"use strict";

const BENCHMARK_SUITE_REPORT_VERSION = "1.0.0";

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
 * Renders human-readable suite report text.
 */
function renderSuiteReportText(summary, results, generatedAt, version) {
    const lines = [];
    lines.push("==================================================");
    lines.push(`Benchmark Suite Report v${version}`);
    lines.push(`Generated At: ${generatedAt}`);
    lines.push(`Suite Status: ${summary.suitePassed ? "SUITE PASSED" : "SUITE FAILED"}`);
    lines.push(`Scenarios Evaluated: ${summary.passedCount}/${summary.benchmarkCount} passed`);
    lines.push(`Average Score: ${summary.averageScore}/100 [Highest: ${summary.highestScore}, Lowest: ${summary.lowestScore}]`);
    lines.push("==================================================");

    lines.push("\nGrade Distribution:");
    lines.push(`  A: ${summary.gradeDistribution.A || 0}  |  B: ${summary.gradeDistribution.B || 0}  |  C: ${summary.gradeDistribution.C || 0}  |  D: ${summary.gradeDistribution.D || 0}  |  F: ${summary.gradeDistribution.F || 0}`);

    if (results && results.length > 0) {
        lines.push("\nScenario Breakdown:");
        for (const item of results) {
            const status = item.passed ? "✓ PASS" : "✗ FAIL";
            const idStr = item.scenario ? item.scenario.id : "scenario";
            lines.push(`  ${status} — ${idStr}: ${item.score}/100 [Grade ${item.grade}]`);
        }
    }

    lines.push("\n==================================================");
    lines.push(summary.suitePassed
        ? "VERDICT: Benchmark suite PASSED. All scenarios met passing threshold."
        : "VERDICT: Benchmark suite FAILED. One or more scenarios failed to meet passing threshold."
    );
    lines.push("==================================================");

    return lines.join("\n");
}

/**
 * Builds and deeply freezes the benchmark suite report artifact.
 *
 * @param {Object} options Report parameters
 * @param {Array} options.results List of individual scenario benchmark execution results
 * @param {Object} options.summary Aggregated metrics summary from aggregateBenchmarkResults
 * @param {string} [options.version] Version string
 * @param {string} [options.generatedAt] ISO timestamp
 * @returns {Object} Deeply frozen benchmark suite report artifact
 */
function buildBenchmarkSuiteReport(options) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const results = Array.isArray(safeOptions.results) ? safeOptions.results : [];
    const summary = safeOptions.summary && typeof safeOptions.summary === "object" ? safeOptions.summary : {
        suitePassed: false,
        benchmarkCount: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        passedCount: 0,
        failedCount: 0,
        gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0 }
    };
    const version = safeOptions.version || BENCHMARK_SUITE_REPORT_VERSION;
    const generatedAt = safeOptions.generatedAt || new Date().toISOString();

    const text = renderSuiteReportText(summary, results, generatedAt, version);

    const reportObj = {
        suitePassed: summary.suitePassed,
        benchmarkCount: summary.benchmarkCount,
        averageScore: summary.averageScore,
        highestScore: summary.highestScore,
        lowestScore: summary.lowestScore,
        gradeDistribution: summary.gradeDistribution,
        results,
        summary,
        version,
        generatedAt,
        text
    };

    return deepFreeze(reportObj);
}

module.exports = {
    buildBenchmarkSuiteReport,
    deepFreeze
};
