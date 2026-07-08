const mongoose = require("mongoose");
const { executeAiRequest } = require("./services/aiGenerationExecutor");
const { buildSharedContracts } = require("./services/contractBuilder");
require("dotenv").config();

const runTest = async () => {
    const spec = {
        projectName: "GymLandingPage",
        projectType: "React Landing Page",
        frontend: "React (Vite)",
        backend: "None",
        database: "None",
        importantDependencies: ["lucide-react", "react-icons"],
        pagesAndRoutes: [{ name: "LandingPage", path: "/" }],
        components: [
            { name: "Header" },
            { name: "HeroSection" },
            { name: "FeaturesSection" },
            { name: "TestimonialsSection" },
            { name: "CallToActionSection" },
            { name: "Footer" }
        ]
    };

    const contracts = buildSharedContracts(spec);
    console.log("Contracts:", JSON.stringify(contracts, null, 2));

    const systemPrompt = `You are a principal software engineer. Generate a complete, minimal, runnable codebase.
No markdown guides or explanations outside files blocks. Return the files block inside:
--- START_FILES ---

For each file, use this exact separator structure (including the dashes):
--- FILE: path/to/filename ---
\`\`\`language
// Complete file content here
\`\`\`
--- END_FILE ---

--- END_FILES ---`;

    const userPrompt = `ORIGINAL REQUEST: "Scaffold a simple React landing page for a gym website."
PROJECT SPECIFICATION:
${JSON.stringify(spec, null, 2)}`;

    console.log("\nSending AI request to OpenRouter...");
    const rawOutput = await executeAiRequest(systemPrompt, userPrompt, {
        tokenBudget: 8000,
        callIndex: 1,
        strategy: "SCAFFOLD_AI"
    });

    console.log("\n================= RAW AI OUTPUT =================\n");
    console.log(rawOutput);
    console.log("\n================= END OF RAW OUTPUT =================\n");
    process.exit(0);
};

runTest();
