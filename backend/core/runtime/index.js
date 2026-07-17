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
    EXECUTION_RUNTIME_ADAPTER_VERSION
};
