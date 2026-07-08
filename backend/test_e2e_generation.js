const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const axios = require("axios");
require("dotenv").config();

const { orchestrateGeneration } = require("./services/generationOrchestrator");
const projectService = require("./services/projectService");
const previewService = require("./services/previewService");

const runE2E = async () => {
    console.log("================= STARTING MASTER E2E GENERATION & BUILD VERIFICATION =================");
    
    // 1. Requirement Analysis
    console.log("1. Running Requirement Analysis for Gym Landing Page...");
    const prompt = "Scaffold a simple React landing page for a gym website.";
    
    let spec;
    try {
        spec = await projectService.analyzeRequirements({ prompt });
        console.log("   Analysis completed successfully!");
        console.log("   Project Name:", spec.projectName);
        console.log("   Frontend:", spec.frontend);
        console.log("   Backend:", spec.backend);
    } catch (err) {
        console.error("   Analysis failed:", err.message);
        process.exit(1);
    }

    // 2. Project Generation
    console.log("\n2. Executing Project Generation via orchestrateGeneration...");
    const progressEmitter = {
        emit: (stage, message) => {
            console.log(`      [Progress] ${stage}: ${message}`);
        }
    };

    let result;
    try {
        result = await orchestrateGeneration({
            originalPrompt: prompt,
            projectSpec: spec
        }, progressEmitter, () => {});
        console.log("   Project generated successfully!");
        console.log("   Generated Files count:", result.files.length);
        console.log("   Files list:", result.files.map(f => f.name).join(", "));
    } catch (err) {
        console.error("   Generation failed:", err.message);
        process.exit(1);
    }

    // Verify all essential files are present
    const expectedFiles = ["package.json", "index.html", "vite.config.js", "src/main.jsx", "src/App.jsx", "src/index.css"];
    const missing = expectedFiles.filter(ef => !result.files.some(f => f.name === ef));
    if (missing.length > 0) {
        console.error("   CRITICAL ERROR: Generated files are missing required entries:", missing);
        process.exit(1);
    }
    console.log("   Completeness validation passed! All entry and source files are present.");

    // 3. Local build validation
    console.log("\n3. Testing Local Installation & Build on generated project...");
    const tempDir = path.resolve(__dirname, "temp_e2e_build");
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    result.files.forEach(f => {
        const filePath = path.join(tempDir, f.name);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, f.content, "utf8");
    });
    console.log("   Generated files written to temporary directory:", tempDir);

    console.log("   Running npm install...");
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    const installProc = spawn(npmCmd, ["install", "--no-audit", "--no-fund"], {
        cwd: tempDir,
        shell: process.platform === "win32"
    });

    const installSuccess = await new Promise((resolve) => {
        installProc.on("close", (code) => {
            resolve(code === 0);
        });
    });

    if (!installSuccess) {
        console.error("   CRITICAL ERROR: npm install failed inside generated codebase!");
        process.exit(1);
    }
    console.log("   npm install succeeded.");

    console.log("   Running npm run build to verify bundle compilation...");
    const buildProc = spawn(npmCmd, ["run", "build"], {
        cwd: tempDir,
        shell: process.platform === "win32"
    });

    let buildLog = [];
    buildProc.stdout.on("data", (data) => buildLog.push(data.toString()));
    buildProc.stderr.on("data", (data) => buildLog.push(data.toString()));

    const buildSuccess = await new Promise((resolve) => {
        buildProc.on("close", (code) => {
            resolve(code === 0);
        });
    });

    if (!buildSuccess) {
        console.error("   CRITICAL ERROR: npm run build failed inside generated codebase!");
        console.error("   Build Logs:\n", buildLog.join(""));
        process.exit(1);
    }
    console.log("   npm run build succeeded. Production bundle compiled correctly.");

    // 4. Live Preview startup check
    console.log("\n4. Testing Live Preview Sandbox Server startup...");
    // Create preview session manually via previewService structures to verify spawn options and port health
    const Project = require("./models/Project");
    const testProjectId = new mongoose.Types.ObjectId().toString();
    const testUserId = new mongoose.Types.ObjectId().toString();

    // Stub Project.findById
    const originalFindById = Project.findById;
    Project.findById = async () => ({
        _id: testProjectId,
        userId: testUserId,
        files: result.files
    });

    let previewSession;
    try {
        console.log("   Starting preview session via startPreview...");
        previewSession = await previewService.startPreview(testProjectId, testUserId);
        console.log("   Preview session created:", previewSession);
        console.log("   Status:", previewSession.status);
        console.log("   Port:", previewSession.port);

        console.log("   Waiting for preview session to become ready (max 180s)...");
        let attempts = 0;
        let isReady = false;
        while (attempts < 180) {
            const currentSession = previewService.activePreviews.get(testProjectId);
            if (!currentSession) {
                throw new Error("Preview session disappeared!");
            }
            if (attempts % 10 === 0) {
                console.log(`      [E2E Preview Wait] elapsed=${attempts}s status=${currentSession.status}`);
            }
            if (currentSession.status === "ready") {
                isReady = true;
                break;
            }
            if (currentSession.status === "failed") {
                throw new Error(`Preview setup failed in background: ${currentSession.errors.join("; ")}`);
            }
            attempts++;
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!isReady) {
            const currentSession = previewService.activePreviews.get(testProjectId);
            throw new Error(`Timeout waiting for preview. Last status: ${currentSession ? currentSession.status : "unknown"}, Errors: ${currentSession ? currentSession.errors.join("; ") : "none"}`);
        }

        const currentSession = previewService.activePreviews.get(testProjectId);
        const url = `http://localhost:${currentSession.port}`;
        console.log("   URL:", url);
        
        console.log("   Vite server is running and healthy! Checking response headers...");
        const res = await axios.get(url);
        console.log("   HTML output status:", res.status);
        console.log("   HTML output length:", res.data.length);
        
        // Assert HTML structure
        if (!res.data.includes("<div id=\"root\">") || !res.data.includes("src/main.jsx")) {
            throw new Error("HTML response is missing root mounting div or entry module path!");
        }
        console.log("   Sandbox page serves correct index.html E2E!");
    } catch (err) {
        console.error("   Live Preview failed:", err.message);
        if (previewSession && previewSession.errors) {
            console.error("   Session Errors:", previewSession.errors);
        }
        process.exit(1);
    } finally {
        // Clean up preview session
        console.log("\n5. Cleaning up preview session and temporary files...");
        if (previewService.activePreviews.has(testProjectId)) {
            try {
                await previewService.stopPreview(testProjectId, testUserId);
            } catch (err) {
                console.error("   Failed to stop preview:", err.message);
            }
        }

        // Cleanup Project stub
        Project.findById = originalFindById;
        
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        console.log("   Cleanup completed successfully.");
    }

    console.log("\n================= ALL MASTER E2E CHECKS PASSED! =================\n");
    process.exit(0);
};

// Connect to DB and run E2E
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        runE2E();
    })
    .catch(err => {
        console.error("DB Connection failed:", err.message);
        process.exit(1);
    });
