"use strict";

const { checkpointErrorCodes } = require("./checkpointErrors");
const { validateCheckpoint } = require("./checkpointValidator");

const CURRENT_SERIALIZER_VERSION = "1.0";

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
 * Custom deep clone helper that does not freeze the result.
 */
function deepClone(val) {
    if (val === null || typeof val !== "object") {
        return val;
    }
    if (Array.isArray(val)) {
        return val.map(item => deepClone(item));
    }
    const copy = {};
    for (const key of Object.keys(val)) {
        copy[key] = deepClone(val[key]);
    }
    return copy;
}

/**
 * Recursively scans an object structure to reject any undefined values or functions.
 *
 * @param {any} obj The object or value to scan
 * @param {String} path The property path tracked for diagnostics
 */
function checkInvalidValues(obj, path = "") {
    if (obj === undefined) {
        const err = new Error(`Invalid value: 'undefined' detected at path '${path}'.`);
        err.code = checkpointErrorCodes.CHECKPOINT_INVALID_INPUT;
        throw err;
    }
    if (typeof obj === "function") {
        const err = new Error(`Invalid value: function detected at path '${path}'.`);
        err.code = checkpointErrorCodes.CHECKPOINT_INVALID_INPUT;
        throw err;
    }
    if (obj === null || typeof obj !== "object") {
        return;
    }
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            checkInvalidValues(obj[i], path ? `${path}[${i}]` : `[${i}]`);
        }
        return;
    }
    for (const key of Object.keys(obj)) {
        checkInvalidValues(obj[key], path ? `${path}.${key}` : key);
    }
}

/**
 * Normalizes a checkpoint to canonical property ordering.
 * Preserves the original array sequence for queues and workers.
 *
 * @param {Object} checkpoint The checkpoint to normalize
 */
function normalizeCheckpoint(checkpoint) {
    if (checkpoint === null || checkpoint === undefined) {
        const err = new Error("Invalid checkpoint: cannot be null or undefined.");
        err.code = checkpointErrorCodes.CHECKPOINT_INVALID_INPUT;
        throw err;
    }

    // Reject invalid serializable elements like functions or undefined
    checkInvalidValues(checkpoint);

    // Clone and freeze if not already frozen, to validate structurally
    const frozen = Object.isFrozen(checkpoint) ? checkpoint : deepFreeze(deepClone(checkpoint));
    const validation = validateCheckpoint(frozen);
    if (!validation.success) {
        const err = new Error(`Checkpoint validation failed: ${validation.errors[0].message}`);
        err.code = validation.errors[0].code;
        throw err;
    }

    if (frozen.version !== CURRENT_SERIALIZER_VERSION) {
        const err = new Error(`Incompatible checkpoint version: ${frozen.version}`);
        err.code = checkpointErrorCodes.CHECKPOINT_INCOMPATIBLE_VERSION;
        throw err;
    }

    const normalized = {};

    // 1. Enforce version and executionId
    normalized.version = frozen.version;
    if (frozen.hasOwnProperty("executionId")) {
        normalized.executionId = frozen.executionId;
    }

    // 2. Normalize metadata block (keys sorted alphabetically)
    const sortedMetadata = {};
    const metaKeys = Object.keys(frozen.metadata).sort();
    for (const k of metaKeys) {
        sortedMetadata[k] = frozen.metadata[k];
    }
    normalized.metadata = sortedMetadata;

    // 3. Normalize queues if present (keys sorted alphabetically, sequence preserved)
    if (frozen.hasOwnProperty("queues")) {
        const sortedQueues = {};
        const queueKeys = ["completed", "failed", "pending", "running"]; // alphabetical order
        for (const k of queueKeys) {
            if (frozen.queues.hasOwnProperty(k)) {
                // PATCH 1: Do NOT reorder queue lists - preserve original execution order
                sortedQueues[k] = [...frozen.queues[k]];
            }
        }
        normalized.queues = sortedQueues;
    }

    // 4. Normalize workers list if present (sequence preserved)
    if (frozen.hasOwnProperty("workers")) {
        // PATCH 1: Do NOT reorder workers array
        normalized.workers = [...frozen.workers];
    }

    // 5. Normalize statistics block if present (keys sorted alphabetically)
    if (frozen.hasOwnProperty("statistics")) {
        const sortedStats = {};
        const statKeys = Object.keys(frozen.statistics).sort();
        for (const k of statKeys) {
            sortedStats[k] = frozen.statistics[k];
        }
        normalized.statistics = sortedStats;
    }

    // Optional legacy compatibility fields
    if (frozen.hasOwnProperty("planner")) {
        normalized.planner = deepClone(frozen.planner);
    }
    if (frozen.hasOwnProperty("executionState")) {
        const sortedExecState = {};
        const execKeys = ["completedTasks", "failedTasks", "pendingTasks", "runningTasks"]; // alphabetical order
        for (const k of execKeys) {
            if (frozen.executionState.hasOwnProperty(k)) {
                // Preserved order for executionState lists
                sortedExecState[k] = [...frozen.executionState[k]];
            }
        }
        normalized.executionState = sortedExecState;
    }

    return deepFreeze(normalized);
}

/**
 * Serializes the checkpoint into a canonical JSON string.
 *
 * @param {Object} checkpoint The checkpoint to serialize
 */
function serializeCheckpoint(checkpoint) {
    if (checkpoint === null || checkpoint === undefined) {
        const err = new Error("Invalid checkpoint: cannot be null or undefined.");
        err.code = checkpointErrorCodes.CHECKPOINT_INVALID_INPUT;
        throw err;
    }

    // Validate that inputs do not contain functions or undefined
    checkInvalidValues(checkpoint);

    const normalized = normalizeCheckpoint(checkpoint);
    return JSON.stringify(normalized);
}

/**
 * Deserializes a canonical representation back into a frozen Checkpoint.
 *
 * @param {String|Object} serialized The serialized string or plain object
 */
function deserializeCheckpoint(serialized) {
    if (serialized === null || serialized === undefined) {
        const err = new Error("Invalid serialized payload: cannot be null or undefined.");
        err.code = checkpointErrorCodes.CHECKPOINT_INVALID_INPUT;
        throw err;
    }

    let parsed;
    if (typeof serialized === "string") {
        try {
            parsed = JSON.parse(serialized);
        } catch (e) {
            const err = new Error(`Malformed JSON payload: ${e.message}`);
            err.code = checkpointErrorCodes.CHECKPOINT_INVALID_STRUCTURE;
            throw err;
        }
    } else if (typeof serialized === "object" && !Array.isArray(serialized)) {
        parsed = deepClone(serialized);
    } else {
        const err = new Error("Invalid serialized payload: must be a string or object.");
        err.code = checkpointErrorCodes.CHECKPOINT_INVALID_INPUT;
        throw err;
    }

    const normalized = normalizeCheckpoint(parsed);
    return normalized;
}

/**
 * Deep clones a checkpoint.
 *
 * @param {Object} checkpoint The checkpoint to clone
 */
function cloneCheckpoint(checkpoint) {
    if (checkpoint === null || checkpoint === undefined) {
        const err = new Error("Invalid checkpoint: cannot be null or undefined.");
        err.code = checkpointErrorCodes.CHECKPOINT_INVALID_INPUT;
        throw err;
    }
    
    checkInvalidValues(checkpoint);
    const cloned = deepClone(checkpoint);
    return deepFreeze(cloned);
}

/**
 * Checks if the given object is a valid serialized checkpoint.
 *
 * @param {String|Object} object The payload to check
 */
function isSerializedCheckpoint(object) {
    if (object === null || object === undefined) {
        return false;
    }
    let parsed = object;
    if (typeof object === "string") {
        try {
            parsed = JSON.parse(object);
        } catch (e) {
            return false;
        }
    }
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
        return false;
    }
    try {
        checkInvalidValues(parsed);
        const frozen = deepFreeze(deepClone(parsed));
        const validation = validateCheckpoint(frozen);
        return validation.success && frozen.version === CURRENT_SERIALIZER_VERSION;
    } catch (e) {
        return false;
    }
}

module.exports = {
    serializeCheckpoint,
    deserializeCheckpoint,
    cloneCheckpoint,
    normalizeCheckpoint,
    isSerializedCheckpoint,
    CURRENT_SERIALIZER_VERSION
};
