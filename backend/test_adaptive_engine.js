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
        // Initial call + 2 retries = 3 total post calls
        assert.strictEqual(postCalls, 3);
        console.log("   - Bounded retries limit strictly respected: PASS");
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

    console.log("\n================= ALL ADAPTIVE ENGINE UNIT TESTS PASSED! =================\n");
};

runTests().catch(e => {
    console.error("UNIT TEST EXCEPTION:", e.message);
    console.error(e.stack);
    process.exit(1);
});
