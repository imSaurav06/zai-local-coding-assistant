"use strict";

const readyErrorCodes = Object.freeze({
    PLANNER_READY_INVALID_INPUT: "PLANNER_READY_INVALID_INPUT",
    PLANNER_READY_INVALID_GRAPH: "PLANNER_READY_INVALID_GRAPH",
    PLANNER_READY_INTERNAL_ERROR: "PLANNER_READY_INTERNAL_ERROR"
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
 * Determines which tasks in the planner are immediately ready to execute.
 * 
 * Ready Policy:
 * 1. task.status === "PENDING"
 * 2. task.blocked !== true
 * 3. All task.dependencies have task.status === "COMPLETED" (or task has empty dependencies)
 * 
 * Ordering Policy:
 * The returned ready queue of stableIds is sorted ascendingly by task displayId.
 * 
 * @param {Object} planner The validated planner state
 */
function buildReadyQueue(planner) {
    try {
        // 1. Validation of input structure
        if (planner === null || planner === undefined || typeof planner !== "object") {
            return deepFreeze({
                success: false,
                readyQueue: [],
                errors: [{
                    code: readyErrorCodes.PLANNER_READY_INVALID_INPUT,
                    path: "",
                    message: "Planner input must be a non-null object."
                }]
            });
        }

        if (!planner.hasOwnProperty("tasks") || !Array.isArray(planner.tasks)) {
            return deepFreeze({
                success: false,
                readyQueue: [],
                errors: [{
                    code: readyErrorCodes.PLANNER_READY_INVALID_GRAPH,
                    path: "tasks",
                    message: "Planner tasks array is missing or invalid."
                }]
            });
        }

        const tasksMap = new Map();
        for (let i = 0; i < planner.tasks.length; i++) {
            const task = planner.tasks[i];
            const path = `tasks[${i}]`;

            if (task === null || typeof task !== "object") {
                return deepFreeze({
                    success: false,
                    readyQueue: [],
                    errors: [{
                        code: readyErrorCodes.PLANNER_READY_INVALID_GRAPH,
                        path,
                        message: "Planner task must be a non-null object."
                    }]
                });
            }

            const requiredFields = ["stableId", "displayId", "status", "dependencies"];
            for (const field of requiredFields) {
                if (!task.hasOwnProperty(field)) {
                    return deepFreeze({
                        success: false,
                        readyQueue: [],
                        errors: [{
                            code: readyErrorCodes.PLANNER_READY_INVALID_GRAPH,
                            path: `${path}.${field}`,
                            message: `Task is missing required field: '${field}'`
                        }]
                    });
                }
            }

            tasksMap.set(task.stableId, task);
        }

        const readyTasks = [];

        // 2. Evaluate ready policy for each task
        for (const [stableId, task] of tasksMap) {
            // Task status must be PENDING
            if (task.status !== "PENDING") {
                continue;
            }

            // Task must not be blocked
            if (task.blocked === true) {
                continue;
            }

            // Check if all dependencies are COMPLETED
            let dependenciesMet = true;
            for (const depId of task.dependencies) {
                const depTask = tasksMap.get(depId);
                if (!depTask) {
                    return deepFreeze({
                        success: false,
                        readyQueue: [],
                        errors: [{
                            code: readyErrorCodes.PLANNER_READY_INVALID_GRAPH,
                            path: `tasks[stableId:${stableId}].dependencies`,
                            message: `Task depends on non-existent task stableId: '${depId}'`
                        }]
                    });
                }
                if (depTask.status !== "COMPLETED") {
                    dependenciesMet = false;
                    break;
                }
            }

            if (dependenciesMet) {
                readyTasks.push(task);
            }
        }

        // 3. Sort ready tasks by displayId ascending
        readyTasks.sort((a, b) => a.displayId.localeCompare(b.displayId));

        // Map to stableIds
        const readyQueue = readyTasks.map(task => task.stableId);

        return deepFreeze({
            success: true,
            readyQueue,
            errors: []
        });

    } catch (err) {
        return deepFreeze({
            success: false,
            readyQueue: [],
            errors: [{
                code: readyErrorCodes.PLANNER_READY_INTERNAL_ERROR,
                path: "",
                message: `Unexpected internal error during ready queue building: ${err.message}`
            }]
        });
    }
}

module.exports = {
    buildReadyQueue,
    readyErrorCodes
};
