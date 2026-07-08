const { planGeneration } = require("./generationPlanner");
const { generateScaffoldFiles } = require("./scaffoldRegistry");
const { buildSharedContracts } = require("./contractBuilder");
const { generateUnitCode, executeAiRequest, parseGeneratedFiles } = require("./aiGenerationExecutor");
const { mergeFiles } = require("./generationMerger");
const { validateProjectFiles } = require("./validationProfiles");
const { repairAffectedFiles } = require("./targetedRepairService");

const generateReadmeLocally = (projectSpec) => {
    return `# ${projectSpec.projectName}

${projectSpec.projectType} application scaffolded dynamically.

## Features
${(projectSpec.mainFeatures || []).map(f => `- ${f}`).join("\n")}

## Prerequisites
- Node.js (v18+) or Python (3.9+) depending on chosen stack.
- Database: ${projectSpec.database}

## Run Locally
Refer to the dynamic Run Guide.
`;
};

const generateRunInstructions = (projectSpec, files) => {
    const prerequisites = [];
    const steps = ["Download and extract the ZIP file."];
    let frontendUrl = "";
    let backendUrl = "";

    const hasMern = projectSpec.projectType?.toLowerCase().includes("mern") || 
                    projectSpec.backend?.toLowerCase().includes("express") || 
                    files.some(f => f.name.includes("server.js") || f.name.includes("backend/"));
    
    const hasNode = files.some(f => f.name === "package.json");
    const hasPython = files.some(f => f.name === "requirements.txt" || f.name === "pyproject.toml");

    if (hasNode) prerequisites.push("Node.js (v18+)");
    if (hasPython) prerequisites.push("Python (3.9+)");

    if (hasMern) {
        frontendUrl = "http://localhost:5173";
        backendUrl = "http://localhost:5000";
        steps.push(
            "Navigate to backend directory, run 'npm install' and create '.env' using '.env.example'.",
            "Start the backend server by running 'npm run dev' or 'npm start'.",
            "Navigate to frontend directory, run 'npm install' to install client libraries.",
            "Start the frontend dashboard by running 'npm run dev'.",
            `Open browser at ${frontendUrl} to view.`
        );
    } else if (hasNode) {
        frontendUrl = "http://localhost:3000";
        let startCmd = "npm run dev";
        const packageJsonFile = files.find(f => f.name === "package.json");
        if (packageJsonFile) {
            try {
                const pj = JSON.parse(packageJsonFile.content);
                if (pj.scripts && pj.scripts.start && !pj.scripts.dev) {
                    startCmd = "npm start";
                }
            } catch (e) {}
        }
        steps.push(
            "Open directory in terminal.",
            "Run 'npm install' to fetch dependencies.",
            `Start local server by running '${startCmd}'.`,
            `Open browser at ${frontendUrl} to view.`
        );
    } else if (hasPython) {
        backendUrl = "http://localhost:8000";
        const isFastapi = projectSpec.backend?.toLowerCase().includes("fastapi");
        const runCmd = isFastapi ? "uvicorn main:app --reload" : "python manage.py runserver";
        steps.push(
            "Create a python virtual environment: 'python -m venv venv'.",
            "Activate virtual environment: 'source venv/bin/activate' (Linux/macOS) or 'venv\\Scripts\\activate' (Windows).",
            "Install python packages: 'pip install -r requirements.txt'.",
            `Run local development app: '${runCmd}'.`
        );
    } else {
        steps.push(
            "Open the project directory.",
            "Double-click index.html to launch visual components in the browser."
        );
    }

    return {
        prerequisites,
        steps,
        frontendUrl: frontendUrl || undefined,
        backendUrl: backendUrl || undefined
    };
};

const orchestrateGeneration = async ({ originalPrompt, projectSpec }, progressEmitter, checkCancellation, options = {}) => {
    const startTime = Date.now();
    let scaffoldMs = 0;
    let validationMs = 0;
    let repairCalls = 0;
    let repairMs = 0;
    
    const callMetricsCollector = [];

    // Safe cancellation checking helper
    const verifyCancellation = () => {
        if (checkCancellation) {
            checkCancellation();
        }
    };

    verifyCancellation();
    progressEmitter.emit("Analyzing Request", "Analyzing user prompts and specs...");
    
    // 1. Local Task Analysis / Planning
    progressEmitter.emit("Planning Generation", "Formulating optimal generation strategy...");
    const plan = planGeneration(projectSpec);
    const contracts = buildSharedContracts(projectSpec);

    const planningMs = Date.now() - startTime;
    verifyCancellation();

    let finalFiles = [];

    // 2. Adaptive Generation Execution
    let callIndex = 1;
    if (plan.strategy === "DIRECT") {
        progressEmitter.emit("Preparing Project", "Running direct generation call...");
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

        const userPrompt = `ORIGINAL REQUEST: "${originalPrompt}"
PROJECT SPECIFICATION:
${JSON.stringify(projectSpec, null, 2)}`;

        verifyCancellation();
        const rawOutput = await executeAiRequest(systemPrompt, userPrompt, {
            cancelSignal: options.cancelSignal,
            callMetricsCollector,
            callIndex: callIndex++,
            strategy: plan.strategy,
            tokenBudget: plan.tokenBudget
        });
        verifyCancellation();

        finalFiles = parseGeneratedFiles(rawOutput);

    } else {
        // Scaffold + AI / Parallel / Chunked strategy
        progressEmitter.emit("Preparing Project", "Generating deterministic configurations locally...");
        const scafStart = Date.now();
        const scaffoldFiles = generateScaffoldFiles(plan.scaffoldAdapter, projectSpec);
        scaffoldMs += (Date.now() - scafStart);

        const aiGeneratedFiles = [];
        const units = plan.generationUnits;
        const totalUnits = units.length;
        let completedUnits = 0;

        // Process parallel groups
        for (const group of plan.parallelGroups) {
            verifyCancellation();
            
            progressEmitter.emit("Generating Modules", `Generating modules group (${completedUnits}/${totalUnits})...`);
            
            // Conservatively process concurrent requests up to limit of 3
            const limit = 3;
            for (let i = 0; i < group.length; i += limit) {
                verifyCancellation();
                const chunk = group.slice(i, i + limit);
                
                const promises = chunk.map(async (unit) => {
                    const rawOutput = await generateUnitCode(unit, projectSpec, contracts, {
                        cancelSignal: options.cancelSignal,
                        callMetricsCollector,
                        callIndex: callIndex++,
                        strategy: plan.strategy
                    });
                    return parseGeneratedFiles(rawOutput);
                });

                const results = await Promise.allSettled(promises);
                
                for (let idx = 0; idx < results.length; idx++) {
                    const res = results[idx];
                    const unit = chunk[idx];
                    
                    if (res.status === "fulfilled") {
                        aiGeneratedFiles.push(...res.value);
                    } else {
                        verifyCancellation();
                        console.error(`UNIT GENERATION FAILED FOR ${unit.id}: ${res.reason ? res.reason.message : "unknown error"}. Unit will not be retried by the orchestrator.`);
                        if (res.reason && (res.reason.status === 429 || res.reason.message.includes("Rate limit"))) {
                            throw res.reason;
                        }
                    }
                }
                completedUnits += chunk.length;
                progressEmitter.emit("Generating Modules", `Generating modules group (${completedUnits}/${totalUnits})...`);
            }
        }

        // Merge files
        verifyCancellation();
        progressEmitter.emit("Merging Project", "Combining configuration and AI code modules...");
        finalFiles = mergeFiles(scaffoldFiles, aiGeneratedFiles);
    }

    // Ensure README exists before validation
    verifyCancellation();
    const hasReadme = finalFiles.some(f => f.name.toLowerCase() === "readme.md");
    if (!hasReadme) {
        finalFiles.push({
            name: "README.md",
            content: generateReadmeLocally(projectSpec)
        });
    }

    // 3. Post-Merge / Project-Level Validation
    verifyCancellation();
    const valStart = Date.now();
    progressEmitter.emit("Validating Modules", "Validating merged codebase integrity and schemas...");
    let validationErrors = validateProjectFiles(finalFiles, projectSpec);
    validationMs += (Date.now() - valStart);

    // 4. Bounded Targeted Repair Loop
    let attempt = 0;
    while (validationErrors.length > 0 && attempt < plan.repairPolicy.maxAttempts) {
        verifyCancellation();
        attempt++;
        repairCalls++;
        progressEmitter.emit("Repairing Code", `Running targeted validation repairs (Attempt ${attempt}/${plan.repairPolicy.maxAttempts})...`);
        const repStart = Date.now();
        try {
            finalFiles = await repairAffectedFiles(validationErrors, finalFiles, projectSpec, contracts, {
                cancelSignal: options.cancelSignal,
                callMetricsCollector,
                callIndex: callIndex++,
                strategy: plan.strategy
            });
            validationErrors = validateProjectFiles(finalFiles, projectSpec);
        } catch (repairErr) {
            console.error("TARGETED REPAIR FAILED:", repairErr.message);
            if (repairErr.status === 429 || repairErr.message.includes("Rate limit")) {
                throw new Error("Rate limit (HTTP 429) exceeded during targeted repair phase.");
            }
        }
        repairMs += (Date.now() - repStart);
    }

    verifyCancellation();
    if (validationErrors.length > 0) {
        throw new Error("Project generation validation/repair failed: " + validationErrors.join("; "));
    }

    const runInstructions = generateRunInstructions(projectSpec, finalFiles);

    // Aggregate metrics from all calls
    let totalAiGenerationMs = 0;
    let totalRetries = 0;
    let totalRetryWaitMs = 0;
    let totalTimeouts = 0;
    let totalNetworkErrors = 0;

    callMetricsCollector.forEach(c => {
        totalAiGenerationMs += c.callDuration;
        totalRetries += c.retries;
        totalRetryWaitMs += c.retryWaitMs;
        totalTimeouts += c.timeoutCount;
        totalNetworkErrors += c.networkErrorCount;
    });

    const totalMs = Date.now() - startTime;

    // Log final orchestrator timing summary
    console.log(`
--- GENERATION SUMMARY METRICS ---
strategy=${plan.strategy}
planningMs=${planningMs}
scaffoldMs=${scaffoldMs}
primaryAiCalls=${callMetricsCollector.filter(c => c.unitId === "all_source_files" || c.unitId === "core_entry").length}
parallelAiCalls=${callMetricsCollector.filter(c => c.unitId !== "all_source_files" && c.unitId !== "core_entry" && c.success).length}
aiGenerationMs=${totalAiGenerationMs}
retries=${totalRetries}
retryWaitMs=${totalRetryWaitMs}
timeouts=${totalTimeouts}
networkErrors=${totalNetworkErrors}
validationMs=${validationMs}
repairCalls=${repairCalls}
repairMs=${repairMs}
databaseSaveMs=0
totalMs=${totalMs}
----------------------------------
`);

    return {
        files: finalFiles,
        runInstructions,
        summary: `Scaffolded complete runnable project blueprint for a ${projectSpec.projectType} using ${projectSpec.frontend} and ${projectSpec.backend}.`,
        model: process.env.ZAI_MODEL
    };
};

module.exports = { orchestrateGeneration };
