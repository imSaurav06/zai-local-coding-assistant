"use strict";

const { validateCheckpoint } = require("./checkpointValidator");
const { checkpointErrorCodes } = require("./checkpointErrors");
const { checkpointStoreErrorCodes } = require("./checkpointStoreErrors");

/**
 * Deep freezes an object recursively to ensure strict immutability.
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
 * Validates whether a checkpoint is structurally and version compatible for restoration.
 *
 * @param {Object} checkpoint The checkpoint to validate
 */
function validateRestorableCheckpoint(checkpoint) {
    if (checkpoint === null || checkpoint === undefined || typeof checkpoint !== "object") {
        return {
            success: false,
            errors: [{
                code: checkpointErrorCodes.CHECKPOINT_INVALID_INPUT,
                path: "",
                message: "Checkpoint must be a non-null object."
            }]
        };
    }

    const val = validateCheckpoint(checkpoint);
    if (!val.success) {
        return val;
    }

    if (checkpoint.version !== "1.0") {
        return {
            success: false,
            errors: [{
                code: checkpointErrorCodes.CHECKPOINT_INCOMPATIBLE_VERSION,
                path: "version",
                message: `Unsupported checkpoint version: '${checkpoint.version}'. Only '1.0' is supported.`
            }]
        };
    }

    return {
        success: true,
        errors: []
    };
}

/**
 * Translates a valid Checkpoint back into a deeply frozen, immutable ExecutionState.
 *
 * @param {Object} checkpoint The valid checkpoint to restore
 */
function restoreExecutionState(checkpoint) {
    const val = validateRestorableCheckpoint(checkpoint);
    if (!val.success) {
        const err = new Error(`Failed to restore ExecutionState: ${val.errors[0].message}`);
        err.code = val.errors[0].code;
        throw err;
    }

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
            running: [...checkpoint.queues.running],
            completed: [...checkpoint.queues.completed],
            failed: [...checkpoint.queues.failed]
        },
        workers: [...(checkpoint.workers || [])],
        statistics: {
            totalTasks: checkpoint.statistics.totalTasks,
            pending: checkpoint.queues.pending.length,
            running: checkpoint.queues.running.length,
            completed: checkpoint.queues.completed.length,
            failed: checkpoint.queues.failed.length
        }
    };

    return deepFreeze(executionState);
}

/**
 * Loads a Checkpoint via CheckpointStore and restores the ExecutionState.
 *
 * @param {String} executionId The execution identifier
 * @param {Object} checkpointStore The persistence store implementation
 */
async function loadExecutionState(executionId, checkpointStore) {
    if (typeof executionId !== "string" || executionId.trim() === "") {
        const err = new Error("Invalid executionId: must be a non-empty string.");
        err.code = checkpointStoreErrorCodes.CHECKPOINT_STORE_INVALID_ARGUMENT;
        throw err;
    }

    if (checkpointStore === null || checkpointStore === undefined || typeof checkpointStore.load !== "function") {
        const err = new Error("Invalid checkpointStore: must implement CheckpointStore interface with load().");
        err.code = checkpointStoreErrorCodes.CHECKPOINT_STORE_INVALID_ARGUMENT;
        throw err;
    }

    let checkpoint;
    try {
        checkpoint = await checkpointStore.load(executionId);
    } catch (e) {
        if (e.code && Object.values(checkpointStoreErrorCodes).includes(e.code)) {
            throw e;
        }
        const storeErr = new Error(`Store load operation failed: ${e.message}`);
        storeErr.code = checkpointStoreErrorCodes.CHECKPOINT_STORE_OPERATION_FAILED;
        storeErr.originalError = e;
        throw storeErr;
    }

    if (!checkpoint) {
        return null;
    }

    return restoreExecutionState(checkpoint);
}

module.exports = {
    loadExecutionState,
    restoreExecutionState,
    validateRestorableCheckpoint
};
