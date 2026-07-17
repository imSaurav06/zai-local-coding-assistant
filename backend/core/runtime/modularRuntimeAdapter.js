"use strict";

const MODULAR_RUNTIME_ADAPTER_VERSION = "1.0";

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
 * Executes execution request through the modular runtime (STUB ONLY in this phase).
 *
 * @param {Object} adapter Execution adapter instance
 * @param {Object} request Validated request structure
 */
async function executeModular(adapter, request) {
    const stub = {
        runtime: "MODULAR",
        status: "NOT_IMPLEMENTED",
        message: "Modular runtime activation is scheduled for Phase 11B-2."
    };
    return deepFreeze(stub);
}

module.exports = {
    executeModular,
    MODULAR_RUNTIME_ADAPTER_VERSION
};
