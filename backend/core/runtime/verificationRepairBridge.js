"use strict";

const { createPatch } = require("../repair");
const { verificationRepairBridgeErrorCodes } = require("./verificationRepairBridgeErrors");

const VERIFICATION_REPAIR_BRIDGE_VERSION = "1.0";

/**
 * Deep freezes verification repair response structure.
 *
 * @param {Object} obj The object to freeze
 */
function deepFreezeVerificationRepairResult(obj) {
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
            deepFreezeVerificationRepairResult(obj[prop]);
        }
    });
    return obj;
}

/**
 * Validates the input execution generation result context.
 *
 * @param {Object} result Mapped generation result
 */
function validateVerificationRepairRequest(result) {
    if (result === null || result === undefined || typeof result !== "object" || Array.isArray(result)) {
        return {
            success: false,
            errors: [{
                code: verificationRepairBridgeErrorCodes.VERIFICATION_REPAIR_INVALID_INPUT,
                path: "",
                message: "Generation result must be a non-null object."
            }]
        };
    }

    const errors = [];
    if (!result.hasOwnProperty("files") || !Array.isArray(result.files)) {
        errors.push({
            code: verificationRepairBridgeErrorCodes.VERIFICATION_REPAIR_INVALID_INPUT,
            path: "files",
            message: "Generation result must contain a valid files array."
        });
    }

    return {
        success: errors.length === 0,
        errors
    };
}

/**
 * Helper to build a valid domain Patch model from generation files.
 *
 * @param {Array<Object>} files The target files list
 */
function buildPatchFromFiles(files) {
    const operations = files.map(f => ({
        path: f.name,
        type: "CREATE_FILE",
        content: f.content || ""
    }));

    const affectedFiles = files.map(f => f.name);

    const patchRes = createPatch({
        id: `patch_gen_${Date.now()}`,
        repairId: `rep_gen_${Date.now()}`,
        executionId: `exec_gen_${Date.now()}`,
        taskId: "task_gen",
        strategy: "AI",
        status: "PENDING",
        affectedFiles,
        operations
    });

    if (!patchRes.success) {
        const err = new Error(`Patch construction failed: ${patchRes.errors[0].message}`);
        err.code = verificationRepairBridgeErrorCodes.VERIFICATION_REPAIR_INVALID_INPUT;
        throw err;
    }

    return patchRes.patch;
}

/**
 * Runs validation/verification checks on the target execution result.
 *
 * @param {Object} result Mapped execution result
 */
async function verifyExecutionResult(result) {
    const val = validateVerificationRepairRequest(result);
    if (!val.success) {
        const err = new Error(`Invalid request: ${val.errors[0].message}`);
        err.code = val.errors[0].code;
        err.originalErrors = val.errors;
        throw err;
    }

    const { verifyPatch } = require("../repair");

    try {
        const patch = buildPatchFromFiles(result.files);
        const verificationResult = await verifyPatch(patch);
        return verificationResult;
    } catch (err) {
        const bridgeErr = new Error(`Verification run failed: ${err.message}`);
        bridgeErr.code = verificationRepairBridgeErrorCodes.VERIFICATION_REPAIR_BRIDGE_FAILED;
        bridgeErr.originalError = err;
        throw bridgeErr;
    }
}

/**
 * Runs a multi-pass repair session on a failed verification target.
 *
 * @param {Object} result Mapped execution result
 * @param {Object} verificationResult The verification failures details
 */
async function repairExecutionResult(result, verificationResult) {
    const val = validateVerificationRepairRequest(result);
    if (!val.success) {
        const err = new Error(`Invalid request: ${val.errors[0].message}`);
        err.code = val.errors[0].code;
        err.originalErrors = val.errors;
        throw err;
    }

    if (!verificationResult || typeof verificationResult !== "object") {
        const err = new Error("Invalid verificationResult: must be a non-null object.");
        err.code = verificationRepairBridgeErrorCodes.VERIFICATION_REPAIR_INVALID_INPUT;
        throw err;
    }

    const { createRepairRequest, executeRepairSession } = require("../repair");

    const affectedFiles = (verificationResult.issues || [])
        .map(issue => issue.path || issue.file)
        .filter(Boolean);
    const finalAffected = affectedFiles.length > 0 ? affectedFiles : result.files.map(f => f.name);

    const reqRes = createRepairRequest({
        id: `rep_${Date.now()}`,
        executionId: `exec_${Date.now()}`,
        taskId: "task_repair",
        type: "VERIFICATION",
        severity: "HIGH",
        status: "PENDING",
        reason: verificationResult.summary || "Verification failed",
        affectedFiles: finalAffected,
        metadata: {}
    });

    if (!reqRes.success) {
        const err = new Error(`Failed to create RepairRequest: ${reqRes.errors[0].message}`);
        err.code = verificationRepairBridgeErrorCodes.VERIFICATION_REPAIR_INVALID_INPUT;
        throw err;
    }

    try {
        const sessionResult = await executeRepairSession(reqRes.repairRequest, { maxRepairAttempts: 2 });
        if (sessionResult.status !== "SUCCESS") {
            const err = new Error(`Repair session ended with status: ${sessionResult.status}`);
            err.code = verificationRepairBridgeErrorCodes.VERIFICATION_REPAIR_REPAIR_FAILED;
            err.sessionResult = sessionResult;
            throw err;
        }

        // Apply patches to original files
        const updatedFiles = [...result.files];
        for (const op of sessionResult.finalPatch.operations) {
            const idx = updatedFiles.findIndex(f => f.name === op.path);
            if (idx !== -1) {
                if (op.type === "DELETE_FILE") {
                    updatedFiles.splice(idx, 1);
                } else {
                    updatedFiles[idx] = { name: op.path, content: op.content };
                }
            } else {
                if (op.type === "CREATE_FILE" || op.type === "UPDATE_FILE") {
                    updatedFiles.push({ name: op.path, content: op.content });
                }
            }
        }

        const repairedResult = {
            ...result,
            files: updatedFiles
        };

        return deepFreezeVerificationRepairResult({
            success: true,
            repaired: true,
            result: repairedResult,
            verificationResult: sessionResult.finalVerification
        });
    } catch (err) {
        if (err.code && err.code === verificationRepairBridgeErrorCodes.VERIFICATION_REPAIR_REPAIR_FAILED) {
            throw err;
        }
        const bridgeErr = new Error(`Repair run failed: ${err.message}`);
        bridgeErr.code = verificationRepairBridgeErrorCodes.VERIFICATION_REPAIR_BRIDGE_FAILED;
        bridgeErr.originalError = err;
        throw bridgeErr;
    }
}

/**
 * Main coordinator pipeline executing verification and optional repair loops.
 *
 * @param {Object} result Mapped execution result
 */
async function verifyAndRepair(result, options = {}) {
    const metricsCollector = options.metricsCollector;
    if (!this.config.enableVerification) {
        return deepFreezeVerificationRepairResult({
            success: true,
            repaired: false,
            result,
            verificationResult: null
        });
    }

    if (metricsCollector && typeof metricsCollector.recordVerificationRun === "function") {
        metricsCollector.recordVerificationRun();
    }

    const verificationResult = await this.verifyExecutionResult(result);
    if (verificationResult.success) {
        return deepFreezeVerificationRepairResult({
            success: true,
            repaired: false,
            result,
            verificationResult
        });
    }

    if (metricsCollector && typeof metricsCollector.recordVerificationFailure === "function") {
        metricsCollector.recordVerificationFailure();
    }

    if (!this.config.enableRepair) {
        const err = new Error(`Verification failed: ${verificationResult.summary}`);
        err.code = verificationRepairBridgeErrorCodes.VERIFICATION_REPAIR_VERIFICATION_FAILED;
        err.verificationResult = verificationResult;
        throw err;
    }

    if (metricsCollector && typeof metricsCollector.recordRepairAttempt === "function") {
        metricsCollector.recordRepairAttempt();
    }

    const repairRes = await this.repairExecutionResult(result, verificationResult);

    if (repairRes.success && metricsCollector && typeof metricsCollector.recordRepairSuccess === "function") {
        metricsCollector.recordRepairSuccess();
    }

    return repairRes;
}

/**
 * Factory instantiating a Verification Repair Bridge object.
 *
 * @param {Object} [config] Custom configuration options
 */
function createVerificationRepairBridge(config = {}) {
    const enableVerification = !!config.enableVerification;
    const enableRepair = !!config.enableRepair;

    const bridge = {
        config: Object.freeze({
            enableVerification,
            enableRepair
        }),
        verifyExecutionResult,
        repairExecutionResult,
        verifyAndRepair
    };

    return Object.freeze(bridge);
}

module.exports = {
    createVerificationRepairBridge,
    verifyExecutionResult,
    repairExecutionResult,
    verifyAndRepair,
    validateVerificationRepairRequest,
    verificationRepairBridgeErrorCodes,
    VERIFICATION_REPAIR_BRIDGE_VERSION
};
