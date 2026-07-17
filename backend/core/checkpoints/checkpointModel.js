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
 * Public helper to deep freeze checkpoint.
 */
function deepFreezeCheckpoint(checkpoint) {
    return deepFreeze(checkpoint);
}

/**
 * Checks if the given object has a valid checkpoint signature.
 */
function isCheckpoint(obj) {
    if (obj === null || obj === undefined || typeof obj !== "object") {
        return false;
    }
    return (
        typeof obj.version === "string" &&
        typeof obj.executionId === "string" &&
        obj.metadata !== null &&
        typeof obj.metadata === "object" &&
        obj.queues !== null &&
        typeof obj.queues === "object" &&
        Array.isArray(obj.workers) &&
        obj.statistics !== null &&
        typeof obj.statistics === "object"
    );
}

/**
 * Creates a execution checkpoint from a validated Planner state (legacy) or a domain options object.
 *
 * @param {Object} input The planner state or checkpoint domain options
 * @param {String} createdBy Identity string of the checkpoint creator
 */
function createCheckpoint(input, createdBy = "planner") {
    try {
        if (input === null || input === undefined) {
            return deepFreeze({
                success: false,
                checkpoint: null,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_INPUT,
                    path: "",
                    message: "Input must be a non-null object."
                }]
            });
        }

        if (typeof input !== "object" || Array.isArray(input)) {
            return deepFreeze({
                success: false,
                checkpoint: null,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_INPUT,
                    path: "",
                    message: "Input must be an object."
                }]
            });
        }

        // Detect if input is legacy Planner state
        const isLegacyPlanner = input.hasOwnProperty("tasks") || !input.hasOwnProperty("queues");

        if (isLegacyPlanner) {
            // Validate legacy planner tasks structure
            if (!input.hasOwnProperty("metadata") || input.metadata === null || typeof input.metadata !== "object") {
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

            const seenStableIds = new Set();
            const seenDisplayIds = new Set();
            const tasksMap = new Map();

            for (let i = 0; i < input.tasks.length; i++) {
                const task = input.tasks[i];
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

            // Separate execution states and sort deterministically by displayId ascending
            const completedTasks = [];
            const runningTasks = [];
            const pendingTasks = [];
            const failedTasks = [];

            const sortedTasks = [...input.tasks].sort((a, b) => a.displayId.localeCompare(b.displayId));

            for (const task of sortedTasks) {
                if (task.status === "COMPLETED") {
                    completedTasks.push(task.stableId);
                } else if (task.status === "RUNNING") {
                    runningTasks.push(task.stableId);
                } else if (task.status === "FAILED") {
                    failedTasks.push(task.stableId);
                } else {
                    pendingTasks.push(task.stableId);
                }
            }

            const clonedPlanner = JSON.parse(JSON.stringify(input));
            const totalTasks = sortedTasks.length;

            const checkpoint = {
                version: CHECKPOINT_MODEL_VERSION,
                metadata: {
                    checkpointVersion: CHECKPOINT_MODEL_VERSION,
                    plannerVersion: input.version,
                    graphVersion: input.metadata.graphVersion || "1.0",
                    identityVersion: input.metadata.identityVersion || "1.0",
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
        }

        // Domain options creation mode
        // Basic check for required root fields
        const requiredFields = ["executionId", "metadata", "queues", "statistics"];
        for (const field of requiredFields) {
            if (!input.hasOwnProperty(field) || input[field] === null || input[field] === undefined) {
                return deepFreeze({
                    success: false,
                    checkpoint: null,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_INVALID_STRUCTURE,
                        path: field,
                        message: `Checkpoint missing required domain field: '${field}'`
                    }]
                });
            }
        }

        // Cloned elements to remain pure and non-mutating
        const clonedMetadata = JSON.parse(JSON.stringify(input.metadata));
        const clonedQueues = JSON.parse(JSON.stringify(input.queues));
        const clonedStatistics = JSON.parse(JSON.stringify(input.statistics));
        const clonedWorkers = input.workers ? JSON.parse(JSON.stringify(input.workers)) : [];

        // Backward compatibility mapping for recovery/resume
        const completedTasks = clonedQueues.completed ? [...clonedQueues.completed] : undefined;
        const runningTasks = clonedQueues.running ? [...clonedQueues.running] : undefined;
        const pendingTasks = clonedQueues.pending ? [...clonedQueues.pending] : undefined;
        const failedTasks = clonedQueues.failed ? [...clonedQueues.failed] : undefined;

        const checkpoint = {
            version: input.version || CHECKPOINT_MODEL_VERSION,
            executionId: input.executionId,
            metadata: {
                checkpointVersion: clonedMetadata.checkpointVersion || CHECKPOINT_MODEL_VERSION,
                plannerVersion: clonedMetadata.plannerVersion || "1.0",
                graphVersion: clonedMetadata.graphVersion || "1.0",
                identityVersion: clonedMetadata.identityVersion || "1.0",
                createdBy: clonedMetadata.createdBy || "planner",
                createdAt: clonedMetadata.createdAt || "2026-07-17T00:00:00.000Z",
                updatedAt: clonedMetadata.updatedAt || "2026-07-17T00:00:00.000Z",
                waveNumber: typeof clonedMetadata.waveNumber === "number" ? clonedMetadata.waveNumber : 0
            },
            queues: {
                pending: pendingTasks,
                running: runningTasks,
                completed: completedTasks,
                failed: failedTasks
            },
            workers: clonedWorkers,
            statistics: {
                completedTasks: typeof clonedStatistics.completedTasks === "number" ? clonedStatistics.completedTasks : (completedTasks ? completedTasks.length : undefined),
                failedTasks: typeof clonedStatistics.failedTasks === "number" ? clonedStatistics.failedTasks : (failedTasks ? failedTasks.length : undefined),
                totalTasks: typeof clonedStatistics.totalTasks === "number" ? clonedStatistics.totalTasks : (
                    (pendingTasks && runningTasks && completedTasks && failedTasks)
                        ? (pendingTasks.length + runningTasks.length + completedTasks.length + failedTasks.length)
                        : undefined
                )
            },
            // Backward compatibility fields
            executionState: {
                completedTasks: completedTasks || [],
                runningTasks: runningTasks || [],
                pendingTasks: pendingTasks || [],
                failedTasks: failedTasks || []
            }
        };

        if (input.planner) {
            checkpoint.planner = JSON.parse(JSON.stringify(input.planner));
        }

        // Copy any unknown top-level properties from input to checkpoint so validator can reject them
        const allowedKeys = ["version", "executionId", "metadata", "queues", "workers", "statistics", "planner", "executionState"];
        for (const key of Object.keys(input)) {
            if (!allowedKeys.includes(key)) {
                checkpoint[key] = input[key];
            }
        }

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
    isCheckpoint,
    deepFreezeCheckpoint,
    CHECKPOINT_MODEL_VERSION
};
