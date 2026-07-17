"use strict";

const { checkpointStoreErrorCodes } = require("./checkpointStoreErrors");

class CheckpointStore {
    /**
     * Persists a Checkpoint object.
     *
     * @param {Object} checkpoint The validated domain Checkpoint to save
     * @returns {Promise<void>}
     */
    async save(checkpoint) {
        const err = new Error("Method 'save' is not implemented in the base CheckpointStore interface.");
        err.code = checkpointStoreErrorCodes.CHECKPOINT_STORE_NOT_IMPLEMENTED;
        throw err;
    }

    /**
     * Loads a Checkpoint object by its executionId.
     *
     * @param {String} executionId The execution identifier
     * @returns {Promise<Object>} The restored Checkpoint domain model
     */
    async load(executionId) {
        const err = new Error("Method 'load' is not implemented in the base CheckpointStore interface.");
        err.code = checkpointStoreErrorCodes.CHECKPOINT_STORE_NOT_IMPLEMENTED;
        throw err;
    }

    /**
     * Checks if a Checkpoint exists for the given executionId.
     *
     * @param {String} executionId The execution identifier
     * @returns {Promise<Boolean>}
     */
    async exists(executionId) {
        const err = new Error("Method 'exists' is not implemented in the base CheckpointStore interface.");
        err.code = checkpointStoreErrorCodes.CHECKPOINT_STORE_NOT_IMPLEMENTED;
        throw err;
    }

    /**
     * Deletes a Checkpoint by its executionId.
     *
     * @param {String} executionId The execution identifier
     * @returns {Promise<void>}
     */
    async delete(executionId) {
        const err = new Error("Method 'delete' is not implemented in the base CheckpointStore interface.");
        err.code = checkpointStoreErrorCodes.CHECKPOINT_STORE_NOT_IMPLEMENTED;
        throw err;
    }

    /**
     * Lists all checkpoint identifiers in the store.
     *
     * @returns {Promise<Array<String>>} List of executionId strings
     */
    async list() {
        const err = new Error("Method 'list' is not implemented in the base CheckpointStore interface.");
        err.code = checkpointStoreErrorCodes.CHECKPOINT_STORE_NOT_IMPLEMENTED;
        throw err;
    }

    /**
     * Checks store health and connectivity status.
     *
     * @returns {Promise<Object>} Health check report
     */
    async health() {
        const err = new Error("Method 'health' is not implemented in the base CheckpointStore interface.");
        err.code = checkpointStoreErrorCodes.CHECKPOINT_STORE_NOT_IMPLEMENTED;
        throw err;
    }
}

/**
 * Factory function to instantiate the default abstract CheckpointStore.
 */
function createCheckpointStore() {
    const store = new CheckpointStore();
    
    // Deep freeze the instance contract and methods
    Object.freeze(store);
    
    return store;
}

module.exports = {
    CheckpointStore,
    createCheckpointStore
};
