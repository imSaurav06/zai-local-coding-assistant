const axios = require("axios");

const sendChatCompletion = async (messages, config = {}, options = {}) => {
    const baseURL = process.env.ZAI_BASE_URL || "https://api.z.ai/api/paas/v4";
    const apiKey = process.env.ZAI_API_KEY;
    const model = process.env.ZAI_MODEL || "glm-4.5-flash";

    if (!apiKey) {
        throw new Error("Z.ai API Key is missing in environment variables.");
    }

    // Extract only the fields that are valid axios request-level options.
    // We do NOT spread the whole config object because it may contain custom fields
    // (tokenBudget, max_tokens) that pollute the axios request config.
    const { tokenBudget, max_tokens, signal, timeout, ...rest } = config;
    // Since glm-4.5-flash is a reasoning-first model, we must ensure maxTokens is large enough
    // (at least 8192) so it does not exhaust the token budget on reasoning and return empty content.
    const maxTokens = Math.max(tokenBudget || max_tokens || 8192, 8192);

    const axiosConfig = {
        ...(timeout && { timeout }),
        ...(signal && { signal }),
        headers: {
            ...(rest.headers || {}),
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        }
    };

    const response = await axios.post(
        `${baseURL}/chat/completions`,
        {
            model: model,
            messages: messages,
            stream: false,
            max_tokens: maxTokens
        },
        axiosConfig
    );

    // Defensive guard: validate response shape before accessing nested fields.
    // Missing/empty choices or null content → return null so executor triggers typed fallback.
    const choices = response.data && response.data.choices;
    if (!choices || !Array.isArray(choices) || choices.length === 0) {
        return {
            content: null,
            model: model,
            provider: "zai",
            usage: response.data.usage || {}
        };
    }

    const message = choices[0].message;
    if (!message) {
        return {
            content: null,
            model: model,
            provider: "zai",
            usage: response.data.usage || {}
        };
    }

    const content = message.content;
    // Normalize: null, undefined, or whitespace-only → null so executor's guard triggers
    const normalizedContent = (typeof content === "string" && content.trim().length > 0)
        ? content
        : null;

    return {
        content: normalizedContent,
        model: model,
        provider: "zai",
        usage: response.data.usage || {}
    };
};

module.exports = { sendChatCompletion };
