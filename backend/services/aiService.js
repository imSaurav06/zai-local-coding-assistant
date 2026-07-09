const providerRouter = require("./aiProviders/providerRouter");

const generateAIResponse = async (prompt) => {
    try {
        console.log("1. AI SERVICE STARTED VIA PROVIDER ROUTER");

        const messages = [
            {
                role: "system",
                content: "You are an expert AI coding assistant. Generate clean code and explain it clearly.",
            },
            {
                role: "user",
                content: prompt,
            },
        ];

        const data = await providerRouter.sendChatCompletion(messages, {
            timeout: 180000,
        });

        console.log("2. AI RESPONSE RECEIVED VIA PROVIDER ROUTER");

        return {
            result: data.content,
            model: data.model,
            provider: data.provider
        };
    } catch (error) {
        console.error("AI SERVICE ERROR:", error.message);
        throw error;
    }
};

module.exports = {
    generateAIResponse,
};
















// const generateAIResponse = async (prompt) => {
//     return {
//         result: `Mock AI response for: ${prompt}`,
//     };
// };

// module.exports = {
//     generateAIResponse,
// };