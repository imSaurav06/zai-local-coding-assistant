"use strict";

const { pipelineErrorCodes } = require("./pipelineErrors");

/**
 * Validates the structure and properties of an ExecutionPipeline result.
 * Returns a deeply frozen result object containing success and errors array.
 *
 * @param {Object} result The pipeline result object to validate
 */
function validatePipeline(result) {
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
                code: pipelineErrorCodes.PIPELINE_INVALID_INPUT,
                path: "",
                message: "Pipeline result must be a non-null object."
            }]
        });
    }

    // 2. Required Fields check
    const requiredFields = ["success", "execution", "verification", "diagnostics", "metadata"];
    for (const field of requiredFields) {
        if (!result.hasOwnProperty(field)) {
            errors.push({
                code: pipelineErrorCodes.PIPELINE_INVALID_INPUT,
                path: field,
                message: `Pipeline result is missing required field: '${field}'`
            });
        }
    }

    if (errors.length > 0) {
        return deepFreeze({ success: false, errors });
    }

    if (typeof result.success !== "boolean") {
        errors.push({
            code: pipelineErrorCodes.PIPELINE_INVALID_INPUT,
            path: "success",
            message: "success must be a boolean."
        });
    }

    if (result.metadata === null || typeof result.metadata !== "object" || Array.isArray(result.metadata)) {
        errors.push({
            code: pipelineErrorCodes.PIPELINE_INVALID_INPUT,
            path: "metadata",
            message: "metadata must be a non-null object."
        });
    }

    // 3. Immutability check
    if (!Object.isFrozen(result)) {
        errors.push({
            code: pipelineErrorCodes.PIPELINE_INVALID_INPUT,
            path: "",
            message: "Pipeline result object root must be frozen."
        });
    }

    return deepFreeze({
        success: errors.length === 0,
        errors
    });
}

module.exports = {
    validatePipeline
};
