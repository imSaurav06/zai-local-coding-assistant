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

module.exports = function registerSchedulerIntegrationTests(suite, test) {
    const { createScheduler, schedulerErrorCodes } = require("../../../core/execution");

    function getSampleTaskGraph() {
        return deepFreeze({
            nodes: [
                { stableId: "task_A", displayId: "Task A", dependencies: [] },
                { stableId: "task_B", displayId: "Task B", dependencies: ["task_A"] },
                { stableId: "task_C", displayId: "Task C", dependencies: ["task_A"] },
                { stableId: "task_D", displayId: "Task D", dependencies: ["task_B", "task_C"] }
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
                pending: ["task_A", "task_B", "task_C", "task_D"],
                running: [],
                completed: [],
                failed: []
            },
            statistics: {
                totalTasks: 4,
                pending: 4,
                running: 0,
                completed: 0,
                failed: 0
            }
        });
    }

    function getSampleWorkerRegistry() {
        return deepFreeze({
            workers: {
                w_01: { workerId: "w_01", status: "IDLE" },
                w_02: { workerId: "w_02", status: "IDLE" }
            }
        });
    }

    suite("Scheduler Stateful Traversal & Validation (Phase 11B-3A)", () => {
        // ── 1. Rejections ──
        test("1. Rejects missing dependencies with SCHEDULER_INVALID_GRAPH", () => {
            const graph = deepFreeze({
                nodes: [
                    { stableId: "task_A", displayId: "Task A", dependencies: ["non_existent"] }
                ]
            });
            const scheduler = createScheduler();
            assert.throws(() => {
                scheduler.initialize(getSampleExecutionState(), getSampleWorkerRegistry(), graph);
            }, (err) => {
                return err.code === schedulerErrorCodes.SCHEDULER_INVALID_GRAPH;
            });
        });

        test("2. Rejects circular dependencies with SCHEDULER_CIRCULAR_DEPENDENCY", () => {
            const graph = deepFreeze({
                nodes: [
                    { stableId: "task_A", displayId: "Task A", dependencies: ["task_B"] },
                    { stableId: "task_B", displayId: "Task B", dependencies: ["task_A"] }
                ]
            });
            const scheduler = createScheduler();
            assert.throws(() => {
                scheduler.initialize(getSampleExecutionState(), getSampleWorkerRegistry(), graph);
            }, (err) => {
                return err.code === schedulerErrorCodes.SCHEDULER_CIRCULAR_DEPENDENCY;
            });
        });

        test("3. Rejects duplicate worker IDs with SCHEDULER_INVALID_WORKER", () => {
            const graph = getSampleTaskGraph();
            const registry = deepFreeze({
                workers: {
                    w_01: { workerId: "w_01", status: "IDLE" },
                    w_dup: { workerId: "w_01", status: "IDLE" } // duplicate workerId
                }
            });
            const scheduler = createScheduler();
            assert.throws(() => {
                scheduler.initialize(getSampleExecutionState(), registry, graph);
            }, (err) => {
                return err.code === schedulerErrorCodes.SCHEDULER_INVALID_WORKER;
            });
        });

        // ── 2. Deterministic execution order & scheduling flow ──
        test("4. Schedules tasks in correct dependency-resolved order", () => {
            const graph = getSampleTaskGraph();
            const scheduler = createScheduler();
            scheduler.initialize(getSampleExecutionState(), getSampleWorkerRegistry(), graph);

            // Step 1: Task A should be ready (no dependencies)
            assert.strictEqual(scheduler.hasReadyWorkers(), true);
            const assignmentA = scheduler.nextWorker();
            assert.strictEqual(assignmentA.taskId, "task_A");
            
            // Mark completed
            scheduler.markCompleted(assignmentA.workerId);

            // Step 2: Task B and Task C should be ready (both depend on Task A).
            // They should be sorted alphabetically by displayId.
            // Task B (displayId: "Task B") vs Task C (displayId: "Task C").
            // "Task B" comes before "Task C", so Task B should be next.
            assert.strictEqual(scheduler.hasReadyWorkers(), true);
            const assignmentB = scheduler.nextWorker();
            assert.strictEqual(assignmentB.taskId, "task_B");
            scheduler.markCompleted(assignmentB.workerId);

            // Step 3: Task C should be next
            assert.strictEqual(scheduler.hasReadyWorkers(), true);
            const assignmentC = scheduler.nextWorker();
            assert.strictEqual(assignmentC.taskId, "task_C");
            scheduler.markCompleted(assignmentC.workerId);

            // Step 4: Task D should be next (since B and C are completed)
            assert.strictEqual(scheduler.hasReadyWorkers(), true);
            const assignmentD = scheduler.nextWorker();
            assert.strictEqual(assignmentD.taskId, "task_D");
            scheduler.markCompleted(assignmentD.workerId);

            // Step 5: None ready left
            assert.strictEqual(scheduler.hasReadyWorkers(), false);
        });

        // ── 3. Invalid order rejections ──
        test("5. Throws SCHEDULER_INVALID_ORDER when completing a non-existent active worker", () => {
            const graph = getSampleTaskGraph();
            const scheduler = createScheduler();
            scheduler.initialize(getSampleExecutionState(), getSampleWorkerRegistry(), graph);

            assert.throws(() => {
                scheduler.markCompleted("w_01");
            }, (err) => {
                return err.code === schedulerErrorCodes.SCHEDULER_INVALID_ORDER;
            });
        });
    });
};
