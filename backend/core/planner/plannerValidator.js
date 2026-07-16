"use strict";

const validatorErrorCodes = Object.freeze({
    PLANNER_INVALID_STRUCTURE: "PLANNER_INVALID_STRUCTURE",
    PLANNER_INVALID_TASK: "PLANNER_INVALID_TASK",
    PLANNER_DUPLICATE_TASK: "PLANNER_DUPLICATE_TASK",
    PLANNER_BROKEN_REFERENCE: "PLANNER_BROKEN_REFERENCE",
    PLANNER_SELF_DEPENDENCY: "PLANNER_SELF_DEPENDENCY",
    PLANNER_ASYMMETRIC_EDGE: "PLANNER_ASYMMETRIC_EDGE",
    PLANNER_INVALID_STATUS: "PLANNER_INVALID_STATUS",
    PLANNER_INTERNAL_ERROR: "PLANNER_INTERNAL_ERROR"
});

const VALID_STATUSES = new Set(["PENDING"]);

/**
 * Asserves if an object is deeply frozen recursively.
 */
function isDeeplyFrozen(obj) {
    if (obj === null || typeof obj !== "object") {
        return true;
    }
    if (!Object.isFrozen(obj)) {
        return false;
    }
    const props = Object.getOwnPropertyNames(obj);
    for (const prop of props) {
        const val = obj[prop];
        if (val !== null && typeof val === "object") {
            if (!isDeeplyFrozen(val)) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Validates a Planner object.
 * 
 * @param {Object} planner The planner structure to validate
 */
function validatePlanner(planner) {
    try {
        const errors = [];

        // 1. Root structure validation
        if (planner === null || planner === undefined || typeof planner !== "object") {
            return {
                success: false,
                errors: [{
                    code: validatorErrorCodes.PLANNER_INVALID_STRUCTURE,
                    path: "",
                    message: "Planner must be a non-null object."
                }]
            };
        }

        // Deep freeze check
        if (!isDeeplyFrozen(planner)) {
            errors.push({
                code: validatorErrorCodes.PLANNER_INVALID_STRUCTURE,
                path: "",
                message: "Planner structure and its arrays/objects must be deeply frozen."
            });
        }

        if (!planner.hasOwnProperty("version") || typeof planner.version !== "string") {
            errors.push({
                code: validatorErrorCodes.PLANNER_INVALID_STRUCTURE,
                path: "version",
                message: "Planner version must be a string."
            });
        }

        if (!planner.hasOwnProperty("metadata") || planner.metadata === null || typeof planner.metadata !== "object") {
            errors.push({
                code: validatorErrorCodes.PLANNER_INVALID_STRUCTURE,
                path: "metadata",
                message: "Planner metadata must be a non-null object."
            });
        }

        if (!planner.hasOwnProperty("tasks") || !Array.isArray(planner.tasks)) {
            errors.push({
                code: validatorErrorCodes.PLANNER_INVALID_STRUCTURE,
                path: "tasks",
                message: "Planner tasks must be an array."
            });
            return { success: false, errors };
        }

        const tasksMap = new Map();
        const seenStableIds = new Set();
        const seenDisplayIds = new Set();

        // 2. Individual task structural and status checks
        for (let i = 0; i < planner.tasks.length; i++) {
            const task = planner.tasks[i];
            const path = `tasks[${i}]`;

            if (task === null || typeof task !== "object") {
                errors.push({
                    code: validatorErrorCodes.PLANNER_INVALID_TASK,
                    path,
                    message: "Task must be a non-null object."
                });
                continue;
            }

            const requiredFields = ["stableId", "displayId", "kind", "status", "dependencies", "dependents", "ready", "blocked", "metadata"];
            let missingField = false;
            for (const field of requiredFields) {
                if (!task.hasOwnProperty(field)) {
                    errors.push({
                        code: validatorErrorCodes.PLANNER_INVALID_TASK,
                        path: `${path}.${field}`,
                        message: `Task is missing required field: '${field}'`
                    });
                    missingField = true;
                }
            }
            if (missingField) continue;

            if (typeof task.stableId !== "string" || task.stableId.trim() === "") {
                errors.push({
                    code: validatorErrorCodes.PLANNER_INVALID_TASK,
                    path: `${path}.stableId`,
                    message: "Task stableId must be a non-empty string."
                });
            }

            if (typeof task.displayId !== "string" || task.displayId.trim() === "") {
                errors.push({
                    code: validatorErrorCodes.PLANNER_INVALID_TASK,
                    path: `${path}.displayId`,
                    message: "Task displayId must be a non-empty string."
                });
            }

            if (typeof task.kind !== "string" || task.kind.trim() === "") {
                errors.push({
                    code: validatorErrorCodes.PLANNER_INVALID_TASK,
                    path: `${path}.kind`,
                    message: "Task kind must be a non-empty string."
                });
            }

            // Status Enum validation
            if (!VALID_STATUSES.has(task.status)) {
                errors.push({
                    code: validatorErrorCodes.PLANNER_INVALID_STATUS,
                    path: `${path}.status`,
                    message: `Invalid task status: '${task.status}'. Only PENDING is valid.`
                });
            }

            // Booleans checks
            if (typeof task.ready !== "boolean") {
                errors.push({
                    code: validatorErrorCodes.PLANNER_INVALID_TASK,
                    path: `${path}.ready`,
                    message: "Task ready flag must be a boolean."
                });
            }

            if (typeof task.blocked !== "boolean") {
                errors.push({
                    code: validatorErrorCodes.PLANNER_INVALID_TASK,
                    path: `${path}.blocked`,
                    message: "Task blocked flag must be a boolean."
                });
            }

            if (!Array.isArray(task.dependencies)) {
                errors.push({
                    code: validatorErrorCodes.PLANNER_INVALID_TASK,
                    path: `${path}.dependencies`,
                    message: "Task dependencies must be an array."
                });
            }

            if (!Array.isArray(task.dependents)) {
                errors.push({
                    code: validatorErrorCodes.PLANNER_INVALID_TASK,
                    path: `${path}.dependents`,
                    message: "Task dependents must be an array."
                });
            }

            // Duplicate checks
            if (seenStableIds.has(task.stableId)) {
                errors.push({
                    code: validatorErrorCodes.PLANNER_DUPLICATE_TASK,
                    path: `${path}.stableId`,
                    message: `Duplicate task stableId: '${task.stableId}'`
                });
            }
            seenStableIds.add(task.stableId);

            if (seenDisplayIds.has(task.displayId)) {
                errors.push({
                    code: validatorErrorCodes.PLANNER_DUPLICATE_TASK,
                    path: `${path}.displayId`,
                    message: `Duplicate task displayId: '${task.displayId}'`
                });
            }
            seenDisplayIds.add(task.displayId);

            tasksMap.set(task.stableId, task);
        }

        if (errors.length > 0) {
            return { success: false, errors };
        }

        // 3. Dependency consistency & symmetry validations
        for (const [stableId, task] of tasksMap) {
            const path = `tasks[stableId:${stableId}]`;

            // Self dependency check
            if (task.dependencies.includes(stableId)) {
                errors.push({
                    code: validatorErrorCodes.PLANNER_SELF_DEPENDENCY,
                    path: `${path}.dependencies`,
                    message: `Task cannot depend on itself: '${stableId}'`
                });
            }

            if (task.dependents.includes(stableId)) {
                errors.push({
                    code: validatorErrorCodes.PLANNER_SELF_DEPENDENCY,
                    path: `${path}.dependents`,
                    message: `Task cannot be a dependent of itself: '${stableId}'`
                });
            }

            // Broken references and Symmetry check
            for (const depId of task.dependencies) {
                const targetTask = tasksMap.get(depId);
                if (!targetTask) {
                    errors.push({
                        code: validatorErrorCodes.PLANNER_BROKEN_REFERENCE,
                        path: `${path}.dependencies`,
                        message: `Dependency references non-existent task stableId: '${depId}'`
                    });
                    continue;
                }

                // Symmetry check: targetTask must list task as a dependent
                if (!targetTask.dependents.includes(stableId)) {
                    errors.push({
                        code: validatorErrorCodes.PLANNER_ASYMMETRIC_EDGE,
                        path: `${path}.dependencies`,
                        message: `Dependency edge is asymmetric: '${stableId}' depends on '${depId}', but '${depId}' does not list '${stableId}' as a dependent.`
                    });
                }
            }

            for (const dependentId of task.dependents) {
                const targetTask = tasksMap.get(dependentId);
                if (!targetTask) {
                    errors.push({
                        code: validatorErrorCodes.PLANNER_BROKEN_REFERENCE,
                        path: `${path}.dependents`,
                        message: `Dependent references non-existent task stableId: '${dependentId}'`
                    });
                    continue;
                }

                // Symmetry check: targetTask must list task as a dependency
                if (!targetTask.dependencies.includes(stableId)) {
                    errors.push({
                        code: validatorErrorCodes.PLANNER_ASYMMETRIC_EDGE,
                        path: `${path}.dependents`,
                        message: `Dependent edge is asymmetric: '${dependentId}' lists '${stableId}' as a dependency, but '${stableId}' does not list '${dependentId}' as a dependent.`
                    });
                }
            }
        }

        if (errors.length > 0) {
            return { success: false, errors };
        }

        return {
            success: true,
            errors: []
        };

    } catch (err) {
        return {
            success: false,
            errors: [{
                code: validatorErrorCodes.PLANNER_INTERNAL_ERROR,
                path: "",
                message: `Unexpected internal error during planner validation: ${err.message}`
            }]
        };
    }
}

module.exports = {
    validatePlanner,
    validatorErrorCodes
};
