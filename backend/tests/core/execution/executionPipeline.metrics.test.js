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

module.exports = function registerPipelineMetricsTests(suite, test) {
    const { createExecutionPipeline, createExecutionState, createWorkerRegistry } = require("../../../core/execution");
    const { createMetricsCollector, isMetricsSnapshot } = require("../../../core/runtime");

    suite("Execution Pipeline Metrics Integration", () => {
        test("successfully collects metrics during sequential pipeline execution", async () => {
            const taskNode = {
                stableId: "task_01",
                displayId: 1,
                kind: "backend",
                semanticKey: "backend",
                status: "PENDING",
                dependencies: [],
                dependents: [],
                metadata: {},
                payload: {}
            };

            const taskGraph = deepFreeze({
                graphVersion: "1.0",
                metadata: {
                    graphVersion: "1.0",
                    identityVersion: "1.0",
                    createdBy: "test",
                    totalNodes: 1
                },
                nodes: [taskNode]
            });

            const stateRes = createExecutionState(taskGraph);
            assert.strictEqual(stateRes.success, true, `ExecutionState creation failed: ${JSON.stringify(stateRes.errors)}`);
            const registry = createWorkerRegistry().create("w1").registry;

            const scheduler = {
                initialize() {},
                hasReadyWorkers() { return this.has; },
                nextWorker() {
                    this.has = false;
                    return { taskId: "task_01", workerId: "w1" };
                },
                markCompleted() {},
                computeSchedule() { return { assignments: [{ taskId: "task_01", workerId: "w1" }] }; },
                has: true
            };

            const mockContextBuilder = {
                buildContext(taskId) { return { success: true, context: { taskId } }; }
            };

            const mockGateway = {
                generateResponse: async (context) => ({ success: true, text: `code-for-${context.taskId}` })
            };

            const mockWorker = {
                generateFile: (text, taskId) => ({
                    success: true,
                    file: { path: `src/${taskId}.js`, content: text }
                })
            };

            const mockVfs = {
                createFile: (vfsState, file) => {
                    const files = [...(vfsState.files || []), file];
                    return { success: true, vfs: { files } };
                }
            };

            const mockVerification = {
                runVerification() {
                    return { success: true, errors: [], warnings: [] };
                }
            };

            const pipeline = createExecutionPipeline({
                scheduler,
                contextBuilder: mockContextBuilder,
                aiProviderGateway: mockGateway,
                codingWorker: mockWorker,
                vfs: mockVfs,
                verification: mockVerification
            });

            const metricsCollector = createMetricsCollector();
            metricsCollector.startExecution("exec_pipeline_test");

            const frozenState = deepFreeze(stateRes.executionState);
            const frozenRegistry = deepFreeze(registry);
            const frozenGraph = deepFreeze(taskGraph);

            const result = await pipeline.executePipeline(frozenState, frozenRegistry, frozenGraph, {
                enableVerification: true,
                metricsCollector
            });

            metricsCollector.endExecution();
            const snapshot = metricsCollector.getSnapshot();

            assert.strictEqual(result.success, true);
            assert.ok(isMetricsSnapshot(snapshot));
            assert.strictEqual(snapshot.executionId, "exec_pipeline_test");
            assert.strictEqual(snapshot.scheduler.decisions, 1);
            assert.strictEqual(snapshot.workerPool.allocationCount, 1);
            assert.strictEqual(snapshot.workerPool.executionCount, 1);
            assert.strictEqual(snapshot.verification.runs, 1);
            assert.strictEqual(snapshot.verification.failures, 0);
            assert.strictEqual(snapshot.statistics.tasksCompleted, 1);
            assert.strictEqual(snapshot.statistics.tasksFailed, 0);
        });
    });
};
