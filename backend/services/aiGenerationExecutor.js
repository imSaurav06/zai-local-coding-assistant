const axios = require("axios");
const providerRouter = require("./aiProviders/providerRouter");

// Overall generation deadline — retries/fallback must not cause unbounded total wall time.
// A single executeAiRequest call (primary + retries + fallback + retries) may not exceed this.
const GENERATION_DEADLINE_MS = 300000; // 5 minutes

// Adaptive timeout calculator based on strategy and token budget
const calculateAdaptiveTimeout = (strategy, tokenBudget) => {
    let timeout = 120000; // Base 120s
    if (strategy === "DIRECT" || strategy === "SCAFFOLD_AI") {
        timeout = 120000 + (tokenBudget * 30); // 30ms per token
    } else {
        timeout = 90000 + (tokenBudget * 20); // 20ms per token
    }
    // Bound between 120s minimum and 240s maximum
    return Math.min(240000, Math.max(120000, timeout));
};

const executeWithBackoff = async (apiCallFn, retriesLeft, delay, options, stats) => {
    const startTime = Date.now();
    try {
        if (options.cancelSignal && options.cancelSignal.aborted) {
            const err = new Error("Canceled");
            err.code = "ERR_CANCELED";
            throw err;
        }

        return await apiCallFn();
    } catch (err) {
        const isCanceled = err.code === "ERR_CANCELED" || (options.cancelSignal && options.cancelSignal.aborted);
        if (isCanceled) {
            stats.success = false;
            stats.errorCode = "CANCELED";
            throw err;
        }

        const status = err.response ? err.response.status : null;
        const code = err.code || "";
        
        const isRateLimit = status === 429;
        const isTimeout = code === "ECONNABORTED" || (err.message && err.message.toLowerCase().includes("timeout"));
        const isNetwork = ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(code);
        const isTransient5xx = status >= 500 && status <= 599;

        const isNullContent = err.isNullContent === true;
        const isTransient = isRateLimit || isTimeout || isNetwork || isTransient5xx || isNullContent;

        // Check if we can retry — also enforce the overall deadline
        const totalRetryBudgetMax = 30000; // Max 30 seconds wait budget total
        const elapsedMs = Date.now() - stats._startTime;
        const remainingDeadlineMs = GENERATION_DEADLINE_MS - elapsedMs;
        if (isTransient && retriesLeft > 0 && stats.retryWaitMs < totalRetryBudgetMax && remainingDeadlineMs > 8000) {
            stats.retries++;
            if (isTimeout) stats.timeoutCount++;
            if (isNetwork) stats.networkErrorCount++;

            // Handle Retry-After header
            let nextDelay = delay;
            const retryAfterHeader = err.response && err.response.headers && err.response.headers["retry-after"];
            if (retryAfterHeader) {
                const parsed = parseInt(retryAfterHeader, 10);
                if (!isNaN(parsed)) {
                    nextDelay = parsed * 1000;
                }
            } else {
                // Exponential backoff with jitter
                nextDelay = delay * 2 + Math.floor(Math.random() * 200);
            }
            // Cap individual delay to 6s
            nextDelay = Math.min(6000, nextDelay);

            stats.retryWaitMs += nextDelay;
            console.warn(`Z.AI EXECUTOR: Warning (${code || status}). Retrying in ${nextDelay}ms... (Retries left: ${retriesLeft})`);
            
            await new Promise((resolve, reject) => {
                const timer = setTimeout(resolve, nextDelay);
                if (options.cancelSignal) {
                    options.cancelSignal.addEventListener("abort", () => {
                        clearTimeout(timer);
                        const abortErr = new Error("Canceled");
                        abortErr.code = "ERR_CANCELED";
                        reject(abortErr);
                    });
                }
            });

            return executeWithBackoff(apiCallFn, retriesLeft - 1, nextDelay, options, stats);
        }

        stats.success = false;
        stats.errorCode = code || (status ? `HTTP_${status}` : "ERROR");
        if (isTimeout) stats.timeoutCount++;
        if (isNetwork) stats.networkErrorCount++;
        throw err;
    }
};

const executeAiRequest = async (systemPrompt, userPrompt, options = {}) => {
    const callIndex = options.callIndex || 1;
    const strategy = options.strategy || "DIRECT";
    const unitId = options.unitId || "all_source_files";
    const tokenBudget = options.tokenBudget || 2000;
    
    const primaryProvider = providerRouter.getPrimaryProvider();
    const fallbackProvider = providerRouter.getFallbackProvider();
    
    const stats = {
        callIndex,
        strategy,
        unitId,
        requestedTokenBudget: tokenBudget,
        configuredTimeout: 0,
        callDuration: 0,
        success: true,
        errorCode: "",
        retries: 0,
        retryWaitMs: 0,
        timeoutCount: 0,
        networkErrorCount: 0,
        primaryProvider,
        finalProvider: primaryProvider,
        providerAttempts: 1,
        fallbackUsed: false,
        fallbackReason: ""
    };

    const startTime = Date.now();
    // Expose startTime to retry budget checker
    stats._startTime = startTime;

    const runForProvider = async (provider) => {
        stats.finalProvider = provider;
        const configuredTimeout = options.timeout || calculateAdaptiveTimeout(strategy, tokenBudget);
        stats.configuredTimeout = configuredTimeout;
        
        const apiCall = async () => {
            const config = {};
            if (options.cancelSignal) {
                config.signal = options.cancelSignal;
            }
            config.timeout = configuredTimeout;
            config.tokenBudget = tokenBudget;

            const messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ];

            const res = await providerRouter.sendChatCompletionDirect(provider, messages, config, options);
            if (!res.content || typeof res.content !== "string" || res.content.trim().length === 0) {
                const nullContentErr = new Error(`Provider returned empty or null content. Model may have hit a context or content-policy limit.`);
                nullContentErr.isNullContent = true;
                throw nullContentErr;
            }
            return res;
        };

        return await executeWithBackoff(apiCall, 3, 1000, options, stats);
    };

    try {
        const response = await runForProvider(primaryProvider);

        stats.callDuration = Date.now() - startTime;
        if (options.callMetricsCollector) {
            options.callMetricsCollector.push(stats);
        }
        console.log(`[AI Call Metrics] callIndex=${stats.callIndex} strategy=${stats.strategy} provider=${stats.finalProvider} unit=${stats.unitId} duration=${stats.callDuration}ms success=true retries=${stats.retries}`);

        return response.content.trim();
    } catch (primaryErr) {
        const status = primaryErr.response ? primaryErr.response.status : null;
        const code = primaryErr.code || "";
        
        const isRateLimit = status === 429 || primaryErr.message.includes("429");
        const isPaymentRequired = status === 402;
        const isTimeout = code === "ECONNABORTED" || (primaryErr.message && primaryErr.message.toLowerCase().includes("timeout"));
        const isNetwork = ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(code);
        const isTransient5xx = status >= 500 && status <= 599;
        const isNullContent = primaryErr.isNullContent === true;
        const isFallbackEligible = isRateLimit || isPaymentRequired || isTimeout || isNetwork || isTransient5xx || isNullContent;

        if (isFallbackEligible && fallbackProvider && fallbackProvider !== primaryProvider) {
            console.warn(`[AI Failover] Primary provider ${primaryProvider} failed. Triggering fallback ${fallbackProvider}... Reason: ${primaryErr.message}`);
            stats.fallbackUsed = true;
            stats.providerAttempts = 2;
            stats.fallbackReason = primaryErr.message;
            
            try {
                // Check deadline before attempting fallback
                const elapsedBeforeFallback = Date.now() - startTime;
                if (elapsedBeforeFallback > GENERATION_DEADLINE_MS - 5000) {
                    throw new Error(`Generation deadline exceeded before fallback attempt (${elapsedBeforeFallback}ms elapsed).`);
                }

                // Execute fallback provider with its own retry/backoff policy
                const response = await runForProvider(fallbackProvider);

                stats.callDuration = Date.now() - startTime;
                if (options.callMetricsCollector) {
                    options.callMetricsCollector.push(stats);
                }
                console.log(`[AI Call Metrics] callIndex=${stats.callIndex} strategy=${stats.strategy} provider=${stats.finalProvider} (fallback) unit=${stats.unitId} duration=${stats.callDuration}ms success=true retries=${stats.retries}`);

                return response.content.trim();
            } catch (fallbackErr) {
                stats.callDuration = Date.now() - startTime;
                stats.success = false;
                stats.errorCode = fallbackErr.code || (fallbackErr.response?.status ? `HTTP_${fallbackErr.response.status}` : "ERROR");
                
                if (options.callMetricsCollector) {
                    options.callMetricsCollector.push(stats);
                }

                console.error(`[AI Call Metrics] callIndex=${stats.callIndex} strategy=${stats.strategy} provider=${stats.finalProvider} (fallback) unit=${stats.unitId} duration=${stats.callDuration}ms success=false error=${stats.errorCode} retries=${stats.retries}`);
                throw fallbackErr;
            }
        } else {
            stats.callDuration = Date.now() - startTime;
            stats.success = false;
            stats.errorCode = primaryErr.code || (primaryErr.response?.status ? `HTTP_${primaryErr.response.status}` : "ERROR");

            if (options.callMetricsCollector) {
                options.callMetricsCollector.push(stats);
            }

            console.error(`[AI Call Metrics] callIndex=${stats.callIndex} strategy=${stats.strategy} provider=${stats.finalProvider} unit=${stats.unitId} duration=${stats.callDuration}ms success=false error=${stats.errorCode} retries=${stats.retries}`);
            throw primaryErr;
        }
    }
};

const parseGeneratedFiles = (resultContent) => {
    const files = [];
    const fileRegex = /--- FILE:\s*([^\s]+)\s*---[\s]+([\s\S]*?)(?=--- FILE:|--- END_FILE ---|--- END_FILES ---)/g;
    let fileMatch;
    while ((fileMatch = fileRegex.exec(resultContent)) !== null) {
        const filePath = fileMatch[1].trim();
        if (filePath.toLowerCase() === "path/to/filename" || filePath.includes("path/to/filename")) {
            continue; // Skip instruction placeholder
        }
        let content = fileMatch[2].trim();
        // Robustly strip leading code fences
        content = content.replace(/^\s*```[a-zA-Z0-9#\+]*\r?\n/, "");
        // Robustly strip trailing code fences
        content = content.replace(/```\s*$/, "");
        content = content.trim();
        files.push({ name: filePath, content });
    }
    return files;
};

/**
 * Build a system prompt for a specific generation unit type.
 * Differentiates MERN backend vs frontend units to avoid cross-contamination.
 */
const buildUnitSystemPrompt = (unit, isMern) => {
    const isMernBackend = isMern && (
        unit.type === "backend-foundation" ||
        unit.type === "backend-api"
    );
    const isMernFrontend = isMern && (
        unit.type === "frontend-shell" ||
        unit.type === "frontend-pages" ||
        unit.type === "frontend-components"
    );
    const isMernDoc = isMern && unit.type === "documentation";

    let scaffoldNote = "";
    if (isMernBackend) {
        scaffoldNote = `
SCAFFOLD FILES ALREADY EXIST (do not regenerate these):
- backend/package.json (already created with express, mongoose, jsonwebtoken, bcryptjs, dotenv, cors)
- backend/config/db.js (already created with mongoose connectDB function)
- backend/routes/healthRoutes.js (already created with GET /api/health endpoint)
- backend/.env.example (already created with PORT, MONGO_URI, JWT_SECRET)
- .gitignore (already created)

YOU MUST GENERATE THESE BACKEND FILES (they are NOT scaffold files):
- backend/server.js (Express server entry, requires app.js and starts listening)
- backend/app.js (Express app configuration with middleware and route mounting)
- backend/models/*.js (Mongoose schemas)
- backend/controllers/*.js (Route handler functions)
- backend/routes/authRoutes.js and other route files
- backend/middleware/authMiddleware.js
- backend/middleware/errorMiddleware.js
- backend/utils/generateToken.js`;
    } else if (isMernFrontend) {
        scaffoldNote = `
SCAFFOLD FILES ALREADY EXIST (do not regenerate these):
- frontend/package.json (already created with react, react-dom, react-router-dom, axios, react-icons, tailwindcss)
- frontend/vite.config.js (already created with Vite + proxy to backend :5000)
- frontend/tailwind.config.js (already created)
- frontend/postcss.config.js (already created)
- frontend/index.html (already created with <div id="root"> and src/main.jsx script)
- frontend/.env.example (already created with VITE_API_URL)

YOU MUST GENERATE THESE FRONTEND FILES (they are NOT scaffold files):
- frontend/src/main.jsx
- frontend/src/App.jsx
- frontend/src/index.css
- frontend/src/context/*.jsx
- frontend/src/hooks/*.js
- frontend/src/services/*.js
- frontend/src/pages/*.jsx
- frontend/src/components/**/*.jsx`;
    } else if (isMernDoc) {
        scaffoldNote = `
Generate documentation and any missing configuration files.
All scaffold files are already created. Generate only:
- README.md (comprehensive project documentation at root level)`;
    } else {
        // Non-MERN: original behavior
        scaffoldNote = `
Do not generate, output, or mention the configuration and scaffold files that are already created locally. These include: package.json, vite.config.js, tailwind.config.js, postcss.config.js, index.html, and README.md. Only generate the files under the 'src/' directory (such as src/main.jsx, src/App.jsx, src/index.css, src/components/*, src/pages/*).`;
    }

    return `You are an expert AI software engineer. Generate implementation files matching the approved contracts and spec.
Rules:
1. Provide only the file paths and complete code files requested.
2. Never output verbose explanations, markdown commentary, or design footnotes.
3. You must strictly only import relative/local modules that correspond to paths in the SHARED CONTRACTS folderStructure. Never introduce new relative imports that are not declared in the contracts folderStructure.
4. The files block must be enclosed exactly within:
--- START_FILES ---

For each file, use this exact separator structure (including the dashes):
--- FILE: path/to/filename ---
\`\`\`language
// Complete file content here
\`\`\`
--- END_FILE ---

5. For UI icons in React: prefer react-icons (e.g., import { FaGithub } from 'react-icons/fa'). Only use lucide-react if react-icons is not available.
6. NEVER use '<{variable}' JSX syntax. Dynamic components MUST be assigned to a PascalCase variable first: const Icon = props.icon; return <Icon />; — using <{props.icon} /> is a fatal build error.
7. Write complete, production-quality code. No TODOs, no placeholders, no stub implementations.
${scaffoldNote}
--- END_FILES ---`;
};

const generateUnitCode = async (unit, projectSpec, contracts, options = {}) => {
    const isMern = contracts.isMern || false;
    const systemPrompt = buildUnitSystemPrompt(unit, isMern);

    const userPrompt = `PROJECT SPEC:
- Project Name: ${projectSpec.projectName}
- Project Type: ${projectSpec.projectType}
- Frontend: ${projectSpec.frontend}
- Backend: ${projectSpec.backend}
- Database: ${projectSpec.database}
- Authentication: ${projectSpec.authentication || "None"}
- Design: ${projectSpec.designRequirements || "Tailwind CSS"}

SHARED CONTRACTS:
${JSON.stringify(contracts, null, 2)}

GENERATION TARGET:
- Unit ID: ${unit.id}
- Unit Type: ${unit.type || "general"}
- Goal: ${unit.description}
- Metadata: ${JSON.stringify(unit.meta || {})}

CRITICAL REQUIREMENTS:
1. Write COMPLETE, WORKING code for every file — no stubs, no placeholders, no TODOs.
2. All local imports must resolve to paths declared in SHARED CONTRACTS folderStructure.
3. Use realistic, professional portfolio data (not "Lorem ipsum" or "placeholder").
4. For the portfolio: the developer is a skilled Full-Stack JavaScript Developer with experience in React, Node.js, MongoDB, and related technologies.
5. All API calls in the frontend must use relative paths (e.g., '/api/health') since Vite proxies to the backend.
6. Backend must use proper async/await with error handling.
7. All React components must be visually professional with Tailwind CSS dark theme styling.

Generate the complete implementation files for Unit: ${unit.id}`;

    return await executeAiRequest(systemPrompt, userPrompt, {
        ...options,
        unitId: unit.id,
        tokenBudget: unit.estimatedTokens || 2000
    });
};

module.exports = { executeAiRequest, generateUnitCode, parseGeneratedFiles, calculateAdaptiveTimeout };
