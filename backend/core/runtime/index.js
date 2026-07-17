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

const {
    createWorkerPool,
    allocateWorker,
    releaseWorker,
    getAvailableWorkers,
    getActiveWorkers,
    validateWorkerPool,
    workerPoolErrorCodes,
    WORKER_POOL_VERSION
} = require("./workerPool");

const {
    createShadowRuntime,
    executeShadow,
    SHADOW_RUNTIME_VERSION
} = require("./shadowRuntime");

const {
    createParityValidator,
    validateParity,
    generateParityReport,
    PARITY_VALIDATOR_VERSION
} = require("./parityValidator");

const { shadowRuntimeErrorCodes } = require("./shadowRuntimeErrors");
const { parityValidatorErrorCodes } = require("./parityValidatorErrors");

const {
    createRuntimeRouter,
    selectRuntime,
    executeRuntime,
    validateRuntimeSelection,
    runtimeRouterErrorCodes,
    RUNTIME_ROUTER_VERSION
} = require("./runtimeRouter");

const { executeLegacy, LEGACY_RUNTIME_ADAPTER_VERSION } = require("./legacyRuntimeAdapter");
const { executeModular, MODULAR_RUNTIME_ADAPTER_VERSION } = require("./modularRuntimeAdapter");

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
    VERIFICATION_REPAIR_BRIDGE_VERSION,
    createWorkerPool,
    allocateWorker,
    releaseWorker,
    getAvailableWorkers,
    getActiveWorkers,
    validateWorkerPool,
    workerPoolErrorCodes,
    WORKER_POOL_VERSION,
    createShadowRuntime,
    executeShadow,
    SHADOW_RUNTIME_VERSION,
    createParityValidator,
    validateParity,
    generateParityReport,
    PARITY_VALIDATOR_VERSION,
    shadowRuntimeErrorCodes,
    parityValidatorErrorCodes,
    createRuntimeRouter,
    selectRuntime,
    executeRuntime,
    validateRuntimeSelection,
    runtimeRouterErrorCodes,
    RUNTIME_ROUTER_VERSION,
    executeLegacy,
    LEGACY_RUNTIME_ADAPTER_VERSION,
    executeModular,
    MODULAR_RUNTIME_ADAPTER_VERSION
};
