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

module.exports = function registerExecutionPipelineResumeTests(suite, test) {
    const { createExecutionPipeline } = require("../../../core/execution");
    const { createScheduler } = require("../../../core/execution");

    function getSampleTaskGraph() {
        return deepFreeze({
            nodes: [
                { stableId: "task_A", displayId: "Task A", dependencies: [] },
                { stableId: "task_B", displayId: "Task B", dependencies: ["task_A"] }
            ]
        });
    }

    function getSampleWorkerRegistry() {
        return deepFreeze({
            workers: {
                w_01: { workerId: "w_01", status: "IDLE" }
            }
        });
    }

    class MockCheckpointStore {
        constructor(checkpoint) {
            this.checkpoint = checkpoint;
        }
        async load(id) {
            return this.checkpoint;
        }
    }

    suite("Execution Pipeline Resume & Restore Integration (Phase 11B-4B)", () => {
        test("1. Successfully resumes execution, skipping completed task_A", async () => {
            const checkpoint = {
                version: "1.0",
                executionId: "exec_resume_01",
                metadata: {
                    createdAt: new Date().toISOString(),
                    waveNumber: 1
                },
                queues: {
                    pending: ["task_B"],
                    completed: ["task_A"]
                },
                statistics: {
                    totalTasks: 2
                }
            };
            const store = new MockCheckpointStore(checkpoint);

            let executedTasks = [];
            const pipeline = createExecutionPipeline({
                scheduler: createScheduler(),
                contextBuilder: {
                    buildContext: (taskId) => {
                        executedTasks.push(taskId);
                        return { success: true, context: { taskId } };
                    }
                },
                aiProviderGateway: {
                    generateResponse: async (context) => ({ success: true, text: `res-${context.taskId}` })
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

            const initialDummyState = deepFreeze({
                version: "1.0",
                metadata: {
                    status: "READY",
                    executionId: "dummy",
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

            const registry = getSampleWorkerRegistry();
            const graph = getSampleTaskGraph();

            const result = await pipeline.executePipeline(initialDummyState, registry, graph, {
                resumeExecutionId: "exec_resume_01",
                checkpointStore: store,
                vfsState: { files: [] }
            });

            assert.strictEqual(result.success, true);
            // task_A must have been skipped (never in contextBuilder)
            assert.deepStrictEqual(executedTasks, ["task_B"]);
            assert.strictEqual(result.metadata.taskId, "task_B");
        });
    });
};
