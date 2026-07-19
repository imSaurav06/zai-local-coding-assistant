"use strict";

const assert = require("assert");

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

module.exports = function registerExecutionPipelineTests(suite, test) {
    const { createExecutionPipeline, pipelineErrorCodes } = require("../../../core/execution");
    const { createScheduler } = require("../../../core/execution");

    function getSampleTaskGraph() {
        return deepFreeze({
            nodes: [
                { stableId: "task_A", displayId: "Task A", dependencies: [] },
                { stableId: "task_B", displayId: "Task B", dependencies: ["task_A"] }
            ]
        });
    }

    function getSampleExecutionState() {
        return deepFreeze({
            version: "1.0",
            metadata: {
                status: "READY",
                executionId: "exec_01",
                createdAt: new Date().toISOString()
            },
            queues: {
                pending: ["task_A", "task_B"],
                running: [],
                completed: [],
                failed: []
            },
            statistics: {
                totalTasks: 2,
                pending: 2,
                running: 0,
                completed: 0,
                failed: 0
            }
        });
    }

    function getSampleWorkerRegistry() {
        return deepFreeze({
            workers: {
                w_01: { workerId: "w_01", status: "IDLE" }
            }
        });
    }

    suite("Execution Pipeline Scheduler Traversal (Phase 11B-3A)", () => {
        test("1. executePipeline traverses tasks in correct serial order using the Scheduler", async () => {
            const scheduler = createScheduler();
            const pipeline = createExecutionPipeline({
                scheduler,
                contextBuilder: {
                    buildContext: (taskId) => ({ success: true, context: { taskId } })
                },
                aiProviderGateway: {
                    generateResponse: async (context) => ({ success: true, text: `code-for-${context.taskId}` })
                },
                codingWorker: {
                    generateFile: (text, taskId) => ({
                        success: true,
                        file: { path: `src/${taskId}.js`, content: text }
                    })
                },
                vfs: {
                    createFile: (vfsState, file) => {
                        const files = [...(vfsState.files || []), file];
                        return { success: true, vfs: { files } };
                    }
                },
                verification: {
                    runVerification: (files) => ({ success: true, errors: [] })
                }
            });

            const state = getSampleExecutionState();
            const registry = getSampleWorkerRegistry();
            const graph = getSampleTaskGraph();

            // Run first task (task_A)
            const result1 = await pipeline.executePipeline(state, registry, graph, {
                vfsState: { files: [] }
            });

            assert.strictEqual(result1.success, true);
            assert.strictEqual(result1.metadata.taskId, "task_A");
            assert.strictEqual(result1.execution.vfsState.files.length, 1);
            assert.strictEqual(result1.execution.vfsState.files[0].path, "src/task_A.js");

            // Update state representing completion of task_A
            const stateAfterA = deepFreeze({
                ...state,
                queues: {
                    ...state.queues,
                    pending: ["task_B"],
                    completed: ["task_A"]
                }
            });

            // Run second task (task_B)
            const result2 = await pipeline.executePipeline(stateAfterA, registry, graph, {
                vfsState: result1.execution.vfsState
            });

            assert.strictEqual(result2.success, true);
            assert.strictEqual(result2.metadata.taskId, "task_B");
            assert.strictEqual(result2.execution.vfsState.files.length, 2);
            assert.strictEqual(result2.execution.vfsState.files[1].path, "src/task_B.js");
        });

        test("2. Returns success: false with verification error details on verification failure", async () => {
            const scheduler = createScheduler();
            const pipeline = createExecutionPipeline({
                scheduler,
                contextBuilder: {
                    buildContext: (taskId) => ({ success: true, context: { taskId } })
                },
                aiProviderGateway: {
                    generateResponse: async (context) => ({ success: true, text: `code-for-${context.taskId}` })
                },
                codingWorker: {
                    generateFile: (text, taskId) => ({
                        success: true,
                        file: { path: `src/${taskId}.js`, content: text }
                    })
                },
                vfs: {
                    createFile: (vfsState, file) => {
                        const files = [...(vfsState.files || []), file];
                        return { success: true, vfs: { files } };
                    }
                },
                verification: {
                    runVerification: (files) => ({ success: false, errors: ["Lint error"] }) // fails verification
                }
            });

            const state = getSampleExecutionState();
            const registry = getSampleWorkerRegistry();
            const graph = getSampleTaskGraph();

            const result = await pipeline.executePipeline(state, registry, graph, {
                vfsState: { files: [] }
            });

            assert.strictEqual(result.success, false);
            assert.strictEqual(result.metadata.error.code, pipelineErrorCodes.PIPELINE_VERIFICATION_ERROR);
        });

        test("3. Throws WORKERPOOL_EXECUTION_FAILED on unexpected exception", async () => {
            const scheduler = createScheduler();
            const pipeline = createExecutionPipeline({
                scheduler,
                contextBuilder: {
                    buildContext: (taskId) => {
                        throw new Error("Disk full");
                    }
                }
            });

            const state = getSampleExecutionState();
            const registry = getSampleWorkerRegistry();
            const graph = getSampleTaskGraph();

            await assert.rejects(async () => {
                await pipeline.executePipeline(state, registry, graph, {
                    vfsState: { files: [] }
                });
            }, (err) => {
                return err.code === "WORKERPOOL_EXECUTION_FAILED";
            });
        });

        test("4. Integrates with workerPool to allocate, execute, and release worker", async () => {
            const scheduler = createScheduler();
            let allocated = false;
            let executed = false;
            let released = false;
            const mockWorkerPoolInstance = {
                allocateWorker: (task) => {
                    allocated = true;
                    return { success: true, worker: { workerId: "w_01", status: "ALLOCATED", currentTask: task.stableId } };
                },
                executeWorker: async (worker, deps, opts) => {
                    executed = true;
                    return { success: true, success: true, metadata: { taskId: worker.currentTask } };
                },
                releaseWorker: (workerId) => {
                    released = true;
                    return { success: true };
                }
            };
            const pipeline = createExecutionPipeline({
                scheduler,
                workerPool: mockWorkerPoolInstance
            });

            const state = getSampleExecutionState();
            const registry = getSampleWorkerRegistry();
            const graph = getSampleTaskGraph();

            const result = await pipeline.executePipeline(state, registry, graph, {
                vfsState: { files: [] }
            });

            assert.strictEqual(result.success, true);
            assert.strictEqual(allocated, true);
            assert.strictEqual(executed, true);
            assert.strictEqual(released, true);
        });
    });
};
