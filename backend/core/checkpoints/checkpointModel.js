"use strict";

const { checkpointErrorCodes } = require("./checkpointErrors");

const CHECKPOINT_MODEL_VERSION = "1.0";

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
 * Creates a execution checkpoint from a validated Planner state.
 * 
 * @param {Object} planner The current Planner state
 * @param {String} createdBy Identity string of the checkpoint creator
 */
function createCheckpoint(planner, createdBy = "planner") {
    try {
        // 1. Validation of planner structure
        if (planner === null || planner === undefined || typeof planner !== "object") {
            return deepFreeze({
                success: false,
                checkpoint: null,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_INPUT,
                    path: "",
                    message: "Planner input must be a non-null object."
                }]
            });
        }

        if (!planner.hasOwnProperty("version") || typeof planner.version !== "string") {
            return deepFreeze({
                success: false,
                checkpoint: null,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_PLANNER,
                    path: "version",
                    message: "Planner version is missing or invalid."
                }]
            });
        }

        if (!planner.hasOwnProperty("metadata") || planner.metadata === null || typeof planner.metadata !== "object") {
            return deepFreeze({
                success: false,
                checkpoint: null,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_PLANNER,
                    path: "metadata",
                    message: "Planner metadata is missing or invalid."
                }]
            });
        }

        if (!planner.hasOwnProperty("tasks") || !Array.isArray(planner.tasks)) {
            return deepFreeze({
                success: false,
                checkpoint: null,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_PLANNER,
                    path: "tasks",
                    message: "Planner tasks array is missing or invalid."
                }]
            });
        }

        const seenStableIds = new Set();
        const seenDisplayIds = new Set();
        const tasksMap = new Map();

        // 2. Validate tasks within planner and check duplicates
        for (let i = 0; i < planner.tasks.length; i++) {
            const task = planner.tasks[i];
            const path = `tasks[${i}]`;

            if (task === null || typeof task !== "object") {
                return deepFreeze({
                    success: false,
                    checkpoint: null,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_INVALID_PLANNER,
                        path,
                        message: "Planner task must be a non-null object."
                    }]
                });
            }

            const requiredTaskFields = ["stableId", "displayId", "status", "dependencies", "dependents"];
            for (const field of requiredTaskFields) {
                if (!task.hasOwnProperty(field)) {
                    return deepFreeze({
                        success: false,
                        checkpoint: null,
                        errors: [{
                            code: checkpointErrorCodes.CHECKPOINT_INVALID_PLANNER,
                            path: `${path}.${field}`,
                            message: `Task is missing required field: '${field}'`
                        }]
                    });
                }
            }

            if (seenStableIds.has(task.stableId)) {
                return deepFreeze({
                    success: false,
                    checkpoint: null,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_DUPLICATE_TASK,
                        path: `${path}.stableId`,
                        message: `Duplicate task stableId detected: '${task.stableId}'`
                    }]
                });
            }
            seenStableIds.add(task.stableId);

            if (seenDisplayIds.has(task.displayId)) {
                return deepFreeze({
                    success: false,
                    checkpoint: null,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_DUPLICATE_TASK,
                        path: `${path}.displayId`,
                        message: `Duplicate task displayId detected: '${task.displayId}'`
                    }]
                });
            }
            seenDisplayIds.add(task.displayId);

            tasksMap.set(task.stableId, task);
        }

        // Verify task linkages
        for (const [stableId, task] of tasksMap) {
            for (const depId of task.dependencies) {
                if (!tasksMap.has(depId)) {
                    return deepFreeze({
                        success: false,
                        checkpoint: null,
                        errors: [{
                            code: checkpointErrorCodes.CHECKPOINT_INVALID_PLANNER,
                            path: `tasks[stableId:${stableId}].dependencies`,
                            message: `Task refers to non-existent dependency stableId: '${depId}'`
                        }]
                    });
                }
            }
            for (const depId of task.dependents) {
                if (!tasksMap.has(depId)) {
                    return deepFreeze({
                        success: false,
                        checkpoint: null,
                        errors: [{
                            code: checkpointErrorCodes.CHECKPOINT_INVALID_PLANNER,
                            path: `tasks[stableId:${stableId}].dependents`,
                            message: `Task refers to non-existent dependent stableId: '${depId}'`
                        }]
                    });
                }
            }
        }

        // 3. Separate execution states
        const completedTasks = [];
        const runningTasks = [];
        const pendingTasks = [];
        const failedTasks = [];

        // Sort execution arrays deterministically by displayId ascending
        const sortedTasks = [...planner.tasks].sort((a, b) => a.displayId.localeCompare(b.displayId));

        for (const task of sortedTasks) {
            if (task.status === "COMPLETED") {
                completedTasks.push(task.stableId);
            } else if (task.status === "RUNNING") {
                runningTasks.push(task.stableId);
            } else if (task.status === "FAILED") {
                failedTasks.push(task.stableId);
            } else {
                // Treat everything else (primarily PENDING) as pending
                pendingTasks.push(task.stableId);
            }
        }

        // 4. Construct deeply cloned and frozen Checkpoint object
        const clonedPlanner = JSON.parse(JSON.stringify(planner));

        const checkpoint = {
            version: CHECKPOINT_MODEL_VERSION,
            metadata: {
                checkpointVersion: CHECKPOINT_MODEL_VERSION,
                plannerVersion: planner.version,
                graphVersion: planner.metadata.graphVersion,
                identityVersion: planner.metadata.identityVersion || "1.0",
                createdBy: createdBy
            },
            planner: clonedPlanner,
            executionState: {
                completedTasks,
                runningTasks,
                pendingTasks,
                failedTasks
            }
        };

        return deepFreeze({
            success: true,
            checkpoint,
            errors: []
        });

    } catch (err) {
        return deepFreeze({
            success: false,
            checkpoint: null,
            errors: [{
                code: checkpointErrorCodes.CHECKPOINT_INTERNAL_ERROR,
                path: "",
                message: `Unexpected internal error during checkpoint creation: ${err.message}`
            }]
        });
    }
}

module.exports = {
    createCheckpoint,
    CHECKPOINT_MODEL_VERSION
};
