const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");
const AdmZip = require("adm-zip");
const net = require("net");

const API_URL = "http://localhost:5000/api";
const email = `master_tester_${Date.now()}@example.com`;
const password = "password123";
let token = "";

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function discoverContract(zipBuffer, stackKey) {
    if (!zipBuffer) {
        return { routePath: stackKey === "express" ? "/api/books" : "/api/tasks", payload: {}, requiresAuth: false };
    }
    try {
        const zip = new AdmZip(zipBuffer);
        const entries = zip.getEntries();
        
        let modelFields = {};
        let modelName = "";
        let routePath = "";
        let requiresAuth = false;

        // 1. Find model files
        const modelEntry = entries.find(e => 
            (e.entryName.includes("models/") || e.entryName.includes("backend/models/")) && 
            e.entryName.endsWith(".js")
        );

        if (modelEntry) {
            const name = path.basename(modelEntry.entryName, ".js");
            modelName = name; // e.g. "Book" or "Task"
            const content = modelEntry.getData().toString("utf8");
            console.log(`\n[Contract Discovery] Found model schema definition: ${modelEntry.entryName}`);
            console.log(`[Contract Discovery] Generated Mongoose schema required fields detection:`);

            // Parse fields
            const lines = content.split("\n");
            let currentField = null;
            let braceCount = 0;
            
            for (let line of lines) {
                line = line.trim();
                if (!line) continue;
                
                const simpleMatch = line.match(/^(\w+)\s*:\s*(String|Number|Boolean|Date|Array|ObjectId)\s*,?$/i);
                if (simpleMatch) {
                    const fName = simpleMatch[1];
                    const fType = simpleMatch[2];
                    modelFields[fName] = { type: fType, required: false };
                    continue;
                }
                
                const fieldStartMatch = line.match(/^(\w+)\s*:\s*\{\s*$/);
                if (fieldStartMatch) {
                    currentField = fieldStartMatch[1];
                    modelFields[currentField] = { type: "String", required: false };
                    braceCount = 1;
                    continue;
                }
                
                if (currentField) {
                    if (line.includes("{")) braceCount++;
                    if (line.includes("}")) braceCount--;
                    
                    const typeMatch = line.match(/type\s*:\s*(String|Number|Boolean|Date|Array|ObjectId|mongoose\.Schema\.Types\.ObjectId)\s*,?/i);
                    if (typeMatch) {
                        modelFields[currentField].type = typeMatch[1];
                    }
                    if (line.includes("required") && line.includes("true")) {
                        modelFields[currentField].required = true;
                        console.log(`   - Field '${currentField}' is REQUIRED`);
                    }
                    const minMatch = line.match(/min\s*:\s*(\d+)/);
                    if (minMatch) {
                        modelFields[currentField].min = parseInt(minMatch[1], 10);
                    }
                    const maxMatch = line.match(/max\s*:\s*(\d+)/);
                    if (maxMatch) {
                        modelFields[currentField].max = parseInt(maxMatch[1], 10);
                    }
                    
                    if (braceCount === 0) {
                        currentField = null;
                    }
                }
            }
        }

        // 2. Discover route paths and validator validations
        const jsEntries = entries.filter(e => e.entryName.endsWith(".js") && !e.entryName.includes("node_modules/"));
        let potentialPaths = [];
        const pluralName = modelName ? (modelName.toLowerCase() + "s") : "";
        const singularName = modelName ? modelName.toLowerCase() : "";

        console.log(`[Contract Discovery] Generated route definitions and controller validation scanning:`);
        for (const entry of jsEntries) {
            const content = entry.getData().toString("utf8");
            
            const useRouteRegex = /app\.use\(\s*['"]([^'"]+)['"]/g;
            let match;
            while ((match = useRouteRegex.exec(content)) !== null) {
                potentialPaths.push(match[1]);
            }

            const directRouteRegex = /app\.(post|get|put|delete)\(\s*['"]([^'"]+)['"]/g;
            while ((match = directRouteRegex.exec(content)) !== null) {
                potentialPaths.push(match[2]);
            }

            const routerRouteRegex = /router\.(post|get|put|delete)\(\s*['"]([^'"]+)['"]/g;
            while ((match = routerRouteRegex.exec(content)) !== null) {
                potentialPaths.push(match[2]);
            }
            
            if (/protect|auth|jwt|requireAuth/i.test(content)) {
                requiresAuth = true;
            }

            // Express-validator body('fieldName') extraction
            const bodyRegex = /body\(\s*['"]([^'"]+)['"]\)/g;
            while ((match = bodyRegex.exec(content)) !== null) {
                const fName = match[1];
                if (!modelFields[fName]) {
                    modelFields[fName] = { type: "String", required: false };
                }
                let restOfChain = content.slice(match.index, match.index + 200);
                const nextBodyIdx = restOfChain.indexOf("body(", 5);
                if (nextBodyIdx !== -1) {
                    restOfChain = restOfChain.slice(0, nextBodyIdx);
                }
                if (restOfChain.includes("notEmpty") || restOfChain.includes("required")) {
                    modelFields[fName].required = true;
                }
                if (restOfChain.includes("isDate") || restOfChain.includes("isISO8601") || restOfChain.toLowerCase().includes("date")) {
                    modelFields[fName].type = "Date";
                }
                if (restOfChain.includes("isInt") || restOfChain.includes("isDecimal") || restOfChain.includes("isNumeric")) {
                    modelFields[fName].type = "Number";
                }
                if (restOfChain.includes("isBoolean")) {
                    modelFields[fName].type = "Boolean";
                }
                if (restOfChain.includes("isEmail")) {
                    modelFields[fName].type = "Email";
                }
                if (restOfChain.includes("isISBN")) {
                    modelFields[fName].type = "ISBN";
                }
            }
        }

        if (pluralName) {
            routePath = potentialPaths.find(p => p.includes(pluralName)) || "";
        }
        if (!routePath && singularName) {
            routePath = potentialPaths.find(p => p.includes(singularName)) || "";
        }
        if (!routePath) {
            routePath = potentialPaths.find(p => p.startsWith("/api/") && p !== "/api/health") || "";
        }
        if (!routePath) {
            routePath = stackKey === "express" ? "/api/books" : "/api/tasks";
        }

        if (!routePath.startsWith("/")) {
            routePath = "/" + routePath;
        }
        routePath = routePath.split("/:")[0];
        console.log(`   - Discovered Route Path: ${routePath}`);
        console.log(`   - Requires Auth: ${requiresAuth}`);

        // 3. Construct dynamic mock payload
        const payload = {};
        for (const [fName, meta] of Object.entries(modelFields)) {
            if (fName === "id" || fName === "_id" || fName === "__v" || fName === "createdAt" || fName === "updatedAt") {
                continue;
            }
            
            const typeLower = meta.type.toLowerCase();
            if (fName.toLowerCase() === "isbn" || typeLower === "isbn") {
                payload[fName] = "9783161484100"; // Valid 13-digit ISBN
            } else if (fName.toLowerCase().includes("email") || typeLower === "email") {
                payload[fName] = "test@example.com";
            } else if (fName.toLowerCase().includes("url") || fName.toLowerCase().includes("link")) {
                payload[fName] = "https://example.com";
            } else if (typeLower.includes("string")) {
                payload[fName] = `Mock ${fName}`;
            } else if (typeLower.includes("number")) {
                payload[fName] = meta.min !== undefined ? meta.min + 1 : 2024;
            } else if (typeLower.includes("boolean")) {
                payload[fName] = true;
            } else if (typeLower.includes("date")) {
                payload[fName] = new Date().toISOString();
            } else if (typeLower.includes("array")) {
                payload[fName] = [];
            } else {
                payload[fName] = `Mock ${fName}`;
            }
        }

        if (Object.keys(payload).length === 0) {
            if (stackKey === "express") {
                payload.title = "Default Book";
                payload.author = "Default Author";
                payload.publicationYear = 2024;
                payload.isbn = "9783161484100";
            } else {
                payload.title = "Default Task";
                payload.description = "Default Description";
                payload.completed = false;
            }
        }

        console.log(`   - Constructed Request Payload:`, payload);
        return {
            routePath,
            payload,
            requiresAuth
        };
    } catch (e) {
        console.error("[Contract Discovery] Failed parsing contract:", e.message);
        return {
            routePath: stackKey === "express" ? "/api/books" : "/api/tasks",
            payload: stackKey === "express" 
                ? { title: "Default Book", author: "Default Author", publicationYear: 2024, isbn: "9783161484100" }
                : { title: "Default Task", description: "Default Description", completed: false },
            requiresAuth: false
        };
    }
}


// We only run Next.js, Express, and MERN to verify fixes as requested
const stacksToTest = [
    {
        key: "express",
        name: "Node/Express",
        prompt: "Create a structured Express REST API containing routes, controllers, middleware, and request validation CRUD endpoints for a 'books' resource, a health route, and server.js. No frontend."
    },
    {
        key: "nextjs",
        name: "Next.js",
        prompt: "Create a basic Next.js app with next.config.js, app/page.jsx, app/layout.jsx, app/globals.css. Keep it extremely small."
    },
    {
        key: "mern",
        name: "MERN",
        prompt: "Build a minimal full-stack MERN task app. Provide frontend/src/main.jsx, frontend/src/App.jsx, and backend/server.js. Keep files under 20 lines."
    }
];

// Helper to check if a port is in use
function isPortOpen(port) {
    return new Promise((resolve) => {
        const client = new net.Socket();
        client.setTimeout(1000);
        client.on("connect", () => {
            client.destroy();
            resolve(true);
        });
        client.on("error", () => {
            resolve(false);
        });
        client.on("timeout", () => {
            resolve(false);
        });
        client.connect(port, "127.0.0.1");
    });
}

async function runE2E() {
    console.log("=== STARTING MASTER RELEASE VERIFICATION ===");

    // Step 1: Auth
    console.log("\n[1/5] Authenticating User...");
    try {
        const regRes = await axios.post(`${API_URL}/auth/register`, {
            name: "Master Tester",
            email,
            password
        });
        token = regRes.data.token;
        console.log("-> Registration successful. Token retrieved.");
    } catch (err) {
        console.error("-> Registration failed:", err.response ? err.response.data : err.message);
        process.exit(1);
    }

    const authHeaders = {
        headers: { Authorization: `Bearer ${token}` }
    };

    // Step 2: Analyze Requirements
    console.log("\n[2/5] Running Sequential Requirement Analysis...");
    const specs = {};
    for (const stack of stacksToTest) {
        console.log(`   [ANALYSIS START] ${stack.name}...`);
        try {
            const res = await axios.post(`${API_URL}/project/analyze`, { prompt: stack.prompt }, {
                ...authHeaders,
                timeout: 300000
            });
            specs[stack.key] = res.data.projectSpec;
            console.log(`   [ANALYSIS DONE] ${stack.name}. Resolved Profile: ${res.data.projectSpec.frontend} / ${res.data.projectSpec.backend}`);
        } catch (err) {
            console.error(`   [ANALYSIS FAIL] ${stack.name}:`, err.response ? err.response.data : err.message);
            specs[stack.key] = null;
        }
        await sleep(3000); // spacing to prevent rate limits
    }

    // Step 3: Run Generation
    console.log("\n[3/5] Running Sequential Generations (SSE)...");
    const results = {};
    for (const stack of stacksToTest) {
        const spec = specs[stack.key];
        if (!spec) {
            results[stack.key] = { success: false, error: "Analysis failed" };
            continue;
        }
        console.log(`   [GEN START] ${stack.name}...`);
        const startTime = Date.now();
        try {
            const genRes = await axios({
                method: "post",
                url: `${API_URL}/project/generate`,
                data: { originalPrompt: stack.prompt, projectSpec: spec },
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                responseType: "stream",
                timeout: 300000
            });

            const stream = genRes.data;
            let projectId = "";
            let finalStage = "";
            let metrics = null;

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
                                finalStage = data.stage;
                                if (data.stage === "Error") {
                                    return reject(new Error(data.error || "Generation error"));
                                }
                                if (data.stage === "Ready") {
                                    projectId = data.result.projectId;
                                    metrics = data.result.metrics;
                                }
                            } catch (e) {
                                // Ignored format errors
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

            const duration = Date.now() - startTime;
            console.log(`   [GEN SUCCESS] ${stack.name}. ID: ${projectId}. Duration: ${(duration/1000).toFixed(1)}s`);
            results[stack.key] = { success: true, projectId, duration, metrics };

        } catch (err) {
            console.error(`   [GEN FAIL] ${stack.name}:`, err.message);
            results[stack.key] = { success: false, error: err.message };
        }
        await sleep(3000); // spacing to prevent rate limits
    }

    // Step 4: Verification (Preview, Health, Download, Build)
    console.log("\n[4/5] Running Stack Verifications sequentially...");
    const reportData = [];

    for (const stack of stacksToTest) {
        const genResult = results[stack.key];
        const spec = specs[stack.key];

        if (!genResult || !genResult.success) {
            reportData.push({
                stack: stack.name,
                requested: stack.prompt,
                resolvedProfile: "N/A",
                status: "FAIL",
                details: `Generation failed: ${genResult ? genResult.error : 'Unknown error'}`
            });
            continue;
        }

        const projectId = genResult.projectId;
        console.log(`\n--- VERIFYING ${stack.name} (ID: ${projectId}) ---`);

        // Resolve profile name
        let resolvedProfile = "unknown";
        if (spec) {
            if (stack.key.startsWith("dynamic")) resolvedProfile = "dynamic";
            else if (stack.key === "vanilla") resolvedProfile = "vanilla";
            else if (stack.key === "nextjs") resolvedProfile = "nextjs";
            else if (stack.key === "express") resolvedProfile = "express";
            else if (stack.key === "fastapi") resolvedProfile = "fastapi";
            else if (stack.key === "mern") resolvedProfile = "mern";
        }

        // Download ZIP
        console.log("   Downloading ZIP...");
        let zipBuffer = null;
        for (let retry = 1; retry <= 3; retry++) {
            try {
                const dlRes = await axios({
                    method: "get",
                    url: `${API_URL}/project/${projectId}/download`,
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: "arraybuffer",
                    timeout: 20000
                });
                zipBuffer = dlRes.data;
                console.log(`   ZIP Downloaded successfully. Size: ${zipBuffer.length} bytes`);
                break;
            } catch (e) {
                console.error(`   ZIP Download attempt ${retry} failed: ${e.message}`);
                await sleep(3000);
            }
        }

        const apiContract = discoverContract(zipBuffer, stack.key);

        // Verify ZIP exclusions
        let zipExclusionCheck = "PASS";
        let zipDetails = "";
        let zipFilesList = [];
        if (zipBuffer) {
            try {
                const zip = new AdmZip(zipBuffer);
                const entries = zip.getEntries();
                zipFilesList = entries.map(e => e.entryName);
                const hasNodeModules = entries.some(e => e.entryName.includes("node_modules/"));
                const hasEnv = entries.some(e => e.entryName.includes(".env") && !e.entryName.includes(".env.example"));

                if (hasNodeModules || hasEnv) {
                    zipExclusionCheck = "FAIL";
                    zipDetails = `Contains: ${hasNodeModules ? 'node_modules' : ''} ${hasEnv ? '.env' : ''}`;
                }
            } catch (err) {
                zipExclusionCheck = "FAIL";
                zipDetails = `ZIP parsing failed: ${err.message}`;
            }
        } else {
            zipExclusionCheck = "FAIL";
            zipDetails = "No ZIP file downloaded";
        }

        // Start Preview and Health Check
        let previewState = "SKIPPED";
        let healthCheck = "SKIPPED";
        let buildResult = "SKIPPED";
        let installResult = "SKIPPED";
        let previewPort = null;
        let previewStates = [];
        let apiEndpointEvidence = "N/A";

        console.log("   Starting Preview...");
        try {
            const startRes = await axios.post(`${API_URL}/project/${projectId}/preview`, {}, authHeaders);
            console.log("   Preview session started:", startRes.data.status);

            const timeoutMs = startRes.data.timeoutMs || 180000;
            const intervalMs = 2000;
            const maxAttempts = Math.ceil(timeoutMs / intervalMs);

            // Monitor transitions
            let status = "";
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                await sleep(intervalMs);
                const statusRes = await axios.get(`${API_URL}/project/${projectId}/preview/status`, authHeaders);
                const currentStatus = statusRes.data.status;
                if (currentStatus !== status) {
                    status = currentStatus;
                    previewStates.push(status);
                    console.log(`      [Preview State] -> ${status}`);
                }
                if (status === "READY") {
                    previewPort = statusRes.data.port;
                    break;
                }
                if (status === "FAILED") {
                    break;
                }
            }

            if (status === "READY") {
                previewState = "PASS";
                console.log(`   Preview server is listening on port ${previewPort}. Polling health check endpoint robustly...`);
                
                // Poll health check robustly (up to 15 times with 1s delays) to handle connection refusal/reset during startup
                let healthStatusPassed = false;
                for (let poll = 1; poll <= 15; poll++) {
                    try {
                        let healthRes;
                        try {
                            healthRes = await axios.get(`http://127.0.0.1:${previewPort}/health`, { timeout: 3000 });
                        } catch (e) {
                            healthRes = await axios.get(`http://127.0.0.1:${previewPort}/api/health`, { timeout: 3000 });
                        }
                        healthCheck = `PASS (HTTP ${healthRes.status})`;
                        console.log(`   Health Check returned status: ${healthRes.status} on poll ${poll}`);
                        healthStatusPassed = true;
                        break;
                    } catch (pollErr) {
                        console.log(`   Health Check poll ${poll}/15 waiting: ${pollErr.message}`);
                        await sleep(1000);
                    }
                }

                if (!healthStatusPassed) {
                    healthCheck = "FAIL";
                }

                if (healthStatusPassed) {
                    // 2. Real API endpoint CRUD check for Node/Express and MERN preview
                    if (stack.key === "express" || stack.key === "mern") {
                        console.log("   Performing real HTTP CRUD request to preview server...");
                        try {
                            const crudHeaders = {};
                            if (apiContract.requiresAuth) {
                                crudHeaders.Authorization = `Bearer ${token}`;
                            }

                            console.log(`      [CRUD Method] POST`);
                            console.log(`      [CRUD Endpoint] http://127.0.0.1:${previewPort}${apiContract.routePath}`);
                            console.log(`      [CRUD Payload]`, apiContract.payload);

                            const postRes = await axios.post(`http://127.0.0.1:${previewPort}${apiContract.routePath}`, apiContract.payload, { 
                                headers: crudHeaders,
                                timeout: 5000 
                            });

                            console.log(`      [CRUD Response Status] ${postRes.status}`);
                            console.log(`      [CRUD Response Body]`, postRes.data);

                            console.log(`      [CRUD Method] GET`);
                            console.log(`      [CRUD Endpoint] http://127.0.0.1:${previewPort}${apiContract.routePath}`);
                            const getRes = await axios.get(`http://127.0.0.1:${previewPort}${apiContract.routePath}`, { 
                                headers: crudHeaders,
                                timeout: 5000 
                            });
                            console.log(`      [CRUD Response Status] ${getRes.status}`);
                            console.log(`      [CRUD Response Body length] ${Array.isArray(getRes.data) ? getRes.data.length : typeof getRes.data}`);

                            if (getRes.status === 200 || getRes.status === 201) {
                                apiEndpointEvidence = `PASS (POST status ${postRes.status}, GET status ${getRes.status})`;
                            } else {
                                apiEndpointEvidence = `FAIL (Bad GET status ${getRes.status})`;
                            }
                        } catch (crudErr) {
                            apiEndpointEvidence = `FAIL: ${crudErr.message}`;
                            console.error("      Preview CRUD test failed:", crudErr.message);
                            if (crudErr.response) {
                                console.error(`      [CRUD Response Status] ${crudErr.response.status}`);
                                console.error(`      [CRUD Response Body]`, crudErr.response.data);
                            }
                        }
                    }
                }
            } else {
                previewState = "FAIL";
                console.error("   Preview compilation failed to reach READY state. Errors:", previewStates);
            }

            // Stop preview so we clean up ports
            console.log("   Stopping preview session...");
            await axios.delete(`${API_URL}/project/${projectId}/preview`, authHeaders);

        } catch (e) {
            previewState = "FAIL";
            console.error("   Preview process failed:", e.message);
        }

        // Local Compiling & Running Check
        let localRunResult = "SKIPPED";
        let localHealthResult = "SKIPPED";
        let localApiResult = "SKIPPED";

        if (zipBuffer) {
            const extractDir = path.resolve(__dirname, `temp_extract_${stack.key}`);
            if (fs.existsSync(extractDir)) {
                fs.rmSync(extractDir, { recursive: true, force: true });
            }
            fs.mkdirSync(extractDir, { recursive: true });

            try {
                const zip = new AdmZip(zipBuffer);
                zip.extractAllTo(extractDir, true);
                console.log(`   Extracted ZIP to ${extractDir}`);

                const hasPkgJson = fs.existsSync(path.join(extractDir, "package.json")) ||
                                   fs.existsSync(path.join(extractDir, "frontend", "package.json"));

                if (hasPkgJson) {
                    console.log("   Running local npm install & build checks...");
                    const installCwd = fs.existsSync(path.join(extractDir, "frontend")) ? path.join(extractDir, "frontend") : extractDir;

                    try {
                        console.log(`      Running npm install in ${installCwd}...`);
                        execSync("npm install --no-audit --no-fund", { cwd: installCwd, stdio: "ignore" });
                        installResult = "PASS";

                        const packageJson = require(path.join(installCwd, "package.json"));
                        if (packageJson.scripts && packageJson.scripts.build) {
                            console.log(`      Running npm run build in ${installCwd}...`);
                            execSync("npm run build", { cwd: installCwd, stdio: "ignore" });
                            buildResult = "PASS";
                        } else {
                            buildResult = "SKIPPED";
                        }

                        // STEP 4/7: Spawn Express / MERN backend locally to test runtime execution
                        if (stack.key === "express" || stack.key === "mern") {
                            const runDir = stack.key === "mern" ? path.join(extractDir, "backend") : extractDir;
                            if (fs.existsSync(path.join(runDir, "package.json"))) {
                                if (runDir !== installCwd) {
                                    console.log(`      Running npm install in backend: ${runDir}...`);
                                    execSync("npm install --no-audit --no-fund", { cwd: runDir, stdio: "ignore" });
                                }

                                // Write dummy .env with BOTH MONGO_URI and MONGODB_URI to avoid undefined errors
                                const dbName = stack.key === "mern" ? "mern-verify" : "express-verify";
                                const uriVal = `mongodb://127.0.0.1:27017/${dbName}`;
                                fs.writeFileSync(
                                    path.join(runDir, ".env"),
                                    `PORT=60600\nMONGO_URI=${uriVal}\nMONGODB_URI=${uriVal}\nDATABASE_URI=${uriVal}\nJWT_SECRET=secret\n`
                                );

                                console.log(`      Spawning backend process locally in ${runDir}...`);
                                const backendPort = 60600;
                                const child = spawn("node", ["server.js"], {
                                    cwd: runDir,
                                    env: { ...process.env, PORT: backendPort.toString(), MONGO_URI: uriVal, MONGODB_URI: uriVal, DATABASE_URI: uriVal }
                                });

                                localRunResult = "STARTING";

                                // Wait for server to bind
                                for (let i = 0; i < 20; i++) {
                                    await sleep(500);
                                    if (await isPortOpen(backendPort)) {
                                        localRunResult = "PASS";
                                        break;
                                    }
                                }

                                if (localRunResult === "PASS") {
                                    console.log(`      Local server is listening on port ${backendPort}. Checking endpoints...`);
                                    try {
                                        let healthRes;
                                        try {
                                            healthRes = await axios.get(`http://127.0.0.1:${backendPort}/health`, { timeout: 3000 });
                                        } catch (e) {
                                            healthRes = await axios.get(`http://127.0.0.1:${backendPort}/api/health`, { timeout: 3000 });
                                        }
                                        localHealthResult = `PASS (HTTP ${healthRes.status})`;
                                        console.log(`      Local health endpoint responded with status: ${healthRes.status}`);

                                        // Try CRUD
                                        const crudHeaders = {};
                                        if (apiContract.requiresAuth) {
                                            crudHeaders.Authorization = `Bearer ${token}`;
                                        }

                                        console.log(`      [Local CRUD Method] POST`);
                                        console.log(`      [Local CRUD Endpoint] http://127.0.0.1:${backendPort}${apiContract.routePath}`);
                                        console.log(`      [Local CRUD Payload]`, apiContract.payload);

                                        const postRes = await axios.post(`http://127.0.0.1:${backendPort}${apiContract.routePath}`, apiContract.payload, { 
                                            headers: crudHeaders,
                                            timeout: 3000 
                                        });
                                        console.log(`      [Local CRUD Response Status] ${postRes.status}`);
                                        
                                        const getRes = await axios.get(`http://127.0.0.1:${backendPort}${apiContract.routePath}`, { 
                                            headers: crudHeaders,
                                            timeout: 3000 
                                        });

                                        localApiResult = `PASS (POST status ${postRes.status}, GET status ${getRes.status}, count: ${Array.isArray(getRes.data) ? getRes.data.length : 1})`;
                                        console.log(`      Local API CRUD test verified successfully!`);
                                    } catch (err) {
                                        localHealthResult = "FAIL";
                                        localApiResult = "FAIL";
                                        console.error("      Local endpoints test failed:", err.message);
                                        if (err.response) {
                                            console.error(`      [Local CRUD Response Status] ${err.response.status}`);
                                            console.error(`      [Local CRUD Response Body]`, err.response.data);
                                        }
                                    }
                                } else {
                                    localRunResult = "FAIL";
                                    console.error(`      Local server failed to bind to port ${backendPort} within 10 seconds.`);
                                }

                                // Terminate local server
                                console.log("      Killing local backend process...");
                                child.kill("SIGKILL");
                            }
                        }
                    } catch (err) {
                        installResult = "FAIL";
                        buildResult = "FAIL";
                        console.error("      Local npm build check failed:", err.message);
                    }
                }
            } catch (err) {
                console.error("   Local compile failed:", err.message);
            } finally {
                // Clean up folder
                try {
                    fs.rmSync(extractDir, { recursive: true, force: true });
                } catch (e) {}
            }
        }

        // Status check logic
        const overallStatus = (
            previewState === "FAIL" ||
            healthCheck === "FAIL" ||
            installResult === "FAIL" ||
            buildResult === "FAIL" ||
            zipExclusionCheck === "FAIL" ||
            (stack.key === "express" && localApiResult === "FAIL") ||
            (stack.key === "mern" && localApiResult === "FAIL")
        ) ? "FAIL" : "PASS";

        reportData.push({
            stack: stack.name,
            requested: stack.prompt,
            resolvedProfile: resolvedProfile,
            duration: genResult.duration,
            expectedFileCount: spec ? (spec.importantDependencies?.length || 0) : 0,
            generatedFileCount: zipFilesList.length,
            zipExclusion: zipExclusionCheck,
            zipExclusionDetails: zipDetails,
            preview: previewState,
            previewStates: previewStates.join(" -> "),
            health: healthCheck,
            apiEndpointEvidence,
            install: installResult,
            build: buildResult,
            localRun: localRunResult,
            localHealth: localHealthResult,
            localApi: localApiResult,
            status: overallStatus,
            metrics: genResult.metrics
        });
    }

    // Step 5: Report Output
    console.log("\n=== COMPILING FINAL E2E RELEASE REPORT ===");
    console.log(JSON.stringify(reportData, null, 2));

    // Save report data as a local json artifact
    fs.writeFileSync("release_report.json", JSON.stringify(reportData, null, 2), "utf8");
}

runE2E();
