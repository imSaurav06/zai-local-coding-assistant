"use strict";

const { runtimeRouterErrorCodes } = require("./runtimeRouterErrors");
const { createLegacyRuntimeAdapter } = require("./legacyRuntimeAdapter");
const { createModularRuntimeAdapter } = require("./modularRuntimeAdapter");

const RUNTIME_ROUTER_VERSION = "1.0";

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
 * Ensures the chosen mode is valid.
 *
 * @param {String} mode Mode to check
 */
function validateRuntimeSelection(mode) {
    const ALLOWED_MODES = new Set(["LEGACY", "MODULAR", "SHADOW"]);
    if (typeof mode !== "string" || !ALLOWED_MODES.has(mode)) {
        const err = new Error(`Unsupported runtime mode: '${mode}'`);
        err.code = runtimeRouterErrorCodes.RUNTIME_ROUTER_INVALID_MODE;
        throw err;
    }
    return true;
}

/**
 * Selects the runtime adapter instance based on configuration.
 *
 * @param {Object} config Config containing runtimeMode
 */
function selectRuntime(config) {
    if (config === null || config === undefined || typeof config !== "object") {
        const err = new Error("Config must be a non-null object.");
        err.code = runtimeRouterErrorCodes.RUNTIME_ROUTER_INVALID_REQUEST;
        throw err;
    }
    if (!Object.isFrozen(config)) {
        const err = new Error("Config must be frozen.");
        err.code = runtimeRouterErrorCodes.RUNTIME_ROUTER_INVALID_REQUEST;
        throw err;
    }
    const mode = config.runtimeMode || "LEGACY";
    validateRuntimeSelection(mode);

    if (mode === "LEGACY") {
        return createLegacyRuntimeAdapter();
    } else if (mode === "MODULAR") {
        return createModularRuntimeAdapter();
    } else if (mode === "SHADOW") {
        const { createShadowRuntime } = require("./shadowRuntime");
        return createShadowRuntime();
    }

    const unknownErr = new Error(`Unknown adapter implementation for mode: '${mode}'`);
    unknownErr.code = runtimeRouterErrorCodes.RUNTIME_ROUTER_UNKNOWN_ADAPTER;
    throw unknownErr;
}

/**
 * Factory instantiating a runtime router instance.
 *
 * @param {Object} config Router config
 */
function createRuntimeRouter(config) {
    const router = {
        config: Object.freeze(config || {}),
        selectRuntime() {
            return selectRuntime(this.config);
        },
        validateRuntimeSelection(mode) {
            return validateRuntimeSelection(mode);
        }
    };
    return Object.freeze(router);
}

module.exports = {
    createRuntimeRouter,
    selectRuntime,
    validateRuntimeSelection,
    runtimeRouterErrorCodes,
    RUNTIME_ROUTER_VERSION
};
