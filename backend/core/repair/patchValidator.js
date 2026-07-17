"use strict";

const { patchErrorCodes } = require("./patchErrors");

const CANONICAL_FIELDS = new Set([
    "id",
    "repairId",
    "executionId",
    "taskId",
    "strategy",
    "status",
    "operations",
    "affectedFiles",
    "metadata"
]);

const ALLOWED_STRATEGIES = new Set([
    "AI",
    "DETERMINISTIC",
    "AST",
    "MANUAL"
]);

const ALLOWED_STATUSES = new Set([
    "PENDING",
    "READY",
    "APPLIED",
    "REJECTED",
    "FAILED"
]);

const ALLOWED_OP_TYPES = new Set([
    "CREATE_FILE",
    "UPDATE_FILE",
    "DELETE_FILE",
    "RENAME_FILE"
]);

/**
 * Validates a Patch configuration object or instantiated model.
 *
 * @param {Object} patch The patch object to validate
 * @returns {Object} Validation outcome
 */
function validatePatch(patch) {
    if (patch === null || patch === undefined || typeof patch !== "object" || Array.isArray(patch)) {
        return {
            success: false,
            errors: [{
                code: patchErrorCodes.PATCH_INVALID_INPUT,
                path: "",
                message: "Patch must be a non-null object."
            }]
        };
    }

    const errors = [];

    // 1. Check unknown properties
    for (const key of Object.keys(patch)) {
        if (!CANONICAL_FIELDS.has(key)) {
            errors.push({
                code: patchErrorCodes.PATCH_UNKNOWN_PROPERTY,
                path: key,
                message: `Unknown property key: '${key}'`
            });
        }
    }

    // 2. Validate id
    if (!patch.hasOwnProperty("id") || typeof patch.id !== "string" || patch.id.trim() === "") {
        errors.push({
            code: patchErrorCodes.PATCH_INVALID_STRUCTURE,
            path: "id",
            message: "Property 'id' is required and must be a non-empty string."
        });
    }

    // 3. Validate repairId
    if (!patch.hasOwnProperty("repairId") || typeof patch.repairId !== "string" || patch.repairId.trim() === "") {
        errors.push({
            code: patchErrorCodes.PATCH_INVALID_STRUCTURE,
            path: "repairId",
            message: "Property 'repairId' is required and must be a non-empty string."
        });
    }

    // 4. Validate executionId
    if (!patch.hasOwnProperty("executionId") || typeof patch.executionId !== "string" || patch.executionId.trim() === "") {
        errors.push({
            code: patchErrorCodes.PATCH_INVALID_STRUCTURE,
            path: "executionId",
            message: "Property 'executionId' is required and must be a non-empty string."
        });
    }

    // 5. Validate taskId
    if (!patch.hasOwnProperty("taskId") || typeof patch.taskId !== "string" || patch.taskId.trim() === "") {
        errors.push({
            code: patchErrorCodes.PATCH_INVALID_STRUCTURE,
            path: "taskId",
            message: "Property 'taskId' is required and must be a non-empty string."
        });
    }

    // 6. Validate strategy
    if (!patch.hasOwnProperty("strategy")) {
        errors.push({
            code: patchErrorCodes.PATCH_INVALID_STRUCTURE,
            path: "strategy",
            message: "Property 'strategy' is required."
        });
    } else if (!ALLOWED_STRATEGIES.has(patch.strategy)) {
        errors.push({
            code: patchErrorCodes.PATCH_INVALID_STRATEGY,
            path: "strategy",
            message: `Property 'strategy' must be one of: ${Array.from(ALLOWED_STRATEGIES).join(", ")}.`
        });
    }

    // 7. Validate status
    if (!patch.hasOwnProperty("status")) {
        errors.push({
            code: patchErrorCodes.PATCH_INVALID_STRUCTURE,
            path: "status",
            message: "Property 'status' is required."
        });
    } else if (!ALLOWED_STATUSES.has(patch.status)) {
        errors.push({
            code: patchErrorCodes.PATCH_INVALID_STATUS,
            path: "status",
            message: `Property 'status' must be one of: ${Array.from(ALLOWED_STATUSES).join(", ")}.`
        });
    }

    // 8. Validate affectedFiles
    if (!patch.hasOwnProperty("affectedFiles") || !Array.isArray(patch.affectedFiles)) {
        errors.push({
            code: patchErrorCodes.PATCH_INVALID_STRUCTURE,
            path: "affectedFiles",
            message: "Property 'affectedFiles' is required and must be an array."
        });
    } else {
        const seen = new Set();
        for (let i = 0; i < patch.affectedFiles.length; i++) {
            const f = patch.affectedFiles[i];
            if (typeof f !== "string" || f.trim() === "") {
                errors.push({
                    code: patchErrorCodes.PATCH_INVALID_STRUCTURE,
                    path: `affectedFiles[${i}]`,
                    message: "Affected file paths must be non-empty strings."
                });
            } else if (seen.has(f)) {
                errors.push({
                    code: patchErrorCodes.PATCH_DUPLICATE_FILE,
                    path: `affectedFiles[${i}]`,
                    message: `Duplicate affected file path found: '${f}'`
                });
            } else {
                seen.add(f);
            }
        }
    }

    // 9. Validate operations
    if (!patch.hasOwnProperty("operations") || !Array.isArray(patch.operations)) {
        errors.push({
            code: patchErrorCodes.PATCH_INVALID_STRUCTURE,
            path: "operations",
            message: "Property 'operations' is required and must be an array."
        });
    } else if (patch.operations.length === 0) {
        errors.push({
            code: patchErrorCodes.PATCH_INVALID_OPERATION,
            path: "operations",
            message: "Property 'operations' cannot be empty."
        });
    } else {
        for (let i = 0; i < patch.operations.length; i++) {
            const op = patch.operations[i];
            if (op === null || typeof op !== "object" || Array.isArray(op)) {
                errors.push({
                    code: patchErrorCodes.PATCH_INVALID_OPERATION,
                    path: `operations[${i}]`,
                    message: "Operation must be a non-null object."
                });
                continue;
            }

            // Check operation path
            if (!op.hasOwnProperty("path") || typeof op.path !== "string" || op.path.trim() === "") {
                errors.push({
                    code: patchErrorCodes.PATCH_INVALID_OPERATION,
                    path: `operations[${i}].path`,
                    message: "Operation property 'path' is required and must be a non-empty string."
                });
            }

            // Check operation type
            if (!op.hasOwnProperty("type")) {
                errors.push({
                    code: patchErrorCodes.PATCH_INVALID_OPERATION,
                    path: `operations[${i}].type`,
                    message: "Operation property 'type' is required."
                });
            } else if (!ALLOWED_OP_TYPES.has(op.type)) {
                errors.push({
                    code: patchErrorCodes.PATCH_INVALID_OPERATION,
                    path: `operations[${i}].type`,
                    message: `Operation type must be one of: ${Array.from(ALLOWED_OP_TYPES).join(", ")}.`
                });
            }

            // Check operation content
            if (op.type !== "DELETE_FILE" && (!op.hasOwnProperty("content") || typeof op.content !== "string")) {
                errors.push({
                    code: patchErrorCodes.PATCH_INVALID_OPERATION,
                    path: `operations[${i}].content`,
                    message: "Operation content must be a string."
                });
            }

            // Optional metadata in operation
            if (op.hasOwnProperty("metadata") && op.metadata !== null && (typeof op.metadata !== "object" || Array.isArray(op.metadata))) {
                errors.push({
                    code: patchErrorCodes.PATCH_INVALID_OPERATION,
                    path: `operations[${i}].metadata`,
                    message: "Operation property 'metadata' must be an object or null."
                });
            }
        }
    }

    // 10. Validate metadata (optional)
    if (patch.hasOwnProperty("metadata") && patch.metadata !== null && (typeof patch.metadata !== "object" || Array.isArray(patch.metadata))) {
        errors.push({
            code: patchErrorCodes.PATCH_INVALID_STRUCTURE,
            path: "metadata",
            message: "Property 'metadata' must be an object or null."
        });
    }

    return {
        success: errors.length === 0,
        errors
    };
}

module.exports = {
    validatePatch
};
