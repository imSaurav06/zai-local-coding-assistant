"use strict";

const BENCHMARK_REPORT_VERSION = "1.0.0";

/**
 * Deep freezes an object recursively to guarantee absolute immutability.
 *
 * @param {*} obj Object to freeze
 * @returns {*} Frozen object
 */
function deepFreeze(obj) {
    if (obj === null || typeof obj !== "object") return obj;
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
 * Resolves benchmark grade from overall score.
 *
 * Grades:
 * - A: Score >= 95
 * - B: Score >= 85
 * - C: Score >= 70
 * - D: Score >= 50
 * - F: Score < 50
 *
 * @param {number} score Benchmark score (0-100)
 * @returns {string} Grade letter
 */
function resolveBenchmarkGrade(score) {
    if (score >= 95) return "A";
    if (score >= 85) return "B";
    if (score >= 70) return "C";
    if (score >= 50) return "D";
    return "F";
}

/**
 * Renders human-readable benchmark summary text.
 */
function renderBenchmarkText(passed, score, grade, metrics, generatedAt, version) {
    const lines = [];
    lines.push("==================================================");
    lines.push(`Generic Benchmark Report v${version}`);
    lines.push(`Generated At: ${generatedAt}`);
    lines.push(`Benchmark Verdict: ${passed ? "PASSED" : "FAILED"}`);
    lines.push(`Benchmark Score: ${score}/100 [Grade: ${grade}]`);
    lines.push("==================================================");

    lines.push("\nMetrics Breakdown (0-100):");
    lines.push(`  Planning Quality:            ${metrics.planningQuality}/100`);
    lines.push(`  Requirement Coverage:        ${metrics.requirementCoverage}/100`);
    lines.push(`  TaskGraph Completeness:      ${metrics.taskGraphCompleteness}/100`);
    lines.push(`  Generation Completeness:     ${metrics.generationCompleteness}/100`);
    lines.push(`  Verification Success Rate:   ${metrics.verificationSuccessRate}/100`);
    lines.push(`  Repair Success Rate:         ${metrics.repairSuccessRate}/100`);
    lines.push(`  Audit Score:                 ${metrics.auditScore}/100`);
    lines.push(`  Release Score:               ${metrics.releaseScore}/100`);
    lines.push(`  Readiness Score:             ${metrics.readinessScore}/100`);
    lines.push(`  Regression Pass Rate:        ${metrics.regressionPassRate}/100`);

    lines.push("\n==================================================");
    lines.push(passed
        ? `VERDICT: Benchmark PASSED with Grade ${grade}. Project meets or exceeds quality benchmarks.`
        : `VERDICT: Benchmark FAILED with Grade ${grade}. Score is below the 70 point passing threshold.`
    );
    lines.push("==================================================");

    return lines.join("\n");
}

/**
 * Builds and deeply freezes the benchmark report artifact.
 *
 * @param {Object} options Options object
 * @param {Object} options.metrics Metrics object
 * @param {number} options.score Benchmark score (0-100)
 * @param {string} [options.version] Version string
 * @param {string} [options.generatedAt] ISO timestamp
 * @returns {Object} Deeply frozen benchmark report artifact
 */
function buildBenchmarkReport(options) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const metrics = safeOptions.metrics && typeof safeOptions.metrics === "object" ? safeOptions.metrics : {};
    const score = typeof safeOptions.score === "number" ? safeOptions.score : 0;
    const version = safeOptions.version || BENCHMARK_REPORT_VERSION;
    const generatedAt = safeOptions.generatedAt || new Date().toISOString();

    const grade = resolveBenchmarkGrade(score);
    const passed = score >= 70;

    const summary = {
        passed,
        score,
        grade,
        metricsCount: Object.keys(metrics).length,
        evalTimestamp: generatedAt
    };

    const text = renderBenchmarkText(passed, score, grade, metrics, generatedAt, version);

    const reportObj = {
        passed,
        score,
        grade,
        metrics,
        summary,
        version,
        generatedAt,
        text
    };

    return deepFreeze(reportObj);
}

module.exports = {
    buildBenchmarkReport,
    resolveBenchmarkGrade,
    deepFreeze
};
