"use strict";

const { createCheckpoint } = require("./checkpointModel");
const { checkpointErrorCodes } = require("./checkpointErrors");
const { checkpointStoreErrorCodes } = require("./checkpointStoreErrors");

/**
 * Creates an initial Checkpoint based on the provided ExecutionState.
 *
 * @param {Object} executionState The execution state containing queues and stats
 */
function createInitialCheckpoint(executionState) {
    if (executionState === null || executionState === undefined || typeof executionState !== "object") {
        const err = new Error("Invalid executionState: must be a non-null object.");
        err.code = checkpointErrorCodes.CHECKPOINT_INVALID_INPUT;
        throw err;
    }

    const metadata = executionState.metadata || {};
    const executionId = metadata.executionId || "exec_initial";
    const createdAt = metadata.createdAt || new Date().toISOString();

    const opts = {
        version: "1.0",
        executionId,
        metadata: {
            createdAt,
            updatedAt: new Date().toISOString(),
            waveNumber: 0
        },
        queues: {
            pending: [...(executionState.queues?.pending || [])],
            running: [...(executionState.queues?.running || [])],
            completed: [...(executionState.queues?.completed || [])],
            failed: [...(executionState.queues?.failed || [])]
        },
        workers: [],
        statistics: {
            completedTasks: executionState.statistics?.completed || 0,
            failedTasks: executionState.statistics?.failed || 0,
            totalTasks: executionState.statistics?.totalTasks || 0
        }
    };

    const res = createCheckpoint(opts);
    if (!res.success) {
        const err = new Error(`Failed to create initial checkpoint: ${res.errors[0].message}`);
        err.code = res.errors[0].code;
        throw err;
    }

    return res.checkpoint;
}

/**
 * Creates a runtime Checkpoint based on the current ExecutionState.
 *
 * @param {Object} executionState The current execution state
 */
function createRuntimeCheckpoint(executionState) {
    if (executionState === null || executionState === undefined || typeof executionState !== "object") {
        const err = new Error("Invalid executionState: must be a non-null object.");
        err.code = checkpointErrorCodes.CHECKPOINT_INVALID_INPUT;
        throw err;
    }

    const metadata = executionState.metadata || {};
    const executionId = metadata.executionId || "exec_runtime";
    const createdAt = metadata.createdAt || new Date().toISOString();
    const waveNumber = metadata.waveNumber || metadata.currentWave || 0;

    const opts = {
        version: "1.0",
        executionId,
        metadata: {
            createdAt,
            updatedAt: new Date().toISOString(),
            waveNumber
        },
        queues: {
            pending: [...(executionState.queues?.pending || [])],
            running: [...(executionState.queues?.running || [])],
            completed: [...(executionState.queues?.completed || [])],
            failed: [...(executionState.queues?.failed || [])]
        },
        workers: [...(executionState.workers || [])],
        statistics: {
            completedTasks: executionState.statistics?.completed || 0,
            failedTasks: executionState.statistics?.failed || 0,
            totalTasks: executionState.statistics?.totalTasks || 0
        }
    };

    const res = createCheckpoint(opts);
    if (!res.success) {
        const err = new Error(`Failed to create runtime checkpoint: ${res.errors[0].message}`);
        err.code = res.errors[0].code;
        throw err;
    }

    return res.checkpoint;
}

/**
 * Delegates persistence of a checkpoint to a CheckpointStore.
 *
 * @param {Object} checkpoint The checkpoint to persist
 * @param {Object} checkpointStore The persistence store implementation
 */
async function persistCheckpoint(checkpoint, checkpointStore) {
    if (checkpoint === null || checkpoint === undefined) {
        const err = new Error("Invalid checkpoint: cannot be null or undefined.");
        err.code = checkpointErrorCodes.CHECKPOINT_INVALID_INPUT;
        throw err;
    }

    if (checkpointStore === null || checkpointStore === undefined || typeof checkpointStore.save !== "function") {
        const err = new Error("Invalid checkpointStore: must implement CheckpointStore interface with save().");
        err.code = checkpointStoreErrorCodes.CHECKPOINT_STORE_INVALID_ARGUMENT;
        throw err;
    }

    await checkpointStore.save(checkpoint);
}

/**
 * Determines whether the event should trigger a checkpoint request.
 *
 * @param {String} event The runtime event string
 */
function shouldCreateCheckpoint(event) {
    const allowedEvents = [
        "EXECUTION_STARTED",
        "WORKER_COMPLETED",
        "PIPELINE_COMPLETED",
        "PIPELINE_FAILED"
    ];
    return allowedEvents.includes(event);
}

module.exports = {
    createInitialCheckpoint,
    createRuntimeCheckpoint,
    persistCheckpoint,
    shouldCreateCheckpoint
};
