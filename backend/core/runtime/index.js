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

module.exports = {
    createRuntimeConfig,
    loadRuntimeConfig,
    validateRuntimeConfig,
    isRuntimeConfig,
    deepFreezeRuntimeConfig,
    runtimeConfigErrorCodes,
    RUNTIME_CONFIG_VERSION
};
