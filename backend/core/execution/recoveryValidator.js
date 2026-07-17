"use strict";

const { recoveryErrorCodes } = require("./recoveryErrors");

/**
 * Validates the structure and properties of a recovery decision result.
 * Returns a deeply frozen result object containing success and errors array.
 *
 * @param {Object} result The recovery decision result object to validate
 */
function validateRecovery(result) {
    const errors = [];
    const deepFreeze = (obj) => {
        if (obj === null || typeof obj !== "object") return obj;
        Object.freeze(obj);
        Object.getOwnPropertyNames(obj).forEach(prop => {
            if (obj.hasOwnProperty(prop) && obj[prop] !== null && typeof obj[prop] === "object" && !Object.isFrozen(obj[prop])) {
                deepFreeze(obj[prop]);
            }
        });
        return obj;
    };

    // 1. Basic Type Validation
    if (result === null || result === undefined || typeof result !== "object" || Array.isArray(result)) {
        return deepFreeze({
            success: false,
            errors: [{
                code: recoveryErrorCodes.RECOVERY_INVALID_INPUT,
                path: "",
                message: "Recovery result must be a non-null object."
            }]
        });
    }

    // 2. Required Fields check
    const requiredFields = ["success", "recoveryDecision", "retryPlan", "checkpointAction", "metadata"];
    for (const field of requiredFields) {
        if (!result.hasOwnProperty(field)) {
            errors.push({
                code: recoveryErrorCodes.RECOVERY_INVALID_INPUT,
                path: field,
                message: `Recovery result is missing required field: '${field}'`
            });
        }
    }

    if (errors.length > 0) {
        return deepFreeze({ success: false, errors });
    }

    if (typeof result.success !== "boolean") {
        errors.push({
            code: recoveryErrorCodes.RECOVERY_INVALID_INPUT,
            path: "success",
            message: "success must be a boolean."
        });
    }

    if (typeof result.recoveryDecision !== "string") {
        errors.push({
            code: recoveryErrorCodes.RECOVERY_INVALID_INPUT,
            path: "recoveryDecision",
            message: "recoveryDecision must be a string."
        });
    }

    if (result.retryPlan === null || typeof result.retryPlan !== "object" || Array.isArray(result.retryPlan)) {
        errors.push({
            code: recoveryErrorCodes.RECOVERY_INVALID_INPUT,
            path: "retryPlan",
            message: "retryPlan must be a non-null object."
        });
    } else {
        const retryFields = ["shouldRetry", "retryCount", "delay"];
        for (const f of retryFields) {
            if (!result.retryPlan.hasOwnProperty(f)) {
                errors.push({
                    code: recoveryErrorCodes.RECOVERY_INVALID_INPUT,
                    path: `retryPlan.${f}`,
                    message: `retryPlan is missing field: '${f}'`
                });
            }
        }
    }

    if (typeof result.checkpointAction !== "string") {
        errors.push({
            code: recoveryErrorCodes.RECOVERY_INVALID_INPUT,
            path: "checkpointAction",
            message: "checkpointAction must be a string."
        });
    }

    if (result.metadata === null || typeof result.metadata !== "object" || Array.isArray(result.metadata)) {
        errors.push({
            code: recoveryErrorCodes.RECOVERY_INVALID_INPUT,
            path: "metadata",
            message: "metadata must be a non-null object."
        });
    }

    // 3. Immutability check
    if (!Object.isFrozen(result)) {
        errors.push({
            code: recoveryErrorCodes.RECOVERY_INVALID_INPUT,
            path: "",
            message: "Recovery result object root must be frozen."
        });
    }

    return deepFreeze({
        success: errors.length === 0,
        errors
    });
}

module.exports = {
    validateRecovery
};
