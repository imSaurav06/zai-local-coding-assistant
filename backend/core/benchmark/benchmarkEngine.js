"use strict";

const { benchmarkErrorCodes } = require("./benchmarkErrors");
const { calculateBenchmarkMetrics } = require("./benchmarkMetrics");
const { calculateBenchmarkScore } = require("./benchmarkScoring");
const { buildBenchmarkReport, deepFreeze } = require("./benchmarkReport");

function createError(message, code) {
    const err = new Error(message);
    err.code = code;
    return err;
}

/**
 * Public API to run a benchmark evaluation on evidence artifacts.
 *
 * @param {Object} input Input evidence bundle
 * @param {Object} [input.projectSpec] ProjectSpec object
 * @param {Object} [input.execution] Execution Metadata
 * @param {Object} [input.verification] Verification Engine report
 * @param {Object|Array} [input.repair] Repair Engine history / report
 * @param {Object} [input.audit] Audit Report or output from runFullAudit()
 * @param {Object} [input.release] Release Qualification report
 * @param {Object} [input.readiness] Production Readiness report
 * @param {Object} [input.regression] Regression Test Metadata
 * @returns {Object} Deeply frozen benchmark result artifact ({ passed, score, grade, metrics, summary, report })
 */
function runBenchmark(input) {
    // 1. Guard check input
    if (input === null || input === undefined || typeof input !== "object" || Array.isArray(input)) {
        throw createError(
            "Benchmark input must be a non-null object.",
            benchmarkErrorCodes.INVALID_INPUT
        );
    }

    // 2. Coordinate metrics calculation
    let metrics;
    try {
        metrics = calculateBenchmarkMetrics(input);
    } catch (err) {
        throw createError(
            `Benchmark metrics calculation failed: ${err.message}`,
            benchmarkErrorCodes.INVALID_METRICS
        );
    }

    // 3. Coordinate scoring
    let score;
    try {
        score = calculateBenchmarkScore(metrics);
    } catch (err) {
        throw createError(
            `Benchmark score calculation failed: ${err.message}`,
            benchmarkErrorCodes.INVALID_SCORE
        );
    }

    // 4. Coordinate report building
    let report;
    try {
        report = buildBenchmarkReport({ metrics, score });
    } catch (err) {
        throw createError(
            `Benchmark report building failed: ${err.message}`,
            benchmarkErrorCodes.REPORT_BUILD_FAILED
        );
    }

    // 5. Assemble and deeply freeze output artifact
    const result = {
        passed: report.passed,
        score: report.score,
        grade: report.grade,
        metrics,
        summary: report.summary,
        report
    };

    return deepFreeze(result);
}

module.exports = {
    runBenchmark
};
