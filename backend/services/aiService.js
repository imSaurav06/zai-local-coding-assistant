const axios = require("axios");

const generateAIResponse = async (prompt) => {
    try {
        console.log("1. AI SERVICE STARTED");

        const response = await axios.post(
            `${process.env.ZAI_BASE_URL}/chat/completions`,
            {
                model: process.env.ZAI_MODEL,
                messages: [
                    {
                        role: "system",
                        content: "You are an expert AI coding assistant. Generate clean code and explain it clearly.",
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.ZAI_API_KEY}`,
                    "Content-Type": "application/json",
                },
                timeout: 120000,
            }
        );

        console.log("2. ZAI RESPONSE RECEIVED");

        return {
            result: response.data.choices[0].message.content,
            model: process.env.ZAI_MODEL,
        };
    } catch (error) {
        console.error("ZAI ERROR STATUS:", error.response?.status);
        console.error("ZAI ERROR DATA:", error.response?.data);
        console.error("ZAI ERROR MESSAGE:", error.message);

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