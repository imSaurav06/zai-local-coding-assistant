"use strict";

const { gatewayErrorCodes } = require("./gatewayErrors");

/**
 * Resolves priority value for a provider.
 * Lower priority number indicates higher precedence.
 */
function getProviderPriority(provider) {
    if (provider.priority !== undefined) return provider.priority;
    if (provider.config && provider.config.priority !== undefined) return provider.config.priority;
    if (provider.metadata && provider.metadata.priority !== undefined) return provider.metadata.priority;

    const id = provider.id || (provider.config && provider.config.id);
    if (id === "zai") return 1;
    if (id === "openrouter") return 2;
    return 100; // Default lower priority for custom providers
}

/**
 * Wraps a promise in a timeout guard.
 */
function withTimeout(promise, timeoutMs) {
    let timer = null;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const err = new Error(`Request timed out after ${timeoutMs}ms`);
            err.code = "GATEWAY_TIMEOUT";
            reject(err);
        }, timeoutMs);
    });

    return Promise.race([
        promise.then(res => {
            if (timer) clearTimeout(timer);
            return res;
        }),
        timeoutPromise
    ]);
}

class AIProviderGateway {
    constructor() {
        this.providers = new Map();
        
        // Memory-only dynamic metrics tracking
        this.metrics = new Map();
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
        
        // Initialize metrics for this provider
        this.metrics.set(id, {
            successfulRequests: 0,
            failedRequests: 0,
            fallbackCount: 0,
            averageLatency: 0
        });
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
        this.metrics.delete(providerId);
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
     * Exposes metrics for a given provider.
     *
     * @param {String} providerId
     */
    getProviderMetrics(providerId) {
        const m = this.metrics.get(providerId);
        if (!m) return null;
        return { ...m };
    }

    /**
     * Records a request execution metric.
     */
    recordMetric(providerId, isSuccess, latency) {
        const m = this.metrics.get(providerId);
        if (!m) return;

        if (isSuccess) {
            m.successfulRequests += 1;
        } else {
            m.failedRequests += 1;
        }

        const count = m.successfulRequests + m.failedRequests;
        m.averageLatency = ((m.averageLatency * (count - 1)) + latency) / count;
    }

    /**
     * Records a fallback occurrence.
     */
    recordFallback(providerId) {
        const m = this.metrics.get(providerId);
        if (m) {
            m.fallbackCount += 1;
        }
    }

    /**
     * Dispatches chat execution requests, executing priority-based capability routing,
     * retries, timeouts, and fallbacks.
     *
     * @param {Object} request The canonical chat request payload
     */
    async execute(request) {
        if (request === null || request === undefined || typeof request !== "object") {
            const err = new Error("Invalid request: must be a non-null object.");
            err.code = gatewayErrorCodes.GATEWAY_INVALID_REQUEST;
            throw err;
        }

        if (!Array.isArray(request.messages)) {
            const err = new Error("Invalid request: messages must be an array.");
            err.code = gatewayErrorCodes.GATEWAY_INVALID_REQUEST;
            throw err;
        }

        if (this.providers.size === 0) {
            const err = new Error("No providers registered in the gateway.");
            err.code = gatewayErrorCodes.GATEWAY_NO_PROVIDER_AVAILABLE;
            throw err;
        }

        const capability = request.capability || "chat";
        const supporting = [];

        // 1. Gather all providers that support requested capability
        for (const p of this.providers.values()) {
            if (await p.supports(capability)) {
                supporting.push(p);
            }
        }

        if (supporting.length === 0) {
            const err = new Error(`No provider registered supports capability: '${capability}'`);
            err.code = gatewayErrorCodes.GATEWAY_CAPABILITY_UNSUPPORTED;
            throw err;
        }

        // 2. Sort by priority
        supporting.sort((a, b) => getProviderPriority(a) - getProviderPriority(b));

        // 3. If request.providerId is specified, make that provider first
        if (request.providerId) {
            const idx = supporting.findIndex(p => p.id === request.providerId);
            if (idx !== -1) {
                const [target] = supporting.splice(idx, 1);
                supporting.unshift(target);
            } else {
                const err = new Error(`Requested provider '${request.providerId}' not found or doesn't support capability '${capability}'`);
                err.code = gatewayErrorCodes.GATEWAY_PROVIDER_NOT_FOUND;
                throw err;
            }
        }

        // 4. Try executing down the fallback chain
        let lastError = null;

        for (let pIdx = 0; pIdx < supporting.length; pIdx++) {
            const provider = supporting[pIdx];
            const providerId = provider.id;

            const maxRetries = request.maxRetries !== undefined ? request.maxRetries : 1;
            const timeoutMs = request.timeout !== undefined ? request.timeout : (provider.timeout || (provider.config && provider.config.timeout) || 30000);

            let attempt = 0;
            let success = false;
            let response = null;

            while (attempt <= maxRetries && !success) {
                const startTime = Date.now();
                try {
                    // Inject providerId into the request payload so concrete adapter can inspect it
                    const requestWithModel = {
                        ...request,
                        model: request.model || (provider.config && provider.config.model)
                    };
                    
                    response = await withTimeout(provider.chat(requestWithModel), timeoutMs);
                    success = true;

                    const latency = Date.now() - startTime;
                    this.recordMetric(providerId, true, latency);
                } catch (err) {
                    const latency = Date.now() - startTime;
                    this.recordMetric(providerId, false, latency);
                    lastError = err;

                    // Immediately abort retry on client validation errors
                    if (err.code === "PROVIDER_INTERFACE_INVALID_ARGUMENT" || err.code === "PROVIDER_INVALID_INPUT") {
                        break;
                    }

                    attempt++;
                }
            }

            if (success) {
                return response;
            }

            // Record fallback if there are more providers remaining
            if (pIdx < supporting.length - 1) {
                this.recordFallback(providerId);
            }
        }

        // If loop completes without success, map and throw deterministic errors
        if (lastError && (lastError.code === "PROVIDER_INTERFACE_INVALID_ARGUMENT" || lastError.code === "PROVIDER_INVALID_INPUT")) {
            throw lastError;
        }

        if (lastError && lastError.code === "GATEWAY_TIMEOUT") {
            const err = new Error(`Gateway request failed due to timeout: ${lastError.message}`);
            err.code = gatewayErrorCodes.GATEWAY_TIMEOUT;
            throw err;
        }

        const err = new Error(`All configured AI providers failed to resolve request. Last error: ${lastError ? lastError.message : "unknown"}`);
        err.code = gatewayErrorCodes.GATEWAY_ALL_PROVIDERS_FAILED;
        err.originalError = lastError;
        throw err;
    }

    /**
     * Checks health status of all registered providers and appends metrics.
     */
    async health() {
        const reports = {};
        let allHealthy = true;

        for (const [id, provider] of this.providers.entries()) {
            try {
                const healthReport = await provider.health();
                reports[id] = {
                    ...healthReport,
                    metrics: this.getProviderMetrics(id)
                };
                if (healthReport.status !== "healthy") {
                    allHealthy = false;
                }
            } catch (e) {
                reports[id] = {
                    status: "unhealthy",
                    error: e.message,
                    metrics: this.getProviderMetrics(id)
                };
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
