"use strict";

const { gatewayErrorCodes } = require("./gatewayErrors");

class AIProviderGateway {
    constructor() {
        this.providers = new Map();
    }

    /**
     * Registers a new AI Provider.
     *
     * @param {Object} provider The provider adapter instance
     */
    registerProvider(provider) {
        if (provider === null || provider === undefined || typeof provider !== "object") {
            const err = new Error("Invalid provider: must be a non-null object.");
            err.code = gatewayErrorCodes.GATEWAY_INVALID_REQUEST;
            throw err;
        }

        const id = provider.id || (provider.config && provider.config.id) || (provider.config && provider.config.model);
        if (!id || typeof id !== "string" || id.trim() === "") {
            const err = new Error("Provider must have a valid string 'id'.");
            err.code = gatewayErrorCodes.GATEWAY_INVALID_REQUEST;
            throw err;
        }

        if (this.providers.has(id)) {
            const err = new Error(`Provider with id '${id}' is already registered.`);
            err.code = gatewayErrorCodes.GATEWAY_DUPLICATE_PROVIDER;
            throw err;
        }

        this.providers.set(id, provider);
    }

    /**
     * Unregisters a provider by its ID.
     *
     * @param {String} providerId The provider identifier
     */
    unregisterProvider(providerId) {
        if (typeof providerId !== "string" || providerId.trim() === "") {
            const err = new Error("Invalid providerId: must be a non-empty string.");
            err.code = gatewayErrorCodes.GATEWAY_INVALID_REQUEST;
            throw err;
        }

        this.providers.delete(providerId);
    }

    /**
     * Retrieves a registered provider by its ID.
     *
     * @param {String} providerId The provider identifier
     */
    getProvider(providerId) {
        if (typeof providerId !== "string" || providerId.trim() === "") {
            return null;
        }
        return this.providers.get(providerId) || null;
    }

    /**
     * Lists all registered provider IDs.
     *
     * @returns {Array<String>}
     */
    listProviders() {
        return Array.from(this.providers.keys());
    }

    /**
     * Dispatches chat execution requests.
     *
     * @param {Object} request The canonical chat request payload
     */
    async execute(request) {
        if (request === null || request === undefined || typeof request !== "object") {
            const err = new Error("Invalid request: must be a non-null object.");
            err.code = gatewayErrorCodes.GATEWAY_INVALID_REQUEST;
            throw err;
        }

        const providerId = request.providerId;
        if (typeof providerId !== "string" || providerId.trim() === "") {
            const err = new Error("Invalid request: providerId is required and must be a string.");
            err.code = gatewayErrorCodes.GATEWAY_INVALID_REQUEST;
            throw err;
        }

        if (!Array.isArray(request.messages)) {
            const err = new Error("Invalid request: messages must be an array.");
            err.code = gatewayErrorCodes.GATEWAY_INVALID_REQUEST;
            throw err;
        }

        const provider = this.getProvider(providerId);
        if (!provider) {
            const err = new Error(`Provider not found: '${providerId}'`);
            err.code = gatewayErrorCodes.GATEWAY_PROVIDER_NOT_FOUND;
            throw err;
        }

        try {
            const response = await provider.chat(request);
            return response;
        } catch (err) {
            const exeErr = new Error(`Gateway execution failed: ${err.message}`);
            exeErr.code = gatewayErrorCodes.GATEWAY_EXECUTION_FAILED;
            exeErr.originalError = err;
            throw exeErr;
        }
    }

    /**
     * Checks health status of all registered providers.
     */
    async health() {
        const reports = {};
        let allHealthy = true;

        for (const [id, provider] of this.providers.entries()) {
            try {
                const healthReport = await provider.health();
                reports[id] = healthReport;
                if (healthReport.status !== "healthy") {
                    allHealthy = false;
                }
            } catch (e) {
                reports[id] = { status: "unhealthy", error: e.message };
                allHealthy = false;
            }
        }

        return {
            status: allHealthy ? "healthy" : "unhealthy",
            providers: reports
        };
    }
}

/**
 * Factory function to instantiate the AIProviderGateway.
 */
function createAIProviderGateway() {
    return new AIProviderGateway();
}

module.exports = {
    AIProviderGateway,
    createAIProviderGateway
};
