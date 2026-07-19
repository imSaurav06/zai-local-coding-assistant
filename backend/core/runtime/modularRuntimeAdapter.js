"use strict";

const { validateProjectSpec } = require("../projectSpec");
const { createExecutionState, createWorkerRegistry, createExecutionPipeline, validatePipeline } = require("../execution");
const { prepareCanonicalProjectSpec, generateRichPlan, generateRichReadme, sanitizeMongooseConnectOptions } = require("../../services/generationOrchestrator");
const aiExecutor = require("../../services/aiGenerationExecutor");
const { runVerification } = require("../verification");
const { validateSyntax } = require("../../utils/syntaxValidator");
const vfs = require("../vfs");

const { planGeneration } = require("../../services/generationPlanner");
const { generateScaffoldFiles } = require("../../services/scaffoldRegistry");

const MODULAR_RUNTIME_ADAPTER_VERSION = "1.0";

const modularRuntimeAdapterErrorCodes = Object.freeze({
    MODULAR_RUNTIME_INVALID_REQUEST: "MODULAR_RUNTIME_INVALID_REQUEST",
    MODULAR_RUNTIME_PIPELINE_FAILED: "MODULAR_RUNTIME_PIPELINE_FAILED",
    MODULAR_RUNTIME_INVALID_RESULT: "MODULAR_RUNTIME_INVALID_RESULT"
});

const CANONICAL_REQUEST_KEYS = new Set(["projectSpec", "options", "metadata"]);

/**
 * Deep freezes an object recursively to guarantee immutability.
 */
function deepFreeze(obj) {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach(prop => {
        if (
            obj.hasOwnProperty(prop) &&
            obj[prop] !== null &&
            (typeof obj[prop] === "object" || typeof obj[prop] === "function") &&
            !Object.isFrozen(obj[prop])
        ) {
            deepFreeze(obj[prop]);
        }
    });
    return obj;
}

function createError(message, code) {
    const err = new Error(message);
    err.code = code;
    return err;
}

function validateExecutionRequestLocal(request) {
    if (request === null || request === undefined || typeof request !== "object" || Array.isArray(request)) {
        throw createError("Execution request must be a non-null object.", "MODULAR_RUNTIME_INVALID_REQUEST");
    }

    // 1. Unknown properties check
    for (const key of Object.keys(request)) {
        if (!CANONICAL_REQUEST_KEYS.has(key)) {
            throw createError(`Unknown property key in request: '${key}'`, "MODULAR_RUNTIME_INVALID_REQUEST");
        }
    }

    // 2. Required projectSpec check
    if (!request.hasOwnProperty("projectSpec")) {
        throw createError("Property 'projectSpec' is required.", "MODULAR_RUNTIME_INVALID_REQUEST");
    }

    // 3. Validate projectSpec structure using core validator
    const specVal = validateProjectSpec(request.projectSpec);
    if (!specVal.success) {
        throw createError(`Invalid ProjectSpec schema: ${specVal.errors[0].message}`, "MODULAR_RUNTIME_INVALID_REQUEST");
    }

    // 4. Validate options type
    if (request.hasOwnProperty("options") && request.options !== null && (typeof request.options !== "object" || Array.isArray(request.options))) {
        throw createError("Property 'options' must be a non-null object or null.", "MODULAR_RUNTIME_INVALID_REQUEST");
    }

    // 5. Validate metadata type
    if (request.hasOwnProperty("metadata") && request.metadata !== null && (typeof request.metadata !== "object" || Array.isArray(request.metadata))) {
        throw createError("Property 'metadata' must be a non-null object or null.", "MODULAR_RUNTIME_INVALID_REQUEST");
    }
}

const isMernStack = (projectSpec) => {
    const isMern = projectSpec.projectType === "MERN Stack Application" ||
        (projectSpec.frontend && projectSpec.frontend.toLowerCase().includes("react") &&
         projectSpec.backend && projectSpec.backend.toLowerCase().includes("express"));
    return !!isMern;
};

const generateRunInstructions = (projectSpec, files) => {
    const prerequisites = [];
    const steps = ["Download and extract the ZIP file."];
    let frontendUrl = "";
    let backendUrl = "";

    const hasMernFiles = files && (files.some(f => f.name === "backend/package.json") ||
                          files.some(f => f.name.startsWith("backend/")));
    const hasNode = files && files.some(f => f.name === "package.json");
    const hasPython = files && files.some(f => f.name === "requirements.txt" || f.name === "pyproject.toml");

    if (hasNode) prerequisites.push("Node.js (v18+)");
    if (hasPython) prerequisites.push("Python (3.9+)");
    if (isMernStack(projectSpec) || hasMernFiles) {
        if (!prerequisites.includes("MongoDB (local or Atlas)")) {
            prerequisites.push("MongoDB (local or Atlas)");
        }
    } else if (projectSpec.database) {
        if (projectSpec.database.toLowerCase().includes("mongo")) prerequisites.push("MongoDB (local or Atlas)");
        else if (projectSpec.database.toLowerCase().includes("postgre")) prerequisites.push("PostgreSQL server");
        else if (projectSpec.database.toLowerCase().includes("redis")) prerequisites.push("Redis server");
    }

    if (isMernStack(projectSpec) || hasMernFiles) {
        frontendUrl = "http://localhost:5173";
        backendUrl = "http://localhost:5000";
        steps.push(
            "Navigate to backend directory, run `npm install` and create `.env` using `.env.example`.",
            "Start the backend server by running `npm run dev` or `npm start`.",
            "Navigate to frontend directory, run `npm install` to install client libraries.",
            "Start the frontend dashboard by running `npm run dev`.",
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
                if (pj.devDependencies && pj.devDependencies.vite) {
                    frontendUrl = "http://localhost:5173";
                }
            } catch (e) {}
        }
        steps.push(
            "Open directory in terminal.",
            "Run `npm install` to fetch dependencies.",
            `Start local server by running \`${startCmd}\`.`,
            `Open browser at ${frontendUrl} to view.`
        );
    } else if (hasPython) {
        backendUrl = "http://localhost:8000";
        const isFastapi = projectSpec.backend?.toLowerCase().includes("fastapi");
        const runCmd = isFastapi ? "uvicorn main:app --reload" : "python manage.py runserver";
        steps.push(
            "Create a python virtual environment: `python -m venv venv`.",
            "Activate virtual environment: `source venv/bin/activate` (Linux/macOS) or `venv\\Scripts\\activate` (Windows).",
            "Install python packages: `pip install -r requirements.txt`.",
            `Run local development app: \`${runCmd}\`.`
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

/**
 * Executes request strictly using the execution pipeline under MODULAR mode.
 *
 * @param {Object} request Validated request structure
 */
async function execute(request) {
    // 1. Validate ExecutionRequest
    validateExecutionRequestLocal(request);

    // 2. Prepare canonical project spec
    let prep;
    try {
        prep = prepareCanonicalProjectSpec(request.projectSpec);
    } catch (err) {
        throw createError(`Invalid request during preparation: ${err.message}`, "MODULAR_RUNTIME_INVALID_REQUEST");
    }

    // 3. Initialize Execution Domain Model and Worker Registry
    const execStateResult = createExecutionState(prep.taskGraph);
    if (!execStateResult.success) {
        throw createError(`Failed to create execution state: ${execStateResult.errors[0].message}`, "MODULAR_RUNTIME_INVALID_REQUEST");
    }
    let executionState = execStateResult.executionState;

    let workerRegistry = createWorkerRegistry();
    workerRegistry = workerRegistry.create("w1").registry;
    workerRegistry = workerRegistry.create("w2").registry;
    workerRegistry = workerRegistry.create("w3").registry;

    // 4. Initialize VFS and scaffold files
    const plan = planGeneration(prep.projectSpec);
    const scaffoldFiles = generateScaffoldFiles(plan.scaffoldAdapter, prep.projectSpec);

    let initialVfs = vfs.createVirtualFileSystem().vfs;
    const tx = vfs.beginTransaction(initialVfs);
    let vfsState = tx.vfs;

    for (const file of scaffoldFiles) {
        const pathVal = file.name || file.path;
        let lang = file.language;
        if (!lang) {
            if (pathVal.endsWith(".js") || pathVal.endsWith(".jsx")) lang = "javascript";
            else if (pathVal.endsWith(".css")) lang = "css";
            else if (pathVal.endsWith(".html")) lang = "html";
            else lang = "plaintext";
        }
        const res = vfs.createFile(vfsState, {
            path: pathVal,
            language: lang,
            content: file.content,
            metadata: {}
        });
        if (res.success) {
            vfsState = res.vfs;
        }
    }

    // 5. Setup helpers and custom mocks for pipeline
    const progressEmitter = request.options && request.options.progressEmitter;
    const checkCancellation = request.options && request.options.checkCancellation;
    const cancelSignal = request.options && request.options.cancelSignal;

    const mockGateway = {
        async generateResponse(contextPrompt) {
            const systemPrompt = `You are a principal MERN stack engineer. Generate the files specified in user requests.
No explanations. Output files block using standard separators.`;
            const rawOutput = await aiExecutor.executeAiRequest(systemPrompt, contextPrompt, {
                cancelSignal,
                strategy: plan.strategy,
                tokenBudget: plan.tokenBudget
            });
            return { success: true, text: rawOutput };
        }
    };

    const mockWorker = {
        generateFile(aiText, taskId) {
            const parsedFiles = aiExecutor.parseGeneratedFiles(aiText);
            const { applyContentGuard } = require("../../services/generationOrchestrator");
            const guardErrors = applyContentGuard(parsedFiles);
            if (guardErrors.length > 0) {
                return { success: false, errors: guardErrors };
            }
            return { success: true, files: parsedFiles };
        }
    };

    const mockVerification = {
        runVerification(files, opts) {
            const verResult = runVerification(files, opts);
            const mappedFiles = files.map(f => ({ name: f.path || f.name, content: f.content }));
            const syntaxErrors = validateSyntax(mappedFiles);
            const errors = [...(verResult.errors || [])];
            for (const se of syntaxErrors) {
                errors.push({
                    path: se.filePath,
                    message: `SyntaxError in '${se.filePath}': ${se.reason}`
                });
            }
            return {
                success: errors.length === 0,
                errors,
                diagnostics: verResult.diagnostics
            };
        }
    };

    const mockContextBuilder = {
        buildContext(taskId) {
            const plannerTask = prep.planner.tasks.find(t => t.stableId === taskId);
            if (!plannerTask) {
                return { success: false, errors: [{ message: `Planner task '${taskId}' not found.` }] };
            }
            const requirement = prep.requirementIdentity.requirements.find(r => r.stableId === taskId);
            const hasTarget = plannerTask.targetFile || requirement.targetFile ||
                              (plannerTask.metadata && plannerTask.metadata.targetFile) ||
                              (requirement.payload && requirement.payload.targetFile) ||
                              plannerTask.filePath || requirement.filePath ||
                              (plannerTask.metadata && plannerTask.metadata.filePath) ||
                              (requirement.payload && requirement.payload.filePath);
            const repoFiles = vfsState.files.map(f => ({
                path: f.path,
                language: f.path.endsWith(".jsx") || f.path.endsWith(".js") ? "javascript" : "text",
                imports: []
            }));
            return require("../context").buildContext(
                prep.projectSpec,
                requirement,
                plannerTask,
                hasTarget ? repoFiles : null,
                {}
            );
        }
    };

    const schedulerInstance = require("../execution/scheduler").createScheduler();

    const pipelineInstance = createExecutionPipeline({
        scheduler: schedulerInstance,
        contextBuilder: mockContextBuilder,
        aiProviderGateway: mockGateway,
        codingWorker: mockWorker,
        vfs,
        verification: mockVerification
    });

    // 6. Execute loop sequentially over pending tasks
    while (executionState.queues.pending.length > 0) {
        if (checkCancellation) {
            checkCancellation();
        }

        const schedule = schedulerInstance.computeSchedule(executionState, workerRegistry, prep.taskGraph);
        if (!schedule || !schedule.assignments || schedule.assignments.length === 0) {
            break;
        }

        const assignment = schedule.assignments[0];
        if (progressEmitter) {
            progressEmitter.emit("Generating Modules", `Generating module for task '${assignment.taskId}'...`);
        }

        let pipelineResult;
        try {
            pipelineResult = await pipelineInstance.executePipeline(executionState, workerRegistry, prep.taskGraph, {
                vfsState,
                projectSpec: prep.projectSpec
            });
        } catch (pipelineErr) {
            const failedErr = createError(`Pipeline execution failed with exception: ${pipelineErr.message}`, "MODULAR_RUNTIME_PIPELINE_FAILED");
            failedErr.originalError = pipelineErr;
            throw failedErr;
        }

        // Validate PipelineResult format and mutability
        if (!pipelineResult) {
            throw createError("PipelineResult is null or undefined", "MODULAR_RUNTIME_INVALID_RESULT");
        }

        if (!Object.isFrozen(pipelineResult)) {
            throw createError("PipelineResult is mutable", "MODULAR_RUNTIME_INVALID_RESULT");
        }

        const validation = validatePipeline(pipelineResult);
        if (!validation.success) {
            throw createError(`PipelineResult validation failed: ${validation.errors[0].message}`, "MODULAR_RUNTIME_INVALID_RESULT");
        }

        if (!pipelineResult.success) {
            const errMsg = pipelineResult.metadata && pipelineResult.metadata.error
                ? pipelineResult.metadata.error.message
                : "Execution failed";
            throw createError(`Pipeline execution failed: ${errMsg}`, "MODULAR_RUNTIME_PIPELINE_FAILED");
        }

        // Update states
        if (pipelineResult.execution && pipelineResult.execution.vfsState) {
            vfsState = pipelineResult.execution.vfsState;
        }

        const newPending = executionState.queues.pending.filter(id => id !== assignment.taskId);
        const newCompleted = [...executionState.queues.completed, assignment.taskId];

        executionState = Object.freeze({
            ...executionState,
            queues: Object.freeze({
                ...executionState.queues,
                pending: Object.freeze(newPending),
                completed: Object.freeze(newCompleted)
            })
        });
    }

    if (checkCancellation) {
        checkCancellation();
    }
    if (progressEmitter) {
        progressEmitter.emit("Merging Project", "Finalizing project code modules...");
    }

    // Commit Transaction
    const commitRes = vfs.commitTransaction(vfsState);
    if (!commitRes.success) {
        throw createError("VFS transaction commit failed: " + commitRes.errors[0].message, "MODULAR_RUNTIME_PIPELINE_FAILED");
    }

    let finalFiles = commitRes.vfs.files.map(f => ({
        name: f.path,
        content: f.content
    }));

    if (checkCancellation) {
        checkCancellation();
    }

    // Ensure README exists
    const hasReadme = finalFiles.some(f => f.name.toLowerCase() === "readme.md");
    if (!hasReadme) {
        finalFiles.push({
            name: "README.md",
            content: generateRichReadme(prep.projectSpec, finalFiles)
        });
    }

    const finalReadmeIdx = finalFiles.findIndex(f => f.name.toLowerCase() === "readme.md");
    if (finalReadmeIdx !== -1) {
        finalFiles[finalReadmeIdx] = {
            name: "README.md",
            content: generateRichReadme(prep.projectSpec, finalFiles)
        };
    }

    sanitizeMongooseConnectOptions(finalFiles);

    const runInstructions = generateRunInstructions(prep.projectSpec, finalFiles);
    const richPlan = generateRichPlan(prep.projectSpec);

    const rawResult = {
        files: finalFiles,
        runInstructions,
        summary: richPlan,
        model: process.env.ZAI_MODEL || "gemini-3.5-flash",
        projectSpec: prep.projectSpec,
        requirementIdentity: prep.requirementIdentity
    };

    const response = {
        success: true,
        runtime: "MODULAR",
        result: rawResult,
        metadata: {
            requirementIdentity: prep.requirementIdentity,
            verificationResult: null,
            repaired: false
        }
    };

    return deepFreeze(response);
}

/**
 * Factory instantiating modular runtime adapter.
 */
function createModularRuntimeAdapter() {
    return deepFreeze({
        execute,
        version: MODULAR_RUNTIME_ADAPTER_VERSION
    });
}

module.exports = {
    createModularRuntimeAdapter,
    execute,
    MODULAR_RUNTIME_ADAPTER_VERSION,
    modularRuntimeAdapterErrorCodes
};
