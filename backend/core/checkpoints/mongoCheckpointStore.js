"use strict";

const { CheckpointStore } = require("./checkpointStore");
const { checkpointStoreErrorCodes } = require("./checkpointStoreErrors");
const CheckpointModel = require("./checkpointSchema");
const { serializeCheckpoint, deserializeCheckpoint } = require("./checkpointSerializer");
const { validateCheckpoint } = require("./checkpointValidator");

class MongoCheckpointStore extends CheckpointStore {
    /**
     * Persists a Checkpoint object into MongoDB.
     *
     * @param {Object} checkpoint The validated domain Checkpoint to save
     * @returns {Promise<void>}
     */
    async save(checkpoint) {
        try {
            if (checkpoint === null || checkpoint === undefined) {
                const err = new Error("Invalid checkpoint: cannot be null or undefined.");
                err.code = checkpointStoreErrorCodes.CHECKPOINT_STORE_INVALID_ARGUMENT;
                throw err;
            }

            // Run domain validation
            const val = validateCheckpoint(checkpoint);
            if (!val.success) {
                const err = new Error(`Checkpoint validation failed: ${val.errors[0].message}`);
                err.code = val.errors[0].code;
                throw err;
            }

            // Serialize checkpoint
            const serialized = serializeCheckpoint(checkpoint);

            // Upsert by executionId
            await CheckpointModel.findOneAndUpdate(
                { executionId: checkpoint.executionId },
                {
                    executionId: checkpoint.executionId,
                    version: checkpoint.version,
                    payload: serialized
                },
                { upsert: true, new: true, runValidators: true }
            );

        } catch (err) {
            // Re-throw validation or invalid argument errors
            if (err.code && err.code !== checkpointStoreErrorCodes.CHECKPOINT_STORE_OPERATION_FAILED) {
                throw err;
            }
            // Map native database failures
            const dbErr = new Error(`MongoDB save operation failed: ${err.message}`);
            dbErr.code = checkpointStoreErrorCodes.CHECKPOINT_STORE_OPERATION_FAILED;
            dbErr.originalError = err;
            throw dbErr;
        }
    }

    /**
     * Loads a Checkpoint object by its executionId from MongoDB.
     *
     * @param {String} executionId The execution identifier
     * @returns {Promise<Object|null>} The restored Checkpoint domain model
     */
    async load(executionId) {
        try {
            if (typeof executionId !== "string" || executionId.trim() === "") {
                const err = new Error("Invalid executionId: must be a non-empty string.");
                err.code = checkpointStoreErrorCodes.CHECKPOINT_STORE_INVALID_ARGUMENT;
                throw err;
            }

            const doc = await CheckpointModel.findOne({ executionId });
            if (!doc) {
                return null;
            }

            // Restore domain object using serializer
            const restored = deserializeCheckpoint(doc.payload);
            return restored;

        } catch (err) {
            if (err.code && err.code !== checkpointStoreErrorCodes.CHECKPOINT_STORE_OPERATION_FAILED) {
                throw err;
            }
            const dbErr = new Error(`MongoDB load operation failed: ${err.message}`);
            dbErr.code = checkpointStoreErrorCodes.CHECKPOINT_STORE_OPERATION_FAILED;
            dbErr.originalError = err;
            throw dbErr;
        }
    }

    /**
     * Checks if a Checkpoint exists for the given executionId in MongoDB.
     *
     * @param {String} executionId The execution identifier
     * @returns {Promise<Boolean>}
     */
    async exists(executionId) {
        try {
            if (typeof executionId !== "string" || executionId.trim() === "") {
                const err = new Error("Invalid executionId: must be a non-empty string.");
                err.code = checkpointStoreErrorCodes.CHECKPOINT_STORE_INVALID_ARGUMENT;
                throw err;
            }

            const count = await CheckpointModel.countDocuments({ executionId });
            return count > 0;

        } catch (err) {
            if (err.code && err.code !== checkpointStoreErrorCodes.CHECKPOINT_STORE_OPERATION_FAILED) {
                throw err;
            }
            const dbErr = new Error(`MongoDB exists operation failed: ${err.message}`);
            dbErr.code = checkpointStoreErrorCodes.CHECKPOINT_STORE_OPERATION_FAILED;
            dbErr.originalError = err;
            throw dbErr;
        }
    }

    /**
     * Deletes a Checkpoint by its executionId in MongoDB.
     *
     * @param {String} executionId The execution identifier
     * @returns {Promise<void>}
     */
    async delete(executionId) {
        try {
            if (typeof executionId !== "string" || executionId.trim() === "") {
                const err = new Error("Invalid executionId: must be a non-empty string.");
                err.code = checkpointStoreErrorCodes.CHECKPOINT_STORE_INVALID_ARGUMENT;
                throw err;
            }

            await CheckpointModel.deleteOne({ executionId });

        } catch (err) {
            if (err.code && err.code !== checkpointStoreErrorCodes.CHECKPOINT_STORE_OPERATION_FAILED) {
                throw err;
            }
            const dbErr = new Error(`MongoDB delete operation failed: ${err.message}`);
            dbErr.code = checkpointStoreErrorCodes.CHECKPOINT_STORE_OPERATION_FAILED;
            dbErr.originalError = err;
            throw dbErr;
        }
    }

    /**
     * Lists all checkpoint identifiers in MongoDB.
     *
     * @returns {Promise<Array<String>>} List of executionId strings
     */
    async list() {
        try {
            const docs = await CheckpointModel.find({}, { executionId: 1 }).lean();
            return docs.map(d => d.executionId);

        } catch (err) {
            const dbErr = new Error(`MongoDB list operation failed: ${err.message}`);
            dbErr.code = checkpointStoreErrorCodes.CHECKPOINT_STORE_OPERATION_FAILED;
            dbErr.originalError = err;
            throw dbErr;
        }
    }

    /**
     * Checks MongoDB connection health status.
     *
     * @returns {Promise<Object>} Health check report
     */
    async health() {
        try {
            const mongoose = require("mongoose");
            const dbState = mongoose.connection.readyState;
            const states = {
                0: "disconnected",
                1: "connected",
                2: "connecting",
                3: "disconnecting"
            };
            const status = states[dbState] || "unknown";

            return {
                status: status === "connected" ? "healthy" : "unhealthy",
                details: {
                    connectionState: status,
                    readyState: dbState
                }
            };
        } catch (err) {
            const dbErr = new Error(`MongoDB health check failed: ${err.message}`);
            dbErr.code = checkpointStoreErrorCodes.CHECKPOINT_STORE_OPERATION_FAILED;
            dbErr.originalError = err;
            throw dbErr;
        }
    }
}

/**
 * Factory function to instantiate a MongoCheckpointStore.
 */
function createMongoCheckpointStore() {
    const store = new MongoCheckpointStore();
    Object.freeze(store);
    return store;
}

module.exports = {
    MongoCheckpointStore,
    createMongoCheckpointStore
};
