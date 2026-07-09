const assert = require("assert");

const runRegressionTest = async () => {
    // Stub provider keys so tests work without real API keys
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    process.env.ZAI_API_KEY = "test-zai-key";
    process.env.AI_PRIMARY_PROVIDER = "openrouter";
    process.env.AI_FALLBACK_PROVIDER = "zai";

    console.log("================= REGRESSION: ANALYZE HTTP 402 FALLBACK FIX =================\n");

    const axios = require("axios");
    const providerRouter = require("./services/aiProviders/providerRouter");
    const projectService = require("./services/projectService");

    // --- Test 1: 402 from primary triggers Z.ai fallback ---
    console.log("Test 1: HTTP 402 from primary triggers Z.ai fallback...");
    const originalPost = axios.post;
    let callCount = 0;
    let lastProvider = "";

    axios.post = async (url, data, config) => {
        callCount++;
        const authHeader = config?.headers?.Authorization || "";
        if (url.includes("openrouter.ai")) {
            lastProvider = "openrouter";
            // Simulate 402 Payment Required from OpenRouter
            const err = new Error("Request failed with status code 402");
            err.response = {
                status: 402,
                data: {
                    error: {
                        message: "This request requires more credits, or fewer max_tokens.",
                        code: 402
                    }
                }
            };
            err.code = "ERR_BAD_REQUEST";
            throw err;
        } else if (url.includes("api.z.ai")) {
            lastProvider = "zai";
            // Simulate successful response from Z.ai fallback
            return {
                data: {
                    choices: [{ message: { content: JSON.stringify({
                        projectName: "GymLanding",
                        projectType: "React Landing Page",
                        frontend: "React (Vite) 18.2",
                        backend: "None",
                        database: "None",
                        authentication: "None",
                        designRequirements: "Tailwind CSS",
                        pagesAndRoutes: [{ path: "/", name: "Home", description: "Landing page" }],
                        components: [{ name: "Navbar", purpose: "Navigation" }],
                        backendApis: [],
                        databaseModels: [],
                        integrations: [],
                        importantDependencies: ["react-router-dom"],
                        environmentVariables: [],
                        architectureConstraints: [],
                        runBuildRequirements: { runScript: "npm run dev", buildScript: "npm run build" },
                        deploymentRequirements: "None",
                        assumptions: ["Pure frontend project, no backend required"]
                    }) } }],
                    usage: {}
                }
            };
        }
        throw new Error("Unexpected URL: " + url);
    };

    try {
        const spec = await projectService.analyzeRequirements({
            prompt: "Scaffold a simple React landing page for a gym website."
        });

        assert.strictEqual(callCount, 2, `Expected exactly 2 calls (openrouter fail + zai succeed), got ${callCount}`);
        assert.strictEqual(lastProvider, "zai", "Expected final provider to be zai");
        assert.strictEqual(spec.frontend.toLowerCase().includes("react"), true, "Expected React in frontend spec");
        assert.strictEqual(spec.backend, "None", "Expected no backend for a simple landing page");
        assert.strictEqual(spec.database, "None", "Expected no database for a simple landing page");
        assert.strictEqual(spec.authentication, "None", "Expected no authentication for a simple landing page");
        assert.strictEqual(typeof spec.projectName, "string", "Expected projectName to be a string");
        console.log("   Test 1 PASS — 402 from OpenRouter correctly triggers Z.ai fallback");
        console.log("   Final provider:", lastProvider, "| Calls:", callCount);
        console.log("   Spec: frontend=" + spec.frontend + " backend=" + spec.backend + " auth=" + spec.authentication);
    } catch (e) {
        console.error("   Test 1 FAIL:", e.message);
        axios.post = originalPost;
        process.exit(1);
    }

    // --- Test 2: extractSafeErrorMessage handles object data.error ---
    console.log("\nTest 2: Error message extraction handles object data.error...");
    callCount = 0;
    axios.post = async (url, data, config) => {
        callCount++;
        if (url.includes("openrouter.ai")) {
            const err = new Error("Request failed with status code 402");
            err.response = {
                status: 402,
                data: { error: { message: "Insufficient credits.", code: 402 } }
            };
            throw err;
        }
        // Z.ai returns valid JSON spec
        return {
            data: {
                choices: [{ message: { content: JSON.stringify({
                    projectName: "GymTest",
                    projectType: "React Landing Page",
                    frontend: "React",
                    backend: "None",
                    database: "None",
                    authentication: "None",
                    designRequirements: "Tailwind CSS",
                    pagesAndRoutes: [],
                    components: [],
                    backendApis: [],
                    databaseModels: [],
                    integrations: [],
                    importantDependencies: [],
                    environmentVariables: [],
                    architectureConstraints: [],
                    runBuildRequirements: { runScript: "npm run dev", buildScript: "" },
                    deploymentRequirements: "None",
                    assumptions: []
                }) } }],
                usage: {}
            }
        };
    };

    try {
        const spec = await projectService.analyzeRequirements({ prompt: "A gym landing page." });
        assert.ok(spec.projectName, "Expected projectName in spec");
        console.log("   Test 2 PASS — Error message extracted cleanly, fallback succeeded");
    } catch (e) {
        assert.ok(!e.message.includes("[object Object]"), "Error message must not contain '[object Object]': " + e.message);
        console.error("   Test 2 FAIL:", e.message);
        axios.post = originalPost;
        process.exit(1);
    }

    // --- Test 3: Robust JSON extraction handles leading prose ---
    console.log("\nTest 3: Robust JSON extraction handles leading prose...");
    callCount = 0;
    axios.post = async (url, data, config) => {
        callCount++;
        if (url.includes("openrouter.ai")) {
            const err = new Error("Request failed with status code 402");
            err.response = { status: 402, data: { error: { message: "No credits." } } };
            throw err;
        }
        return {
            data: {
                choices: [{ message: { content: `Here is the specification you requested:

\`\`\`json
{
  "projectName": "GymSite",
  "projectType": "React Landing Page",
  "frontend": "React (Vite)",
  "backend": "None",
  "database": "None",
  "authentication": "None",
  "designRequirements": "Tailwind CSS",
  "pagesAndRoutes": [],
  "components": [],
  "backendApis": [],
  "databaseModels": [],
  "integrations": [],
  "importantDependencies": [],
  "environmentVariables": [],
  "architectureConstraints": [],
  "runBuildRequirements": { "runScript": "npm run dev", "buildScript": "" },
  "deploymentRequirements": "None",
  "assumptions": []
}
\`\`\`

Hope this helps!` } }],
                usage: {}
            }
        };
    };

    try {
        const spec = await projectService.analyzeRequirements({ prompt: "A gym landing page." });
        assert.strictEqual(spec.projectName, "GymSite", "Expected projectName to be GymSite");
        assert.strictEqual(spec.frontend, "React (Vite)", "Expected React frontend in spec");
        console.log("   Test 3 PASS — Markdown fenced JSON with surrounding prose parsed correctly");
    } catch (e) {
        console.error("   Test 3 FAIL:", e.message);
        axios.post = originalPost;
        process.exit(1);
    }

    // Restore
    axios.post = originalPost;

    console.log("\n================= ALL REGRESSION TESTS PASSED! =================\n");
};

runRegressionTest().then(() => {
    process.exit(0);
}).catch(e => {
    console.error("REGRESSION TEST EXCEPTION:", e.message);
    console.error(e.stack);
    process.exit(1);
});
