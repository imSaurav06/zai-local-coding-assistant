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
function createScheduler(customComputeSchedule) {
    const activeCompute = customComputeSchedule || computeSchedule;
    let internalState = null;
    let internalRegistry = null;
    let internalGraph = null;
    const runningAssignments = new Map();
    let pendingTasks = [];
    let completedTasks = [];

    function initialize(executionState, workerRegistry, taskGraph) {
        validateInputs(executionState, workerRegistry, taskGraph);

        // Map graph nodes by stableId for fast O(1) lookup
        const nodeMap = new Map();
        for (const node of taskGraph.nodes) {
            if (nodeMap.has(node.stableId)) {
                const err = new Error(`Duplicate task ID: ${node.stableId}`);
                err.code = schedulerErrorCodes.SCHEDULER_INVALID_GRAPH;
                throw err;
            }
            nodeMap.set(node.stableId, node);
        }

        // Build adjacency list and validate dependencies existence
        const adj = new Map();
        for (const node of taskGraph.nodes) {
            adj.set(node.stableId, []);
            for (const depId of node.dependencies) {
                if (!nodeMap.has(depId)) {
                    const err = new Error(`Task '${node.stableId}' depends on non-existent task '${depId}'.`);
                    err.code = schedulerErrorCodes.SCHEDULER_INVALID_GRAPH;
                    throw err;
                }
                adj.get(node.stableId).push(depId);
            }
        }

        // Circular dependency check (DFS cycle detection)
        const visited = new Map();
        for (const node of taskGraph.nodes) {
            visited.set(node.stableId, 0); // 0 = unvisited
        }

        function hasCycle(u) {
            visited.set(u, 1); // 1 = visiting
            for (const v of adj.get(u)) {
                if (visited.get(v) === 1) {
                    return true;
                }
                if (visited.get(v) === 0) {
                    if (hasCycle(v)) return true;
                }
            }
            visited.set(u, 2); // 2 = visited
            return false;
        }

        for (const node of taskGraph.nodes) {
            if (visited.get(node.stableId) === 0) {
                if (hasCycle(node.stableId)) {
                    const err = new Error("Circular dependency detected in task graph.");
                    err.code = schedulerErrorCodes.SCHEDULER_CIRCULAR_DEPENDENCY;
                    throw err;
                }
            }
        }

        // Validate duplicate worker IDs in registry
        const seenWorkers = new Set();
        for (const w of Object.values(workerRegistry.workers)) {
            if (seenWorkers.has(w.workerId)) {
                const err = new Error(`Duplicate worker ID detected: ${w.workerId}`);
                err.code = schedulerErrorCodes.SCHEDULER_INVALID_WORKER;
                throw err;
            }
            seenWorkers.add(w.workerId);
        }

        // Initialize state variables
        internalState = executionState;
        internalRegistry = workerRegistry;
        internalGraph = taskGraph;
        runningAssignments.clear();
        pendingTasks = [...executionState.queues.pending];
        completedTasks = [...executionState.queues.completed];
    }

    function buildTempExecutionState() {
        const running = Array.from(runningAssignments.values());
        const pending = pendingTasks.filter(id => !running.includes(id));
        return Object.freeze({
            version: internalState.version || "1.0",
            metadata: internalState.metadata,
            queues: Object.freeze({
                pending: Object.freeze(pending),
                running: Object.freeze(running),
                completed: Object.freeze([...completedTasks]),
                failed: Object.freeze([])
            }),
            statistics: Object.freeze({
                totalTasks: internalState.statistics.totalTasks,
                pending: pending.length,
                running: running.length,
                completed: completedTasks.length,
                failed: 0
            })
        });
    }

    function buildTempWorkerRegistry() {
        const workers = {};
        for (const [wId, w] of Object.entries(internalRegistry.workers)) {
            const status = runningAssignments.has(wId) ? "RUNNING" : "IDLE";
            workers[wId] = Object.freeze({
                ...w,
                status
            });
        }
        return Object.freeze({
            workers: Object.freeze(workers)
        });
    }

    let cachedSchedule = null;

    function hasReadyWorkers() {
        if (!internalState) return false;
        const tempState = buildTempExecutionState();
        const tempRegistry = buildTempWorkerRegistry();
        cachedSchedule = activeCompute(tempState, tempRegistry, internalGraph);
        return cachedSchedule.assignments && cachedSchedule.assignments.length > 0;
    }

    function nextWorker() {
        if (!internalState) {
            const err = new Error("Scheduler not initialized.");
            err.code = schedulerErrorCodes.SCHEDULER_INVALID_STATE;
            throw err;
        }
        let schedule = cachedSchedule;
        if (!schedule) {
            const tempState = buildTempExecutionState();
            const tempRegistry = buildTempWorkerRegistry();
            schedule = activeCompute(tempState, tempRegistry, internalGraph);
        }
        cachedSchedule = null; // Clear cache for next cycle
        if (!schedule.assignments || schedule.assignments.length === 0) {
            const err = new Error("No ready workers available.");
            err.code = schedulerErrorCodes.SCHEDULER_INVALID_ORDER;
            throw err;
        }
        const assignment = schedule.assignments[0];
        runningAssignments.set(assignment.workerId, assignment.taskId);
        return assignment;
    }

    function markCompleted(workerId) {
        if (!internalState) {
            const err = new Error("Scheduler not initialized.");
            err.code = schedulerErrorCodes.SCHEDULER_INVALID_STATE;
            throw err;
        }
        if (!runningAssignments.has(workerId)) {
            const err = new Error(`Worker '${workerId}' is not currently executing any task.`);
            err.code = schedulerErrorCodes.SCHEDULER_INVALID_ORDER;
            throw err;
        }
        const taskId = runningAssignments.get(workerId);
        runningAssignments.delete(workerId);

        const idx = pendingTasks.indexOf(taskId);
        if (idx !== -1) {
            pendingTasks.splice(idx, 1);
        }
        completedTasks.push(taskId);
    }

    return deepFreeze({
        initialize,
        hasReadyWorkers,
        nextWorker,
        markCompleted,
        computeSchedule
    });
}

module.exports = {
    createScheduler,
    computeSchedule
};
