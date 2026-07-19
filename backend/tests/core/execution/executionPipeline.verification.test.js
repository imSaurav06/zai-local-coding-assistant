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

module.exports = function registerExecutionPipelineVerificationTests(suite, test) {
    const { createExecutionPipeline } = require("../../../core/execution");
    const { createScheduler } = require("../../../core/execution");

    function getSampleTaskGraph() {
        return deepFreeze({
            nodes: [
                { stableId: "task_A", displayId: "Task A", dependencies: [] }
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
                pending: ["task_A"],
                running: [],
                completed: [],
                failed: []
            },
            statistics: {
                totalTasks: 1,
                pending: 1,
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

    suite("Execution Pipeline Verification Integration (Phase 11B-5A)", () => {
        test("1. Fails pipeline execution if verification fails", async () => {
            const pipeline = createExecutionPipeline({
                scheduler: createScheduler(),
                contextBuilder: {
                    buildContext: (taskId) => ({ success: true, context: { taskId } })
                },
                aiProviderGateway: {
                    generateResponse: async (context) => ({ success: true, text: `code-for-${context.taskId}` })
                },
                codingWorker: {
                    generateFile: (text, taskId) => ({
                        success: true,
                        // missing README.md will fail structure verifier
                        file: { path: "src/task_A.js", content: text }
                    })
                },
                vfs: {
                    createFile: (vfsState, file) => {
                        const files = [...(vfsState.files || []), file];
                        return { success: true, vfs: { files } };
                    }
                },
                verification: {
                    runVerification: (files) => ({ success: false, errors: ["Missing README.md"] }) // fails verification
                }
            });

            const state = getSampleExecutionState();
            const registry = getSampleWorkerRegistry();
            const graph = getSampleTaskGraph();

            const result = await pipeline.executePipeline(state, registry, graph, {
                enableVerification: true,
                vfsState: { files: [] }
            });

            assert.strictEqual(result.success, false);
            assert.ok(result.verificationReport);
            assert.strictEqual(result.verificationReport.status, "FAILED");
        });
    });
};
