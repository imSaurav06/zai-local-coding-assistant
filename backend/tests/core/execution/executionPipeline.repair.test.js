"use strict";

const assert = require("assert");
const { createExecutionPipeline } = require("../../../core/execution/executionPipeline");

module.exports = function registerExecutionPipelineRepairTests(suite, test) {
    suite("Execution Pipeline Repair Integration (Phase 11B-5B)", () => {
        test("1. Executes RepairBridge when verification fails and enableRepair is true", async () => {
            let repairCalled = false;

            const mockScheduler = {
                initialize: () => {},
                hasReadyWorkers: () => {
                    // Stop after first assignment
                    return !repairCalled;
                },
                nextWorker: () => ({ workerId: "w1", taskId: "t1" }),
                markCompleted: () => {}
            };

            const mockWorkerPool = {
                allocateWorker: () => ({ success: true, worker: { workerId: "w1" } }),
                executeWorker: async () => ({ success: true, files: [{ name: "index.js", content: "const x = 1;" }] }),
                releaseWorker: () => ({ success: true })
            };

            const mockVerificationBridge = {
                verifyResult: async (res) => ({
                    success: false,
                    files: res.files,
                    verificationReport: { status: "FAILED", errors: [{ path: "index.js", message: "Failed" }] }
                })
            };

            const mockRepairBridge = {
                repairResult: async (res) => {
                    repairCalled = true;
                    return {
                        success: true,
                        files: res.files,
                        repairSession: { attemptNumber: 1, status: "SUCCESS" }
                    };
                }
            };

            const pipeline = createExecutionPipeline({
                scheduler: mockScheduler,
                workerPool: mockWorkerPool,
                verificationBridge: mockVerificationBridge,
                repairBridge: mockRepairBridge
            });

            // Set up valid frozen state
            const state = Object.freeze({
                status: "READY",
                completedTasks: [],
                runningTasks: [],
                failedTasks: [],
                statistics: Object.freeze({ totalTasks: 1, completedCount: 0, runningCount: 0, failedCount: 0 }),
                queues: Object.freeze({ pending: ["t1"], running: [], completed: [], failed: [] })
            });
            const reg = Object.freeze({ workers: Object.freeze({ w1: Object.freeze({ workerId: "w1", status: "IDLE" }) }) });
            const graph = Object.freeze({ nodes: Object.freeze({ t1: Object.freeze({ stableId: "t1", displayId: "t1", dependencies: [] }) }) });

            const result = await pipeline.executePipeline(state, reg, graph, {
                enableVerification: true,
                enableRepair: true
            });

            assert.strictEqual(repairCalled, true);
            assert.strictEqual(result.success, true);
            assert.ok(result.repairSession);
        });
    });
};
