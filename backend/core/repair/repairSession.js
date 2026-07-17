"use strict";

const { executeRepairPipeline } = require("./repairPipeline");
const { repairSessionErrorCodes } = require("./repairSessionErrors");

const REPAIR_SESSION_VERSION = "1.0";

const CANONICAL_SESSION_FIELDS = new Set([
    "repairRequest",
    "attempts",
    "history",
    "finalPatch",
    "finalVerification",
    "status",
    "metadata"
]);

const ALLOWED_SESSION_STATUSES = new Set([
    "SUCCESS",
    "FAILED",
    "EXHAUSTED"
]);

/**
 * Deep freezes a repair session object recursively to guarantee strict immutability.
 *
 * @param {Object} obj The object to freeze
 */
function deepFreezeRepairSession(obj) {
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
            deepFreezeRepairSession(obj[prop]);
        }
    });
    return obj;
}

/**
 * Checks if the given object is an instantiated deeply frozen RepairSession domain model.
 *
 * @param {Object} obj The object to inspect
 */
function isRepairSession(obj) {
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
        return false;
    }
    if (!Object.isFrozen(obj)) {
        return false;
    }
    const val = validateRepairSession(obj);
    return val.success;
}

/**
 * Validates a RepairSession configuration object or model.
 *
 * @param {Object} session The repair session to validate
 */
function validateRepairSession(session) {
    if (session === null || session === undefined || typeof session !== "object" || Array.isArray(session)) {
        return {
            success: false,
            errors: [{
                code: repairSessionErrorCodes.REPAIR_SESSION_INVALID_INPUT,
                path: "",
                message: "RepairSession must be a non-null object."
            }]
        };
    }

    const errors = [];

    // 1. Unknown properties check
    for (const key of Object.keys(session)) {
        if (!CANONICAL_SESSION_FIELDS.has(key)) {
            errors.push({
                code: repairSessionErrorCodes.REPAIR_SESSION_INVALID_RESULT,
                path: key,
                message: `Unknown property key: '${key}'`
            });
        }
    }

    // 2. Required properties check
    const required = ["repairRequest", "attempts", "history", "status"];
    for (const req of required) {
        if (!session.hasOwnProperty(req)) {
            errors.push({
                code: repairSessionErrorCodes.REPAIR_SESSION_INVALID_RESULT,
                path: req,
                message: `Property '${req}' is required.`
            });
        }
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    const { isRepairRequest } = require("./repairModel");
    const { isRepairPlan } = require("./repairPlanner");
    const { isPatch } = require("./patchModel");
    const { isVerificationResult } = require("./verificationAdapter");

    if (!isRepairRequest(session.repairRequest)) {
        errors.push({ code: repairSessionErrorCodes.REPAIR_SESSION_INVALID_RESULT, path: "repairRequest", message: "Invalid repairRequest" });
    }

    if (typeof session.attempts !== "number" || session.attempts < 0) {
        errors.push({ code: repairSessionErrorCodes.REPAIR_SESSION_INVALID_RESULT, path: "attempts", message: "attempts must be a non-negative number" });
    }

    if (!ALLOWED_SESSION_STATUSES.has(session.status)) {
        errors.push({
            code: repairSessionErrorCodes.REPAIR_SESSION_INVALID_RESULT,
            path: "status",
            message: `Property 'status' must be one of: ${Array.from(ALLOWED_SESSION_STATUSES).join(", ")}.`
        });
    }

    // Validate history list
    if (!Array.isArray(session.history)) {
        errors.push({ code: repairSessionErrorCodes.REPAIR_SESSION_INVALID_RESULT, path: "history", message: "history must be an array" });
    } else {
        for (let i = 0; i < session.history.length; i++) {
            const h = session.history[i];
            if (h === null || typeof h !== "object" || Array.isArray(h)) {
                errors.push({ code: repairSessionErrorCodes.REPAIR_SESSION_INVALID_RESULT, path: `history[${i}]`, message: "History item must be an object" });
                continue;
            }

            if (typeof h.attemptNumber !== "number") {
                errors.push({ code: repairSessionErrorCodes.REPAIR_SESSION_INVALID_RESULT, path: `history[${i}].attemptNumber`, message: "attemptNumber must be a number" });
            }

            if (!isRepairPlan(h.repairPlan)) {
                errors.push({ code: repairSessionErrorCodes.REPAIR_SESSION_INVALID_RESULT, path: `history[${i}].repairPlan`, message: "Invalid repairPlan in history" });
            }

            if (!isPatch(h.patch)) {
                errors.push({ code: repairSessionErrorCodes.REPAIR_SESSION_INVALID_RESULT, path: `history[${i}].patch`, message: "Invalid patch in history" });
            }

            if (!isVerificationResult(h.verificationResult)) {
                errors.push({ code: repairSessionErrorCodes.REPAIR_SESSION_INVALID_RESULT, path: `history[${i}].verificationResult`, message: "Invalid verificationResult in history" });
            }

            if (typeof h.durationMs !== "number") {
                errors.push({ code: repairSessionErrorCodes.REPAIR_SESSION_INVALID_RESULT, path: `history[${i}].durationMs`, message: "durationMs must be a number" });
            }
        }
    }

    if (session.hasOwnProperty("finalPatch") && session.finalPatch !== null && !isPatch(session.finalPatch)) {
        errors.push({ code: repairSessionErrorCodes.REPAIR_SESSION_INVALID_RESULT, path: "finalPatch", message: "Invalid finalPatch" });
    }

    if (session.hasOwnProperty("finalVerification") && session.finalVerification !== null && !isVerificationResult(session.finalVerification)) {
        errors.push({ code: repairSessionErrorCodes.REPAIR_SESSION_INVALID_RESULT, path: "finalVerification", message: "Invalid finalVerification" });
    }

    if (session.hasOwnProperty("metadata") && session.metadata !== null && (typeof session.metadata !== "object" || Array.isArray(session.metadata))) {
        errors.push({
            code: repairSessionErrorCodes.REPAIR_SESSION_INVALID_RESULT,
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
 * Executes a multi-pass repair session, wrapping the loop boundaries.
 *
 * @param {Object} repairRequest The input RepairRequest context
 * @param {Object} [config] Configuration override options
 */
async function executeRepairSession(repairRequest, config = {}) {
    const { isRepairRequest } = require("./repairModel");

    if (!repairRequest || !isRepairRequest(repairRequest)) {
        const err = new Error("Invalid RepairRequest input: must be a validated, frozen RepairRequest.");
        err.code = repairSessionErrorCodes.REPAIR_SESSION_INVALID_INPUT;
        throw err;
    }

    const maxRepairAttempts = config.maxRepairAttempts !== undefined ? config.maxRepairAttempts : 2;

    let attempts = 0;
    const history = [];
    let success = false;
    let finalPatch = null;
    let finalVerification = null;
    let status = "FAILED";

    while (attempts < maxRepairAttempts && !success) {
        attempts++;
        const startTime = Date.now();

        try {
            // Execute a single pass of the pipeline
            const pipelineResult = await executeRepairPipeline(repairRequest);

            const durationMs = Date.now() - startTime;

            history.push({
                attemptNumber: attempts,
                repairPlan: pipelineResult.repairPlan,
                patch: pipelineResult.patch,
                verificationResult: pipelineResult.verificationResult,
                durationMs
            });

            finalPatch = pipelineResult.patch;
            finalVerification = pipelineResult.verificationResult;

            if (pipelineResult.verificationResult.success) {
                success = true;
                status = "SUCCESS";
            }
        } catch (err) {
            // Propagate standard structural errors immediately
            throw err;
        }
    }

    if (!success) {
        status = attempts >= maxRepairAttempts ? "EXHAUSTED" : "FAILED";
    }

    const sessionResult = {
        repairRequest,
        attempts,
        history,
        finalPatch,
        finalVerification,
        status,
        metadata: {}
    };

    return deepFreezeRepairSession(sessionResult);
}

/**
 * Factory instantiating a Repair Session coordinator.
 *
 * @param {Object} [config] Configuration options
 */
function createRepairSession(config = {}) {
    const maxRepairAttempts = config.maxRepairAttempts !== undefined ? config.maxRepairAttempts : 2;
    return {
        maxRepairAttempts,
        execute: (repairRequest) => executeRepairSession(repairRequest, { maxRepairAttempts })
    };
}

module.exports = {
    createRepairSession,
    executeRepairSession,
    validateRepairSession,
    isRepairSession,
    deepFreezeRepairSession,
    repairSessionErrorCodes,
    REPAIR_SESSION_VERSION
};
