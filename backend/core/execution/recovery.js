"use strict";

const { recoveryErrorCodes } = require("./recoveryErrors");

const failureCategories = Object.freeze({
    RECOVERABLE: "RECOVERABLE",
    NON_RECOVERABLE: "NON_RECOVERABLE",
    VERIFICATION_FAILURE: "VERIFICATION_FAILURE",
    PROVIDER_FAILURE: "PROVIDER_FAILURE",
    WORKER_FAILURE: "WORKER_FAILURE",
    CHECKPOINT_FAILURE: "CHECKPOINT_FAILURE"
});

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
 * Validates the inputs to recoverExecution. Throws structured errors with specific codes if invalid.
 */
function validateInputs(executionState, checkpoint, pipelineResult) {
    // 1. Validate executionState
    if (
        executionState === null ||
        executionState === undefined ||
        typeof executionState !== "object" ||
        Array.isArray(executionState)
    ) {
        const err = new Error("Invalid executionState: must be a non-null object.");
        err.code = recoveryErrorCodes.RECOVERY_INVALID_INPUT;
        throw err;
    }
    if (!Object.isFrozen(executionState)) {
        const err = new Error("Invalid executionState: must be frozen.");
        err.code = recoveryErrorCodes.RECOVERY_INVALID_INPUT;
        throw err;
    }
    if (!executionState.queues || typeof executionState.queues !== "object" || Array.isArray(executionState.queues)) {
        const err = new Error("Invalid executionState: missing queues object.");
        err.code = recoveryErrorCodes.RECOVERY_INVALID_INPUT;
        throw err;
    }

    // 2. Validate checkpoint
    if (
        checkpoint === null ||
        checkpoint === undefined ||
        typeof checkpoint !== "object" ||
        Array.isArray(checkpoint)
    ) {
        const err = new Error("Invalid checkpoint: must be a non-null object.");
        err.code = recoveryErrorCodes.RECOVERY_INVALID_CHECKPOINT;
        throw err;
    }
    if (!Object.isFrozen(checkpoint)) {
        const err = new Error("Invalid checkpoint: must be frozen.");
        err.code = recoveryErrorCodes.RECOVERY_INVALID_CHECKPOINT;
        throw err;
    }
    if (!checkpoint.executionState || typeof checkpoint.executionState !== "object" || Array.isArray(checkpoint.executionState)) {
        const err = new Error("Invalid checkpoint: missing executionState object.");
        err.code = recoveryErrorCodes.RECOVERY_INVALID_CHECKPOINT;
        throw err;
    }

    // 3. Validate pipelineResult
    if (
        pipelineResult === null ||
        pipelineResult === undefined ||
        typeof pipelineResult !== "object" ||
        Array.isArray(pipelineResult)
    ) {
        const err = new Error("Invalid pipelineResult: must be a non-null object.");
        err.code = recoveryErrorCodes.RECOVERY_INVALID_PIPELINE;
        throw err;
    }
    if (!Object.isFrozen(pipelineResult)) {
        const err = new Error("Invalid pipelineResult: must be frozen.");
        err.code = recoveryErrorCodes.RECOVERY_INVALID_PIPELINE;
        throw err;
    }
    if (typeof pipelineResult.success !== "boolean") {
        const err = new Error("Invalid pipelineResult: success must be a boolean.");
        err.code = recoveryErrorCodes.RECOVERY_INVALID_PIPELINE;
        throw err;
    }
}

/**
 * Computes a new immutable recovery decision based on execution state, checkpoint, and pipeline result.
 *
 * @param {Object} executionState Current frozen executionState
 * @param {Object} checkpoint Current frozen checkpoint state
 * @param {Object} pipelineResult Current frozen pipeline execution result
 * @param {Object} options Options configuration
 */
function recoverExecution(executionState, checkpoint, pipelineResult, options = {}) {
    // 1. Validate inputs
    validateInputs(executionState, checkpoint, pipelineResult);

    const maxRetries = typeof options.maxRetries === "number" ? options.maxRetries : 3;

    // Checkpoint can track retryCount, otherwise option, defaulting to 0
    let currentRetryCount = 0;
    if (checkpoint.metadata && typeof checkpoint.metadata.retryCount === "number") {
        currentRetryCount = checkpoint.metadata.retryCount;
    } else if (typeof options.currentRetryCount === "number") {
        currentRetryCount = options.currentRetryCount;
    }

    // 2. Classify failures
    let failureCategory = null;
    let recoveryDecision = "CONTINUE";
    let checkpointAction = "NONE";
    let shouldRetry = false;
    let delay = 0;

    if (pipelineResult.success === true) {
        // Successful task execution milestone
        recoveryDecision = "CONTINUE";
        checkpointAction = "SAVE";
    } else {
        const error = pipelineResult.metadata && pipelineResult.metadata.error;
        const errCode = error && error.code;

        // Verify if error code is supported
        const supportedPipelineErrors = [
            "PIPELINE_CONTEXT_ERROR",
            "PIPELINE_PROVIDER_ERROR",
            "PIPELINE_VERIFICATION_ERROR"
        ];
        if (errCode && !supportedPipelineErrors.includes(errCode)) {
            const err = new Error(`Unsupported pipeline failure code: '${errCode}'`);
            err.code = recoveryErrorCodes.RECOVERY_UNSUPPORTED_FAILURE;
            throw err;
        }

        // Check if checkpoint is mismatching (state corruption)
        const checkpointCompleted = checkpoint.executionState.completedTasks || [];
        const stateCompleted = executionState.queues.completed || [];
        const completedMatch = checkpointCompleted.length === stateCompleted.length &&
            checkpointCompleted.every((id, idx) => id === stateCompleted[idx]);

        if (!completedMatch) {
            failureCategory = failureCategories.CHECKPOINT_FAILURE;
            recoveryDecision = "RESUME";
            checkpointAction = "RESTORE";
        } else if (errCode === "PIPELINE_CONTEXT_ERROR") {
            failureCategory = failureCategories.NON_RECOVERABLE;
            recoveryDecision = "ABORT";
            checkpointAction = "NONE";
        } else {
            // VERIFICATION_FAILURE, PROVIDER_FAILURE, or WORKER_FAILURE
            if (errCode === "PIPELINE_VERIFICATION_ERROR") {
                failureCategory = failureCategories.VERIFICATION_FAILURE;
            } else if (errCode === "PIPELINE_PROVIDER_ERROR") {
                failureCategory = failureCategories.PROVIDER_FAILURE;
            } else {
                failureCategory = failureCategories.WORKER_FAILURE;
            }

            if (currentRetryCount < maxRetries) {
                recoveryDecision = "RETRY";
                shouldRetry = true;
                currentRetryCount = currentRetryCount + 1;
                // Exponential backoff: 1s, 2s, 4s...
                delay = 1000 * Math.pow(2, currentRetryCount - 1);
                checkpointAction = "RESTORE"; // Restore clean state before retrying
            } else {
                recoveryDecision = "ABORT";
                checkpointAction = "NONE";
            }
        }
    }

    const result = {
        success: true,
        recoveryDecision,
        retryPlan: {
            shouldRetry,
            retryCount: currentRetryCount,
            delay
        },
        checkpointAction,
        metadata: {
            failureCategory,
            maxRetries,
            currentRetryCount
        }
    };

    return deepFreeze(result);
}

/**
 * Factory function creating a Recovery instance.
 */
function createRecovery() {
    return deepFreeze({
        recoverExecution
    });
}

module.exports = {
    createRecovery,
    recoverExecution,
    failureCategories
};
