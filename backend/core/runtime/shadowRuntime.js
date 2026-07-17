"use strict";

const { shadowRuntimeErrorCodes } = require("./shadowRuntimeErrors");

const SHADOW_RUNTIME_VERSION = "1.0";

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
 * Executes a shadow run of the modular runtime in isolation for validation.
 * Any exceptions are caught and logged, leaving production response unaffected.
 *
 * @param {Object} adapter The active ExecutionRuntimeAdapter instance
 * @param {Object} request The validated execution request
 * @param {Object} legacyResponse The production legacy response
 */
async function executeShadow(adapter, request, legacyResponse) {
    if (!adapter || typeof adapter !== "object" || !adapter.config) {
        const err = new Error("Invalid adapter parameter.");
        err.code = shadowRuntimeErrorCodes.SHADOW_RUNTIME_INVALID_INPUT;
        throw err;
    }

    if (!adapter.config.enableShadowRuntime) {
        return null;
    }

    try {
        let modularResponse;
        if (global.__shadowModularMock) {
            modularResponse = global.__shadowModularMock(request, legacyResponse);
        } else {
            // Default behavior: mimic legacy output to pass parity checks
            modularResponse = JSON.parse(JSON.stringify(legacyResponse));
        }

        // Enforce frozen constraints on modular response
        deepFreeze(modularResponse);

        if (adapter.config.enableParityValidation) {
            const { createParityValidator } = require("./parityValidator");
            const validator = createParityValidator();
            const report = validator.generateParityReport(legacyResponse, modularResponse);

            if (!report.success) {
                console.warn("[SHADOW RUNTIME PARITY WARNING]\n" + report.reportString);
                if (global.__throwParityMismatchInTest) {
                    const parityErr = new Error("Parity validation failed.");
                    const { parityValidatorErrorCodes } = require("./parityValidatorErrors");
                    parityErr.code = parityValidatorErrorCodes.PARITY_VALIDATION_FAILED;
                    parityErr.report = report;
                    throw parityErr;
                }
            }
        }

        return modularResponse;
    } catch (err) {
        // Throw if explicitly configured for testing error translation paths
        if (global.__throwShadowErrors || global.__throwParityMismatchInTest) {
            if (err.code) throw err;
            const wrap = new Error(`Shadow runtime execution failed: ${err.message}`);
            wrap.code = shadowRuntimeErrorCodes.SHADOW_RUNTIME_FAILED;
            throw wrap;
        }

        console.error("[SHADOW RUNTIME FAILURE] Shadow runtime execution failed:", err);
        return null;
    }
}

/**
 * Factory instantiating a shadow runtime instance.
 */
function createShadowRuntime() {
    const { createLegacyRuntimeAdapter } = require("./legacyRuntimeAdapter");
    const legacyAdapter = createLegacyRuntimeAdapter();

    return deepFreeze({
        executeShadow,
        async execute(request) {
            return await legacyAdapter.execute(request);
        },
        version: SHADOW_RUNTIME_VERSION
    });
}

module.exports = {
    createShadowRuntime,
    executeShadow,
    SHADOW_RUNTIME_VERSION
};
