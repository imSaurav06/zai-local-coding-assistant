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

module.exports = function registerSchedulerResumeTests(suite, test) {
    const { createScheduler } = require("../../../core/execution");

    function getRestoredExecutionState() {
        return deepFreeze({
            version: "1.0",
            metadata: {
                status: "READY",
                executionId: "exec_01",
                createdAt: new Date().toISOString()
            },
            queues: {
                pending: ["task_B"],
                running: [],
                completed: ["task_A"],
                failed: []
            },
            statistics: {
                totalTasks: 2,
                pending: 1,
                running: 0,
                completed: 1,
                failed: 0
            }
        });
    }

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

    suite("Scheduler Resume Traversal & Validation (Phase 11B-4B)", () => {
        test("1. Reconstructs correctly from restored state skipping completed tasks", () => {
            const scheduler = createScheduler();
            const state = getRestoredExecutionState();
            const registry = getSampleWorkerRegistry();
            const graph = getSampleTaskGraph();

            scheduler.initialize(state, registry, graph);

            // Verify task_A is skipped and only task_B is scheduled next
            assert.strictEqual(scheduler.hasReadyWorkers(), true);
            const assignment = scheduler.nextWorker();
            assert.strictEqual(assignment.taskId, "task_B");

            scheduler.markCompleted(assignment.workerId);
            assert.strictEqual(scheduler.hasReadyWorkers(), false);
        });
    });
};
