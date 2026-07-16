"use strict";

const { checkpointErrorCodes } = require("./checkpointErrors");

/**
 * Helper to recursively verify that an object is deeply frozen.
 */
function isDeeplyFrozen(obj, visited = new Set()) {
    if (obj === null || typeof obj !== "object") {
        return true;
    }
    if (visited.has(obj)) {
        return true;
    }
    visited.add(obj);
    if (!Object.isFrozen(obj)) {
        return false;
    }
    const props = Object.getOwnPropertyNames(obj);
    for (const prop of props) {
        const val = obj[prop];
        if (val !== null && (typeof val === "object" || typeof val === "function")) {
            if (!isDeeplyFrozen(val, visited)) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Deterministically validates structural and semantic correctness of a Checkpoint object.
 * 
 * @param {Object} checkpoint The checkpoint object to validate
 */
function validateCheckpoint(checkpoint) {
    try {
        // 1. Root structure validation
        if (checkpoint === null || checkpoint === undefined || typeof checkpoint !== "object") {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_STRUCTURE,
                    path: "",
                    message: "Checkpoint must be a non-null object."
                }]
            };
        }

        // Deep Immutability check
        if (!isDeeplyFrozen(checkpoint)) {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_STRUCTURE,
                    path: "",
                    message: "Checkpoint and all sub-objects must be deeply frozen/immutable."
                }]
            };
        }

        const requiredTopLevel = ["version", "metadata", "planner", "executionState"];
        for (const field of requiredTopLevel) {
            if (!checkpoint.hasOwnProperty(field)) {
                return {
                    success: false,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_INVALID_STRUCTURE,
                        path: field,
                        message: `Checkpoint is missing required top-level property: '${field}'`
                    }]
                };
            }
        }

        // 2. Metadata block validation
        const metadata = checkpoint.metadata;
        if (metadata === null || typeof metadata !== "object") {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_METADATA,
                    path: "metadata",
                    message: "Checkpoint metadata must be a non-null object."
                }]
            };
        }

        const requiredMetadata = ["checkpointVersion", "plannerVersion", "graphVersion", "identityVersion", "createdBy"];
        for (const field of requiredMetadata) {
            if (!metadata.hasOwnProperty(field) || typeof metadata[field] !== "string" || metadata[field].trim() === "") {
                return {
                    success: false,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_INVALID_METADATA,
                        path: `metadata.${field}`,
                        message: `Metadata is missing or has invalid string value for: '${field}'`
                    }]
                };
            }
        }

        // 3. Planner block validation
        const planner = checkpoint.planner;
        if (planner === null || typeof planner !== "object") {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_PLANNER,
                    path: "planner",
                    message: "Checkpoint planner must be a non-null object."
                }]
            };
        }

        const requiredPlanner = ["version", "metadata", "tasks"];
        for (const field of requiredPlanner) {
            if (!planner.hasOwnProperty(field)) {
                return {
                    success: false,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_INVALID_PLANNER,
                        path: `planner.${field}`,
                        message: `Planner is missing required property: '${field}'`
                    }]
                };
            }
        }

        if (!Array.isArray(planner.tasks)) {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_PLANNER,
                    path: "planner.tasks",
                    message: "Planner tasks must be an array."
                }]
            };
        }

        const seenStableIds = new Set();
        const seenDisplayIds = new Set();
        const tasksMap = new Map();

        for (let i = 0; i < planner.tasks.length; i++) {
            const task = planner.tasks[i];
            const path = `planner.tasks[${i}]`;

            if (task === null || typeof task !== "object") {
                return {
                    success: false,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_INVALID_PLANNER,
                        path,
                        message: "Task must be a non-null object."
                    }]
                };
            }

            const requiredTaskFields = ["stableId", "displayId", "status", "dependencies", "dependents"];
            for (const field of requiredTaskFields) {
                if (!task.hasOwnProperty(field)) {
                    return {
                        success: false,
                        errors: [{
                            code: checkpointErrorCodes.CHECKPOINT_INVALID_PLANNER,
                            path: `${path}.${field}`,
                            message: `Task is missing required field: '${field}'`
                        }]
                    };
                }
            }

            if (seenStableIds.has(task.stableId)) {
                return {
                    success: false,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_DUPLICATE_TASK,
                        path: `${path}.stableId`,
                        message: `Duplicate task stableId detected: '${task.stableId}'`
                    }]
                };
            }
            seenStableIds.add(task.stableId);

            if (seenDisplayIds.has(task.displayId)) {
                return {
                    success: false,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_DUPLICATE_TASK,
                        path: `${path}.displayId`,
                        message: `Duplicate task displayId detected: '${task.displayId}'`
                    }]
                };
            }
            seenDisplayIds.add(task.displayId);

            tasksMap.set(task.stableId, task);
        }

        // Validate task dependencies and dependents references
        for (const [stableId, task] of tasksMap) {
            for (const depId of task.dependencies) {
                if (!tasksMap.has(depId)) {
                    return {
                        success: false,
                        errors: [{
                            code: checkpointErrorCodes.CHECKPOINT_INVALID_PLANNER,
                            path: `planner.tasks[stableId:${stableId}].dependencies`,
                            message: `Task refers to non-existent dependency: '${depId}'`
                        }]
                    };
                }
            }
            for (const depId of task.dependents) {
                if (!tasksMap.has(depId)) {
                    return {
                        success: false,
                        errors: [{
                            code: checkpointErrorCodes.CHECKPOINT_INVALID_PLANNER,
                            path: `planner.tasks[stableId:${stableId}].dependents`,
                            message: `Task refers to non-existent dependent: '${depId}'`
                        }]
                    };
                }
            }
        }

        // 4. Execution State validation
        const executionState = checkpoint.executionState;
        if (executionState === null || typeof executionState !== "object") {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_EXECUTION_STATE,
                    path: "executionState",
                    message: "Checkpoint executionState must be a non-null object."
                }]
            };
        }

        const requiredStateLists = ["completedTasks", "runningTasks", "pendingTasks", "failedTasks"];
        for (const listName of requiredStateLists) {
            if (!executionState.hasOwnProperty(listName) || !Array.isArray(executionState[listName])) {
                return {
                    success: false,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_INVALID_EXECUTION_STATE,
                        path: `executionState.${listName}`,
                        message: `executionState is missing list or is not an array: '${listName}'`
                    }]
                };
            }
        }

        // Verify task membership across executionState arrays matches planner tasks exactly
        const allStateTaskIds = [];
        const seenStateTaskIds = new Set();

        for (const listName of requiredStateLists) {
            for (let i = 0; i < executionState[listName].length; i++) {
                const stableId = executionState[listName][i];
                const path = `executionState.${listName}[${i}]`;

                if (typeof stableId !== "string") {
                    return {
                        success: false,
                        errors: [{
                            code: checkpointErrorCodes.CHECKPOINT_INVALID_EXECUTION_STATE,
                            path,
                            message: "Task ID inside executionState list must be a string."
                        }]
                    };
                }

                if (!tasksMap.has(stableId)) {
                    return {
                        success: false,
                        errors: [{
                            code: checkpointErrorCodes.CHECKPOINT_INVALID_EXECUTION_STATE,
                            path,
                            message: `Task ID refers to non-existent planner task: '${stableId}'`
                        }]
                    };
                }

                if (seenStateTaskIds.has(stableId)) {
                    return {
                        success: false,
                        errors: [{
                            code: checkpointErrorCodes.CHECKPOINT_INVALID_EXECUTION_STATE,
                            path,
                            message: `Task ID duplicate across executionState categories: '${stableId}'`
                        }]
                    };
                }

                seenStateTaskIds.add(stableId);
                allStateTaskIds.push(stableId);

                // Verify status matches list category
                const task = tasksMap.get(stableId);
                const taskStatus = task.status;

                if (listName === "completedTasks" && taskStatus !== "COMPLETED") {
                    return {
                        success: false,
                        errors: [{
                            code: checkpointErrorCodes.CHECKPOINT_INVALID_EXECUTION_STATE,
                            path,
                            message: `Task status mismatch: Task '${stableId}' is in completedTasks list but status is '${taskStatus}'`
                        }]
                    };
                }
                if (listName === "runningTasks" && taskStatus !== "RUNNING") {
                    return {
                        success: false,
                        errors: [{
                            code: checkpointErrorCodes.CHECKPOINT_INVALID_EXECUTION_STATE,
                            path,
                            message: `Task status mismatch: Task '${stableId}' is in runningTasks list but status is '${taskStatus}'`
                        }]
                    };
                }
                if (listName === "failedTasks" && taskStatus !== "FAILED") {
                    return {
                        success: false,
                        errors: [{
                            code: checkpointErrorCodes.CHECKPOINT_INVALID_EXECUTION_STATE,
                            path,
                            message: `Task status mismatch: Task '${stableId}' is in failedTasks list but status is '${taskStatus}'`
                        }]
                    };
                }
                if (listName === "pendingTasks" && taskStatus !== "PENDING" && taskStatus !== "BLOCKED" && taskStatus !== "") {
                    // For flexible pending mapping
                    if (["COMPLETED", "RUNNING", "FAILED"].includes(taskStatus)) {
                        return {
                            success: false,
                            errors: [{
                                code: checkpointErrorCodes.CHECKPOINT_INVALID_EXECUTION_STATE,
                                path,
                                message: `Task status mismatch: Task '${stableId}' is in pendingTasks list but status is '${taskStatus}'`
                            }]
                        };
                    }
                }
            }
        }

        // Verify total task counts match exactly
        if (allStateTaskIds.length !== planner.tasks.length) {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_EXECUTION_STATE,
                    path: "executionState",
                    message: `Task count mismatch: executionState lists contain ${allStateTaskIds.length} tasks but planner contains ${planner.tasks.length} tasks.`
                }]
            };
        }

        return {
            success: true,
            errors: []
        };

    } catch (err) {
        return {
            success: false,
            errors: [{
                code: checkpointErrorCodes.CHECKPOINT_INTERNAL_ERROR,
                path: "",
                message: `Unexpected internal error during checkpoint validation: ${err.message}`
            }]
        };
    }
}

module.exports = {
    validateCheckpoint
};
