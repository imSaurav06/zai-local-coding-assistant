"use strict";

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
 * Factory to build an immutable verification result.
 * 
 * @param {boolean} success True if verification passed without errors
 * @param {Array} errors List of error objects
 * @param {Array} warnings List of warning objects
 * @param {Object} metadata Execution or profiling metadata
 */
function createVerificationResult(success, errors = [], warnings = [], metadata = {}) {
    const clonedErrors = Array.isArray(errors) ? JSON.parse(JSON.stringify(errors)) : [];
    const clonedWarnings = Array.isArray(warnings) ? JSON.parse(JSON.stringify(warnings)) : [];
    const clonedMetadata = typeof metadata === "object" && metadata !== null ? JSON.parse(JSON.stringify(metadata)) : {};

    const result = {
        success: !!success,
        errors: clonedErrors,
        warnings: clonedWarnings,
        metadata: clonedMetadata
    };

    return deepFreeze(result);
}

module.exports = {
    createVerificationResult
};
