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

            // 2. Call Scheduler
            const schedule = scheduler.computeSchedule(executionState, workerRegistry, taskGraph);
            if (!schedule || !schedule.assignments || schedule.assignments.length === 0) {
                // No work to perform
                return deepFreeze({
                    success: true,
                    execution: { schedule },
                    verification: null,
                    diagnostics: null,
                    metadata: { message: "No assignments computed by Scheduler." }
                });
            }

            const assignment = schedule.assignments[0];

            try {
                // 3. Build context
                const contextResult = contextBuilder.buildContext(assignment.taskId);
                if (!contextResult || !contextResult.success) {
                    return deepFreeze({
                        success: false,
                        execution: { schedule },
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
                        execution: { schedule },
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
                        execution: { schedule },
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
                const vfsState = executionOptions.vfsState || {};
                const vfsFile = {
                    path: workerResult.file.path || workerResult.file.name,
                    content: workerResult.file.content,
                    metadata: workerResult.file.metadata || {}
                };

                let vfsResult;
                if (vfs.createFile) {
                    vfsResult = vfs.createFile(vfsState, vfsFile);
                } else if (vfs.stageChanges) {
                    vfsResult = vfs.stageChanges(vfsState, vfsFile);
                } else {
                    vfsResult = { success: true, vfs: vfsState, files: [vfsFile] };
                }

                if (!vfsResult || vfsResult.success === false) {
                    return deepFreeze({
                        success: false,
                        execution: { schedule },
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

                // 7. Invoke Verification
                const verifyFiles = (vfsResult.vfs && Array.isArray(vfsResult.vfs.files)) ? vfsResult.vfs.files : (vfsResult.files || [vfsFile]);
                const verificationResult = verification.runVerification(verifyFiles, { projectSpec: executionOptions.projectSpec });
                const success = !!(verificationResult && (!verificationResult.errors || verificationResult.errors.length === 0));

                const diagnostics = verificationResult ? (verificationResult.diagnostics || { totalErrors: (verificationResult.errors || []).length }) : null;

                const result = {
                    success,
                    execution: { schedule },
                    verification: verificationResult,
                    diagnostics,
                    metadata: {
                        taskId: assignment.taskId,
                        workerId: assignment.workerId
                    }
                };

                if (!success) {
                    result.metadata.error = {
                        code: pipelineErrorCodes.PIPELINE_VERIFICATION_ERROR,
                        message: "Verification failed with errors."
                    };
                }

                return deepFreeze(result);

            } catch (error) {
                return deepFreeze({
                    success: false,
                    execution: { schedule },
                    verification: null,
                    diagnostics: null,
                    metadata: {
                        error: {
                            code: error.code || pipelineErrorCodes.PIPELINE_PROVIDER_ERROR,
                            message: `Internal pipeline exception: ${error.message}`
                        }
                    }
                });
            }
        }
    };

    return Object.freeze(pipeline);
}

module.exports = {
    createExecutionPipeline
};
