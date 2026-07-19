"use strict";

const assert = require("assert");

module.exports = function registerWorkerPoolIntegrationTests(suite, test) {
    const { createWorkerPool, workerPoolErrorCodes } = require("../../../core/runtime");

    function getSampleTaskGraph() {
        return Object.freeze({
            nodes: [
                { stableId: "task_A", displayId: "Task A", dependencies: [] },
                { stableId: "task_B", displayId: "Task B", dependencies: ["task_A"] }
            ]
        });
    }

    function getSampleExecutionState() {
        return Object.freeze({
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

    suite("WorkerPool Integration & Lifecycle (Phase 11B-3B)", () => {
        test("1. Allocates, executes, and releases workers successfully", async () => {
            const config = {
                maxConcurrentWorkers: 1
            };
            let pool = createWorkerPool(config);

            // Verify initial state
            assert.strictEqual(pool.getAvailableWorkers().length, 1);
            assert.strictEqual(pool.getActiveWorkers().length, 0);

            // 1. Allocation
            const allocRes = pool.allocateWorker({ stableId: "task_A" });
            assert.strictEqual(allocRes.success, true);
            pool = allocRes.pool;
            const worker = allocRes.worker;

            assert.strictEqual(worker.status, "ALLOCATED");
            assert.strictEqual(worker.currentTask, "task_A");
            assert.strictEqual(pool.getAvailableWorkers().length, 0);
            assert.strictEqual(pool.getActiveWorkers().length, 1);

            // 2. Execution (Mock execution)
            const executeResult = await pool.executeWorker(worker, {
                contextBuilder: {
                    buildContext: (taskId) => ({ success: true, context: { taskId } })
                },
                aiProviderGateway: {
                    generateResponse: async (context) => ({ success: true, text: `mock-code-${context.taskId}` })
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
            }, {
                vfsState: { files: [] }
            });

            assert.strictEqual(executeResult.success, true);
            assert.strictEqual(executeResult.metadata.taskId, "task_A");

            // 3. Release
            const releaseRes = pool.releaseWorker(worker.workerId);
            assert.strictEqual(releaseRes.success, true);
            pool = releaseRes.pool;

            assert.strictEqual(pool.getAvailableWorkers().length, 1);
            assert.strictEqual(pool.getActiveWorkers().length, 0);
            assert.deepStrictEqual(pool.workers[worker.workerId].completedTasks, ["task_A"]);
        });

        test("2. Rejects duplicate allocations and invalid releases", () => {
            const config = {
                maxConcurrentWorkers: 1
            };
            let pool = createWorkerPool(config);

            const allocRes = pool.allocateWorker({ stableId: "task_A" });
            pool = allocRes.pool;

            // Attempt duplicate allocation (no idle workers left)
            assert.throws(() => {
                pool.allocateWorker({ stableId: "task_B" });
            }, (err) => {
                return err.code === workerPoolErrorCodes.WORKER_POOL_NO_AVAILABLE_WORKERS;
            });

            // Attempt invalid release (non-existent worker ID)
            assert.throws(() => {
                pool.releaseWorker("non_existent_worker");
            }, (err) => {
                return err.code === workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT;
            });
        });
    });
};
