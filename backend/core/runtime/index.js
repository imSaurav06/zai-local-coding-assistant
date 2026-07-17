"use strict";

const {
    createRuntimeConfig,
    loadRuntimeConfig,
    validateRuntimeConfig,
    isRuntimeConfig,
    deepFreezeRuntimeConfig,
    runtimeConfigErrorCodes,
    RUNTIME_CONFIG_VERSION
} = require("./runtimeConfig");

const {
    createExecutionRuntimeAdapter,
    validateExecutionRequest,
    isExecutionRequest,
    deepFreezeExecutionRequest,
    deepFreezeExecutionResponse,
    executionRuntimeAdapterErrorCodes,
    EXECUTION_RUNTIME_ADAPTER_VERSION
} = require("./executionRuntimeAdapter");

const {
    createCheckpointBridge,
    validateCheckpointBridgeRequest,
    checkpointBridgeErrorCodes,
    CHECKPOINT_BRIDGE_VERSION,
    InMemoryCheckpointStore
} = require("./checkpointBridge");

const {
    createVerificationRepairBridge,
    verifyExecutionResult,
    repairExecutionResult,
    verifyAndRepair,
    validateVerificationRepairRequest,
    verificationRepairBridgeErrorCodes,
    VERIFICATION_REPAIR_BRIDGE_VERSION
} = require("./verificationRepairBridge");

module.exports = {
    createRuntimeConfig,
    loadRuntimeConfig,
    validateRuntimeConfig,
    isRuntimeConfig,
    deepFreezeRuntimeConfig,
    runtimeConfigErrorCodes,
    RUNTIME_CONFIG_VERSION,
    createExecutionRuntimeAdapter,
    validateExecutionRequest,
    isExecutionRequest,
    deepFreezeExecutionRequest,
    deepFreezeExecutionResponse,
    executionRuntimeAdapterErrorCodes,
    EXECUTION_RUNTIME_ADAPTER_VERSION,
    createCheckpointBridge,
    validateCheckpointBridgeRequest,
    checkpointBridgeErrorCodes,
    CHECKPOINT_BRIDGE_VERSION,
    InMemoryCheckpointStore,
    createVerificationRepairBridge,
    verifyExecutionResult,
    repairExecutionResult,
    verifyAndRepair,
    validateVerificationRepairRequest,
    verificationRepairBridgeErrorCodes,
    VERIFICATION_REPAIR_BRIDGE_VERSION
};
