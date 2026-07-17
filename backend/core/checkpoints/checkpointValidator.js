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
 * Supports legacy planner checkpoints and new domain checkpoints.
 *
 * @param {Object} checkpoint The checkpoint object to validate
 */
function validateCheckpoint(checkpoint) {
    try {
        // 1. Root structure validation
        if (checkpoint === null || checkpoint === undefined || typeof checkpoint !== "object" || Array.isArray(checkpoint)) {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_INPUT,
                    path: "",
                    message: "Checkpoint must be a non-null object."
                }]
            };
        }

        // Deep Immutability check (ADR-011 structural constraint)
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

        // Check required root version and metadata
        if (!checkpoint.hasOwnProperty("version") || checkpoint.version === null || checkpoint.version === undefined) {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_STRUCTURE,
                    path: "version",
                    message: "Checkpoint is missing version."
                }]
            };
        }

        if (!checkpoint.hasOwnProperty("metadata") || checkpoint.metadata === null || checkpoint.metadata === undefined) {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_STRUCTURE,
                    path: "metadata",
                    message: "Checkpoint is missing metadata."
                }]
            };
        }

        const isLegacy = checkpoint.hasOwnProperty("planner");

        if (isLegacy) {
            // Validate allowed keys for legacy format
            const allowedLegacyKeys = ["version", "metadata", "planner", "executionState"];
            for (const key of Object.keys(checkpoint)) {
                if (!allowedLegacyKeys.includes(key)) {
                    return {
                        success: false,
                        errors: [{
                            code: checkpointErrorCodes.CHECKPOINT_UNKNOWN_PROPERTY,
                            path: key,
                            message: `Legacy checkpoint contains unknown property: '${key}'`
                        }]
                    };
                }
            }

            // Required legacy keys
            if (!checkpoint.hasOwnProperty("executionState") || checkpoint.executionState === null || checkpoint.executionState === undefined) {
                return {
                    success: false,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_INVALID_STRUCTURE,
                        path: "executionState",
                        message: "Legacy checkpoint is missing executionState."
                    }]
                };
            }

            // Validate legacy metadata
            const metadata = checkpoint.metadata;
            if (typeof metadata !== "object" || Array.isArray(metadata)) {
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

            // Validate legacy planner block
            const planner = checkpoint.planner;
            if (planner === null || typeof planner !== "object" || Array.isArray(planner)) {
                return {
                    success: false,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_INVALID_PLANNER,
                        path: "planner",
                        message: "Checkpoint planner must be a non-null object."
                    }]
                };
            }

            if (!planner.hasOwnProperty("version") || !planner.hasOwnProperty("metadata") || !planner.hasOwnProperty("tasks") || !Array.isArray(planner.tasks)) {
                return {
                    success: false,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_INVALID_PLANNER,
                        path: "planner",
                        message: "Planner is invalid or missing required properties."
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
                            message: "Planner task must be a non-null object."
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

            // Verify planner task linkages
            for (const [stableId, task] of tasksMap) {
                for (const depId of task.dependencies) {
                    if (!tasksMap.has(depId)) {
                        return {
                            success: false,
                            errors: [{
                                code: checkpointErrorCodes.CHECKPOINT_INVALID_PLANNER,
                                path: `planner.tasks[stableId:${stableId}].dependencies`,
                                message: `Task refers to non-existent dependency stableId: '${depId}'`
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
                                message: `Task refers to non-existent dependent stableId: '${depId}'`
                            }]
                        };
                    }
                }
            }

            // Validate legacy executionState
            const execState = checkpoint.executionState;
            if (execState === null || typeof execState !== "object" || Array.isArray(execState)) {
                return {
                    success: false,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_INVALID_EXECUTION_STATE,
                        path: "executionState",
                        message: "executionState must be an object."
                    }]
                };
            }

            const requiredStateLists = ["completedTasks", "pendingTasks", "failedTasks", "runningTasks"];
            for (const listName of requiredStateLists) {
                if (!execState.hasOwnProperty(listName) || !Array.isArray(execState[listName])) {
                    return {
                        success: false,
                        errors: [{
                            code: checkpointErrorCodes.CHECKPOINT_INVALID_EXECUTION_STATE,
                            path: `executionState.${listName}`,
                            message: `executionState must contain array property: '${listName}'`
                        }]
                    };
                }
            }

            // Validate duplicates in executionState arrays
            const seenExecIds = new Set();
            for (const listName of requiredStateLists) {
                const arr = execState[listName];
                for (let i = 0; i < arr.length; i++) {
                    const taskId = arr[i];
                    if (seenExecIds.has(taskId)) {
                        return {
                            success: false,
                            errors: [{
                                code: checkpointErrorCodes.CHECKPOINT_DUPLICATE_TASK,
                                path: `executionState.${listName}[${i}]`,
                                message: `Duplicate task stableId in executionState: '${taskId}'`
                            }]
                        };
                    }
                    seenExecIds.add(taskId);
                }
            }

            return {
                success: true,
                errors: []
            };
        }

        // ── Validate New Domain Checkpoint format ──
        const allowedDomainKeys = [
            "version",
            "executionId",
            "metadata",
            "queues",
            "workers",
            "statistics",
            "executionState" // Permitted for recovery compatibility
        ];

        for (const key of Object.keys(checkpoint)) {
            if (!allowedDomainKeys.includes(key)) {
                return {
                    success: false,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_UNKNOWN_PROPERTY,
                        path: key,
                        message: `Checkpoint contains unknown top-level property: '${key}'`
                    }]
                };
            }
        }

        // Required domain fields
        const requiredDomainRoot = ["version", "executionId", "metadata", "queues", "workers", "statistics"];
        for (const field of requiredDomainRoot) {
            if (!checkpoint.hasOwnProperty(field) || checkpoint[field] === null || checkpoint[field] === undefined) {
                return {
                    success: false,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_INVALID_STRUCTURE,
                        path: field,
                        message: `Checkpoint is missing required domain property: '${field}'`
                    }]
                };
            }
        }

        if (typeof checkpoint.version !== "string" || checkpoint.version.trim() === "") {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_STRUCTURE,
                    path: "version",
                    message: "Checkpoint version must be a non-empty string."
                }]
            };
        }

        if (typeof checkpoint.executionId !== "string" || checkpoint.executionId.trim() === "") {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_STRUCTURE,
                    path: "executionId",
                    message: "Checkpoint executionId must be a non-empty string."
                }]
            };
        }

        // Validate metadata
        const metadata = checkpoint.metadata;
        if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_METADATA,
                    path: "metadata",
                    message: "Checkpoint metadata must be a non-null object."
                }]
            };
        }

        const requiredMetadata = ["createdAt", "updatedAt", "waveNumber"];
        for (const field of requiredMetadata) {
            if (!metadata.hasOwnProperty(field) || metadata[field] === null || metadata[field] === undefined) {
                return {
                    success: false,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_INVALID_METADATA,
                        path: `metadata.${field}`,
                        message: `Metadata is missing required field: '${field}'`
                    }]
                };
            }
        }

        if (typeof metadata.createdAt !== "string" || metadata.createdAt.trim() === "") {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_METADATA,
                    path: "metadata.createdAt",
                    message: "Metadata createdAt must be a non-empty string."
                }]
            };
        }

        if (typeof metadata.updatedAt !== "string" || metadata.updatedAt.trim() === "") {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_METADATA,
                    path: "metadata.updatedAt",
                    message: "Metadata updatedAt must be a non-empty string."
                }]
            };
        }

        if (typeof metadata.waveNumber !== "number" || metadata.waveNumber < 0 || !Number.isInteger(metadata.waveNumber)) {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_METADATA,
                    path: "metadata.waveNumber",
                    message: "Metadata waveNumber must be a non-negative integer."
                }]
            };
        }

        // Validate queues
        const queues = checkpoint.queues;
        if (queues === null || typeof queues !== "object" || Array.isArray(queues)) {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_QUEUE,
                    path: "queues",
                    message: "Checkpoint queues must be a non-null object."
                }]
            };
        }

        const requiredQueues = ["pending", "running", "completed", "failed"];
        for (const field of requiredQueues) {
            if (!queues.hasOwnProperty(field) || !Array.isArray(queues[field])) {
                return {
                    success: false,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_INVALID_QUEUE,
                        path: `queues.${field}`,
                        message: `Queues must contain array property: '${field}'`
                    }]
                };
            }
        }

        // Validate task duplicates
        const seenTaskIds = new Set();
        let totalUniqueTasks = 0;

        for (const qKey of requiredQueues) {
            const arr = queues[qKey];
            for (let i = 0; i < arr.length; i++) {
                const taskId = arr[i];
                if (typeof taskId !== "string" || taskId.trim() === "") {
                    return {
                        success: false,
                        errors: [{
                            code: checkpointErrorCodes.CHECKPOINT_INVALID_QUEUE,
                            path: `queues.${qKey}[${i}]`,
                            message: "Task ID must be a non-empty string."
                        }]
                    };
                }

                if (seenTaskIds.has(taskId)) {
                    return {
                        success: false,
                        errors: [{
                            code: checkpointErrorCodes.CHECKPOINT_DUPLICATE_TASK,
                            path: `queues.${qKey}[${i}]`,
                            message: `Duplicate task ID detected in checkpoint: '${taskId}'`
                        }]
                    };
                }
                seenTaskIds.add(taskId);
                totalUniqueTasks++;
            }
        }

        // Validate workers
        const workers = checkpoint.workers;
        if (!Array.isArray(workers)) {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_STRUCTURE,
                    path: "workers",
                    message: "Checkpoint workers must be an array."
                }]
            };
        }

        const seenWorkerIds = new Set();
        for (let i = 0; i < workers.length; i++) {
            const worker = workers[i];
            if (worker === null || worker === undefined) {
                return {
                    success: false,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_INVALID_STRUCTURE,
                        path: `workers[${i}]`,
                        message: "Worker entry cannot be null or undefined."
                    }]
                };
            }

            let wId;
            if (typeof worker === "string") {
                wId = worker;
            } else if (typeof worker === "object") {
                wId = worker.id || worker.workerId;
                if (!wId || typeof wId !== "string" || wId.trim() === "") {
                    return {
                        success: false,
                        errors: [{
                            code: checkpointErrorCodes.CHECKPOINT_INVALID_STRUCTURE,
                            path: `workers[${i}]`,
                            message: "Worker object must contain a non-empty string 'id' or 'workerId'."
                        }]
                    };
                }
            } else {
                return {
                    success: false,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_INVALID_STRUCTURE,
                        path: `workers[${i}]`,
                        message: "Worker entry must be a string or an object."
                    }]
                };
            }

            if (seenWorkerIds.has(wId)) {
                return {
                    success: false,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_DUPLICATE_WORKER,
                        path: `workers[${i}]`,
                        message: `Duplicate worker ID detected: '${wId}'`
                    }]
                };
            }
            seenWorkerIds.add(wId);
        }

        // Validate statistics
        const stats = checkpoint.statistics;
        if (stats === null || typeof stats !== "object" || Array.isArray(stats)) {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_STATISTICS,
                    path: "statistics",
                    message: "Checkpoint statistics must be a non-null object."
                }]
            };
        }

        const requiredStats = ["completedTasks", "failedTasks", "totalTasks"];
        for (const field of requiredStats) {
            if (!stats.hasOwnProperty(field) || typeof stats[field] !== "number" || stats[field] < 0 || !Number.isInteger(stats[field])) {
                return {
                    success: false,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_INVALID_STATISTICS,
                        path: `statistics.${field}`,
                        message: `Statistics field must be a non-negative integer: '${field}'`
                    }]
                };
            }
        }

        if (stats.totalTasks !== totalUniqueTasks) {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_STATISTICS,
                    path: "statistics.totalTasks",
                    message: `Statistics totalTasks (${stats.totalTasks}) must match unique task count in queues (${totalUniqueTasks}).`
                }]
            };
        }

        if (stats.completedTasks !== queues.completed.length) {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_STATISTICS,
                    path: "statistics.completedTasks",
                    message: `Statistics completedTasks (${stats.completedTasks}) must match completed queue length (${queues.completed.length}).`
                }]
            };
        }

        if (stats.failedTasks !== queues.failed.length) {
            return {
                success: false,
                errors: [{
                    code: checkpointErrorCodes.CHECKPOINT_INVALID_STATISTICS,
                    path: "statistics.failedTasks",
                    message: `Statistics failedTasks (${stats.failedTasks}) must match failed queue length (${queues.failed.length}).`
                }]
            };
        }

        // Validate executionState if present for compatibility
        if (checkpoint.hasOwnProperty("executionState")) {
            const execState = checkpoint.executionState;
            if (execState === null || typeof execState !== "object" || Array.isArray(execState)) {
                return {
                    success: false,
                    errors: [{
                        code: checkpointErrorCodes.CHECKPOINT_INVALID_EXECUTION_STATE,
                        path: "executionState",
                        message: "executionState must be an object for backward compatibility."
                    }]
                };
            }

            const checkMap = {
                completedTasks: "completed",
                runningTasks: "running",
                pendingTasks: "pending",
                failedTasks: "failed"
            };

            for (const [stateKey, qKey] of Object.entries(checkMap)) {
                if (!execState.hasOwnProperty(stateKey) || !Array.isArray(execState[stateKey])) {
                    return {
                        success: false,
                        errors: [{
                            code: checkpointErrorCodes.CHECKPOINT_INVALID_EXECUTION_STATE,
                            path: `executionState.${stateKey}`,
                            message: `executionState missing array: '${stateKey}'`
                        }]
                    };
                }
                const execArr = execState[stateKey];
                const qArr = queues[qKey];
                if (execArr.length !== qArr.length || !execArr.every((id, idx) => id === qArr[idx])) {
                    return {
                        success: false,
                        errors: [{
                            code: checkpointErrorCodes.CHECKPOINT_INVALID_EXECUTION_STATE,
                            path: `executionState.${stateKey}`,
                            message: `executionState.${stateKey} does not match queues.${qKey}.`
                        }]
                    };
                }
            }
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
