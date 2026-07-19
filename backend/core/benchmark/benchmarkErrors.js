"use strict";

/**
 * Benchmark engine error taxonomy (Phase 13C).
 */
const benchmarkErrorCodes = Object.freeze({
    INVALID_INPUT: "INVALID_INPUT",
    INVALID_METRICS: "INVALID_METRICS",
    INVALID_SCORE: "INVALID_SCORE",
    REPORT_BUILD_FAILED: "REPORT_BUILD_FAILED",
    INTERNAL_ERROR: "INTERNAL_ERROR"
});

module.exports = {
    benchmarkErrorCodes
};
