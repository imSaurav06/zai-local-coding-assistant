const axios = require("axios");

const sendChatCompletion = async (messages, config = {}, options = {}) => {
    const baseURL = process.env.ZAI_BASE_URL || "https://api.z.ai/api/paas/v4";
    const apiKey = process.env.ZAI_API_KEY;
    const model = process.env.ZAI_MODEL || "glm-4.5-flash";

    if (!apiKey) {
        throw new Error("Z.ai API Key is missing in environment variables.");
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
        provider: "zai",
        usage: response.data.usage || {}
    };
};

module.exports = { sendChatCompletion };
