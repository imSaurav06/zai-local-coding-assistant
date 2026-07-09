const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const AdmZip = require("adm-zip");

const API_URL = "http://localhost:5000/api";
const email = "fitzone_tester_production@example.com";
const password = "password123";
let token = "";

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runE2E() {
    console.log("=== STARTING PRODUCTION E2E VALIDATION FOR FITZONE ===");

    // Step 1: Authenticate or Register
    console.log("\n[1/8] Authenticating User...");
    try {
        const loginRes = await axios.post(`${API_URL}/auth/login`, { email, password });
        token = loginRes.data.token;
        console.log("-> Login successful. Token retrieved.");
    } catch (err) {
        console.log("-> Login failed or user not found. Attempting registration...");
        try {
            const regRes = await axios.post(`${API_URL}/auth/register`, {
                name: "FitZone Tester",
                email,
                password
            });
            token = regRes.data.token;
            console.log("-> Registration successful. Token retrieved.");
        } catch (regErr) {
            console.error("-> Authentication completely failed:", regErr.response ? regErr.response.data : regErr.message);
            process.exit(1);
        }
    }

    const authHeaders = {
        headers: { Authorization: `Bearer ${token}` }
    };

    // Step 2: Analyze Prompt
    console.log("\n[2/8] Running Requirement Analysis & Project Specification...");
    const prompt = `Build a simple modern React/Vite landing page for a gym called FitZone.

Include:
- Navbar
- Hero section
- Features section with 3 feature cards
- Call-to-action section
- Footer

Use responsive design and clean CSS.
No backend.
No database.
No authentication.
Keep the project lightweight.`;

    let spec;
    try {
        const analyzeRes = await axios.post(`${API_URL}/project/analyze`, { prompt }, authHeaders);
        spec = analyzeRes.data.projectSpec;
        console.log("-> Project Specification constructed successfully:");
        console.log(JSON.stringify(spec, null, 2));
    } catch (err) {
        console.error("-> Analysis failed:", err.response ? err.response.data : err.message);
        process.exit(1);
    }

    // Step 3: Run Generation (SSE)
    console.log("\n[3/8] Running Project Generation (SSE)...");
    let projectId = "";
    try {
        const genRes = await axios({
            method: "post",
            url: `${API_URL}/project/generate`,
            data: { originalPrompt: prompt, projectSpec: spec },
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            responseType: "stream"
        });

        const stream = genRes.data;
        await new Promise((resolve, reject) => {
            let buffer = "";
            stream.on("data", chunk => {
                buffer += chunk.toString();
                const lines = buffer.split("\n");
                buffer = lines.pop();

                for (const line of lines) {
                    const cleanLine = line.trim();
                    if (cleanLine.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(cleanLine.substring(6));
                            if (data.stage === "Error") {
                                return reject(new Error(data.error || "Generation error"));
                            }
                            console.log(`   [GEN PROGRESS] Stage: ${data.stage} | ${data.message || ""}`);
                            if (data.stage === "Ready") {
                                projectId = data.result.projectId;
                            }
                        } catch (e) {
                            // Ignored formatting
                        }
                    }
                }
            });
            stream.on("end", () => {
                if (projectId) resolve();
                else reject(new Error("Stream ended without Ready event"));
            });
            stream.on("error", err => reject(err));
        });

        console.log(`-> Generation succeeded. Project ID: ${projectId}`);
    } catch (err) {
        console.error("-> Generation failed:", err.message);
        process.exit(1);
    }

    // Step 4: Preview State Machine Transitions
    console.log("\n[4/8] Starting Preview Process...");
    try {
        const startRes = await axios.post(`${API_URL}/project/${projectId}/preview`, {}, authHeaders);
        console.log("-> Preview start response:", startRes.data);
    } catch (err) {
        console.error("-> Failed to start preview:", err.response ? err.response.data : err.message);
        process.exit(1);
    }

    console.log("\n[5/8] Monitoring Preview State Machine Transitions...");
    let status = "";
    const observedStates = [];
    let readyPort = null;

    for (let attempt = 1; attempt <= 120; attempt++) {
        await sleep(2000);
        try {
            const statusRes = await axios.get(`${API_URL}/project/${projectId}/preview/status`, authHeaders);
            const currentStatus = statusRes.data.status;
            if (currentStatus !== status) {
                status = currentStatus;
                observedStates.push(status);
                console.log(`   [PREVIEW STATE] -> ${status}`);
            }
            if (status === "READY") {
                readyPort = statusRes.data.port;
                break;
            }
            if (status === "FAILED") {
                console.error("-> Preview compilation/start failed. Errors:", statusRes.data.errors);
                process.exit(1);
            }
        } catch (err) {
            console.error("-> Failed to get status:", err.message);
        }
    }

    console.log(`-> Observed State Sequence: ${observedStates.join(" -> ")}`);
    if (status !== "READY") {
        console.error("-> Preview failed to reach READY status within timeout.");
        process.exit(1);
    }
    console.log(`-> Preview is healthy and running on port: ${readyPort}`);

    // Step 5: Application Health Check Verification
    console.log("\n[6/8] Performing Application-Level Health Check on Preview...");
    try {
        const healthRes = await axios.get(`http://127.0.0.1:${readyPort}`);
        console.log(`-> Health Check returned status: ${healthRes.status} (OK)`);
    } catch (err) {
        console.error("-> Health check request failed:", err.message);
        process.exit(1);
    }

    // Clean up active preview process so we don't leave it running
    console.log("-> Cleaning up preview process...");
    try {
        await axios.delete(`${API_URL}/project/${projectId}/preview`, authHeaders);
        console.log("-> Preview stopped successfully.");
    } catch (e) {
        console.warn("-> Warning during preview stop:", e.message);
    }

    // Step 6: Download ZIP
    console.log("\n[7/8] Downloading Generated Project ZIP...");
    const zipPath = path.resolve(__dirname, "fitzone.zip");
    try {
        const downloadRes = await axios({
            method: "get",
            url: `${API_URL}/project/${projectId}/download`,
            headers: { Authorization: `Bearer ${token}` },
            responseType: "arraybuffer"
        });
        fs.writeFileSync(zipPath, downloadRes.data);
        console.log(`-> ZIP downloaded and saved to: ${zipPath}`);
    } catch (err) {
        console.error("-> ZIP download failed:", err.response ? err.response.data : err.message);
        process.exit(1);
    }

    // Step 7: Extract ZIP, npm install, and npm run build
    console.log("\n[8/8] Extracting ZIP and Compiling Locally...");
    const extractDir = path.resolve(__dirname, "fitzone_extracted");
    if (fs.existsSync(extractDir)) {
        fs.rmSync(extractDir, { recursive: true, force: true });
    }
    fs.mkdirSync(extractDir);

    try {
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(extractDir, true);
        console.log(`-> Extracted ZIP files to: ${extractDir}`);

        console.log("-> Running 'npm install' inside extracted directory...");
        execSync("npm install --no-audit --no-fund", { cwd: extractDir, stdio: "inherit" });

        console.log("-> Running 'npm run build' inside extracted directory...");
        execSync("npm run build", { cwd: extractDir, stdio: "inherit" });

        console.log("\n=== ALL PRODUCTION E2E VALIDATION STEPS PASSED SUCCESSFULLY! ===");
    } catch (err) {
        console.error("-> Compilation / build verification failed:", err.message);
        process.exit(1);
    }
}

runE2E();
