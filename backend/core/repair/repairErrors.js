"use strict";

/**
 * Repair-specific error codes.
 *
 * All codes are deeply frozen and immutable.
 * These codes are returned in structured repair failure objects when
 * `repairSingleFile` cannot complete a repair successfully.
 */
const repairErrorCodes = Object.freeze({
    // Input validation failures
    REPAIR_INVALID_TARGET_FILE:    "REPAIR_INVALID_TARGET_FILE",
    REPAIR_INVALID_ERRORS:         "REPAIR_INVALID_ERRORS",
    REPAIR_INVALID_FILES:          "REPAIR_INVALID_FILES",
    REPAIR_INVALID_PROJECT_SPEC:   "REPAIR_INVALID_PROJECT_SPEC",
    REPAIR_INVALID_CONTRACTS:      "REPAIR_INVALID_CONTRACTS",

    // Execution failures
    REPAIR_AI_CALL_FAILED:         "REPAIR_AI_CALL_FAILED",
    REPAIR_PARSE_FAILED:           "REPAIR_PARSE_FAILED",
    REPAIR_SYNTAX_REGRESSION:      "REPAIR_SYNTAX_REGRESSION",
    REPAIR_TARGET_NOT_IN_OUTPUT:   "REPAIR_TARGET_NOT_IN_OUTPUT",

    // Structural violations
    REPAIR_MULTI_FILE_REJECTED:    "REPAIR_MULTI_FILE_REJECTED",
    REPAIR_INTERNAL_ERROR:         "REPAIR_INTERNAL_ERROR"
});

module.exports = { repairErrorCodes };
