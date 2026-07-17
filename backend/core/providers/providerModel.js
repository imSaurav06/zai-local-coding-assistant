"use strict";

const { validateProvider } = require("./providerValidator");
const { providerErrorCodes } = require("./providerErrors");

const PROVIDER_MODEL_VERSION = "1.0";

/**
 * Deep freezes a provider object recursively to guarantee strict immutability.
 *
 * @param {Object} obj The object to freeze
 */
function deepFreezeProvider(obj) {
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
            deepFreezeProvider(obj[prop]);
        }
    });
    return obj;
}

/**
 * Check if the given object is an instantiated deeply frozen Provider domain model.
 *
 * @param {Object} obj The object to inspect
 */
function isProvider(obj) {
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
        return false;
    }
    if (!Object.isFrozen(obj)) {
        return false;
    }
    const val = validateProvider(obj);
    return val.success;
}

/**
 * Pure function to construct a deeply frozen, validated Provider domain model.
 *
 * @param {Object} config The provider configuration input
 */
function createProvider(config) {
    if (config === null || config === undefined || typeof config !== "object" || Array.isArray(config)) {
        return {
            success: false,
            provider: null,
            errors: [{
                code: providerErrorCodes.PROVIDER_INVALID_INPUT,
                path: "",
                message: "Input configuration must be a non-null object."
            }]
        };
    }

    // Deep clone the input to guarantee no shared references or mutations
    const cloned = JSON.parse(JSON.stringify(config));

    // Default the model version if not specified
    if (!cloned.hasOwnProperty("version")) {
        cloned.version = PROVIDER_MODEL_VERSION;
    }

    const val = validateProvider(cloned);
    if (!val.success) {
        return {
            success: false,
            provider: null,
            errors: val.errors
        };
    }

    // Freeze to ensure immutability
    const provider = deepFreezeProvider(cloned);

    return {
        success: true,
        provider,
        errors: []
    };
}

module.exports = {
    createProvider,
    isProvider,
    deepFreezeProvider,
    PROVIDER_MODEL_VERSION
};
