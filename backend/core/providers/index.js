"use strict";

const {
    createProvider,
    isProvider,
    deepFreezeProvider,
    PROVIDER_MODEL_VERSION
} = require("./providerModel");

const { validateProvider } = require("./providerValidator");
const { providerErrorCodes } = require("./providerErrors");

const {
    AIProvider,
    createProviderInterface
} = require("./providerInterface");

const {
    providerInterfaceErrorCodes
} = require("./providerInterfaceErrors");

const {
    OpenRouterProvider
} = require("./openRouterProvider");

module.exports = {
    createProvider,
    validateProvider,
    isProvider,
    deepFreezeProvider,
    providerErrorCodes,
    PROVIDER_MODEL_VERSION,
    AIProvider,
    createProviderInterface,
    providerInterfaceErrorCodes,
    OpenRouterProvider
};
