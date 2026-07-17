"use strict";

const verification = require("../verification");
const { isPatch } = require("./patchModel");
const { verificationAdapterErrorCodes } = require("./verificationAdapterErrors");

const VERIFICATION_ADAPTER_VERSION = "1.0";

const CANONICAL_RESULT_FIELDS = new Set([
    "success",
    "patchId",
    "status",
    "issues",
    "summary",
    "metadata"
]);

const ALLOWED_STATUSES = new Set([
    "PASSED",
    "FAILED",
    "ERROR"
]);

/**
 * Deep freezes a verification result recursively.
 *
 * @param {Object} obj The object to freeze
 */
function deepFreezeVerificationResult(obj) {
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
            deepFreezeVerificationResult(obj[prop]);
        }
    });
    return obj;
}

/**
 * Checks if the given object is an instantiated deeply frozen VerificationResult domain model.
 *
 * @param {Object} obj The object to inspect
 */
function isVerificationResult(obj) {
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
        return false;
    }
    if (!Object.isFrozen(obj)) {
        return false;
    }
    const val = validateVerificationResult(obj);
    return val.success;
}

/**
 * Validates a VerificationResult configuration object or model.
 *
 * @param {Object} result The verification result to validate
 */
function validateVerificationResult(result) {
    if (result === null || result === undefined || typeof result !== "object" || Array.isArray(result)) {
        return {
            success: false,
            errors: [{
                code: verificationAdapterErrorCodes.VERIFICATION_ADAPTER_INVALID_INPUT,
                path: "",
                message: "VerificationResult must be a non-null object."
            }]
        };
    }

    const errors = [];

    // 1. Unknown properties check
    for (const key of Object.keys(result)) {
        if (!CANONICAL_RESULT_FIELDS.has(key)) {
            errors.push({
                code: verificationAdapterErrorCodes.VERIFICATION_ADAPTER_INVALID_RESULT,
                path: key,
                message: `Unknown property key: '${key}'`
            });
        }
    }

    // 2. Required properties check
    const required = ["success", "patchId", "status", "issues", "summary"];
    for (const req of required) {
        if (!result.hasOwnProperty(req)) {
            errors.push({
                code: verificationAdapterErrorCodes.VERIFICATION_ADAPTER_INVALID_RESULT,
                path: req,
                message: `Property '${req}' is required.`
            });
        }
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    // 3. Type checking validation
    if (typeof result.success !== "boolean") {
        errors.push({ code: verificationAdapterErrorCodes.VERIFICATION_ADAPTER_INVALID_RESULT, path: "success", message: "success must be a boolean" });
    }

    if (typeof result.patchId !== "string" || result.patchId.trim() === "") {
        errors.push({ code: verificationAdapterErrorCodes.VERIFICATION_ADAPTER_INVALID_RESULT, path: "patchId", message: "patchId must be non-empty string" });
    }

    if (!ALLOWED_STATUSES.has(result.status)) {
        errors.push({
            code: verificationAdapterErrorCodes.VERIFICATION_ADAPTER_INVALID_RESULT,
            path: "status",
            message: `Property 'status' must be one of: ${Array.from(ALLOWED_STATUSES).join(", ")}.`
        });
    }

    if (!Array.isArray(result.issues)) {
        errors.push({ code: verificationAdapterErrorCodes.VERIFICATION_ADAPTER_INVALID_RESULT, path: "issues", message: "issues must be an array" });
    }

    if (typeof result.summary !== "string") {
        errors.push({ code: verificationAdapterErrorCodes.VERIFICATION_ADAPTER_INVALID_RESULT, path: "summary", message: "summary must be a string" });
    }

    if (result.hasOwnProperty("metadata") && result.metadata !== null && (typeof result.metadata !== "object" || Array.isArray(result.metadata))) {
        errors.push({
            code: verificationAdapterErrorCodes.VERIFICATION_ADAPTER_INVALID_RESULT,
            path: "metadata",
            message: "Property 'metadata' must be an object or null."
        });
    }

    return {
        success: errors.length === 0,
        errors
    };
}

/**
 * Runs validation/verification checks on the patch contents.
 *
 * @param {Object} patch The target Patch object
 * @param {Object} context Context values for VerificationEngine
 */
async function verifyPatch(patch, context = {}) {
    if (!patch || !isPatch(patch)) {
        const err = new Error("Invalid patch: must be a validated, frozen Patch object.");
        err.code = verificationAdapterErrorCodes.VERIFICATION_ADAPTER_INVALID_INPUT;
        throw err;
    }

    try {
        // Map patch operations format to VerificationEngine files array format
        const files = patch.operations.map(op => ({
            name: op.path,
            content: op.content || "",
            path: op.path
        }));

        const engineResult = verification.runVerification(files, context);

        const status = engineResult.success ? "PASSED" : "FAILED";
        const issues = engineResult.errors || [];
        const summary = `Verification completed with status: ${status}. Found ${issues.length} errors and ${(engineResult.warnings || []).length} warnings.`;

        const resultConfig = {
            success: engineResult.success,
            patchId: patch.id,
            status,
            issues,
            summary,
            metadata: {
                warnings: engineResult.warnings || []
            }
        };

        return deepFreezeVerificationResult(resultConfig);
    } catch (err) {
        const adapterErr = new Error(`Verification Engine run failed: ${err.message}`);
        adapterErr.code = verificationAdapterErrorCodes.VERIFICATION_ADAPTER_FAILED;
        adapterErr.originalError = err;
        throw adapterErr;
    }
}

/**
 * Factory instantiating the Verification Adapter.
 */
function createVerificationAdapter() {
    return {
        verify: verifyPatch
    };
}

module.exports = {
    createVerificationAdapter,
    verifyPatch,
    validateVerificationResult,
    isVerificationResult,
    deepFreezeVerificationResult,
    verificationAdapterErrorCodes,
    VERIFICATION_ADAPTER_VERSION
};
