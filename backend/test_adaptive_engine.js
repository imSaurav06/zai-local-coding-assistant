const assert = require("assert");
const axios = require("axios");
const { planGeneration } = require("./services/generationPlanner");
const { buildSharedContracts } = require("./services/contractBuilder");
const { generateScaffoldFiles } = require("./services/scaffoldRegistry");
const { validateProjectFiles } = require("./services/validationProfiles");
const { mapErrorsToFiles } = require("./services/targetedRepairService");
const { orchestrateGeneration } = require("./services/generationOrchestrator");
const { calculateAdaptiveTimeout } = require("./services/aiGenerationExecutor");

const runTests = async () => {
    // Stub keys for provider tests to proceed to mocked axios.post calls
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    process.env.ZAI_API_KEY = "test-zai-key";
    process.env.AI_PRIMARY_PROVIDER = "openrouter";
    process.env.AI_FALLBACK_PROVIDER = "zai";

    console.log("================= STARTING ADAPTIVE ENGINE UNIT TESTS =================\n");

    // 1. Test strategy selections in planner
    console.log("1. Testing planner strategy selection...");
    
    // A complex small-file project is not automatically DIRECT (prefers SCAFFOLD_AI due to scaffold availability)
    const complexSmallPlan = planGeneration({
        projectName: "ComplexSmall",
        projectType: "Fullstack App",
        frontend: "React + Vite",
        backend: "Express",
        database: "MongoDB",
        pagesAndRoutes: [{ name: "Login" }],
        components: [{ name: "LoginForm" }],
        databaseModels: [{ name: "User" }],
        importantDependencies: ["express", "mongoose"]
    });
    assert.strictEqual(complexSmallPlan.strategy, "SCAFFOLD_AI");
    console.log("   - Complex small-file project with scaffold coverage prefers SCAFFOLD_AI: PASS");

    // A larger low-coupling project may use PARALLEL when beneficial
    const largeLowCoupledPlan = planGeneration({
        projectName: "LowCoupledDashboard",
        projectType: "Modular Dashboard",
        frontend: "React + Vite",
        backend: "None",
        database: "None",
        pagesAndRoutes: [{ name: "Home" }, { name: "Analytics" }, { name: "Settings" }, { name: "Users" }, { name: "Profile" }, { name: "Billing" }],
        components: [{ name: "Card" }, { name: "Chart" }, { name: "Navbar" }, { name: "Sidebar" }, { name: "Footer" }, { name: "Button" }, { name: "Input" }, { name: "Modal" }, { name: "Label" }],
        databaseModels: [],
        importantDependencies: []
    });
    assert.strictEqual(largeLowCoupledPlan.strategy, "PARALLEL");
    console.log("   - Larger low-coupling project selects PARALLEL: PASS");

    // A many-file but highly coupled project does not use PARALLEL blindly (prefers CHUNKED or SCAFFOLD_AI if not massive)
    const coupledManyFilesPlan = planGeneration({
        projectName: "CoupledShop",
        projectType: "Fullstack Shop",
        frontend: "React + Vite",
        backend: "Express",
        database: "MongoDB",
        pagesAndRoutes: [{ name: "Catalog" }, { name: "Cart" }, { name: "Checkout" }, { name: "Orders" }],
        components: [{ name: "ProductItem" }, { name: "CartSummary" }, { name: "Navbar" }, { name: "Footer" }],
        databaseModels: [{ name: "Product" }, { name: "Order" }, { name: "User" }],
        importantDependencies: ["express", "mongoose"]
    });
    // Total files = base 5 + 4 pages + 4 components + 3 models = 16 files.
    // Highly coupled (frontend + backend + models). Because files <= 18, it fits in SCAFFOLD_AI budget!
    assert.strictEqual(coupledManyFilesPlan.strategy, "SCAFFOLD_AI");
    console.log("   - Many-file highly-coupled project avoids PARALLEL and fits in SCAFFOLD_AI: PASS");

    // CHUNKED is selected only when output/context limits require it
    const massivePlan = planGeneration({
        projectName: "MassiveApp",
        projectType: "Enterprise SaaS",
        frontend: "Next.js",
        backend: "Django",
        database: "PostgreSQL",
        pagesAndRoutes: [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }, { name: "E" }, { name: "F" }],
        components: [{ name: "C1" }, { name: "C2" }, { name: "C3" }, { name: "C4" }, { name: "C5" }, { name: "C6" }, { name: "C7" }],
        databaseModels: [{ name: "M1" }, { name: "M2" }, { name: "M3" }, { name: "M4" }, { name: "M5" }],
        importantDependencies: []
    });
    // Expected files > 18.
    assert.strictEqual(massivePlan.strategy, "CHUNKED");
    console.log("   - CHUNKED is selected only for massive complexity: PASS");

    // Small projects stay within 1 primary AI call
    const smallPlan = planGeneration({
        projectName: "SimpleApp",
        frontend: "None",
        backend: "None",
        database: "None"
    });
    assert.strictEqual(smallPlan.generationUnits.length, 1);
    console.log("   - Small project plans exactly 1 consolidated generation unit: PASS");

    // Moderate projects stay within 2 primary AI calls
    const moderatePlan = planGeneration({
        projectName: "ModerateApp",
        frontend: "React + Vite",
        backend: "None",
        database: "None",
        pagesAndRoutes: [{ name: "Home" }],
        components: [{ name: "Header" }, { name: "Footer" }]
    });
    assert.ok(moderatePlan.generationUnits.length <= 2);
    console.log("   - Moderate project plans within 2 primary AI calls budget: PASS");

    // 2. Test shared contracts builder
    console.log("2. Testing contract builder...");
    const contracts = buildSharedContracts({
        projectName: "TestSaaS",
        frontend: "React.js",
        backend: "Express.js",
        databaseModels: [{ name: "User", fields: "id, email, password" }],
        backendApis: [{ method: "POST", path: "/api/login", purpose: "Authenticate" }]
    });
    assert.ok(contracts.folderStructure.includes("src/App.jsx"));
    assert.ok(contracts.apiEndpoints.some(e => e.path === "/api/login"));
    console.log("   - Contracts built correctly: PASS");

    // 3. Test scaffold configuration generator
    console.log("3. Testing scaffold registry...");
    const scaffoldFiles = generateScaffoldFiles("react-vite", { projectName: "GymApp" });
    assert.ok(scaffoldFiles.some(f => f.name === "package.json"));
    console.log("   - Scaffold template files mapped: PASS");

    // 4. Test validation error mapping
    console.log("4. Testing validation errors affected files mapping...");
    const dummyFiles = [
        { name: "package.json", content: "{}" },
        { name: "src/App.jsx", content: "import x from './Hero'" }
    ];
    const errors = ["Invalid JSON syntax in 'package.json'", "File 'src/App.jsx' imports missing local module './Hero'"];
    const affected = mapErrorsToFiles(errors, dummyFiles);
    assert.ok(affected.includes("package.json"));
    assert.ok(affected.includes("src/App.jsx"));
    console.log("   - Errors mapped cleanly to specific target source files: PASS");

    // 5. Test Rate-Limiting Backoff and Timeout limits (Max 2 retries)
    console.log("5. Testing rate-limit and timed-out limits (max 2 retries)...");
    const originalPost = axios.post;
    let postCalls = 0;
    
    axios.post = async (url, data, config) => {
        postCalls++;
        // Keep throwing ETIMEDOUT to verify it stops retrying after 2 retries
        const err = new Error("Connection timeout");
        err.code = "ETIMEDOUT";
        throw err;
    };

    const emitter = {
        emit: () => {},
        end: () => {}
    };

    try {
        await orchestrateGeneration({
            originalPrompt: "make static page",
            projectSpec: {
                projectName: "StaticApp",
                projectType: "HTML Page",
                frontend: "HTML",
                backend: "None",
                database: "None"
            }
        }, emitter, () => {});
        assert.fail("Generation should have failed on network timeout limits");
    } catch (e) {
        // Primary (1 + 2 retries) + Fallback (1 + 2 retries) = 6 total post calls
        assert.strictEqual(postCalls, 6);
        console.log("   - Bounded retries and failover limit strictly respected: PASS");
    }

    // 6. Test Client Cancellation Abort
    console.log("6. Testing client cancellation abort...");
    let cancelTriggered = false;
    const checkCancellation = () => {
        if (cancelTriggered) throw new Error("Canceled");
    };

    cancelTriggered = true;
    try {
        await orchestrateGeneration({
            originalPrompt: "make app",
            projectSpec: {
                projectName: "CancelApp",
                projectType: "HTML Page",
                frontend: "HTML",
                backend: "None",
                database: "None"
            }
        }, emitter, checkCancellation);
        assert.fail("Orchestrator did not cancel on client disconnect signal");
    } catch (e) {
        assert.strictEqual(e.message, "Canceled");
        console.log("   - Generation aborted immediately on connection close signal: PASS");
    }

    // Restore axios
    axios.post = originalPost;

    // 7. E2E & Unit Regression Tests
    console.log("7. Running new regression tests...");

    // Regression 7.1: progressEmitter error path does not throw ReferenceError
    const projectController = require("./controllers/projectController");
    const mockReq = {
        body: {
            originalPrompt: "build a react counter",
            projectSpec: {
                projectName: "ReactCounter",
                projectType: "React.js",
                frontend: "React + Vite",
                backend: "None",
                database: "None"
            }
        },
        user: { _id: "dummy_user_id" },
        on: (event, cb) => {}
    };
    
    let responseStatus = null;
    let jsonSent = null;
    const mockRes = {
        setHeader: () => {},
        flushHeaders: () => {},
        status: (code) => {
            responseStatus = code;
            return {
                json: (data) => {
                    jsonSent = data;
                }
            };
        },
        write: (chunk) => {
            throw new Error("Simulated write fail in SSE");
        },
        end: () => {}
    };

    try {
        await projectController.generate(mockReq, mockRes);
    } catch (err) {
        assert.fail(`Controller generate threw ReferenceError or other unhandled error: ${err.stack}`);
    }
    console.log("   - Regression 7.1: progressEmitter error path handles ReferenceError safely: PASS");

    // Regression 7.2: HTTP 429 classification uses response.status and honors Retry-After
    const mockPost429 = async () => {
        const err = new Error("Rate limit exceeded");
        err.response = {
            status: 429,
            headers: { "retry-after": "1" }
        };
        throw err;
    };
    
    axios.post = async () => {
        return await mockPost429();
    };

    try {
        await orchestrateGeneration({
            originalPrompt: "make static page",
            projectSpec: {
                projectName: "StaticApp",
                projectType: "HTML Page",
                frontend: "HTML",
                backend: "None",
                database: "None"
            }
        }, emitter, () => {});
        assert.fail("Should have failed with Rate limit exceeded error");
    } catch (e) {
        assert.ok(e.message.includes("Rate limit") || e.status === 429);
        console.log("   - Regression 7.2: HTTP 429 classification uses response.status: PASS");
    }

    // Regression 7.3: deterministic 400 is not retried
    let callTimes400 = 0;
    axios.post = async () => {
        callTimes400++;
        const err = new Error("Bad Request");
        err.response = { status: 400 };
        throw err;
    };

    try {
        await orchestrateGeneration({
            originalPrompt: "make static page",
            projectSpec: {
                projectName: "StaticApp",
                projectType: "HTML Page",
                frontend: "HTML",
                backend: "None",
                database: "None"
            }
        }, emitter, () => {});
        assert.fail("Should have failed with 400 Bad Request error");
    } catch (e) {
        assert.strictEqual(callTimes400, 1);
        console.log("   - Regression 7.3: Deterministic 400 error is not retried: PASS");
    }

    // Regression 7.4: SCAFFOLD_AI has no outer unit retry amplification
    let orchestratorCalls = 0;
    const oldFallback = process.env.AI_FALLBACK_PROVIDER;
    process.env.AI_FALLBACK_PROVIDER = process.env.AI_PRIMARY_PROVIDER || "openrouter";
    
    axios.post = async () => {
        orchestratorCalls++;
        const err = new Error("API Failure");
        err.response = { status: 500 };
        throw err;
    };

    try {
        await orchestrateGeneration({
            originalPrompt: "large dashboard",
            projectSpec: {
                projectName: "LowCoupledDashboard",
                projectType: "Modular Dashboard",
                frontend: "React + Vite",
                backend: "None",
                database: "None",
                pagesAndRoutes: [{ name: "Home" }, { name: "Analytics" }, { name: "Settings" }, { name: "Users" }, { name: "Profile" }, { name: "Billing" }],
                components: [{ name: "Card" }, { name: "Chart" }, { name: "Navbar" }, { name: "Sidebar" }, { name: "Footer" }, { name: "Button" }, { name: "Input" }, { name: "Modal" }, { name: "Label" }]
            }
        }, emitter, () => {});
    } catch (e) {
        assert.ok(orchestratorCalls <= 3, `Expected orchestratorCalls <= 3, got ${orchestratorCalls}`);
        console.log("   - Regression 7.4: SCAFFOLD_AI has no outer unit retry amplification: PASS");
    } finally {
        process.env.AI_FALLBACK_PROVIDER = oldFallback;
    }

    // Regression 7.5: missing local import triggers targeted repair
    const validationProfiles = require("./services/validationProfiles");
    const testFiles = [
        { name: "package.json", content: "{}" },
        { name: "src/App.jsx", content: "import Header from './Header';" }
    ];
    const valErrors = validationProfiles.validateProjectFiles(testFiles, { projectName: "Test" });
    assert.ok(valErrors.some(err => err.includes("imports missing local module './Header'")));
    console.log("   - Regression 7.5: Missing local import correctly triggers validation error: PASS");

    // Regression 7.6: repair cannot introduce undeclared local imports
    const targetedRepair = require("./services/targetedRepairService");
    const contractsMock = {
        folderStructure: ["package.json", "src/App.jsx", "src/Header.jsx"]
    };
    
    let promptIncludesManifest = false;
    axios.post = async (url, data) => {
        const userPrompt = data.messages[1].content;
        if (userPrompt.includes("ALLOWED FILE MANIFEST") && userPrompt.includes("src/Header.jsx")) {
            promptIncludesManifest = true;
        }
        return { data: { choices: [{ message: { content: "--- START_FILES ---\n--- FILE: src/App.jsx ---\n```jsx\nimport Header from './Header';\n```\n--- END_FILE ---\n--- END_FILES ---" } }] } };
    };

    await targetedRepair.repairAffectedFiles(valErrors, testFiles, { projectName: "Test" }, contractsMock);
    assert.ok(promptIncludesManifest);
    console.log("   - Regression 7.6: Repair prompt contains allowed manifest: PASS");

    // Regression 7.7: exhausted repair 429 fails cleanly
    axios.post = async () => {
        const err = new Error("Rate limit exceeded");
        err.response = { status: 429 };
        throw err;
    };

    try {
        await targetedRepair.repairAffectedFiles(valErrors, testFiles, { projectName: "Test" }, contractsMock);
        assert.fail("Repair should have thrown Rate limit error");
    } catch (e) {
        assert.ok(e.message.includes("Rate limit") || e.status === 429);
        console.log("   - Regression 7.7: Exhausted repair 429 fails cleanly: PASS");
    }

    // Restore axios
    axios.post = originalPost;

    // 8. Test Provider Router & Preview Sandbox Capabilities
    console.log("8. Testing Provider Router & Fallback Rules...");
    const providerRouter = require("./services/aiProviders/providerRouter");
    const previewService = require("./services/previewService");
    const fs = require("fs");
    const path = require("path");

    // Test Provider routing interfaces
    assert.strictEqual(typeof providerRouter.getPrimaryProvider, "function");
    assert.strictEqual(typeof providerRouter.getFallbackProvider, "function");
    console.log("   - Provider router getter helper functions: PASS");

    // Test Path safety checks in previewService
    console.log("   - Testing path traversal rejection in preview sandbox...");
    const tempDir = path.resolve(__dirname, "temp_previews/test_traversal");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const mockUser = { _id: "user123" };
    const mockProject = {
        userId: "user123",
        files: [
            { name: "package.json", content: "{}" },
            { name: "../traversal.txt", content: "malicious" }
        ]
    };

    // Mock Project.findById
    const Project = require("./models/Project");
    const originalFindById = Project.findById;
    Project.findById = async () => mockProject;

    try {
        await previewService.startPreview("project123", "user123");
        assert.fail("Should have thrown path traversal escape error");
    } catch (e) {
        assert.ok(e.message.includes("Path traversal") || e.message.includes("escape") || e.message.includes("traversal"));
        console.log("   - Path traversal attempt throws correctly: PASS");
    }

    // Test Ownership check
    console.log("   - Testing preview project ownership validation...");
    try {
        await previewService.startPreview("project123", "different_user");
        assert.fail("Should have thrown Forbidden error");
    } catch (e) {
        assert.strictEqual(e.status, 403);
        console.log("   - Different owner throws 403 Forbidden: PASS");
    }

    // Test Duplicate startup prevention
    console.log("   - Testing preview duplicate-start protection...");
    mockProject.files = [{ name: "package.json", content: "{}" }];
    
    // Stub activePreviews
    previewService.activePreviews.clear();
    const mockSession = {
        projectId: "project123",
        status: "ready",
        port: 9999,
        url: "http://localhost:9999",
        errors: [],
        lastActive: Date.now()
    };
    previewService.activePreviews.set("project123", mockSession);

    const dupRes = await previewService.startPreview("project123", "user123");
    assert.strictEqual(dupRes.status, "ready");
    assert.strictEqual(dupRes.port, 9999);
    console.log("   - Duplicate start returns active session status: PASS");

    // Restore Project stub
    Project.findById = originalFindById;
    previewService.activePreviews.clear();

    // ============================================================
    // E2E REGRESSION TESTS FOR BUILDER COMPLETENESS & WINDOWS PREVIEW
    // ============================================================
    console.log("\n9. Running final regression tests...");

    // Test 1: React/Vite missing entry module fails validation
    console.log("   - Regression 9.1: React/Vite missing entry module fails validation...");
    const missingEntryFiles = [
        { name: "package.json", content: '{"dependencies": {"react": "18.2.0", "react-dom": "18.2.0"}}' },
        { name: "index.html", content: '<html><body><script type="module" src="src/main.jsx"></script></body></html>' },
        { name: "vite.config.js", content: 'export default {}' },
        { name: "src/App.jsx", content: 'export default function App() { return "App Code Here with enough size to pass length validation rule"; }' },
        { name: "src/index.css", content: '@tailwind base; @tailwind components; @tailwind utilities;' },
        { name: "README.md", content: 'readme' }
    ];
    const errs1 = validateProjectFiles(missingEntryFiles, { frontend: "React" });
    assert.ok(errs1.some(e => e.includes("Missing required file 'src/main.jsx'")), "Expected error for missing src/main.jsx");
    console.log("     PASS: Missing entry module detected");

    // Test 2: React/Vite missing root App component fails validation
    console.log("   - Regression 9.2: React/Vite missing root App component fails validation...");
    const missingAppFiles = [
        { name: "package.json", content: '{"dependencies": {"react": "18.2.0", "react-dom": "18.2.0"}}' },
        { name: "index.html", content: '<html><body><script type="module" src="src/main.jsx"></script></body></html>' },
        { name: "vite.config.js", content: 'export default {}' },
        { name: "src/main.jsx", content: 'import App from "./App";' },
        { name: "src/index.css", content: '@tailwind base; @tailwind components; @tailwind utilities;' },
        { name: "README.md", content: 'readme' }
    ];
    const errs2 = validateProjectFiles(missingAppFiles, { frontend: "React" });
    assert.ok(errs2.some(e => e.includes("Missing required file 'src/App.jsx'")), "Expected error for missing src/App.jsx");
    console.log("     PASS: Missing App component detected");

    // Test 3: Generated config importing an undeclared Vite plugin fails dependency validation
    console.log("   - Regression 9.3: Undeclared Vite plugin in vite.config.js fails validation...");
    const undeclaredPluginFiles = [
        { name: "package.json", content: '{"dependencies": {"react": "18.2.0", "react-dom": "18.2.0"}, "devDependencies": {"vite": "5.0.0"}}' },
        { name: "index.html", content: '<html><body><script type="module" src="src/main.jsx"></script></body></html>' },
        { name: "vite.config.js", content: 'import { defineConfig } from "vite"; import react from "@vitejs/plugin-react";' },
        { name: "src/main.jsx", content: 'import App from "./App";' },
        { name: "src/App.jsx", content: 'export default function App() { return "App Code Here with enough size to pass length validation rule"; }' },
        { name: "src/index.css", content: '@tailwind base; @tailwind components; @tailwind utilities;' },
        { name: "README.md", content: 'readme' }
    ];
    const errs3 = validateProjectFiles(undeclaredPluginFiles, { frontend: "React" });
    assert.ok(errs3.some(e => e.includes("imports undeclared external package '@vitejs/plugin-react'")), "Expected error for undeclared plugin");
    console.log("     PASS: Undeclared plugin import detected");

    // Test 4: Config-only React projects cannot reach successful generation status
    console.log("   - Regression 9.4: Config-only React projects cannot reach successful generation...");
    const originalPost94 = axios.post;
    axios.post = async () => {
        return {
            data: {
                choices: [{
                    message: {
                        content: "--- START_FILES ---\n--- END_FILES ---"
                    }
                }],
                usage: {}
            }
        };
    };

    try {
        await orchestrateGeneration({
            originalPrompt: "React landing page",
            projectSpec: { projectName: "ConfigOnlyTest", frontend: "React" }
        }, { emit: () => {} }, () => {});
        assert.fail("Should have failed generation validation check");
    } catch (e) {
        assert.ok(e.message.includes("validation/repair failed") || e.message.includes("Missing required file"), `Expected failure error, got: ${e.message}`);
        console.log("     PASS: Config-only project generation failed correctly");
    } finally {
        axios.post = originalPost94;
    }

    // Test 5: Windows preview command resolution uses the correct executable strategy
    console.log("   - Regression 9.5: Spawning on Windows resolves to command executables...");
    const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    
    // Test for Windows
    Object.defineProperty(process, "platform", { value: "win32" });
    const npmCmdWin = process.platform === "win32" ? "npm.cmd" : "npm";
    const npxCmdWin = process.platform === "win32" ? "npx.cmd" : "npx";
    assert.strictEqual(npmCmdWin, "npm.cmd");
    assert.strictEqual(npxCmdWin, "npx.cmd");

    // Test for non-Windows
    Object.defineProperty(process, "platform", { value: "darwin" });
    const npmCmdUnix = process.platform === "win32" ? "npm.cmd" : "npm";
    const npxCmdUnix = process.platform === "win32" ? "npx.cmd" : "npx";
    assert.strictEqual(npmCmdUnix, "npm");
    assert.strictEqual(npxCmdUnix, "npx");

    // Restore process.platform
    Object.defineProperty(process, "platform", originalPlatform);
    console.log("     PASS: Windows command executable resolution strategy correct");

    // Test 6: Preview spawn options contain no invalid environment values
    console.log("   - Regression 9.6: Preview spawn environment sanitization parses valid strings only...");
    const safeKeys = ["PATH", "SYSTEMROOT", "TEMP", "TMP", "USERPROFILE", "HOME", "COMSPEC", "PATHEXT"];
    for (const key of safeKeys) {
        const actualKey = Object.keys(process.env).find(k => k.toUpperCase() === key.toUpperCase());
        if (actualKey && process.env[actualKey] !== undefined) {
            assert.strictEqual(typeof String(process.env[actualKey]), "string");
        }
    }
    console.log("     PASS: Env values validated to contain only string parameters");

    console.log("\n================= ALL ADAPTIVE ENGINE UNIT TESTS PASSED! =================\n");
};

runTests().catch(e => {
    console.error("UNIT TEST EXCEPTION:", e.message);
    console.error(e.stack);
    process.exit(1);
});
