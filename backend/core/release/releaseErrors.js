"use strict";

/**
 * Release qualification error codes taxonomy (Phase 13A).
 */
const releaseErrorCodes = Object.freeze({
    INVALID_INPUT: "INVALID_INPUT",
    INVALID_AUDIT: "INVALID_AUDIT",
    INVALID_METADATA: "INVALID_METADATA",
    INVALID_SCORE: "INVALID_SCORE",
    REPORT_BUILD_FAILED: "REPORT_BUILD_FAILED",
    INTERNAL_ERROR: "INTERNAL_ERROR"
});

module.exports = {
    releaseErrorCodes
};
