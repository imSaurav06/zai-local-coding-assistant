const zaiProvider = require("./zaiProvider");
const openRouterProvider = require("./openRouterProvider");

const getPrimaryProvider = () => {
    return process.env.AI_PRIMARY_PROVIDER || "openrouter";
};

const getFallbackProvider = () => {
    return process.env.AI_FALLBACK_PROVIDER || "zai";
};

const getProviderInstance = (providerName) => {
    if (providerName === "zai") {
        return zaiProvider;
    } else if (providerName === "openrouter") {
        return openRouterProvider;
    }
    throw new Error(`Unsupported AI Provider: ${providerName}`);
};

const validateConfiguration = () => {
    const primary = getPrimaryProvider();
    const fallback = getFallbackProvider();

    // Check primary provider key
    if (primary === "openrouter" && !process.env.OPENROUTER_API_KEY) {
        console.warn("WARNING: OpenRouter API key is missing. Checking fallback provider...");
        if (fallback === "zai" && process.env.ZAI_API_KEY) {
            console.warn("Using Z.ai as active provider due to missing primary provider config.");
        } else {
            throw new Error("Invalid Configuration: Both primary (OpenRouter) and fallback (Z.ai) API keys are missing.");
        }
    } else if (primary === "zai" && !process.env.ZAI_API_KEY) {
        console.warn("WARNING: Z.ai API key is missing. Checking fallback provider...");
        if (fallback === "openrouter" && process.env.OPENROUTER_API_KEY) {
            console.warn("Using OpenRouter as active provider due to missing primary provider config.");
        } else {
            throw new Error("Invalid Configuration: Both primary (Z.ai) and fallback (OpenRouter) API keys are missing.");
        }
    }
};

// Initial config check on load
try {
    validateConfiguration();
} catch (e) {
    console.error("Provider Router Startup Check Failed:", e.message);
}

const sendChatCompletionDirect = async (provider, messages, config = {}, options = {}) => {
    const instance = getProviderInstance(provider);
    return await instance.sendChatCompletion(messages, config, options);
};

const extractSafeErrorMessage = (err) => {
    if (!err.response) return err.message;
    const data = err.response.data;
    if (!data) return err.message;
    if (typeof data === "string") return data.slice(0, 300);
    if (data.error && typeof data.error.message === "string") return data.error.message.slice(0, 300);
    if (typeof data.message === "string") return data.message.slice(0, 300);
    return JSON.stringify(data).slice(0, 300);
};

const sendChatCompletion = async (messages, config = {}, options = {}) => {
    const primary = getPrimaryProvider();
    const fallback = getFallbackProvider();

    try {
        return await sendChatCompletionDirect(primary, messages, config, options);
    } catch (primaryErr) {
        const status = primaryErr.response ? primaryErr.response.status : null;
        const code = primaryErr.code || "";
        const safeMsg = extractSafeErrorMessage(primaryErr);

        console.error(`[Provider Router] Primary provider '${primary}' failed. status=${status ?? 'none'} code=${code || 'none'} message=${safeMsg}`);
        
        const isRateLimit = status === 429;
        // 402 = payment required / out of credits on provider — treat as fallback-eligible
        const isPaymentRequired = status === 402;
        const isTimeout = code === "ECONNABORTED" || (primaryErr.message && primaryErr.message.toLowerCase().includes("timeout"));
        const isNetwork = ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(code);
        const isTransient5xx = status >= 500 && status <= 599;
        const isFallbackEligible = isRateLimit || isPaymentRequired || isTimeout || isNetwork || isTransient5xx;

        if (isFallbackEligible && fallback && fallback !== primary) {
            console.warn(`[AI Failover] Primary provider '${primary}' failed (${status ?? code}). Retrying exactly once via fallback provider '${fallback}'...`);
            return await sendChatCompletionDirect(fallback, messages, config, options);
        }

        // Re-throw with a clean message that includes provider context
        const richErr = new Error(`[${primary}] ${safeMsg}`);
        richErr.providerStatus = status;
        richErr.providerCode = code;
        richErr.provider = primary;
        throw richErr;
    }
};

module.exports = {
    getPrimaryProvider,
    getFallbackProvider,
    sendChatCompletionDirect,
    sendChatCompletion,
    validateConfiguration
};
