"use strict";

const { validateResumeState, checkpointRestoreErrorCodes } = require("./checkpointResumeValidator");

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

async function loadCheckpoint(executionId, checkpointStore, taskGraph) {
    if (typeof executionId !== "string" || !executionId.trim()) {
        const err = new Error("Invalid executionId: must be a non-empty string.");
        err.code = checkpointRestoreErrorCodes.CHECKPOINT_RESUME_INVALID;
        throw err;
    }

    if (!checkpointStore || typeof checkpointStore.load !== "function") {
        const err = new Error("Invalid checkpointStore: load() function is required.");
        err.code = checkpointRestoreErrorCodes.CHECKPOINT_RESUME_INVALID;
        throw err;
    }

    let checkpoint;
    try {
        checkpoint = await checkpointStore.load(executionId);
    } catch (e) {
        const err = new Error(`Failed to load checkpoint: ${e.message}`);
        err.code = checkpointRestoreErrorCodes.CHECKPOINT_RESTORE_FAILED;
        err.originalError = e;
        throw err;
    }

    if (!checkpoint) {
        const err = new Error(`Checkpoint not found for execution ID: ${executionId}`);
        err.code = checkpointRestoreErrorCodes.CHECKPOINT_RESTORE_FAILED;
        throw err;
    }

    // Validate
    validateResumeState(checkpoint, taskGraph);

    // Rebuild ExecutionState
    try {
        const executionState = {
            version: checkpoint.version,
            metadata: {
                status: "READY",
                executionId: checkpoint.executionId,
                createdAt: checkpoint.metadata.createdAt,
                waveNumber: checkpoint.metadata.waveNumber
            },
            queues: {
                pending: [...checkpoint.queues.pending],
                running: [...(checkpoint.queues.running || [])],
                completed: [...checkpoint.queues.completed],
                failed: [...(checkpoint.queues.failed || [])]
            },
            statistics: {
                totalTasks: checkpoint.statistics.totalTasks,
                pending: checkpoint.queues.pending.length,
                running: (checkpoint.queues.running || []).length,
                completed: checkpoint.queues.completed.length,
                failed: (checkpoint.queues.failed || []).length
            }
        };
        return deepFreeze(executionState);
    } catch (err) {
        const restoreErr = new Error(`ExecutionState reconstruction failed: ${err.message}`);
        restoreErr.code = checkpointRestoreErrorCodes.CHECKPOINT_RESTORE_FAILED;
        restoreErr.originalError = err;
        throw restoreErr;
    }
}

module.exports = {
    loadCheckpoint,
    checkpointRestoreErrorCodes
};
