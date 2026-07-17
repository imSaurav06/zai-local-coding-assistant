"use strict";

const { AIProvider } = require("./providerInterface");
const { providerInterfaceErrorCodes } = require("./providerInterfaceErrors");
const { sendChatCompletion } = require("../../services/aiProviders/zaiProvider");

class ZaiProvider extends AIProvider {
    constructor() {
        super();
        this.config = null;
        this.initialized = false;
    }

    /**
     * Initializes the Zai provider with configuration.
     *
     * @param {Object} config The initialization config
     */
    async initialize(config) {
        if (config === null || config === undefined || typeof config !== "object") {
            const err = new Error("Invalid config: must be a non-null object.");
            err.code = providerInterfaceErrorCodes.PROVIDER_INTERFACE_INVALID_ARGUMENT;
            throw err;
        }

        const apiKey = config.apiKey || process.env.ZAI_KEY || process.env.ZAI_API_KEY;
        if (!apiKey) {
            const err = new Error("Z.ai API Key is missing.");
            err.code = providerInterfaceErrorCodes.PROVIDER_INTERFACE_INVALID_ARGUMENT;
            throw err;
        }

        this.config = {
            apiKey,
            baseURL: config.baseURL || process.env.ZAI_BASE_URL || "https://api.z.ai/api/paas/v4",
            model: config.model || process.env.ZAI_MODEL || "glm-5.2" // Default is glm-5.2!
        };
        this.initialized = true;
    }

    /**
     * Verifies health status of the provider.
     */
    async health() {
        if (!this.initialized) {
            const err = new Error("Provider not initialized.");
            err.code = providerInterfaceErrorCodes.PROVIDER_INTERFACE_UNSUPPORTED_OPERATION;
            throw err;
        }
        return {
            status: "healthy",
            details: {
                provider: "zai",
                model: this.config.model
            }
        };
    }

    /**
     * Dispatches chat completions request.
     *
     * @param {Object} request The chat completion request payload
     */
    async chat(request) {
        if (!this.initialized) {
            const err = new Error("Provider not initialized.");
            err.code = providerInterfaceErrorCodes.PROVIDER_INTERFACE_UNSUPPORTED_OPERATION;
            throw err;
        }

        if (request === null || request === undefined || !Array.isArray(request.messages)) {
            const err = new Error("Invalid request: messages must be an array.");
            err.code = providerInterfaceErrorCodes.PROVIDER_INTERFACE_INVALID_ARGUMENT;
            throw err;
        }

        // Set up temporary environment variables for the existing implementation
        const originalApiKey = process.env.ZAI_API_KEY;
        const originalModel = process.env.ZAI_MODEL;
        const originalBaseUrl = process.env.ZAI_BASE_URL;

        process.env.ZAI_API_KEY = this.config.apiKey;
        process.env.ZAI_MODEL = request.model || this.config.model;
        process.env.ZAI_BASE_URL = this.config.baseURL;

        try {
            const configPayload = request.config || {};
            const result = await sendChatCompletion(request.messages, configPayload);

            return {
                success: result.content !== null,
                provider: "zai",
                model: result.model,
                content: result.content,
                usage: result.usage || {},
                finishReason: result.content !== null ? "stop" : "error",
                metadata: {}
            };
        } catch (err) {
            const mappedErr = new Error(`Zai chat completion failed: ${err.message}`);
            mappedErr.code = "PROVIDER_CHAT_FAILED";
            mappedErr.originalError = err;
            throw mappedErr;
        } finally {
            // Restore environment variables
            process.env.ZAI_API_KEY = originalApiKey;
            process.env.ZAI_MODEL = originalModel;
            process.env.ZAI_BASE_URL = originalBaseUrl;
        }
    }

    /**
     * Dispatches prompt completion request, converting it into a chat message.
     *
     * @param {Object} request The completion request payload
     */
    async complete(request) {
        if (!this.initialized) {
            const err = new Error("Provider not initialized.");
            err.code = providerInterfaceErrorCodes.PROVIDER_INTERFACE_UNSUPPORTED_OPERATION;
            throw err;
        }

        if (request === null || request === undefined || typeof request.prompt !== "string") {
            const err = new Error("Invalid request: prompt must be a string.");
            err.code = providerInterfaceErrorCodes.PROVIDER_INTERFACE_INVALID_ARGUMENT;
            throw err;
        }

        const chatRequest = {
            messages: [{ role: "user", content: request.prompt }],
            model: request.model,
            config: request.config
        };

        return this.chat(chatRequest);
    }

    /**
     * Streaming is currently unsupported.
     */
    async stream(request) {
        const err = new Error("Method 'stream' is not supported by Zai adapter.");
        err.code = providerInterfaceErrorCodes.PROVIDER_INTERFACE_UNSUPPORTED_OPERATION;
        throw err;
    }

    /**
     * Offline token counting is currently unsupported.
     */
    async countTokens(request) {
        const err = new Error("Method 'countTokens' is not supported by Zai adapter.");
        err.code = providerInterfaceErrorCodes.PROVIDER_INTERFACE_UNSUPPORTED_OPERATION;
        throw err;
    }

    /**
     * Lists active models configured.
     */
    async listModels() {
        if (!this.initialized) {
            const err = new Error("Provider not initialized.");
            err.code = providerInterfaceErrorCodes.PROVIDER_INTERFACE_UNSUPPORTED_OPERATION;
            throw err;
        }
        return [this.config.model];
    }

    /**
     * Verifies if this provider supports the requested capability.
     *
     * @param {String} capability Capability identifier string
     */
    async supports(capability) {
        const supported = ["chat", "completion"];
        return supported.includes(capability);
    }

    /**
     * Shutdown procedure.
     */
    async shutdown() {
        return;
    }
}

module.exports = {
    ZaiProvider
};
