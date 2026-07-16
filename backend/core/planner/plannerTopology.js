"use strict";

const { plannerErrorCodes } = require("./plannerErrors");

// Re-map internal errors to matching topology taxonomy
const topologyErrorCodes = Object.freeze({
    PLANNER_TOPOLOGY_INVALID_INPUT: "PLANNER_TOPOLOGY_INVALID_INPUT",
    PLANNER_TOPOLOGY_INVALID_GRAPH: "PLANNER_TOPOLOGY_INVALID_GRAPH",
    PLANNER_TOPOLOGY_CYCLE: "PLANNER_TOPOLOGY_CYCLE",
    PLANNER_TOPOLOGY_INTERNAL_ERROR: "PLANNER_TOPOLOGY_INTERNAL_ERROR"
});

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
 * Computes a deterministic execution order for a planner graph using Kahn's Algorithm.
 * Sibling nodes are sorted ascendingly by displayId (e.g. REQ-001 < REQ-002) to guarantee
 * determinism.
 * 
 * @param {Object} planner The validated planner object
 */
function createExecutionPlan(planner) {
    try {
        // 1. Validation of input structure
        if (planner === null || planner === undefined || typeof planner !== "object") {
            return deepFreeze({
                success: false,
                executionOrder: [],
                errors: [{
                    code: topologyErrorCodes.PLANNER_TOPOLOGY_INVALID_INPUT,
                    path: "",
                    message: "Planner input must be a non-null object."
                }]
            });
        }

        if (!planner.hasOwnProperty("tasks") || !Array.isArray(planner.tasks)) {
            return deepFreeze({
                success: false,
                executionOrder: [],
                errors: [{
                    code: topologyErrorCodes.PLANNER_TOPOLOGY_INVALID_GRAPH,
                    path: "tasks",
                    message: "Planner tasks array is missing or invalid."
                }]
            });
        }

        const tasksMap = new Map();
        const seenStableIds = new Set();
        const seenDisplayIds = new Set();

        // 2. Validate nodes schema and check duplicates
        for (let i = 0; i < planner.tasks.length; i++) {
            const task = planner.tasks[i];
            const path = `tasks[${i}]`;

            if (task === null || typeof task !== "object") {
                return deepFreeze({
                    success: false,
                    executionOrder: [],
                    errors: [{
                        code: topologyErrorCodes.PLANNER_TOPOLOGY_INVALID_GRAPH,
                        path,
                        message: "Planner task must be a non-null object."
                    }]
                });
            }

            const requiredFields = ["stableId", "displayId", "kind", "dependencies", "dependents"];
            for (const field of requiredFields) {
                if (!task.hasOwnProperty(field)) {
                    return deepFreeze({
                        success: false,
                        executionOrder: [],
                        errors: [{
                            code: topologyErrorCodes.PLANNER_TOPOLOGY_INVALID_GRAPH,
                            path: `${path}.${field}`,
                            message: `Task is missing required field: '${field}'`
                        }]
                    });
                }
            }

            if (!Array.isArray(task.dependencies) || !Array.isArray(task.dependents)) {
                return deepFreeze({
                    success: false,
                    executionOrder: [],
                    errors: [{
                        code: topologyErrorCodes.PLANNER_TOPOLOGY_INVALID_GRAPH,
                        path: `${path}.dependencies`,
                        message: "Task dependencies and dependents must be arrays."
                    }]
                });
            }

            if (seenStableIds.has(task.stableId)) {
                return deepFreeze({
                    success: false,
                    executionOrder: [],
                    errors: [{
                        code: topologyErrorCodes.PLANNER_TOPOLOGY_INVALID_GRAPH,
                        path: `${path}.stableId`,
                        message: `Duplicate stableId detected in planner tasks: '${task.stableId}'`
                    }]
                });
            }
            seenStableIds.add(task.stableId);

            if (seenDisplayIds.has(task.displayId)) {
                return deepFreeze({
                    success: false,
                    executionOrder: [],
                    errors: [{
                        code: topologyErrorCodes.PLANNER_TOPOLOGY_INVALID_GRAPH,
                        path: `${path}.displayId`,
                        message: `Duplicate displayId detected in planner tasks: '${task.displayId}'`
                    }]
                });
            }
            seenDisplayIds.add(task.displayId);

            tasksMap.set(task.stableId, task);
        }

        // 3. Verify reference existence
        const inDegrees = new Map();
        for (const [stableId, task] of tasksMap) {
            for (const depId of task.dependencies) {
                if (!tasksMap.has(depId)) {
                    return deepFreeze({
                        success: false,
                        executionOrder: [],
                        errors: [{
                            code: topologyErrorCodes.PLANNER_TOPOLOGY_INVALID_GRAPH,
                            path: `tasks[stableId:${stableId}].dependencies`,
                            message: `Task depends on non-existent task stableId: '${depId}'`
                        }]
                    });
                }
            }
            for (const dependentId of task.dependents) {
                if (!tasksMap.has(dependentId)) {
                    return deepFreeze({
                        success: false,
                        executionOrder: [],
                        errors: [{
                            code: topologyErrorCodes.PLANNER_TOPOLOGY_INVALID_GRAPH,
                            path: `tasks[stableId:${stableId}].dependents`,
                            message: `Task has dependent pointing to non-existent task stableId: '${dependentId}'`
                        }]
                    });
                }
            }
            // Initialize in-degrees for Kahn's algorithm
            inDegrees.set(stableId, task.dependencies.length);
        }

        // 4. Kahn's Algorithm with deterministic sibling sorting by displayId
        const readyList = [];
        for (const [stableId, task] of tasksMap) {
            if (inDegrees.get(stableId) === 0) {
                readyList.push(task);
            }
        }

        // Sort initially by displayId ascending
        readyList.sort((a, b) => a.displayId.localeCompare(b.displayId));

        const executionOrder = [];

        while (readyList.length > 0) {
            const currentTask = readyList.shift();
            executionOrder.push(currentTask.stableId);

            for (const dependentId of currentTask.dependents) {
                const depTask = tasksMap.get(dependentId);
                const currentInDegree = inDegrees.get(dependentId) - 1;
                inDegrees.set(dependentId, currentInDegree);

                if (currentInDegree === 0) {
                    readyList.push(depTask);
                }
            }

            // Keep the readyList sorted by displayId ascending whenever new tasks are added
            readyList.sort((a, b) => a.displayId.localeCompare(b.displayId));
        }

        // 5. Cycle check
        if (executionOrder.length < planner.tasks.length) {
            return deepFreeze({
                success: false,
                executionOrder: [],
                errors: [{
                    code: topologyErrorCodes.PLANNER_TOPOLOGY_CYCLE,
                    path: "",
                    message: "Cyclic dependency detected: Planner tasks cannot form a Directed Acyclic Graph (DAG)."
                }]
            });
        }

        return deepFreeze({
            success: true,
            executionOrder,
            errors: []
        });

    } catch (err) {
        return deepFreeze({
            success: false,
            executionOrder: [],
            errors: [{
                code: topologyErrorCodes.PLANNER_TOPOLOGY_INTERNAL_ERROR,
                path: "",
                message: `Unexpected internal error during topological planning: ${err.message}`
            }]
        });
    }
}

module.exports = {
    createExecutionPlan,
    topologyErrorCodes
};
