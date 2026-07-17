"use strict";

const { repairErrorCodes } = require("./repairErrors");

const CANONICAL_FIELDS = new Set([
    "id",
    "executionId",
    "taskId",
    "type",
    "severity",
    "status",
    "reason",
    "diagnostics",
    "affectedFiles",
    "metadata"
]);

const ALLOWED_TYPES = new Set([
    "SYNTAX",
    "COMPILATION",
    "RUNTIME",
    "VERIFICATION",
    "DEPENDENCY",
    "CONFIGURATION"
]);

const ALLOWED_SEVERITIES = new Set([
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL"
]);

const ALLOWED_STATUSES = new Set([
    "PENDING",
    "ANALYZING",
    "READY",
    "REPAIRED",
    "FAILED"
]);

/**
 * Validates a RepairRequest configuration object or instantiated model.
 *
 * @param {Object} repair The repair request object to validate
 * @returns {Object} Validation outcome
 */
function validateRepairRequest(repair) {
    if (repair === null || repair === undefined || typeof repair !== "object" || Array.isArray(repair)) {
        return {
            success: false,
            errors: [{
                code: repairErrorCodes.REPAIR_INVALID_INPUT,
                path: "",
                message: "Repair request must be a non-null object."
            }]
        };
    }

    const errors = [];

    // 1. Check for unknown properties
    for (const key of Object.keys(repair)) {
        if (!CANONICAL_FIELDS.has(key)) {
            errors.push({
                code: repairErrorCodes.REPAIR_UNKNOWN_PROPERTY,
                path: key,
                message: `Unknown property key: '${key}'`
            });
        }
    }

    // 2. Validate id
    if (!repair.hasOwnProperty("id") || typeof repair.id !== "string" || repair.id.trim() === "") {
        errors.push({
            code: repairErrorCodes.REPAIR_INVALID_STRUCTURE,
            path: "id",
            message: "Property 'id' is required and must be a non-empty string."
        });
    }

    // 3. Validate executionId
    if (!repair.hasOwnProperty("executionId") || typeof repair.executionId !== "string" || repair.executionId.trim() === "") {
        errors.push({
            code: repairErrorCodes.REPAIR_INVALID_STRUCTURE,
            path: "executionId",
            message: "Property 'executionId' is required and must be a non-empty string."
        });
    }

    // 4. Validate taskId
    if (!repair.hasOwnProperty("taskId") || typeof repair.taskId !== "string" || repair.taskId.trim() === "") {
        errors.push({
            code: repairErrorCodes.REPAIR_INVALID_STRUCTURE,
            path: "taskId",
            message: "Property 'taskId' is required and must be a non-empty string."
        });
    }

    // 5. Validate type
    if (!repair.hasOwnProperty("type")) {
        errors.push({
            code: repairErrorCodes.REPAIR_INVALID_STRUCTURE,
            path: "type",
            message: "Property 'type' is required."
        });
    } else if (!ALLOWED_TYPES.has(repair.type)) {
        errors.push({
            code: repairErrorCodes.REPAIR_INVALID_TYPE,
            path: "type",
            message: `Property 'type' must be one of: ${Array.from(ALLOWED_TYPES).join(", ")}.`
        });
    }

    // 6. Validate severity
    if (!repair.hasOwnProperty("severity")) {
        errors.push({
            code: repairErrorCodes.REPAIR_INVALID_STRUCTURE,
            path: "severity",
            message: "Property 'severity' is required."
        });
    } else if (!ALLOWED_SEVERITIES.has(repair.severity)) {
        errors.push({
            code: repairErrorCodes.REPAIR_INVALID_SEVERITY,
            path: "severity",
            message: `Property 'severity' must be one of: ${Array.from(ALLOWED_SEVERITIES).join(", ")}.`
        });
    }

    // 7. Validate status
    if (!repair.hasOwnProperty("status")) {
        errors.push({
            code: repairErrorCodes.REPAIR_INVALID_STRUCTURE,
            path: "status",
            message: "Property 'status' is required."
        });
    } else if (!ALLOWED_STATUSES.has(repair.status)) {
        errors.push({
            code: repairErrorCodes.REPAIR_INVALID_STATUS,
            path: "status",
            message: `Property 'status' must be one of: ${Array.from(ALLOWED_STATUSES).join(", ")}.`
        });
    }

    // 8. Validate reason
    if (!repair.hasOwnProperty("reason") || typeof repair.reason !== "string" || repair.reason.trim() === "") {
        errors.push({
            code: repairErrorCodes.REPAIR_INVALID_STRUCTURE,
            path: "reason",
            message: "Property 'reason' is required and must be a non-empty string."
        });
    }

    // 9. Validate diagnostics
    if (repair.hasOwnProperty("diagnostics") && repair.diagnostics !== null && typeof repair.diagnostics !== "string" && typeof repair.diagnostics !== "object") {
        errors.push({
            code: repairErrorCodes.REPAIR_INVALID_STRUCTURE,
            path: "diagnostics",
            message: "Property 'diagnostics' must be a string, object or null."
        });
    }

    // 10. Validate affectedFiles
    if (!repair.hasOwnProperty("affectedFiles") || !Array.isArray(repair.affectedFiles)) {
        errors.push({
            code: repairErrorCodes.REPAIR_INVALID_STRUCTURE,
            path: "affectedFiles",
            message: "Property 'affectedFiles' is required and must be an array."
        });
    } else {
        const seen = new Set();
        for (let i = 0; i < repair.affectedFiles.length; i++) {
            const f = repair.affectedFiles[i];
            if (typeof f !== "string" || f.trim() === "") {
                errors.push({
                    code: repairErrorCodes.REPAIR_INVALID_STRUCTURE,
                    path: `affectedFiles[${i}]`,
                    message: "Affected file paths must be non-empty strings."
                });
            } else if (seen.has(f)) {
                errors.push({
                    code: repairErrorCodes.REPAIR_DUPLICATE_FILE,
                    path: `affectedFiles[${i}]`,
                    message: `Duplicate affected file path found: '${f}'`
                });
            } else {
                seen.add(f);
            }
        }
    }

    // 11. Validate metadata (optional)
    if (repair.hasOwnProperty("metadata") && repair.metadata !== null && (typeof repair.metadata !== "object" || Array.isArray(repair.metadata))) {
        errors.push({
            code: repairErrorCodes.REPAIR_INVALID_STRUCTURE,
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
    validateRepairRequest
};
