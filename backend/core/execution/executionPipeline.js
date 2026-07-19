"use strict";

const { pipelineErrorCodes } = require("./pipelineErrors");
const { buildContext } = require("../context");
const { runVerification } = require("../verification");

/**
 * Deep freezes an object recursively to guarantee immutability.
 */
function deepFreeze(obj) {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach(prop => {
        if (
            obj.hasOwnProperty(prop) &&
            obj[prop] !== null &&
            (typeof obj[prop] === "object" || typeof obj[prop] === "function") &&
            !Object.isFrozen(obj[prop])
        ) {
            deepFreeze(obj[prop]);
        }
    });
    return obj;
}

/**
 * Creates an ExecutionPipeline coordinator instance with dependency injection options.
 *
 * @param {Object} options Dependency overrides
 */
function createExecutionPipeline(options = {}) {
    const scheduler = options.scheduler || require("./scheduler");
    const workerPool = options.workerPool || require("../runtime/workerPool");
    const verificationBridge = options.verificationBridge || require("../runtime/verificationBridge");
    const repairBridge = options.repairBridge || require("../runtime/repairBridge");
    const contextBuilder = options.contextBuilder || { buildContext };
    const aiProviderGateway = options.aiProviderGateway || {
        generateResponse: async (context) => ({ success: true, text: "default-ai-stub" })
    };
    const codingWorker = options.codingWorker || {
        generateFile: (aiOutput, task) => ({ success: true, file: { path: "src/app.js", content: "const x = 1;" } })
    };
    const vfs = options.vfs || require("../vfs");
    const verification = options.verification || { runVerification };

    const pipeline = {
        /**
         * Orchestrates the execution stages for the first assigned task.
         * Runs: Scheduler -> ContextBuilder -> AIProviderGateway -> CodingWorker -> VFS -> Verification.
         */
        async executePipeline(executionState, workerRegistry, taskGraph, executionOptions = {}) {
            // 1. Input Validation Check
            if (
                executionState === null || executionState === undefined || typeof executionState !== "object" || !Object.isFrozen(executionState) ||
                workerRegistry === null || workerRegistry === undefined || typeof workerRegistry !== "object" || !Object.isFrozen(workerRegistry) ||
                taskGraph === null || taskGraph === undefined || typeof taskGraph !== "object" || !Object.isFrozen(taskGraph)
            ) {
                const err = new Error("Invalid pipeline input: executionState, workerRegistry, and taskGraph must be non-null frozen objects.");
                err.code = pipelineErrorCodes.PIPELINE_INVALID_INPUT;
                throw err;
            }

            const hasMetricsCollector = !!executionOptions.metricsCollector;
            const activeMetricsCollector = executionOptions.metricsCollector || require("../runtime/runtimeMetricsCollector").createMetricsCollector();
            if (!executionOptions.metricsCollector) {
                activeMetricsCollector.startExecution(executionState.metadata ? executionState.metadata.executionId : `exec_${Date.now()}`);
            }

            let state = executionState;
            if (executionOptions.resumeExecutionId && executionOptions.checkpointStore) {
                if (activeMetricsCollector) {
                    activeMetricsCollector.recordResume();
                    activeMetricsCollector.recordCheckpointRestore();
                }
                const { loadCheckpoint } = require("../checkpoint/checkpointRestore");
                state = await loadCheckpoint(executionOptions.resumeExecutionId, executionOptions.checkpointStore, taskGraph);
            }

            let activeScheduler = scheduler;
            if (typeof scheduler.initialize !== "function") {
                const { createScheduler } = require("./scheduler");
                const customCompute = typeof scheduler.computeSchedule === "function" ? scheduler.computeSchedule : null;
                activeScheduler = createScheduler(customCompute);
            }

            // 2. Initialize Scheduler
            activeScheduler.initialize(state, workerRegistry, taskGraph);

            let currentVfsState = executionOptions.vfsState || {};
            let lastResult = null;
            let executedAny = false;

            let activeWorkerPool = workerPool;
            if (typeof workerPool.createWorkerPool === "function") {
                const poolConfig = {
                    maxConcurrentWorkers: 1,
                    workers: Object.values(workerRegistry.workers)
                };
                activeWorkerPool = workerPool.createWorkerPool(poolConfig);
            }

            let activeVerificationBridge = verificationBridge;
            if (typeof verificationBridge.verifyResult !== "function") {
                const { createVerificationBridge } = require("../runtime/verificationBridge");
                activeVerificationBridge = createVerificationBridge({
                    enableVerification: !!executionOptions.enableVerification,
                    verificationEngine: verification
                });
            }

            let activeRepairBridge = repairBridge;
            if (typeof repairBridge.repairResult !== "function") {
                const { createRepairBridge } = require("../runtime/repairBridge");
                activeRepairBridge = createRepairBridge({
                    enableRepair: !!executionOptions.enableRepair,
                    maxRepairAttempts: typeof executionOptions.maxRepairAttempts === "number" ? executionOptions.maxRepairAttempts : 2,
                    verificationEngine: verification
                });
            }

            while (activeScheduler.hasReadyWorkers()) {
                const assignment = activeScheduler.nextWorker();
                executedAny = true;
                if (activeMetricsCollector) {
                    activeMetricsCollector.recordSchedulerDecision();
                }

                // 1. Allocate worker
                let allocRes;
                try {
                    allocRes = activeWorkerPool.allocateWorker({
                        stableId: assignment.taskId
                    });
                    if (activeMetricsCollector) {
                        activeMetricsCollector.recordWorkerAllocation();
                    }
                } catch (err) {
                    if (activeMetricsCollector) {
                        activeMetricsCollector.recordTaskFailed();
                    }
                    const error = new Error(`Worker allocation failed: ${err.message}`);
                    error.code = "WORKERPOOL_ALLOCATION_FAILED";
                    error.originalError = err;
                    throw error;
                }

                if (!allocRes || !allocRes.success || !allocRes.worker) {
                    if (activeMetricsCollector) {
                        activeMetricsCollector.recordTaskFailed();
                    }
                    const err = new Error("Worker allocation failed.");
                    err.code = "WORKERPOOL_ALLOCATION_FAILED";
                    throw err;
                }

                activeWorkerPool = allocRes.pool || activeWorkerPool;
                const allocatedWorker = allocRes.worker;

                try {
                    // 2. Execute worker
                    const executeResult = await activeWorkerPool.executeWorker(allocatedWorker, {
                        contextBuilder,
                        aiProviderGateway,
                        codingWorker,
                        vfs,
                        verification
                    }, {
                        vfsState: currentVfsState,
                        projectSpec: executionOptions.projectSpec
                    });

                    if (activeMetricsCollector) {
                        activeMetricsCollector.recordWorkerExecution();
                    }

                    // 2.5 Invoke Verification Bridge
                    let verifiedResult = await activeVerificationBridge.verifyResult(executeResult, {
                        projectSpec: executionOptions.projectSpec,
                        metricsCollector: activeMetricsCollector
                    });

                    // 2.6 Run Repair Bridge if verification fails and repair is enabled
                    if (!verifiedResult.success && executionOptions.enableRepair) {
                        verifiedResult = await activeRepairBridge.repairResult(verifiedResult, {
                            projectSpec: executionOptions.projectSpec,
                            metricsCollector: activeMetricsCollector
                        });
                    }

                    // 3. Release worker
                    let releaseRes;
                    try {
                        releaseRes = activeWorkerPool.releaseWorker(allocatedWorker.workerId);
                    } catch (err) {
                        const error = new Error(`Worker release failed: ${err.message}`);
                        error.code = "WORKERPOOL_RELEASE_FAILED";
                        error.originalError = err;
                        throw error;
                    }

                    if (!releaseRes || !releaseRes.success) {
                        const err = new Error("Worker release failed.");
                        err.code = "WORKERPOOL_RELEASE_FAILED";
                        throw err;
                    }
                    activeWorkerPool = releaseRes.pool || activeWorkerPool;

                    lastResult = verifiedResult;

                    if (!verifiedResult.success) {
                        if (activeMetricsCollector) {
                            activeMetricsCollector.recordTaskFailed();
                        }
                        return deepFreeze(verifiedResult);
                    }

                    if (activeMetricsCollector) {
                        activeMetricsCollector.recordTaskCompleted();
                    }

                    // Mark completed in Scheduler
                    activeScheduler.markCompleted(assignment.workerId);

                } catch (error) {
                    if (activeMetricsCollector) {
                        activeMetricsCollector.recordTaskFailed();
                    }
                    if (
                        error.code === "WORKERPOOL_ALLOCATION_FAILED" ||
                        error.code === "WORKERPOOL_RELEASE_FAILED" ||
                        error.code === "WORKERPOOL_INVALID_STATE" ||
                        error.code === "WORKERPOOL_EXECUTION_FAILED" ||
                        error.code === "VERIFICATION_ENGINE_FAILED" ||
                        error.code === "VERIFICATION_REPORT_INVALID" ||
                        error.code === "VERIFICATION_CONFIGURATION_INVALID" ||
                        error.code === "REPAIR_ENGINE_FAILED" ||
                        error.code === "REPAIR_SESSION_INVALID" ||
                        error.code === "REPAIR_MAX_ATTEMPTS_EXCEEDED" ||
                        error.code === "REPAIR_RESULT_INVALID"
                    ) {
                        throw error;
                    }
                    const err = new Error(`Worker execution failed: ${error.message}`);
                    err.code = "WORKERPOOL_EXECUTION_FAILED";
                    err.originalError = error;
                    throw err;
                }

                // Serial execution logic: execute one step per executePipeline call
                break;
            }

            if (!executionOptions.metricsCollector) {
                activeMetricsCollector.endExecution();
            }

            const metricsSnapshot = activeMetricsCollector.getSnapshot();

            if (!executedAny) {
                const res = {
                    success: true,
                    execution: {
                        schedule: {
                            readyTasks: [],
                            assignments: [],
                            blockedTasks: [],
                            metadata: {
                                availableWorkers: 0,
                                blockedCount: 0,
                                readyCount: 0
                            }
                        },
                        vfsState: currentVfsState
                    },
                    verification: null,
                    diagnostics: null,
                    metadata: { message: "No assignments computed by Scheduler." }
                };
                if (hasMetricsCollector) {
                    res.metricsSnapshot = metricsSnapshot;
                }
                return deepFreeze(res);
            }

            const resultWithMetrics = {
                ...lastResult
            };
            if (hasMetricsCollector) {
                resultWithMetrics.metricsSnapshot = metricsSnapshot;
            }

            return deepFreeze(resultWithMetrics);
        }
    };

    return Object.freeze(pipeline);
}

module.exports = {
    createExecutionPipeline
};
