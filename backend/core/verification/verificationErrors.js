"use strict";

const verificationErrors = Object.freeze({
    VERIFICATION_SYNTAX_ERROR: "VERIFICATION_SYNTAX_ERROR",
    VERIFICATION_IMPORT_ERROR: "VERIFICATION_IMPORT_ERROR",
    VERIFICATION_DEPENDENCY_ERROR: "VERIFICATION_DEPENDENCY_ERROR",
    VERIFICATION_STRUCTURE_ERROR: "VERIFICATION_STRUCTURE_ERROR",
    VERIFICATION_PROFILE_ERROR: "VERIFICATION_PROFILE_ERROR",
    VERIFICATION_INTERNAL_ERROR: "VERIFICATION_INTERNAL_ERROR"
});

/**
 * Severity levels for verification findings.
 * ERROR   — blocks the pipeline (all current findings are errors).
 * WARNING — informational; does not block the pipeline.
 * INFO    — diagnostic only.
 */
const verificationSeverity = Object.freeze({
    ERROR: "ERROR",
    WARNING: "WARNING",
    INFO: "INFO"
});

/**
 * Category tags that group verification findings by checker type.
 */
const verificationCategory = Object.freeze({
    SYNTAX: "SYNTAX",
    STRUCTURE: "STRUCTURE",
    IMPORT: "IMPORT",
    DEPENDENCY: "DEPENDENCY",
    PROFILE: "PROFILE",
    INTERNAL: "INTERNAL"
});

module.exports = {
    verificationErrors,
    verificationSeverity,
    verificationCategory
};
