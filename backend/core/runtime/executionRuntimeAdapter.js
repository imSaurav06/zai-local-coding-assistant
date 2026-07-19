"use strict";

const { isRuntimeConfig, createRuntimeConfig } = require("./runtimeConfig");
const { createCheckpointBridge } = require("./checkpointBridge");
const { createVerificationRepairBridge } = require("./verificationRepairBridge");
const { createWorkerPool } = require("./workerPool");
const { executionRuntimeAdapterErrorCodes } = require("./executionRuntimeAdapterErrors");

const EXECUTION_RUNTIME_ADAPTER_VERSION = "1.0";

const CANONICAL_REQUEST_KEYS = new Set(["projectSpec", "options", "metadata"]);

/**
 * Deep freezes an execution request object recursively.
 *
 * @param {Object} obj The object to freeze
 */
function deepFreezeExecutionRequest(obj) {
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
            deepFreezeExecutionRequest(obj[prop]);
        }
    });
    return obj;
}

/**
 * Deep freezes an execution response object recursively.
 *
 * @param {Object} obj The object to freeze
 */
function deepFreezeExecutionResponse(obj) {
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
            deepFreezeExecutionResponse(obj[prop]);
        }
    });
    return obj;
}

/**
 * Checks if the given object is an instantiated, valid, frozen execution request.
 *
 * @param {Object} obj The object to check
 */
function isExecutionRequest(obj) {
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
        return false;
    }
    if (!Object.isFrozen(obj)) {
        return false;
    }
    const val = validateExecutionRequest(obj);
    return val.success;
}

/**
 * Validates an execution request object schema.
 *
 * @param {Object} request Request context to validate
 */
function validateExecutionRequest(request) {
    if (request === null || request === undefined || typeof request !== "object" || Array.isArray(request)) {
        return {
            success: false,
            errors: [{
                code: executionRuntimeAdapterErrorCodes.EXECUTION_RUNTIME_INVALID_INPUT,
                path: "",
                message: "Execution request must be a non-null object."
            }]
        };
    }

    const errors = [];

    // 1. Unknown properties check
    for (const key of Object.keys(request)) {
        if (!CANONICAL_REQUEST_KEYS.has(key)) {
            errors.push({
                code: executionRuntimeAdapterErrorCodes.EXECUTION_RUNTIME_INVALID_REQUEST,
                path: key,
                message: `Unknown property key in request: '${key}'`
            });
        }
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    // 2. Required projectSpec check
    if (!request.hasOwnProperty("projectSpec")) {
        errors.push({
            code: executionRuntimeAdapterErrorCodes.EXECUTION_RUNTIME_INVALID_REQUEST,
            path: "projectSpec",
            message: "Property 'projectSpec' is required."
        });
        return { success: false, errors };
    }

    // 3. Validate projectSpec structure using core validator
    const { validateProjectSpec } = require("../projectSpec");
    const specVal = validateProjectSpec(request.projectSpec);
    if (!specVal.success) {
        errors.push({
            code: executionRuntimeAdapterErrorCodes.EXECUTION_RUNTIME_INVALID_REQUEST,
            path: "projectSpec",
            message: `Invalid ProjectSpec schema: ${specVal.errors[0].message}`
        });
    }

    // 4. Validate options type
    if (request.hasOwnProperty("options") && request.options !== null && (typeof request.options !== "object" || Array.isArray(request.options))) {
        errors.push({
            code: executionRuntimeAdapterErrorCodes.EXECUTION_RUNTIME_INVALID_REQUEST,
            path: "options",
            message: "Property 'options' must be a non-null object or null."
        });
    }

    // 5. Validate metadata type
    if (request.hasOwnProperty("metadata") && request.metadata !== null && (typeof request.metadata !== "object" || Array.isArray(request.metadata))) {
        errors.push({
            code: executionRuntimeAdapterErrorCodes.EXECUTION_RUNTIME_INVALID_REQUEST,
            path: "metadata",
            message: "Property 'metadata' must be a non-null object or null."
        });
    }

    return {
        success: errors.length === 0,
        errors
    };
}

/**
 * Execution method implementing the routing adapters.
 * Regardless of mode, Phase 11A-2 strictly routes to LEGACY runtime.
 *
 * @param {Object} request Mapped ExecutionRequest
 */
async function execute(request) {
    const val = validateExecutionRequest(request);
    if (!val.success) {
        const err = new Error(`Invalid execution request: ${val.errors[0].message}`);
        err.code = executionRuntimeAdapterErrorCodes.EXECUTION_RUNTIME_INVALID_REQUEST;
        err.originalErrors = val.errors;
        throw err;
    }

    try {
        const selectedAdapter = this.runtimeRouter.selectRuntime();
        if (!selectedAdapter || typeof selectedAdapter.execute !== "function") {
            const err = new Error("Unknown adapter implementation.");
            err.code = "RUNTIME_ROUTER_UNKNOWN_ADAPTER";
            throw err;
        }

        const rawResult = await selectedAdapter.execute(request);

        const isResponseShape = rawResult && typeof rawResult === "object" && rawResult.hasOwnProperty("runtime");
        const generationResult = isResponseShape ? rawResult.result : rawResult;

        const initialExecutionState = Object.freeze({
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

        await this.checkpointBridge.initializeExecutionCheckpoint(initialExecutionState);

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

        await this.checkpointBridge.finalizeExecutionCheckpoint(finalExecutionState);

        const verifyRepairRes = await this.verificationRepairBridge.verifyAndRepair(generationResult);

        const reqIdentity = isResponseShape
            ? (rawResult.metadata && rawResult.metadata.requirementIdentity) || (rawResult.result && rawResult.result.requirementIdentity)
            : rawResult.requirementIdentity;

        const response = {
            success: verifyRepairRes.success,
            runtime: isResponseShape
                ? rawResult.runtime
                : (this.config.runtimeMode === "SHADOW" ? "LEGACY" : this.config.runtimeMode),
            result: verifyRepairRes.result,
            metadata: {
                requirementIdentity: reqIdentity,
                verificationResult: verifyRepairRes.verificationResult,
                repaired: verifyRepairRes.repaired
            }
        };

        const frozenResponse = deepFreezeExecutionResponse(response);

        // Shadow execution if selected adapter is ShadowRuntime
        if (this.config.runtimeMode === "SHADOW" && typeof selectedAdapter.executeShadow === "function") {
            await selectedAdapter.executeShadow(this, request, frozenResponse);
        }

        return frozenResponse;
    } catch (err) {
        // Let standard adapter errors bubble directly
        const transparentErrorCodes = new Set([
            "VERIFICATION_REPAIR_INVALID_INPUT",
            "VERIFICATION_REPAIR_VERIFICATION_FAILED",
            "VERIFICATION_REPAIR_REPAIR_FAILED",
            "VERIFICATION_REPAIR_BRIDGE_FAILED",
            "RUNTIME_ROUTER_UNKNOWN_ADAPTER",
            "RUNTIME_ROUTER_INVALID_MODE",
            "RUNTIME_ROUTER_INVALID_REQUEST"
        ]);
        if (err.code && transparentErrorCodes.has(err.code)) {
            throw err;
        }

        const execErr = new Error(err.message);
        execErr.code = executionRuntimeAdapterErrorCodes.EXECUTION_RUNTIME_EXECUTION_FAILED;
        execErr.originalError = err.originalError || err;
        throw execErr;
    }
}

/**
 * Factory instantiating an Execution Runtime Adapter.
 *
 * @param {Object} [config] Configuration config overrides
 */
function createExecutionRuntimeAdapter(config = {}) {
    let finalConfig;
    if (isRuntimeConfig(config)) {
        finalConfig = config;
    } else {
        const buildRes = createRuntimeConfig(config);
        if (!buildRes.success) {
            const err = new Error(`Invalid config: ${buildRes.errors[0].message}`);
            err.code = executionRuntimeAdapterErrorCodes.EXECUTION_RUNTIME_INVALID_INPUT;
            throw err;
        }
        finalConfig = buildRes.runtimeConfig;
    }

    const checkpointBridge = createCheckpointBridge(finalConfig);
    const verificationRepairBridge = createVerificationRepairBridge(finalConfig);
    const workerPool = createWorkerPool(finalConfig);
    const { createRuntimeRouter } = require("./runtimeRouter");
    const runtimeRouter = createRuntimeRouter(finalConfig);

    return {
        config: finalConfig,
        checkpointBridge,
        verificationRepairBridge,
        workerPool,
        runtimeRouter,
        execute
    };
}

module.exports = {
    createExecutionRuntimeAdapter,
    validateExecutionRequest,
    isExecutionRequest,
    deepFreezeExecutionRequest,
    deepFreezeExecutionResponse,
    executionRuntimeAdapterErrorCodes,
    EXECUTION_RUNTIME_ADAPTER_VERSION
};
