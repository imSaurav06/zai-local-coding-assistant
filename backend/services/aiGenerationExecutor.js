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

        const isTransient = isRateLimit || isTimeout || isNetwork || isTransient5xx;

        // Check if we can retry — also enforce the overall deadline
        const totalRetryBudgetMax = 15000; // Max 15 seconds wait budget total
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
        
        const apiCall = () => {
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

            return providerRouter.sendChatCompletionDirect(provider, messages, config, options);
        };

        return await executeWithBackoff(apiCall, 2, 1000, options, stats);
    };

    try {
        const response = await runForProvider(primaryProvider);

        // BUG FIX: Validate content BEFORE logging success=true.
        // Previously success=true was logged here and then null-content could throw into catch.
        if (!response.content || typeof response.content !== "string" || response.content.trim().length === 0) {
            const nullContentErr = new Error(`Provider returned empty or null content. Model may have hit a context or content-policy limit.`);
            nullContentErr.isNullContent = true;
            throw nullContentErr;
        }

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

                // BUG FIX: Validate content BEFORE logging success=true for fallback path too.
                if (!response.content || typeof response.content !== "string" || response.content.trim().length === 0) {
                    throw new Error(`Fallback provider returned empty or null content. Model may have hit a context or content-policy limit.`);
                }

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
        content = content.replace(/^```\w*\r?\n/, "").replace(/```$/, "").trim();
        files.push({ name: filePath, content });
    }
    return files;
};

const generateUnitCode = async (unit, projectSpec, contracts, options = {}) => {
    const systemPrompt = `You are an expert AI software engineer. Generate implementation files matching the approved contracts and spec.
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

5. Strictly only use icons from 'lucide-react' (such as import { Heart, Activity } from 'lucide-react') for any UI icons. Do not import or use other icon libraries like @heroicons/react, react-icons, etc. to prevent compilation issues.
6. NEVER use '<{variable}' JSX syntax. Dynamic components MUST be assigned to a PascalCase variable first: const Icon = props.icon; return <Icon />; — using <{props.icon} /> is a fatal build error.
--- END_FILES ---`;

    const userPrompt = `PROJECT SPEC:
- Project Name: ${projectSpec.projectName}
- Project Type: ${projectSpec.projectType}
- Frontend: ${projectSpec.frontend}
- Backend: ${projectSpec.backend}
- Database: ${projectSpec.database}

SHARED CONTRACTS:
${JSON.stringify(contracts, null, 2)}

GENERATION TARGET:
- Module ID: ${unit.id}
- Goal: ${unit.description}
- Metadata: ${JSON.stringify(unit.meta || {})}

Generate the complete implementation file(s) for this target matching the shared contracts folder structure and interfaces.
Important guidelines:
1. Do not add mock styling, placeholders, or TODO comments. Write complete functional code.
2. In the root component (usually "src/App.jsx"), you MUST import and render all other pages and custom components listed in the folderStructure of the SHARED CONTRACTS to present a cohesive, complete application. Never import non-existent files or mock modules that are not declared in the folderStructure contract.
3. Do not generate, output, or mention the configuration and scaffold files that are already created locally. These include: package.json, vite.config.js, tailwind.config.js, postcss.config.js, index.html, and README.md. Only generate the files under the 'src/' directory (such as src/main.jsx, src/App.jsx, src/index.css, src/components/*, src/pages/*).`;

    return await executeAiRequest(systemPrompt, userPrompt, {
        ...options,
        unitId: unit.id,
        tokenBudget: unit.estimatedTokens || 2000
    });
};

module.exports = { executeAiRequest, generateUnitCode, parseGeneratedFiles, calculateAdaptiveTimeout };
