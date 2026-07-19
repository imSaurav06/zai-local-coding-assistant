"use strict";

/**
 * Benchmark suite error taxonomy (Phase 13D).
 */
const benchmarkSuiteErrorCodes = Object.freeze({
    INVALID_INPUT: "INVALID_INPUT",
    INVALID_SCENARIO: "INVALID_SCENARIO",
    UNKNOWN_BENCHMARK: "UNKNOWN_BENCHMARK",
    INVALID_RESULTS: "INVALID_RESULTS",
    REPORT_BUILD_FAILED: "REPORT_BUILD_FAILED",
    INTERNAL_ERROR: "INTERNAL_ERROR"
});

module.exports = {
    benchmarkSuiteErrorCodes
};
