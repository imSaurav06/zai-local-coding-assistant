"use strict";

const { createInitialCheckpoint, createRuntimeCheckpoint, persistCheckpoint, CheckpointStore } = require("../checkpoints");
const { checkpointBridgeErrorCodes } = require("./checkpointBridgeErrors");

const CHECKPOINT_BRIDGE_VERSION = "1.0";

/**
 * Concrete in-memory CheckpointStore implementation to act as the default store for the bridge.
 */
class InMemoryCheckpointStore extends CheckpointStore {
    constructor() {
        super();
        this.store = new Map();
    }

    async save(checkpoint) {
        if (!checkpoint || !checkpoint.executionId) {
            throw new Error("Invalid checkpoint: missing executionId.");
        }
        this.store.set(checkpoint.executionId, checkpoint);
    }

    async load(executionId) {
        if (!this.store.has(executionId)) {
            throw new Error(`Checkpoint not found: ${executionId}`);
        }
        return this.store.get(executionId);
    }

    async exists(executionId) {
        return this.store.has(executionId);
    }

    async delete(executionId) {
        this.store.delete(executionId);
    }

    async list() {
        return Array.from(this.store.keys());
    }

    async health() {
        return { status: "OK", count: this.store.size };
    }
}

/**
 * Deep freezes an object recursively to guarantee immutability.
 *
 * @param {Object} obj The object to freeze
 */
function deepFreezeCheckpointResult(obj) {
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
            deepFreezeCheckpointResult(obj[prop]);
        }
    });
    return obj;
}

/**
 * Validates the input executionState payload.
 *
 * @param {Object} executionState State to validate
 */
function validateCheckpointBridgeRequest(executionState) {
    if (executionState === null || executionState === undefined || typeof executionState !== "object" || Array.isArray(executionState)) {
        return {
            success: false,
            errors: [{
                code: checkpointBridgeErrorCodes.CHECKPOINT_BRIDGE_INVALID_INPUT,
                path: "",
                message: "Execution state must be a non-null object."
            }]
        };
    }

    const errors = [];

    // Ensure it is frozen (immutable)
    if (!Object.isFrozen(executionState)) {
        errors.push({
            code: checkpointBridgeErrorCodes.CHECKPOINT_BRIDGE_INVALID_INPUT,
            path: "",
            message: "Execution state must be deeply frozen."
        });
    }

    // Required fields check
    const required = ["queues", "statistics"];
    for (const req of required) {
        if (!executionState.hasOwnProperty(req)) {
            errors.push({
                code: checkpointBridgeErrorCodes.CHECKPOINT_BRIDGE_INVALID_STATE,
                path: req,
                message: `Property '${req}' is required.`
            });
        }
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    // Check queues lists
    const queues = executionState.queues;
    if (queues === null || typeof queues !== "object" || Array.isArray(queues)) {
        errors.push({
            code: checkpointBridgeErrorCodes.CHECKPOINT_BRIDGE_INVALID_STATE,
            path: "queues",
            message: "queues must be an object."
        });
    } else {
        const queueFields = ["pending", "running", "completed", "failed"];
        for (const q of queueFields) {
            if (!queues.hasOwnProperty(q) || !Array.isArray(queues[q])) {
                errors.push({
                    code: checkpointBridgeErrorCodes.CHECKPOINT_BRIDGE_INVALID_STATE,
                    path: `queues.${q}`,
                    message: `queues.${q} must be an array.`
                });
            }
        }
    }

    // Check statistics structure
    const statistics = executionState.statistics;
    if (statistics === null || typeof statistics !== "object" || Array.isArray(statistics)) {
        errors.push({
            code: checkpointBridgeErrorCodes.CHECKPOINT_BRIDGE_INVALID_STATE,
            path: "statistics",
            message: "statistics must be an object."
        });
    } else {
        const statsFields = ["totalTasks", "pending", "running", "completed", "failed"];
        for (const sf of statsFields) {
            if (!statistics.hasOwnProperty(sf) || typeof statistics[sf] !== "number") {
                errors.push({
                    code: checkpointBridgeErrorCodes.CHECKPOINT_BRIDGE_INVALID_STATE,
                    path: `statistics.${sf}`,
                    message: `statistics.${sf} must be a number.`
                });
            }
        }
    }

    return {
        success: errors.length === 0,
        errors
    };
}

/**
 * Lifecycle hook executing at startup.
 *
 * @param {Object} executionState Mapped execution state
 */
async function initializeExecutionCheckpoint(executionState, options = {}) {
    if (!this.config.enableCheckpointPersistence) {
        return deepFreezeCheckpointResult({ success: true, checkpoint: null });
    }

    const val = validateCheckpointBridgeRequest(executionState);
    if (!val.success) {
        const err = new Error(`Invalid execution state: ${val.errors[0].message}`);
        err.code = val.errors[0].code;
        err.originalErrors = val.errors;
        throw err;
    }

    try {
        const checkpoint = createInitialCheckpoint(executionState);
        await persistCheckpoint(checkpoint, this.config.checkpointStore);
        if (options.metricsCollector && typeof options.metricsCollector.recordCheckpointSave === "function") {
            options.metricsCollector.recordCheckpointSave();
        }
        return deepFreezeCheckpointResult({ success: true, checkpoint });
    } catch (err) {
        const bridgeErr = new Error(`Checkpoint initialize failed: ${err.message}`);
        bridgeErr.code = checkpointBridgeErrorCodes.CHECKPOINT_BRIDGE_FAILED;
        bridgeErr.originalError = err;
        throw bridgeErr;
    }
}

/**
 * Lifecycle hook executing at intermediate runtime cycles.
 *
 * @param {Object} executionState Mapped execution state
 */
async function updateExecutionCheckpoint(executionState, options = {}) {
    if (!this.config.enableCheckpointPersistence) {
        return deepFreezeCheckpointResult({ success: true, checkpoint: null });
    }

    const val = validateCheckpointBridgeRequest(executionState);
    if (!val.success) {
        const err = new Error(`Invalid execution state: ${val.errors[0].message}`);
        err.code = val.errors[0].code;
        err.originalErrors = val.errors;
        throw err;
    }

    try {
        const checkpoint = createRuntimeCheckpoint(executionState);
        await persistCheckpoint(checkpoint, this.config.checkpointStore);
        if (options.metricsCollector && typeof options.metricsCollector.recordCheckpointSave === "function") {
            options.metricsCollector.recordCheckpointSave();
        }
        return deepFreezeCheckpointResult({ success: true, checkpoint });
    } catch (err) {
        const bridgeErr = new Error(`Checkpoint update failed: ${err.message}`);
        bridgeErr.code = checkpointBridgeErrorCodes.CHECKPOINT_BRIDGE_FAILED;
        bridgeErr.originalError = err;
        throw bridgeErr;
    }
}

/**
 * Lifecycle hook executing when execution terminates.
 *
 * @param {Object} executionState Mapped execution state
 */
async function finalizeExecutionCheckpoint(executionState, options = {}) {
    if (!this.config.enableCheckpointPersistence) {
        return deepFreezeCheckpointResult({ success: true, checkpoint: null });
    }

    const val = validateCheckpointBridgeRequest(executionState);
    if (!val.success) {
        const err = new Error(`Invalid execution state: ${val.errors[0].message}`);
        err.code = val.errors[0].code;
        err.originalErrors = val.errors;
        throw err;
    }

    try {
        const checkpoint = createRuntimeCheckpoint(executionState);
        await persistCheckpoint(checkpoint, this.config.checkpointStore);
        if (options.metricsCollector && typeof options.metricsCollector.recordCheckpointSave === "function") {
            options.metricsCollector.recordCheckpointSave();
        }
        return deepFreezeCheckpointResult({ success: true, checkpoint });
    } catch (err) {
        const bridgeErr = new Error(`Checkpoint finalize failed: ${err.message}`);
        bridgeErr.code = checkpointBridgeErrorCodes.CHECKPOINT_BRIDGE_FAILED;
        bridgeErr.originalError = err;
        throw bridgeErr;
    }
}

/**
 * Factory instantiating a Checkpoint Bridge object.
 *
 * @param {Object} [config] Custom configuration options
 */
function createCheckpointBridge(config = {}) {
    const enableCheckpointPersistence = !!config.enableCheckpointPersistence;

    let checkpointStore = config.checkpointStore || null;
    if (enableCheckpointPersistence) {
        if (!checkpointStore) {
            const { createMongoCheckpointStore } = require("../checkpoints");
            checkpointStore = createMongoCheckpointStore();
        }

        if (checkpointStore === null || checkpointStore === undefined) {
            const err = new Error("CheckpointStore injection failed: store cannot be null when persistence is enabled.");
            err.code = checkpointBridgeErrorCodes.CHECKPOINT_BRIDGE_INVALID_STORE;
            throw err;
        }

        // Validate interface methods
        const requiredMethods = ["save", "load", "exists", "delete", "list", "health"];
        for (const m of requiredMethods) {
            if (typeof checkpointStore[m] !== "function") {
                const err = new Error(`Invalid CheckpointStore: method '${m}' is not implemented.`);
                err.code = checkpointBridgeErrorCodes.CHECKPOINT_BRIDGE_INVALID_STORE;
                throw err;
            }
        }
    }

    const bridge = {
        config: Object.freeze({
            enableCheckpointPersistence,
            checkpointStore
        }),
        initializeExecutionCheckpoint,
        updateExecutionCheckpoint,
        finalizeExecutionCheckpoint,
        async restoreExecutionCheckpoint(executionId, taskGraph, options = {}) {
            if (!enableCheckpointPersistence) {
                const err = new Error("Checkpoint persistence is disabled.");
                err.code = "CHECKPOINT_RESUME_INVALID";
                throw err;
            }
            const { loadCheckpoint } = require("../checkpoint/checkpointRestore");
            const checkpoint = await loadCheckpoint(executionId, checkpointStore, taskGraph);
            if (options.metricsCollector && typeof options.metricsCollector.recordCheckpointRestore === "function") {
                options.metricsCollector.recordCheckpointRestore();
            }
            return checkpoint;
        }
    };

    return Object.freeze(bridge);
}

module.exports = {
    createCheckpointBridge,
    validateCheckpointBridgeRequest,
    checkpointBridgeErrorCodes,
    CHECKPOINT_BRIDGE_VERSION,
    InMemoryCheckpointStore
};
