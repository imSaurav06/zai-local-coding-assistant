"use strict";

const { runtimeRouterErrorCodes } = require("./runtimeRouterErrors");
const { executeLegacy } = require("./legacyRuntimeAdapter");
const { executeModular } = require("./modularRuntimeAdapter");

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
 * Selects the runtime mode from configuration.
 *
 * @param {Object} config Config containing runtimeMode
 */
function selectRuntime(config) {
    if (config === null || config === undefined || typeof config !== "object") {
        const err = new Error("Config must be a non-null object.");
        err.code = runtimeRouterErrorCodes.RUNTIME_ROUTER_INVALID_REQUEST;
        throw err;
    }
    const mode = config.runtimeMode || "LEGACY";
    validateRuntimeSelection(mode);
    return mode;
}

/**
 * Executes the Shadow Runtime validation flow.
 */
async function executeShadowFlow(adapter, request) {
    const legacyResponse = await executeLegacy(adapter, request);

    // Background modular validation triggered if enableShadowRuntime is active
    const { executeShadow } = require("./shadowRuntime");
    await executeShadow(adapter, request, legacyResponse);

    return legacyResponse;
}

/**
 * Main routing entry method.
 *
 * @param {Object} adapter Execution adapter instance
 * @param {Object} request Executed request
 */
async function executeRuntime(adapter, request) {
    if (!adapter || typeof adapter !== "object" || !adapter.config) {
        const err = new Error("Invalid adapter parameter.");
        err.code = runtimeRouterErrorCodes.RUNTIME_ROUTER_INVALID_REQUEST;
        throw err;
    }

    const mode = selectRuntime(adapter.config);

    try {
        if (mode === "LEGACY") {
            return await executeLegacy(adapter, request);
        } else if (mode === "MODULAR") {
            return await executeModular(adapter, request);
        } else if (mode === "SHADOW") {
            return await executeShadowFlow(adapter, request);
        }
    } catch (err) {
        // Let bridge adapter validation errors bubble directly
        const adapterErrorCodes = new Set([
            "VERIFICATION_REPAIR_INVALID_INPUT",
            "VERIFICATION_REPAIR_VERIFICATION_FAILED",
            "VERIFICATION_REPAIR_REPAIR_FAILED",
            "VERIFICATION_REPAIR_BRIDGE_FAILED"
        ]);
        if (err.code && (
            adapterErrorCodes.has(err.code) || 
            err.code === "PARITY_VALIDATION_FAILED" ||
            err.code.startsWith("RUNTIME_ROUTER_") || 
            err.code.startsWith("SHADOW_")
        )) {
            throw err;
        }
        const execErr = new Error(`Runtime routing execution failed: ${err.message}`);
        execErr.code = runtimeRouterErrorCodes.RUNTIME_ROUTER_EXECUTION_FAILED;
        execErr.originalError = err;
        throw execErr;
    }
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
        executeRuntime(adapter, request) {
            return executeRuntime(adapter, request);
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
    executeRuntime,
    validateRuntimeSelection,
    runtimeRouterErrorCodes,
    RUNTIME_ROUTER_VERSION
};
