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

            let state = executionState;
            if (executionOptions.resumeExecutionId && executionOptions.checkpointStore) {
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

            while (activeScheduler.hasReadyWorkers()) {
                const assignment = activeScheduler.nextWorker();
                executedAny = true;

                // 1. Allocate worker
                let allocRes;
                try {
                    allocRes = activeWorkerPool.allocateWorker({
                        stableId: assignment.taskId
                    });
                } catch (err) {
                    const error = new Error(`Worker allocation failed: ${err.message}`);
                    error.code = "WORKERPOOL_ALLOCATION_FAILED";
                    error.originalError = err;
                    throw error;
                }

                if (!allocRes || !allocRes.success || !allocRes.worker) {
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

                    lastResult = executeResult;

                    if (!executeResult.success) {
                        return deepFreeze(executeResult);
                    }

                    // Mark completed in Scheduler
                    activeScheduler.markCompleted(assignment.workerId);

                } catch (error) {
                    if (
                        error.code === "WORKERPOOL_ALLOCATION_FAILED" ||
                        error.code === "WORKERPOOL_RELEASE_FAILED" ||
                        error.code === "WORKERPOOL_INVALID_STATE" ||
                        error.code === "WORKERPOOL_EXECUTION_FAILED"
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

            if (!executedAny) {
                return deepFreeze({
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
                });
            }

            return deepFreeze(lastResult);
        }
    };

    return Object.freeze(pipeline);
}

module.exports = {
    createExecutionPipeline
};
