const projectService = require("../services/projectService");

const generate = async (req, res) => {
    console.log("REQUEST:", req.method, req.url);

    try {
        const {
            prompt,
            projectName,
            projectType,
            frontendFramework,
            backendFramework,
            database,
            authRequired,
            adminRequired
        } = req.body;

        if (!prompt || typeof prompt !== 'string' || prompt.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Prompt is required and must be a non-empty string",
            });
        }

        const data = await projectService.generateProject({
            prompt,
            projectName,
            projectType,
            frontendFramework,
            backendFramework,
            database,
            authRequired,
            adminRequired
        });

        res.status(200).json({
            success: true,
            result: data.result,
            model: data.model,
        });

    } catch (error) {
        console.error(
            "PROJECT GENERATION ERROR:",
            error.response?.status,
            error.response?.data || error.message
        );

        res.status(500).json({
            success: false,
            message: "Failed to generate project boilerplate scaffolding",
            error: error.response?.data || error.message,
        });
    }
};

module.exports = {
    generate,
};
