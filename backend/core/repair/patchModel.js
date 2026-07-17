"use strict";

const { validatePatch } = require("./patchValidator");
const { patchErrorCodes } = require("./patchErrors");

const PATCH_MODEL_VERSION = "1.0";

/**
 * Deep freezes a patch object recursively to guarantee strict immutability.
 *
 * @param {Object} obj The object to freeze
 */
function deepFreezePatch(obj) {
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
            deepFreezePatch(obj[prop]);
        }
    });
    return obj;
}

/**
 * Checks if the given object is an instantiated deeply frozen Patch domain model.
 *
 * @param {Object} obj The object to inspect
 */
function isPatch(obj) {
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
        return false;
    }
    if (!Object.isFrozen(obj)) {
        return false;
    }
    const val = validatePatch(obj);
    return val.success;
}

/**
 * Pure function to construct a deeply frozen, validated Patch domain model.
 *
 * @param {Object} config The patch config input
 */
function createPatch(config) {
    if (config === null || config === undefined || typeof config !== "object" || Array.isArray(config)) {
        return {
            success: false,
            patch: null,
            errors: [{
                code: patchErrorCodes.PATCH_INVALID_INPUT,
                path: "",
                message: "Input configuration must be a non-null object."
            }]
        };
    }

    // Deep clone to prevent any input mutations or reference sharing
    const cloned = JSON.parse(JSON.stringify(config));

    const val = validatePatch(cloned);
    if (!val.success) {
        return {
            success: false,
            patch: null,
            errors: val.errors
        };
    }

    // Freeze and return
    const patch = deepFreezePatch(cloned);

    return {
        success: true,
        patch,
        errors: []
    };
}

module.exports = {
    createPatch,
    isPatch,
    deepFreezePatch,
    PATCH_MODEL_VERSION
};
