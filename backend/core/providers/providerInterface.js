"use strict";

const { providerInterfaceErrorCodes } = require("./providerInterfaceErrors");

class AIProvider {
    /**
     * Initializes the provider with its specific config block.
     *
     * @param {Object} config The initialization config
     * @returns {Promise<void>}
     */
    async initialize(config) {
        const err = new Error("Method 'initialize' is not implemented on this AIProvider.");
        err.code = providerInterfaceErrorCodes.PROVIDER_INTERFACE_NOT_IMPLEMENTED;
        throw err;
    }

    /**
     * Checks the provider's connection status or API health state.
     *
     * @returns {Promise<Object>} Health check report
     */
    async health() {
        const err = new Error("Method 'health' is not implemented on this AIProvider.");
        err.code = providerInterfaceErrorCodes.PROVIDER_INTERFACE_NOT_IMPLEMENTED;
        throw err;
    }

    /**
     * Performs a chat generation request.
     *
     * @param {Object} request The chat payload specifications
     * @returns {Promise<Object>} Model output response
     */
    async chat(request) {
        const err = new Error("Method 'chat' is not implemented on this AIProvider.");
        err.code = providerInterfaceErrorCodes.PROVIDER_INTERFACE_NOT_IMPLEMENTED;
        throw err;
    }

    /**
     * Performs a standard completion generation request.
     *
     * @param {Object} request The completion payload specifications
     * @returns {Promise<Object>} Model output response
     */
    async complete(request) {
        const err = new Error("Method 'complete' is not implemented on this AIProvider.");
        err.code = providerInterfaceErrorCodes.PROVIDER_INTERFACE_NOT_IMPLEMENTED;
        throw err;
    }

    /**
     * Returns an async stream of tokens/chunks.
     *
     * @param {Object} request The stream payload specifications
     * @returns {Promise<Object>} Stream response instance
     */
    async stream(request) {
        const err = new Error("Method 'stream' is not implemented on this AIProvider.");
        err.code = providerInterfaceErrorCodes.PROVIDER_INTERFACE_NOT_IMPLEMENTED;
        throw err;
    }

    /**
     * Counts the number of tokens in the request text/payload.
     *
     * @param {Object} request Token count payload specifications
     * @returns {Promise<Number>} Calculated token count
     */
    async countTokens(request) {
        const err = new Error("Method 'countTokens' is not implemented on this AIProvider.");
        err.code = providerInterfaceErrorCodes.PROVIDER_INTERFACE_NOT_IMPLEMENTED;
        throw err;
    }

    /**
     * Lists all models supported by this provider adapter.
     *
     * @returns {Promise<Array<String>>} List of model IDs
     */
    async listModels() {
        const err = new Error("Method 'listModels' is not implemented on this AIProvider.");
        err.code = providerInterfaceErrorCodes.PROVIDER_INTERFACE_NOT_IMPLEMENTED;
        throw err;
    }

    /**
     * Verifies if this provider supports the requested capability.
     *
     * @param {String} capability Capability identifier string
     * @returns {Promise<Boolean>}
     */
    async supports(capability) {
        const err = new Error("Method 'supports' is not implemented on this AIProvider.");
        err.code = providerInterfaceErrorCodes.PROVIDER_INTERFACE_NOT_IMPLEMENTED;
        throw err;
    }

    /**
     * Gracefully shuts down connection pools or active streams.
     *
     * @returns {Promise<void>}
     */
    async shutdown() {
        const err = new Error("Method 'shutdown' is not implemented on this AIProvider.");
        err.code = providerInterfaceErrorCodes.PROVIDER_INTERFACE_NOT_IMPLEMENTED;
        throw err;
    }
}

/**
 * Factory function creating a default un-implemented AIProvider instance.
 */
function createProviderInterface() {
    const provider = new AIProvider();
    Object.freeze(provider);
    return provider;
}

module.exports = {
    AIProvider,
    createProviderInterface
};
