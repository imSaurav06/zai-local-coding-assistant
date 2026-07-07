const aiService = require("../services/aiService");

const generate = async (req, res) => {
    console.log("REQUEST:", req.method, req.url);

    try {
        const { prompt } = req.body;

        if (!prompt || typeof prompt !== 'string' || prompt.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Prompt is required and must be a non-empty string",
            });
        }

        const data = await aiService.generateAIResponse(prompt);

        res.status(200).json({
            success: true,
            result: data.result,
            model: data.model,
        });

    } catch (error) {
        console.error(
            "ZAI ERROR:",
            error.response?.status,
            error.response?.data || error.message
        );

        res.status(500).json({
            success: false,
            message: "Failed to generate AI response",
            error: error.response?.data || error.message,
        });
    }
};

module.exports = {
    generate,
};