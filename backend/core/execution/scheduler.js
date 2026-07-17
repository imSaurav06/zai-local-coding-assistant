"use strict";

const { schedulerErrorCodes } = require("./schedulerErrors");

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
 * Validates the inputs to computeSchedule. Throws structured errors with specific codes if invalid.
 */
function validateInputs(executionState, workerRegistry, taskGraph) {
    // 1. Validate executionState
    if (
        executionState === null ||
        executionState === undefined ||
        typeof executionState !== "object" ||
        Array.isArray(executionState)
    ) {
        const err = new Error("Invalid executionState: must be a non-null object.");
        err.code = schedulerErrorCodes.SCHEDULER_INVALID_STATE;
        throw err;
    }
    if (!Object.isFrozen(executionState)) {
        const err = new Error("Invalid executionState: must be frozen.");
        err.code = schedulerErrorCodes.SCHEDULER_INVALID_STATE;
        throw err;
    }
    if (!executionState.queues || typeof executionState.queues !== "object" || Array.isArray(executionState.queues)) {
        const err = new Error("Invalid executionState: missing queues object.");
        err.code = schedulerErrorCodes.SCHEDULER_INVALID_STATE;
        throw err;
    }
    const requiredQueues = ["pending", "running", "completed", "failed"];
    for (const q of requiredQueues) {
        if (!Array.isArray(executionState.queues[q])) {
            const err = new Error(`Invalid executionState: queues.${q} must be an array.`);
            err.code = schedulerErrorCodes.SCHEDULER_INVALID_STATE;
            throw err;
        }
    }

    // 2. Validate workerRegistry
    if (
        workerRegistry === null ||
        workerRegistry === undefined ||
        typeof workerRegistry !== "object" ||
        Array.isArray(workerRegistry)
    ) {
        const err = new Error("Invalid workerRegistry: must be a non-null object.");
        err.code = schedulerErrorCodes.SCHEDULER_INVALID_WORKER;
        throw err;
    }
    if (!Object.isFrozen(workerRegistry)) {
        const err = new Error("Invalid workerRegistry: must be frozen.");
        err.code = schedulerErrorCodes.SCHEDULER_INVALID_WORKER;
        throw err;
    }
    if (!workerRegistry.workers || typeof workerRegistry.workers !== "object" || Array.isArray(workerRegistry.workers)) {
        const err = new Error("Invalid workerRegistry: missing workers object.");
        err.code = schedulerErrorCodes.SCHEDULER_INVALID_WORKER;
        throw err;
    }

    // 3. Validate taskGraph
    if (
        taskGraph === null ||
        taskGraph === undefined ||
        typeof taskGraph !== "object" ||
        Array.isArray(taskGraph)
    ) {
        const err = new Error("Invalid taskGraph: must be a non-null object.");
        err.code = schedulerErrorCodes.SCHEDULER_INVALID_INPUT;
        throw err;
    }
    if (!Object.isFrozen(taskGraph)) {
        const err = new Error("Invalid taskGraph: must be frozen.");
        err.code = schedulerErrorCodes.SCHEDULER_INVALID_INPUT;
        throw err;
    }
    if (!Array.isArray(taskGraph.nodes)) {
        const err = new Error("Invalid taskGraph: missing nodes array.");
        err.code = schedulerErrorCodes.SCHEDULER_INVALID_INPUT;
        throw err;
    }
}

/**
 * Computes a new immutable schedule decision based on execution state, worker registry, and task graph.
 *
 * @param {Object} executionState Current frozen executionState
 * @param {Object} workerRegistry Current frozen workerRegistry
 * @param {Object} taskGraph Current frozen taskGraph
 */
function computeSchedule(executionState, workerRegistry, taskGraph) {
    // 1. Validate inputs
    validateInputs(executionState, workerRegistry, taskGraph);

    // Map graph nodes by stableId for fast O(1) lookup
    const nodeMap = new Map();
    for (const node of taskGraph.nodes) {
        nodeMap.set(node.stableId, node);
    }

    // 2. Validate all state queues' tasks exist in the taskGraph (dependency resolution verification)
    const allStateTaskIds = [
        ...executionState.queues.pending,
        ...executionState.queues.running,
        ...executionState.queues.completed,
        ...executionState.queues.failed
    ];

    for (const taskId of allStateTaskIds) {
        if (!nodeMap.has(taskId)) {
            const err = new Error(`Task ID '${taskId}' in execution state does not exist in the TaskGraph.`);
            err.code = schedulerErrorCodes.SCHEDULER_DEPENDENCY_ERROR;
            throw err;
        }
    }

    // 3. Run Ready Node Rule
    const completedSet = new Set(executionState.queues.completed);
    const pendingTasks = executionState.queues.pending;

    const readyTasks = [];
    const blockedTasks = [];

    for (const taskId of pendingTasks) {
        const node = nodeMap.get(taskId);

        // Check node's dependencies references are valid and completed
        let isReady = true;
        for (const depId of node.dependencies) {
            if (!nodeMap.has(depId)) {
                const err = new Error(`Task '${taskId}' depends on non-existent task '${depId}'.`);
                err.code = schedulerErrorCodes.SCHEDULER_DEPENDENCY_ERROR;
                throw err;
            }
            if (!completedSet.has(depId)) {
                isReady = false;
            }
        }

        if (isReady) {
            readyTasks.push(taskId);
        } else {
            blockedTasks.push(taskId);
        }
    }

    // 4. Sort ready tasks by displayId ascending to guarantee determinism
    readyTasks.sort((a, b) => {
        const nodeA = nodeMap.get(a);
        const nodeB = nodeMap.get(b);
        return nodeA.displayId.localeCompare(nodeB.displayId);
    });

    // 5. Gather available workers (must be in status IDLE only)
    const idleWorkers = Object.values(workerRegistry.workers)
        .filter(w => w.status === "IDLE");

    // Sort idle workers alphabetically by workerId for determinism
    idleWorkers.sort((a, b) => a.workerId.localeCompare(b.workerId));

    // 6. Respect ADR-006 Parallelism limit
    // Count active workers (assigned or running)
    const activeWorkersCount = Object.values(workerRegistry.workers)
        .filter(w => w.status === "ASSIGNED" || w.status === "RUNNING")
        .length;

    const maxConcurrent = 3; // ADR-006 limit
    const availableSlots = Math.max(0, maxConcurrent - activeWorkersCount);

    // 7. Allocation decisions
    const assignments = [];
    const numToAssign = Math.min(readyTasks.length, idleWorkers.length, availableSlots);

    for (let i = 0; i < numToAssign; i++) {
        assignments.push({
            workerId: idleWorkers[i].workerId,
            taskId: readyTasks[i]
        });
    }

    const schedule = {
        readyTasks,
        assignments,
        blockedTasks,
        metadata: {
            availableWorkers: idleWorkers.length,
            blockedCount: blockedTasks.length,
            readyCount: readyTasks.length
        }
    };

    return deepFreeze(schedule);
}

/**
 * Creates the scheduler instance.
 */
function createScheduler() {
    return deepFreeze({
        computeSchedule
    });
}

module.exports = {
    createScheduler,
    computeSchedule
};
