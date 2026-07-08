const { orchestrateGeneration } = require("./services/generationOrchestrator");
require("dotenv").config();

const runSmokeTest = async () => {
    console.log("================= STARTING REAL Z.AI SMOKE TEST =================");
    const start = Date.now();

    const originalPrompt = "Create a lightweight Express JS task list API with database persistence and memory caching.";
    const projectSpec = {
        projectName: "TaskExpressAPI",
        projectType: "Express API",
        frontend: "None",
        backend: "Express.js (Node)",
        database: "SQLite",
        authentication: "None",
        designRequirements: "None",
        pagesAndRoutes: [
            { name: "get_tasks", path: "/api/tasks", method: "GET" },
            { name: "create_task", path: "/api/tasks", method: "POST" }
        ],
        components: [],
        backendApis: [
            { method: "GET", path: "/api/tasks", purpose: "Fetch tasks" },
            { method: "POST", path: "/api/tasks", purpose: "Save task" }
        ],
        databaseModels: [
            { name: "Task", fields: "id, title, completed, createdAt" }
        ],
        integrations: [],
        importantDependencies: ["express", "sqlite3"],
        environmentVariables: ["PORT"],
        architectureConstraints: [],
        runBuildRequirements: {},
        deploymentRequirements: "None",
        assumptions: ["Use simple file-based sqlite store"]
    };

    const progressEmitter = {
        emit: (stage, text) => console.log(`[Progress] ${stage}: ${text}`),
        end: (result) => console.log("\n[End] Result received successfully!")
    };

    try {
        const result = await orchestrateGeneration({
            originalPrompt,
            projectSpec
        }, progressEmitter, () => {});

        console.log("\nSMOKE TEST COMPLETED SUCCESSFULLY!");
        console.log(`- Project Name: ${projectSpec.projectName}`);
        console.log(`- Total Time: ${(Date.now() - start) / 1000}s`);
        console.log(`- Files Generated (${result.files.length}):`);
        result.files.forEach(f => console.log(`  - ${f.name} (${f.content.length} bytes)`));

        const serverJs = result.files.find(f => f.name === "server.js");
        if (serverJs) {
            console.log("\nserver.js Content Snippet:");
            console.log(serverJs.content.substring(0, 300) + "...\n");
        }
    } catch (e) {
        console.error("\nSMOKE TEST FAILED:", e.message);
        console.error(e.stack);
        process.exit(1);
    }
};

runSmokeTest();
