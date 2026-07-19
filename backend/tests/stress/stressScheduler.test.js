"use strict";

const assert = require("assert");

module.exports = function registerStressSchedulerTests(suite, test) {
    const { createScheduler } = require("../../core/execution/scheduler");
    const { createExecutionState, createWorkerRegistry } = require("../../core/execution");

    function makeFrozen(obj) {
        if (obj && typeof obj === 'object') {
            if (!Object.isFrozen(obj)) {
                Object.freeze(obj);
            }
            for (const k of Object.getOwnPropertyNames(obj)) {
                makeFrozen(obj[k]);
            }
        }
        return obj;
    }

    suite("Stress Scheduler Validation (Phase 11B-7B)", () => {

        test("1. Schedule thousands of independent tasks efficiently", () => {
            const scheduler = createScheduler();
            const nodes = [];
            
            for (let i = 0; i < 1000; i++) {
                nodes.push({
                    stableId: `task_${i}`,
                    displayId: String(i),
                    kind: "backend",
                    semanticKey: `backend_${i}`,
                    status: "PENDING",
                    dependencies: [],
                    dependents: [],
                    metadata: {},
                    payload: {}
                });
            }

            const taskGraph = makeFrozen({
                graphVersion: "1.0",
                metadata: {
                    graphVersion: "1.0",
                    identityVersion: "1.0",
                    createdBy: "test",
                    totalNodes: 1000
                },
                nodes
            });
            const stateRes = createExecutionState(taskGraph);
            assert.strictEqual(stateRes.success, true);
            const state = stateRes.executionState;
            const registry = createWorkerRegistry().create("w1").registry;

            const startTime = Date.now();
            const schedule = scheduler.computeSchedule(state, registry, taskGraph);
            const duration = Date.now() - startTime;

            assert.ok(schedule);
            assert.ok(duration < 200, `Scheduling took too long: ${duration}ms`);
            assert.ok(schedule.assignments.length > 0);
            assert.ok(Object.isFrozen(schedule));
        });

        test("2. Schedule long linear execution dependency chain successfully", () => {
            const scheduler = createScheduler();
            const nodes = [];
            const edges = [];
            const chainLength = 100;

            for (let i = 0; i < chainLength; i++) {
                nodes.push({
                    stableId: `task_${i}`,
                    displayId: String(i),
                    kind: "backend",
                    semanticKey: `backend_${i}`,
                    status: "PENDING",
                    dependencies: i > 0 ? [`task_${i - 1}`] : [],
                    dependents: i < chainLength - 1 ? [`task_${i + 1}`] : [],
                    metadata: {},
                    payload: {}
                });
                if (i > 0) {
                    edges.push({
                        source: `task_${i - 1}`,
                        target: `task_${i}`
                    });
                }
            }

            const taskGraph = makeFrozen({
                graphVersion: "1.0",
                metadata: {
                    graphVersion: "1.0",
                    identityVersion: "1.0",
                    createdBy: "test",
                    totalNodes: chainLength
                },
                nodes,
                edges
            });
            const stateRes = createExecutionState(taskGraph);
            assert.strictEqual(stateRes.success, true);
            const rawState = stateRes.executionState;

            // Manually modify executionState to reflect task_0 is completed
            const state = makeFrozen({
                ...rawState,
                queues: {
                    pending: rawState.queues.pending.filter(id => id !== "task_0"),
                    running: [],
                    completed: ["task_0"],
                    failed: []
                },
                statistics: {
                    ...rawState.statistics,
                    pending: rawState.statistics.pending - 1,
                    completed: 1
                }
            });

            const registry = createWorkerRegistry().create("w1").registry;

            const schedule = scheduler.computeSchedule(state, registry, taskGraph);
            assert.ok(schedule);
            // Only task_1 is ready, since task_0 is completed and task_1 depends on task_0
            assert.strictEqual(schedule.assignments.length, 1);
            assert.strictEqual(schedule.assignments[0].taskId, "task_1");
        });

        test("3. Scheduler handles zero tasks gracefully", () => {
            const scheduler = createScheduler();
            const taskGraph = makeFrozen({
                graphVersion: "1.0",
                metadata: {
                    graphVersion: "1.0",
                    identityVersion: "1.0",
                    createdBy: "test",
                    totalNodes: 0
                },
                nodes: []
            });
            const stateRes = createExecutionState(taskGraph);
            assert.strictEqual(stateRes.success, true);
            const state = stateRes.executionState;
            const registry = createWorkerRegistry().create("w1").registry;

            const schedule = scheduler.computeSchedule(state, registry, taskGraph);
            assert.ok(schedule);
            assert.strictEqual(schedule.assignments.length, 0);
        });

        test("4. Scheduler detects circular dependencies and rejects during state creation", () => {
            const taskGraph = makeFrozen({
                graphVersion: "1.0",
                metadata: {
                    graphVersion: "1.0",
                    identityVersion: "1.0",
                    createdBy: "test",
                    totalNodes: 2
                },
                nodes: [
                    {
                        stableId: "task_1",
                        displayId: "1",
                        kind: "backend",
                        semanticKey: "backend_1",
                        status: "PENDING",
                        dependencies: ["task_2"],
                        dependents: ["task_2"],
                        metadata: {},
                        payload: {}
                    },
                    {
                        stableId: "task_2",
                        displayId: "2",
                        kind: "backend",
                        semanticKey: "backend_2",
                        status: "PENDING",
                        dependencies: ["task_1"],
                        dependents: ["task_1"],
                        metadata: {},
                        payload: {}
                    }
                ],
                edges: [
                    { source: "task_1", target: "task_2" },
                    { source: "task_2", target: "task_1" }
                ]
            });

            const stateRes = createExecutionState(taskGraph);
            assert.strictEqual(stateRes.success, false);
            assert.ok(stateRes.errors.length > 0);
        });
    });
};
