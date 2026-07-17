"use strict";

const repairModel = require("./repairModel");
const repairPlanner = require("./repairPlanner");
const patchModel = require("./patchModel");
const { repairPipelineErrorCodes } = require("./repairPipelineErrors");

const REPAIR_PIPELINE_VERSION = "1.0";

const CANONICAL_RESULT_FIELDS = new Set([
    "success",
    "repairRequest",
    "repairPlan",
    "patch",
    "status",
    "metadata"
]);

const ALLOWED_PIPELINE_STATUSES = new Set([
    "SUCCESS",
    "FAILED"
]);

/**
 * Deep freezes a pipeline result recursively.
 *
 * @param {Object} obj The object to freeze
 */
function deepFreezeRepairPipelineResult(obj) {
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
            deepFreezeRepairPipelineResult(obj[prop]);
        }
    });
    return obj;
}

/**
 * Checks if the given object is an instantiated deeply frozen PipelineResult domain model.
 *
 * @param {Object} obj The object to inspect
 */
function isRepairPipelineResult(obj) {
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
        return false;
    }
    if (!Object.isFrozen(obj)) {
        return false;
    }
    const val = validateRepairPipelineResult(obj);
    return val.success;
}

/**
 * Validates a PipelineResult configuration object or model.
 *
 * @param {Object} result The pipeline result to validate
 */
function validateRepairPipelineResult(result) {
    if (result === null || result === undefined || typeof result !== "object" || Array.isArray(result)) {
        return {
            success: false,
            errors: [{
                code: repairPipelineErrorCodes.REPAIR_PIPELINE_INVALID_INPUT,
                path: "",
                message: "PipelineResult must be a non-null object."
            }]
        };
    }

    const errors = [];

    // 1. Unknown properties check
    for (const key of Object.keys(result)) {
        if (!CANONICAL_RESULT_FIELDS.has(key)) {
            errors.push({
                code: repairPipelineErrorCodes.REPAIR_PIPELINE_INVALID_RESULT,
                path: key,
                message: `Unknown property key: '${key}'`
            });
        }
    }

    // 2. Required properties check
    const required = ["success", "repairRequest", "repairPlan", "patch", "status"];
    for (const req of required) {
        if (!result.hasOwnProperty(req)) {
            errors.push({
                code: repairPipelineErrorCodes.REPAIR_PIPELINE_INVALID_RESULT,
                path: req,
                message: `Property '${req}' is required.`
            });
        }
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    // 3. Types validation
    if (typeof result.success !== "boolean") {
        errors.push({ code: repairPipelineErrorCodes.REPAIR_PIPELINE_INVALID_RESULT, path: "success", message: "success must be a boolean" });
    }

    if (!repairModel.isRepairRequest(result.repairRequest)) {
        errors.push({ code: repairPipelineErrorCodes.REPAIR_PIPELINE_INVALID_RESULT, path: "repairRequest", message: "Invalid repairRequest" });
    }

    if (!repairPlanner.isRepairPlan(result.repairPlan)) {
        errors.push({ code: repairPipelineErrorCodes.REPAIR_PIPELINE_INVALID_RESULT, path: "repairPlan", message: "Invalid repairPlan" });
    }

    if (!patchModel.isPatch(result.patch)) {
        errors.push({ code: repairPipelineErrorCodes.REPAIR_PIPELINE_INVALID_RESULT, path: "patch", message: "Invalid patch" });
    }

    if (!ALLOWED_PIPELINE_STATUSES.has(result.status)) {
        errors.push({
            code: repairPipelineErrorCodes.REPAIR_PIPELINE_INVALID_RESULT,
            path: "status",
            message: `Property 'status' must be one of: ${Array.from(ALLOWED_PIPELINE_STATUSES).join(", ")}.`
        });
    }

    if (result.hasOwnProperty("metadata") && result.metadata !== null && (typeof result.metadata !== "object" || Array.isArray(result.metadata))) {
        errors.push({
            code: repairPipelineErrorCodes.REPAIR_PIPELINE_INVALID_RESULT,
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
 * Executes the repair pipeline orchestration logic.
 *
 * @param {Object} repairRequest The input RepairRequest context
 */
async function executeRepairPipeline(repairRequest) {
    if (!repairRequest || !repairModel.isRepairRequest(repairRequest)) {
        const err = new Error("Invalid RepairRequest input: must be a validated, frozen RepairRequest.");
        err.code = repairPipelineErrorCodes.REPAIR_PIPELINE_INVALID_INPUT;
        throw err;
    }

    // Step 1: Create RepairPlan
    const planRes = repairPlanner.createRepairPlan(repairRequest);
    if (!planRes.success) {
        const err = new Error(`Repair Planner failed: ${planRes.errors[0].message}`);
        err.code = repairPipelineErrorCodes.REPAIR_PIPELINE_PLANNER_FAILED;
        err.originalErrors = planRes.errors;
        throw err;
    }
    const repairPlan = planRes.repairPlan;

    // Step 2: Create Patch operations
    const operations = repairRequest.affectedFiles.map(file => ({
        type: "UPDATE_FILE",
        path: file,
        content: `// Deterministic repair patch for ${file}\n`,
        metadata: {}
    }));

    const patchConfig = {
        id: `patch_${repairRequest.id}`,
        repairId: repairRequest.id,
        executionId: repairRequest.executionId,
        taskId: repairRequest.taskId,
        strategy: repairPlan.strategy,
        status: "READY",
        operations,
        affectedFiles: [...repairRequest.affectedFiles],
        metadata: {}
    };

    // Step 3: Create Patch
    const patchRes = patchModel.createPatch(patchConfig);
    if (!patchRes.success) {
        const err = new Error(`Patch generation failed: ${patchRes.errors[0].message}`);
        err.code = repairPipelineErrorCodes.REPAIR_PIPELINE_PATCH_FAILED;
        err.originalErrors = patchRes.errors;
        throw err;
    }
    const patch = patchRes.patch;

    // Step 4: Assemble results
    const result = {
        success: true,
        repairRequest,
        repairPlan,
        patch,
        status: "SUCCESS",
        metadata: {}
    };

    return deepFreezeRepairPipelineResult(result);
}

/**
 * Factory function instantiating the Repair Pipeline.
 */
function createRepairPipeline() {
    return {
        execute: executeRepairPipeline
    };
}

module.exports = {
    createRepairPipeline,
    executeRepairPipeline,
    validateRepairPipelineResult,
    isRepairPipelineResult,
    deepFreezeRepairPipelineResult,
    repairPipelineErrorCodes,
    REPAIR_PIPELINE_VERSION
};
