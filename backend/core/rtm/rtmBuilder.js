"use strict";

const { classifyRequirements } = require("../requirementsClassification");
const { createRTM, RTM_MODEL_VERSION } = require("./rtmModel");
const { rtmErrorCodes } = require("./rtmErrors");

/**
 * Deep freezes an object recursively to ensure immutability.
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
 * Deterministically constructs the RTM-Lite domain structure.
 * Invokes classifyRequirements() then createRTM().
 * 
 * @param {Array} requirements Array of canonical requirement descriptors
 */
function buildRTM(requirements) {
    try {
        // 1. Validate builder input is an array
        if (!Array.isArray(requirements)) {
            return deepFreeze({
                success: false,
                rtmVersion: RTM_MODEL_VERSION,
                entries: [],
                metadata: {},
                errors: [{
                    code: rtmErrorCodes.RTM_INVALID_INPUT,
                    path: "",
                    message: "Input requirements must be an array."
                }]
            });
        }

        // Keep track of classification invocation count in a local hook for unit testing if required.
        if (buildRTM._testHooks) {
            buildRTM._testHooks.classifyCalls++;
        }

        // 2. Invoke classifyRequirements exactly once
        const classificationRes = classifyRequirements(requirements);
        if (!classificationRes.success) {
            const mappedErrors = (classificationRes.errors || []).map(err => ({
                code: rtmErrorCodes.RTM_INVALID_REQUIREMENT,
                path: err.path,
                message: `Classification failed: ${err.message}`
            }));
            return deepFreeze({
                success: false,
                rtmVersion: RTM_MODEL_VERSION,
                entries: [],
                metadata: {},
                errors: mappedErrors
            });
        }

        // Keep track of createRTM invocation count in a local hook for unit testing if required.
        if (buildRTM._testHooks) {
            buildRTM._testHooks.createRTMCalls++;
        }

        // 3. Invoke createRTM exactly once with precomputed classifications
        const rtmResult = createRTM(requirements, classificationRes.classifications);
        return rtmResult;

    } catch (err) {
        return deepFreeze({
            success: false,
            rtmVersion: RTM_MODEL_VERSION,
            entries: [],
            metadata: {},
            errors: [{
                code: rtmErrorCodes.RTM_INTERNAL_ERROR,
                path: "",
                message: `Internal error building RTM: ${err.message}`
            }]
        });
    }
}

// Trace hooks for unit test assertions
buildRTM._testHooks = {
    classifyCalls: 0,
    createRTMCalls: 0,
    reset() {
        this.classifyCalls = 0;
        this.createRTMCalls = 0;
    }
};

module.exports = {
    buildRTM
};
