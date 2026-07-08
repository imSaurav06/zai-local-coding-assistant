const axios = require("axios");

const sendChatCompletion = async (messages, config = {}, options = {}) => {
    const baseURL = "https://openrouter.ai/api/v1";
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";

    if (!apiKey) {
        throw new Error("OpenRouter API Key is missing in environment variables.");
    }

    const response = await axios.post(
        `${baseURL}/chat/completions`,
        {
            model: model,
            messages: messages,
            stream: false
        },
        {
            ...config,
            headers: {
                ...config.headers,
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            }
        }
    );

    return {
        content: response.data.choices[0].message.content,
        model: model,
        provider: "openrouter",
        usage: response.data.usage || {}
    };
};

module.exports = { sendChatCompletion };
