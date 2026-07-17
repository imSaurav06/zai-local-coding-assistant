"use strict";

const {
    createRepairRequest,
    isRepairRequest,
    deepFreezeRepairRequest,
    REPAIR_MODEL_VERSION
} = require("./repairModel");

const { validateRepairRequest } = require("./repairValidator");
const { repairErrorCodes } = require("./repairErrors");

const {
    createPatch,
    isPatch,
    deepFreezePatch,
    PATCH_MODEL_VERSION
} = require("./patchModel");

const { validatePatch } = require("./patchValidator");
const { patchErrorCodes } = require("./patchErrors");

const {
    createRepairPlan,
    validateRepairPlan,
    isRepairPlan,
    deepFreezeRepairPlan,
    repairPlannerErrorCodes,
    REPAIR_PLANNER_VERSION
} = require("./repairPlanner");

const {
    createRepairPipeline,
    executeRepairPipeline,
    validateRepairPipelineResult,
    isRepairPipelineResult,
    deepFreezeRepairPipelineResult,
    repairPipelineErrorCodes,
    REPAIR_PIPELINE_VERSION
} = require("./repairPipeline");

const {
    createVerificationAdapter,
    verifyPatch,
    validateVerificationResult,
    isVerificationResult,
    deepFreezeVerificationResult,
    verificationAdapterErrorCodes,
    VERIFICATION_ADAPTER_VERSION
} = require("./verificationAdapter");

const {
    createRepairSession,
    executeRepairSession,
    validateRepairSession,
    isRepairSession,
    deepFreezeRepairSession,
    repairSessionErrorCodes,
    REPAIR_SESSION_VERSION
} = require("./repairSession");

module.exports = {
    createRepairRequest,
    validateRepairRequest,
    isRepairRequest,
    deepFreezeRepairRequest,
    repairErrorCodes,
    REPAIR_MODEL_VERSION,
    createPatch,
    validatePatch,
    isPatch,
    deepFreezePatch,
    patchErrorCodes,
    PATCH_MODEL_VERSION,
    createRepairPlan,
    validateRepairPlan,
    isRepairPlan,
    deepFreezeRepairPlan,
    repairPlannerErrorCodes,
    REPAIR_PLANNER_VERSION,
    createRepairPipeline,
    executeRepairPipeline,
    validateRepairPipelineResult,
    isRepairPipelineResult,
    deepFreezeRepairPipelineResult,
    repairPipelineErrorCodes,
    REPAIR_PIPELINE_VERSION,
    createVerificationAdapter,
    verifyPatch,
    validateVerificationResult,
    isVerificationResult,
    deepFreezeVerificationResult,
    verificationAdapterErrorCodes,
    VERIFICATION_ADAPTER_VERSION,
    createRepairSession,
    executeRepairSession,
    validateRepairSession,
    isRepairSession,
    deepFreezeRepairSession,
    repairSessionErrorCodes,
    REPAIR_SESSION_VERSION
};
