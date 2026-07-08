const axios = require("axios");
const providerRouter = require("./aiProviders/providerRouter");

// Adaptive timeout calculator based on strategy and token budget
const calculateAdaptiveTimeout = (strategy, tokenBudget) => {
    let timeout = 60000; // Base 60s
    if (strategy === "DIRECT" || strategy === "SCAFFOLD_AI") {
        timeout = 60000 + (tokenBudget * 20); // 20ms per token
    } else {
        timeout = 30000 + (tokenBudget * 15); // 15ms per token
    }
    // Bound between 30s minimum and 180s maximum
    return Math.min(180000, Math.max(30000, timeout));
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

        // Check if we can retry
        const totalRetryBudgetMax = 15000; // Max 15 seconds wait budget total
        if (isTransient && retriesLeft > 0 && stats.retryWaitMs < totalRetryBudgetMax) {
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
        const isTimeout = code === "ECONNABORTED" || (primaryErr.message && primaryErr.message.toLowerCase().includes("timeout"));
        const isNetwork = ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(code);
        const isTransient5xx = status >= 500 && status <= 599;
        const isFallbackEligible = isRateLimit || isTimeout || isNetwork || isTransient5xx;

        if (isFallbackEligible && fallbackProvider && fallbackProvider !== primaryProvider) {
            console.warn(`[AI Failover] Primary provider ${primaryProvider} failed. Triggering fallback ${fallbackProvider}... Reason: ${primaryErr.message}`);
            stats.fallbackUsed = true;
            stats.providerAttempts = 2;
            stats.fallbackReason = primaryErr.message;
            
            try {
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
    const fileRegex = /--- FILE:\s*([^\s]+)\s*---[\s]+([\s\S]*?)[\s]*--- END_FILE ---/g;
    let fileMatch;
    while ((fileMatch = fileRegex.exec(resultContent)) !== null) {
        const filePath = fileMatch[1].trim();
        let content = fileMatch[2];
        content = content.replace(/^```\w*\r?\n/, "").replace(/\r?\n```$/, "");
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

Generate the complete implementation file(s) for this target matching the shared contracts folder structure and interfaces. Do not add mock styling or placeholders.`;

    return await executeAiRequest(systemPrompt, userPrompt, {
        ...options,
        unitId: unit.id,
        tokenBudget: unit.estimatedTokens || 2000
    });
};

module.exports = { executeAiRequest, generateUnitCode, parseGeneratedFiles, calculateAdaptiveTimeout };
