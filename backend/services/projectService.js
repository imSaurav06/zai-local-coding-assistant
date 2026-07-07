const axios = require("axios");

const generateProject = async (projectData) => {
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
        } = projectData;

        const aiPrompt = `You are an AI coding assistant that generates beginner-friendly project scaffolding.

OPTIONAL CONFIGURATION:
Project Name: ${projectName || "Not specified (derive a suitable project name based on the current user request)"}
Project Type: ${projectType || "Not specified"}
Frontend: ${frontendFramework || "Not specified"}
Backend: ${backendFramework || "Not specified"}
Database: ${database || "Not specified"}
Authentication Required: ${authRequired || "Not specified"}
Admin Panel Required: ${adminRequired || "Not specified"}

Do not reuse examples from previous requests.
Do not always generate SaaS projects.
Do not always use the name AcmeSaaS.
Generate output relevant only to the current request.
Keep the response beginner-friendly and suitable for a junior developer assignment.

Return:
1. Project Title
2. Project Summary
3. Tech Stack
4. Main Features
5. Folder Structure
6. Starter Code or important code snippets
7. Steps to Run the Project Locally

The current user request has highest priority.
CURRENT USER REQUEST:
${prompt}`;

        console.log("PROJECT SERVICE STARTED - Fresh Request");

        const url = `${process.env.ZAI_BASE_URL}/chat/completions`;
        console.log("PROJECT SERVICE URL:", url);

        const response = await axios.post(
            url,
            {
                model: process.env.ZAI_MODEL,
                stream: false,
                messages: [
                    {
                        role: "system",
                        content: "You are an expert AI coding assistant that designs and scaffolds projects.",
                    },
                    {
                        role: "user",
                        content: aiPrompt,
                    },
                ],
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.ZAI_API_KEY}`,
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache"
                },
                timeout: 120000,
            }
        );

        console.log("PROJECT SERVICE RESPONSE RECEIVED");

        return {
            result: response.data.choices[0].message.content,
            model: process.env.ZAI_MODEL,
        };
    } catch (error) {
        console.error("PROJECT SERVICE ZAI ERROR STATUS:", error.response?.status);
        console.error("PROJECT SERVICE ZAI ERROR DATA:", error.response?.data);
        console.error("PROJECT SERVICE ZAI ERROR MESSAGE:", error.message);
        throw error;
    }
};

module.exports = {
    generateProject,
};
