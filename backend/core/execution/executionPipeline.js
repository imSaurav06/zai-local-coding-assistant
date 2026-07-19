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

            let activeScheduler = scheduler;
            if (typeof scheduler.initialize !== "function") {
                const { createScheduler } = require("./scheduler");
                const customCompute = typeof scheduler.computeSchedule === "function" ? scheduler.computeSchedule : null;
                activeScheduler = createScheduler(customCompute);
            }

            // 2. Initialize Scheduler
            activeScheduler.initialize(executionState, workerRegistry, taskGraph);

            let currentVfsState = executionOptions.vfsState || {};
            let lastResult = null;
            let executedAny = false;

            while (activeScheduler.hasReadyWorkers()) {
                const assignment = activeScheduler.nextWorker();
                executedAny = true;

                try {
                    // 3. Build context
                    const contextResult = contextBuilder.buildContext(assignment.taskId);
                    if (!contextResult || !contextResult.success) {
                        return deepFreeze({
                            success: false,
                            execution: {
                                schedule: {
                                    readyTasks: [assignment.taskId],
                                    assignments: [assignment],
                                    blockedTasks: [],
                                    metadata: {
                                        availableWorkers: 1,
                                        blockedCount: 0,
                                        readyCount: 1
                                    }
                                }
                            },
                            verification: null,
                            diagnostics: null,
                            metadata: {
                                error: {
                                    code: pipelineErrorCodes.PIPELINE_CONTEXT_ERROR,
                                    message: "ContextBuilder failed to generate context."
                                }
                            }
                        });
                    }

                    // 4. Call AIProviderGateway
                    const providerResult = await aiProviderGateway.generateResponse(contextResult.context);
                    if (!providerResult || !providerResult.success) {
                        return deepFreeze({
                            success: false,
                            execution: {
                                schedule: {
                                    readyTasks: [assignment.taskId],
                                    assignments: [assignment],
                                    blockedTasks: [],
                                    metadata: {
                                        availableWorkers: 1,
                                        blockedCount: 0,
                                        readyCount: 1
                                    }
                                }
                            },
                            verification: null,
                            diagnostics: null,
                            metadata: {
                                error: {
                                    code: pipelineErrorCodes.PIPELINE_PROVIDER_ERROR,
                                    message: "AIProviderGateway call failed."
                                }
                            }
                        });
                    }

                    // 5. Invoke CodingWorker
                    const workerResult = codingWorker.generateFile(providerResult.text, assignment.taskId);
                    if (!workerResult || !workerResult.success) {
                        return deepFreeze({
                            success: false,
                            execution: {
                                schedule: {
                                    readyTasks: [assignment.taskId],
                                    assignments: [assignment],
                                    blockedTasks: [],
                                    metadata: {
                                        availableWorkers: 1,
                                        blockedCount: 0,
                                        readyCount: 1
                                    }
                                }
                            },
                            verification: null,
                            diagnostics: null,
                            metadata: {
                                error: {
                                    code: pipelineErrorCodes.PIPELINE_PROVIDER_ERROR,
                                    message: "CodingWorker failed to compile code."
                                }
                            }
                        });
                    }

                    // 6. Stage changes in VFS
                    const filesToStage = [];
                    if (workerResult.files && Array.isArray(workerResult.files)) {
                        for (const f of workerResult.files) {
                            const pathVal = f.path || f.name;
                            let lang = f.language;
                            if (!lang) {
                                if (pathVal.endsWith(".js") || pathVal.endsWith(".jsx")) lang = "javascript";
                                else if (pathVal.endsWith(".css")) lang = "css";
                                else if (pathVal.endsWith(".html")) lang = "html";
                                else lang = "plaintext";
                            }
                            filesToStage.push({
                                path: pathVal,
                                language: lang,
                                content: f.content,
                                metadata: f.metadata || {}
                            });
                        }
                    } else if (workerResult.file) {
                        const pathVal = workerResult.file.path || workerResult.file.name;
                        let lang = workerResult.file.language;
                        if (!lang) {
                            if (pathVal.endsWith(".js") || pathVal.endsWith(".jsx")) lang = "javascript";
                            else if (pathVal.endsWith(".css")) lang = "css";
                            else if (pathVal.endsWith(".html")) lang = "html";
                            else lang = "plaintext";
                        }
                        filesToStage.push({
                            path: pathVal,
                            language: lang,
                            content: workerResult.file.content,
                            metadata: workerResult.file.metadata || {}
                        });
                    }

                    let vfsResult;
                    if (vfs.createFile) {
                        let currentVfs = currentVfsState;
                        let lastRes = { success: true, vfs: currentVfs };
                        for (const f of filesToStage) {
                            const normalizedPath = (f.path || f.name).replace(/\\/g, "/");
                            const exists = currentVfs.files && currentVfs.files.some(existing => existing.path.replace(/\\/g, "/") === normalizedPath);
                            let res;
                            if (exists && vfs.updateFile) {
                                res = vfs.updateFile(currentVfs, f.path || f.name, f.content);
                            } else {
                                res = vfs.createFile(currentVfs, f);
                            }
                            if (!res.success) {
                                lastRes = res;
                                break;
                            }
                            currentVfs = res.vfs;
                        }
                        if (lastRes.success !== false) {
                            vfsResult = { success: true, vfs: currentVfs };
                        } else {
                            vfsResult = lastRes;
                        }
                    } else if (vfs.stageChanges) {
                        vfsResult = vfs.stageChanges(currentVfsState, filesToStage[0]);
                    } else {
                        vfsResult = { success: true, vfs: currentVfsState, files: filesToStage };
                    }

                    if (!vfsResult || vfsResult.success === false) {
                        return deepFreeze({
                            success: false,
                            execution: {
                                schedule: {
                                    readyTasks: [assignment.taskId],
                                    assignments: [assignment],
                                    blockedTasks: [],
                                    metadata: {
                                        availableWorkers: 1,
                                        blockedCount: 0,
                                        readyCount: 1
                                    }
                                },
                                vfsState: currentVfsState
                            },
                            verification: null,
                            diagnostics: null,
                            metadata: {
                                error: {
                                    code: pipelineErrorCodes.PIPELINE_PROVIDER_ERROR,
                                    message: "VFS staging failed."
                                }
                            }
                        });
                    }

                    currentVfsState = vfsResult.vfs;

                    // 7. Invoke Verification
                    const rawVerifyFiles = (vfsResult.vfs && Array.isArray(vfsResult.vfs.files)) ? vfsResult.vfs.files : (vfsResult.files || filesToStage);
                    const verifyFiles = rawVerifyFiles.map(f => {
                        const nameVal = f.name || f.path || "";
                        const pathVal = f.path || f.name || "";
                        return {
                            ...f,
                            name: nameVal,
                            path: pathVal
                        };
                    });
                    const verificationResult = verification.runVerification(verifyFiles, { projectSpec: executionOptions.projectSpec });
                    const success = !!(verificationResult && (!verificationResult.errors || verificationResult.errors.length === 0));

                    const diagnostics = verificationResult ? (verificationResult.diagnostics || { totalErrors: (verificationResult.errors || []).length }) : null;

                    lastResult = {
                        success,
                        execution: {
                            schedule: {
                                readyTasks: [assignment.taskId],
                                assignments: [assignment],
                                blockedTasks: [],
                                metadata: {
                                    availableWorkers: 1,
                                    blockedCount: 0,
                                    readyCount: 1
                                }
                            },
                            vfsState: currentVfsState
                        },
                        verification: verificationResult,
                        diagnostics,
                        metadata: {
                            taskId: assignment.taskId,
                            workerId: assignment.workerId
                        }
                    };

                    if (!success) {
                        lastResult.metadata.error = {
                            code: pipelineErrorCodes.PIPELINE_VERIFICATION_ERROR,
                            message: "Verification failed with errors."
                        };
                        return deepFreeze(lastResult);
                    }

                    // Mark completed in Scheduler
                    activeScheduler.markCompleted(assignment.workerId);

                } catch (error) {
                    const err = new Error(`Task execution failed: ${error.message}`);
                    err.code = "SCHEDULER_EXECUTION_FAILED";
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
