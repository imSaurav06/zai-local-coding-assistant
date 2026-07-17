"use strict";

const LEGACY_RUNTIME_ADAPTER_VERSION = "1.0";

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
 * Executes request strictly using generationOrchestrator wrapper.
 *
 * @param {Object} request Validated request structure
 */
async function execute(request) {
    const legacyOrchestrator = require("../../services/generationOrchestrator");
    const originalPrompt = (request.metadata && request.metadata.originalPrompt) || "";
    const progressEmitter = request.options && request.options.progressEmitter;
    const checkCancellation = request.options && request.options.checkCancellation;
    const cancelSignal = request.options && request.options.cancelSignal;

    const legacyResult = await legacyOrchestrator.orchestrateGeneration(
        {
            originalPrompt,
            projectSpec: request.projectSpec
        },
        progressEmitter,
        checkCancellation,
        {
            cancelSignal
        }
    );

    return legacyResult;
}

/**
 * Factory instantiating legacy runtime adapter.
 */
function createLegacyRuntimeAdapter() {
    return deepFreeze({
        execute,
        version: LEGACY_RUNTIME_ADAPTER_VERSION
    });
}

module.exports = {
    createLegacyRuntimeAdapter,
    execute,
    LEGACY_RUNTIME_ADAPTER_VERSION
};
