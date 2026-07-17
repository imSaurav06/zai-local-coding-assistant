"use strict";

const LEGACY_RUNTIME_ADAPTER_VERSION = "1.0";

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

/**
 * Executes execution request through the legacy runtime (orchestrator + checkpoints + repair).
 *
 * @param {Object} adapter Execution adapter instance
 * @param {Object} request Validated request structure
 */
async function executeLegacy(adapter, request) {
    const enableCheckpoint = adapter.config.enableCheckpointPersistence;
    let initialExecutionState = null;
    if (enableCheckpoint) {
        initialExecutionState = Object.freeze({
            version: "1.0",
            metadata: {
                status: "READY",
                executionId: `exec_${Date.now()}`,
                createdAt: new Date().toISOString()
            },
            queues: Object.freeze({
                pending: ["task_01"],
                running: [],
                completed: [],
                failed: []
            }),
            statistics: Object.freeze({
                totalTasks: 1,
                pending: 1,
                running: 0,
                completed: 0,
                failed: 0
            })
        });

        await adapter.checkpointBridge.initializeExecutionCheckpoint(initialExecutionState);
    }

    const legacyOrchestrator = require("../../services/generationOrchestrator");
    const originalPrompt = (request.metadata && request.metadata.originalPrompt) || "";
    const progressEmitter = request.options && request.options.progressEmitter;
    const checkCancellation = request.options && request.options.checkCancellation;
    const cancelSignal = request.options && request.options.cancelSignal;

    const legacyResult = await legacyOrchestrator.orchestrateGeneration(
        {
            originalPrompt,
            projectSpec: request.projectSpec
        },
        progressEmitter,
        checkCancellation,
        {
            cancelSignal
        }
    );

    if (enableCheckpoint) {
        const finalExecutionState = Object.freeze({
            version: "1.0",
            metadata: {
                status: "SUCCESS",
                executionId: initialExecutionState.metadata.executionId,
                createdAt: initialExecutionState.metadata.createdAt
            },
            queues: Object.freeze({
                pending: [],
                running: [],
                completed: ["task_01"],
                failed: []
            }),
            statistics: Object.freeze({
                totalTasks: 1,
                pending: 0,
                running: 0,
                completed: 1,
                failed: 0
            })
        });

        await adapter.checkpointBridge.finalizeExecutionCheckpoint(finalExecutionState);
    }

    const rawResult = {
        files: legacyResult.files,
        runInstructions: legacyResult.runInstructions,
        summary: legacyResult.summary,
        model: legacyResult.model,
        projectSpec: legacyResult.projectSpec
    };

    const verifyRepairRes = await adapter.verificationRepairBridge.verifyAndRepair(rawResult);

    const response = {
        success: verifyRepairRes.success,
        runtime: "LEGACY",
        result: verifyRepairRes.result,
        metadata: {
            requirementIdentity: legacyResult.requirementIdentity,
            verificationResult: verifyRepairRes.verificationResult,
            repaired: verifyRepairRes.repaired
        }
    };

    const { deepFreezeExecutionResponse } = require("./executionRuntimeAdapter");
    return deepFreezeExecutionResponse(response);
}

module.exports = {
    executeLegacy,
    LEGACY_RUNTIME_ADAPTER_VERSION
};
