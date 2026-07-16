"use strict";

const { checkpointErrorCodes } = require("./checkpointErrors");

/**
 * Deep freezes an object recursively.
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
 * Creates the deterministic resume state from a validated checkpoint.
 * 
 * @param {Object} checkpoint The checkpoint to load state from
 */
function createResumeState(checkpoint) {
    try {
        // 1. Validation of checkpoint input
        if (checkpoint === null || checkpoint === undefined || typeof checkpoint !== "object") {
            return deepFreeze({
                success: false,
                resumeState: null,
                errors: [{
                    code: checkpointErrorCodes.RESUME_INVALID_INPUT,
                    path: "",
                    message: "Checkpoint input must be a non-null object."
                }]
            });
        }

        // 2. Validate structural checkpoint properties
        const requiredCheckpointFields = ["version", "metadata", "planner", "executionState"];
        for (const field of requiredCheckpointFields) {
            if (!checkpoint.hasOwnProperty(field)) {
                return deepFreeze({
                    success: false,
                    resumeState: null,
                    errors: [{
                        code: checkpointErrorCodes.RESUME_INVALID_CHECKPOINT,
                        path: field,
                        message: `Checkpoint is missing required field: '${field}'`
                    }]
                });
            }
        }

        const metadata = checkpoint.metadata;
        if (metadata === null || typeof metadata !== "object") {
            return deepFreeze({
                success: false,
                resumeState: null,
                errors: [{
                    code: checkpointErrorCodes.RESUME_INVALID_CHECKPOINT,
                    path: "metadata",
                    message: "Checkpoint metadata must be a non-null object."
                }]
            });
        }

        const requiredMetadataFields = ["checkpointVersion", "plannerVersion", "graphVersion", "identityVersion", "createdBy"];
        for (const field of requiredMetadataFields) {
            if (!metadata.hasOwnProperty(field)) {
                return deepFreeze({
                    success: false,
                    resumeState: null,
                    errors: [{
                        code: checkpointErrorCodes.RESUME_INVALID_CHECKPOINT,
                        path: `metadata.${field}`,
                        message: `Checkpoint metadata is missing required field: '${field}'`
                    }]
                });
            }
        }

        const executionState = checkpoint.executionState;
        if (executionState === null || typeof executionState !== "object") {
            return deepFreeze({
                success: false,
                resumeState: null,
                errors: [{
                    code: checkpointErrorCodes.RESUME_INVALID_CHECKPOINT,
                    path: "executionState",
                    message: "Checkpoint executionState must be a non-null object."
                }]
            });
        }

        const requiredStateLists = ["completedTasks", "pendingTasks", "failedTasks", "runningTasks"];
        for (const listName of requiredStateLists) {
            if (!executionState.hasOwnProperty(listName) || !Array.isArray(executionState[listName])) {
                return deepFreeze({
                    success: false,
                    resumeState: null,
                    errors: [{
                        code: checkpointErrorCodes.RESUME_INVALID_CHECKPOINT,
                        path: `executionState.${listName}`,
                        message: `Checkpoint executionState is missing list or is not an array: '${listName}'`
                    }]
                });
            }
        }

        // 3. Construct resumeState (strictly deep cloned and frozen)
        const resumeState = {
            version: "1.0",
            metadata: {
                checkpointVersion: metadata.checkpointVersion,
                plannerVersion: metadata.plannerVersion,
                graphVersion: metadata.graphVersion,
                identityVersion: metadata.identityVersion,
                createdBy: metadata.createdBy
            },
            completedTasks: [...executionState.completedTasks],
            pendingTasks: [...executionState.pendingTasks],
            failedTasks: [...executionState.failedTasks],
            runningTasks: [...executionState.runningTasks]
        };

        return deepFreeze({
            success: true,
            resumeState,
            errors: []
        });

    } catch (err) {
        return deepFreeze({
            success: false,
            resumeState: null,
            errors: [{
                code: checkpointErrorCodes.RESUME_INTERNAL_ERROR,
                path: "",
                message: `Unexpected internal error during resume state derivation: ${err.message}`
            }]
        });
    }
}

module.exports = {
    createResumeState
};
