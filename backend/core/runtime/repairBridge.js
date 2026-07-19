"use strict";

const { repair } = require("../repair/repairEngine");
const { createVerificationBridge } = require("./verificationBridge");
const { repairErrorCodes } = require("../repair/repairErrors");
const { validateRepairSession, deepFreezeRepairSession } = require("../repair/repairSession");

const REPAIR_BRIDGE_VERSION = "1.0";

/**
 * Deep freezes an object recursively to guarantee strict immutability.
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

function createRepairBridge(config = {}) {
    if (config === null || typeof config !== "object") {
        const err = new Error("Invalid configuration object.");
        err.code = "REPAIR_SESSION_INVALID";
        throw err;
    }

    const enableRepair = !!config.enableRepair;
    const maxRepairAttempts = typeof config.maxRepairAttempts === "number" ? config.maxRepairAttempts : 2;
    const verificationEngine = config.verificationEngine || null;

    const bridge = {
        config: Object.freeze({
            enableRepair,
            maxRepairAttempts
        }),

        async repairResult(verifiedResult, options = {}) {
            if (!enableRepair) {
                return verifiedResult;
            }

            // Input Validation checks
            if (!verifiedResult || typeof verifiedResult !== "object") {
                const err = new Error("VerifiedResult must be a non-null object.");
                err.code = "REPAIR_SESSION_INVALID";
                throw err;
            }

            if (!verifiedResult.verificationReport || typeof verifiedResult.verificationReport !== "object") {
                const err = new Error("Invalid VerificationReport: report is missing or malformed.");
                err.code = "REPAIR_RESULT_INVALID";
                throw err;
            }

            if (verifiedResult.success) {
                return verifiedResult;
            }

            // Max attempts check
            if (maxRepairAttempts <= 0) {
                const err = new Error("Max repair attempts reached.");
                err.code = "REPAIR_MAX_ATTEMPTS_EXCEEDED";
                throw err;
            }

            const metricsCollector = options.metricsCollector;
            const projectSpec = options.projectSpec || {};
            const { buildSharedContracts } = require("../../services/contractBuilder");
            const contracts = buildSharedContracts(projectSpec);

            // Extract initial files
            let files = [];
            if (verifiedResult.files) {
                files = verifiedResult.files;
            } else if (verifiedResult.execution && verifiedResult.execution.vfsState && Array.isArray(verifiedResult.execution.vfsState.files)) {
                files = verifiedResult.execution.vfsState.files;
            }

            const executionId = verifiedResult.executionId || options.executionId || `exec_${Date.now()}`;
            const startTime = Date.now();
            let attemptNumber = 0;
            let currentFiles = files;
            let currentVerifiedResult = verifiedResult;
            const verificationHistory = [];
            const repairedFilesSet = new Set();

            const verificationBridge = createVerificationBridge({
                enableVerification: true,
                verificationEngine
            });

            // Start the repair loop
            while (attemptNumber < maxRepairAttempts && !currentVerifiedResult.success) {
                // Check if attempts exceeded before running the next attempt
                if (attemptNumber >= maxRepairAttempts) {
                    const err = new Error("Exceeded repair attempts limit.");
                    err.code = "REPAIR_MAX_ATTEMPTS_EXCEEDED";
                    throw err;
                }

                attemptNumber++;
                if (metricsCollector && typeof metricsCollector.recordRepairAttempt === "function") {
                    metricsCollector.recordRepairAttempt();
                }

                // Identify target files for this pass
                const targetFiles = new Set();
                const errors = currentVerifiedResult.verificationReport.errors || [];
                errors.forEach(err => {
                    if (err && err.path) {
                        targetFiles.add(err.path);
                    }
                });

                if (targetFiles.size === 0) {
                    const { mapErrorsToFiles } = require("../../services/targetedRepairService");
                    const mapped = mapErrorsToFiles(errors, currentFiles);
                    mapped.forEach(f => targetFiles.add(f));
                }

                // 1. Repair files
                let repairOutput;
                try {
                    repairOutput = await repair(
                        currentFiles,
                        currentVerifiedResult.verificationReport,
                        projectSpec,
                        contracts,
                        options
                    );
                } catch (err) {
                    const error = new Error(`Repair engine failed: ${err.message}`);
                    error.code = "REPAIR_ENGINE_FAILED";
                    error.originalError = err;
                    throw error;
                }

                if (!repairOutput || !repairOutput.success || !repairOutput.files) {
                    const err = new Error("Repair engine failed to generate files.");
                    err.code = "REPAIR_ENGINE_FAILED";
                    throw err;
                }

                // Validate that ONLY targeted files were modified
                for (const f of repairOutput.files) {
                    const original = currentFiles.find(o => o.name === f.name);
                    if (original && original.content !== f.content) {
                        if (!targetFiles.has(f.name)) {
                            const err = new Error(`Repair modified unrelated file: '${f.name}'`);
                            err.code = "REPAIR_RESULT_INVALID";
                            throw err;
                        }
                    }
                }

                // Identify changed files
                const changedFiles = [];
                repairOutput.files.forEach(f => {
                    const original = currentFiles.find(o => o.name === f.name);
                    if (!original || original.content !== f.content) {
                        changedFiles.push(f.name);
                        repairedFilesSet.add(f.name);
                    }
                });

                currentFiles = repairOutput.files;

                // 2. Re-verify the repaired files
                const mockExecutionResult = {
                    ...currentVerifiedResult,
                    success: true, // Reset to true so verificationBridge can toggle to false on failure
                    files: currentFiles,
                    verification: null // Force re-run verification
                };

                const nextVerifiedResult = await verificationBridge.verifyResult(mockExecutionResult, options);

                // Add to history
                verificationHistory.push({
                    attemptNumber,
                    files: currentFiles,
                    changedFiles,
                    verificationReport: nextVerifiedResult.verificationReport
                });

                currentVerifiedResult = nextVerifiedResult;
            }

            const isSuccess = currentVerifiedResult.verificationReport && currentVerifiedResult.verificationReport.status === "PASSED";
            if (isSuccess && metricsCollector && typeof metricsCollector.recordRepairSuccess === "function") {
                metricsCollector.recordRepairSuccess();
            }
            const endTime = Date.now();

            // Create initial raw session object for validation
            const { createRepairRequest } = require("../repair/repairModel");
            const dummyReqRes = createRepairRequest({
                id: `rep_${Date.now()}`,
                executionId,
                taskId: "task_repair",
                type: "VERIFICATION",
                severity: "HIGH",
                status: "PENDING",
                reason: verifiedResult.verificationReport.summary || "Verification failed",
                affectedFiles: Array.from(repairedFilesSet),
                metadata: {}
            });

            if (!dummyReqRes.success) {
                const err = new Error("Failed to construct RepairRequest for session.");
                err.code = "REPAIR_SESSION_INVALID";
                throw err;
            }

            // Map attempt history to session history items
            const { createRepairPlan } = require("../repair/repairPlanner");
            const { createPatch } = require("../repair/patchModel");
            const { createVerificationAdapter } = require("../repair/verificationAdapter");

            const mappedHistory = verificationHistory.map(h => {
                const repairPlanRes = createRepairPlan(dummyReqRes.repairRequest);
                const filesToPatch = h.changedFiles.length > 0 ? h.changedFiles : (files.length > 0 ? [files[0].name] : ["src/App.jsx"]);
                const patchRes = createPatch({
                    id: `patch_pass_${h.attemptNumber}`,
                    repairId: dummyReqRes.repairRequest.id,
                    executionId,
                    taskId: "task_repair",
                    strategy: "AI",
                    status: "APPLIED",
                    operations: filesToPatch.map(path => ({
                        type: "UPDATE_FILE",
                        path,
                        content: (currentFiles.find(f => f.name === path) || { content: "" }).content
                    })),
                    affectedFiles: filesToPatch
                });

                const adapter = createVerificationAdapter();
                const { deepFreezeVerificationResult } = require("../repair/verificationAdapter");
                const verificationResult = deepFreezeVerificationResult({
                    success: h.verificationReport.status === "PASSED",
                    patchId: patchRes.patch.id,
                    status: h.verificationReport.status === "PASSED" ? "PASSED" : "FAILED",
                    issues: h.verificationReport.errors.map(e => ({
                        path: e.path || "",
                        message: e.message || String(e),
                        severity: e.severity || "HIGH",
                        category: e.category || "SYNTAX"
                    })),
                    summary: h.verificationReport.summary || (h.verificationReport.status === "PASSED" ? "Passed" : "Failed"),
                    metadata: {}
                });

                return {
                    attemptNumber: h.attemptNumber,
                    repairPlan: repairPlanRes.repairPlan,
                    patch: patchRes.patch,
                    verificationResult,
                    durationMs: 0
                };
            });

            const session = {
                executionId,
                attemptNumber,
                repairedFiles: Array.from(repairedFilesSet),
                verificationHistory,
                startTime,
                endTime,
                // Backward compatibility fields
                repairRequest: dummyReqRes.repairRequest,
                attempts: attemptNumber,
                history: mappedHistory,
                finalPatch: mappedHistory.length > 0 ? mappedHistory[mappedHistory.length - 1].patch : null,
                finalVerification: mappedHistory.length > 0 ? mappedHistory[mappedHistory.length - 1].verificationResult : null,
                status: isSuccess ? "SUCCESS" : "FAILED",
                metadata: {}
            };

            // Validate session using the domain validator to detect session corruption
            const val = validateRepairSession(session);
            if (!val.success) {
                const err = new Error(`Repair session validation failed: ${val.errors[0].message}`);
                err.code = "REPAIR_SESSION_INVALID";
                err.errors = val.errors;
                throw err;
            }

            const frozenSession = deepFreezeRepairSession(session);

            const finalResult = {
                ...currentVerifiedResult,
                success: isSuccess,
                files: currentFiles,
                repairSession: frozenSession
            };

            return deepFreeze(finalResult);
        }
    };

    return Object.freeze(bridge);
}

module.exports = {
    createRepairBridge,
    REPAIR_BRIDGE_VERSION,
    repairErrorCodes
};
