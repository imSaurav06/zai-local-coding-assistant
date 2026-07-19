"use strict";

/**
 * Production readiness error taxonomy (Phase 13B).
 */
const readinessErrorCodes = Object.freeze({
    INVALID_INPUT: "INVALID_INPUT",
    INVALID_ENVIRONMENT: "INVALID_ENVIRONMENT",
    INVALID_PROVIDER: "INVALID_PROVIDER",
    INVALID_CONFIGURATION: "INVALID_CONFIGURATION",
    INVALID_BUILD: "INVALID_BUILD",
    INVALID_SCORE: "INVALID_SCORE",
    REPORT_BUILD_FAILED: "REPORT_BUILD_FAILED",
    INTERNAL_ERROR: "INTERNAL_ERROR"
});

module.exports = {
    readinessErrorCodes
};
