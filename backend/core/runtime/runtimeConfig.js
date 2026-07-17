"use strict";

const { runtimeConfigErrorCodes } = require("./runtimeConfigErrors");

const RUNTIME_CONFIG_VERSION = "1.0";

const CANONICAL_KEYS = new Set([
    "runtimeMode",
    "maxConcurrentWorkers",
    "enableShadowValidation",
    "enableRuntimeMetrics",
    "enableCheckpointPersistence",
    "enableVerification",
    "enableRepair"
]);

const ALLOWED_MODES = new Set(["LEGACY", "MODULAR", "SHADOW"]);

/**
 * Validates a runtime configuration object.
 *
 * @param {Object} config Configuration to validate
 */
function validateRuntimeConfig(config) {
    if (config === null || config === undefined || typeof config !== "object" || Array.isArray(config)) {
        return {
            success: false,
            errors: [{
                code: runtimeConfigErrorCodes.RUNTIME_CONFIG_INVALID_INPUT,
                path: "",
                message: "Configuration must be a non-null object."
            }]
        };
    }

    const errors = [];

    // 1. Unknown properties check
    for (const key of Object.keys(config)) {
        if (!CANONICAL_KEYS.has(key)) {
            errors.push({
                code: runtimeConfigErrorCodes.RUNTIME_CONFIG_UNKNOWN_PROPERTY,
                path: key,
                message: `Unknown property key: '${key}'`
            });
        }
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    // 2. Validate runtimeMode
    if (config.hasOwnProperty("runtimeMode")) {
        if (typeof config.runtimeMode !== "string") {
            errors.push({
                code: runtimeConfigErrorCodes.RUNTIME_CONFIG_INVALID_MODE,
                path: "runtimeMode",
                message: "runtimeMode must be a string."
            });
        } else if (!ALLOWED_MODES.has(config.runtimeMode)) {
            errors.push({
                code: runtimeConfigErrorCodes.RUNTIME_CONFIG_INVALID_MODE,
                path: "runtimeMode",
                message: `Property 'runtimeMode' must be one of: ${Array.from(ALLOWED_MODES).join(", ")}.`
            });
        }
    }

    // 3. Validate maxConcurrentWorkers
    if (config.hasOwnProperty("maxConcurrentWorkers")) {
        const workers = config.maxConcurrentWorkers;
        if (typeof workers !== "number" || !Number.isInteger(workers)) {
            errors.push({
                code: runtimeConfigErrorCodes.RUNTIME_CONFIG_INVALID_STRUCTURE,
                path: "maxConcurrentWorkers",
                message: "maxConcurrentWorkers must be an integer."
            });
        } else if (workers < 0) {
            errors.push({
                code: runtimeConfigErrorCodes.RUNTIME_CONFIG_INVALID_STRUCTURE,
                path: "maxConcurrentWorkers",
                message: "maxConcurrentWorkers must be a non-negative integer."
            });
        }
    }

    // 4. Validate boolean flags
    const booleans = [
        "enableShadowValidation",
        "enableRuntimeMetrics",
        "enableCheckpointPersistence",
        "enableVerification",
        "enableRepair"
    ];
    for (const boolField of booleans) {
        if (config.hasOwnProperty(boolField) && typeof config[boolField] !== "boolean") {
            errors.push({
                code: runtimeConfigErrorCodes.RUNTIME_CONFIG_INVALID_STRUCTURE,
                path: boolField,
                message: `${boolField} must be a boolean.`
            });
        }
    }

    return {
        success: errors.length === 0,
        errors
    };
}

/**
 * Deep freezes a configuration object recursively.
 *
 * @param {Object} obj The object to freeze
 */
function deepFreezeRuntimeConfig(obj) {
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
            deepFreezeRuntimeConfig(obj[prop]);
        }
    });
    return obj;
}

/**
 * Instantiates a validated, frozen runtime configuration.
 *
 * @param {Object} config Custom configuration overrides
 */
function createRuntimeConfig(config) {
    const val = validateRuntimeConfig(config);
    if (!val.success) {
        return {
            success: false,
            runtimeConfig: null,
            errors: val.errors
        };
    }

    const finalized = {
        runtimeMode: (config && config.runtimeMode) || "LEGACY",
        maxConcurrentWorkers: (config && config.maxConcurrentWorkers !== undefined) ? config.maxConcurrentWorkers : 3,
        enableShadowValidation: !!(config && config.enableShadowValidation),
        enableRuntimeMetrics: !!(config && config.enableRuntimeMetrics),
        enableCheckpointPersistence: !!(config && config.enableCheckpointPersistence),
        enableVerification: !!(config && config.enableVerification),
        enableRepair: !!(config && config.enableRepair)
    };

    const frozen = deepFreezeRuntimeConfig(finalized);
    return {
        success: true,
        runtimeConfig: frozen,
        errors: []
    };
}

/**
 * Checks if the given object is an instantiated, valid, frozen runtime configuration.
 *
 * @param {Object} obj The object to check
 */
function isRuntimeConfig(obj) {
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
        return false;
    }
    if (!Object.isFrozen(obj)) {
        return false;
    }
    const val = validateRuntimeConfig(obj);
    return val.success;
}

/**
 * Loads the configuration from environment context.
 */
function loadRuntimeConfig() {
    const rawMode = process.env.RUNTIME_MODE || "LEGACY";
    const rawWorkers = process.env.MAX_CONCURRENT_WORKERS !== undefined
        ? parseInt(process.env.MAX_CONCURRENT_WORKERS, 10)
        : 3;
    const rawShadow = process.env.ENABLE_SHADOW_VALIDATION === "true";
    const rawMetrics = process.env.ENABLE_RUNTIME_METRICS === "true";
    const rawCheckpoint = process.env.ENABLE_CHECKPOINT_PERSISTENCE === "true";
    const rawVerification = process.env.ENABLE_VERIFICATION === "true";
    const rawRepair = process.env.ENABLE_REPAIR === "true";

    const config = {
        runtimeMode: rawMode,
        maxConcurrentWorkers: rawWorkers,
        enableShadowValidation: rawShadow,
        enableRuntimeMetrics: rawMetrics,
        enableCheckpointPersistence: rawCheckpoint,
        enableVerification: rawVerification,
        enableRepair: rawRepair
    };

    const res = createRuntimeConfig(config);
    if (!res.success) {
        const err = new Error(`Invalid runtime configuration from environment: ${res.errors[0].message}`);
        err.code = res.errors[0].code;
        throw err;
    }
    return res.runtimeConfig;
}

module.exports = {
    createRuntimeConfig,
    loadRuntimeConfig,
    validateRuntimeConfig,
    isRuntimeConfig,
    deepFreezeRuntimeConfig,
    runtimeConfigErrorCodes,
    RUNTIME_CONFIG_VERSION
};
