"use strict";

const { isRuntimeConfig, createRuntimeConfig } = require("./runtimeConfig");
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

    const runtimeMode = this.config.runtimeMode;
    const ALLOWED_MODES = new Set(["LEGACY", "MODULAR", "SHADOW"]);
    if (!ALLOWED_MODES.has(runtimeMode)) {
        const err = new Error(`Unsupported runtime mode: '${runtimeMode}'`);
        err.code = executionRuntimeAdapterErrorCodes.EXECUTION_RUNTIME_UNSUPPORTED_MODE;
        throw err;
    }

    // Phase 11A-2: Always execute legacy orchestrator.
    const legacyOrchestrator = require("../../services/generationOrchestrator");

    try {
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

        const response = {
            success: true,
            runtime: "LEGACY", // Hardcoded target for Phase 11A-2
            result: {
                files: legacyResult.files,
                runInstructions: legacyResult.runInstructions,
                summary: legacyResult.summary,
                model: legacyResult.model,
                projectSpec: legacyResult.projectSpec
            },
            metadata: {
                requirementIdentity: legacyResult.requirementIdentity
            }
        };

        return deepFreezeExecutionResponse(response);
    } catch (err) {
        const execErr = new Error(`Legacy execution failed: ${err.message}`);
        execErr.code = executionRuntimeAdapterErrorCodes.EXECUTION_RUNTIME_EXECUTION_FAILED;
        execErr.originalError = err;
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

    return {
        config: finalConfig,
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
