"use strict";

const { benchmarkSuiteErrorCodes } = require("./benchmarkSuiteErrors");
const { resolveBenchmarkScenario } = require("./benchmarkRegistry");
const { runBenchmark } = require("../benchmark");
const { aggregateBenchmarkResults } = require("./benchmarkAggregator");
const { buildBenchmarkSuiteReport, deepFreeze } = require("./benchmarkSuiteReport");

function createError(message, code) {
    const err = new Error(message);
    err.code = code;
    return err;
}

/**
 * Public API to run a suite of benchmark scenarios using the Generic Benchmark Engine.
 *
 * @param {Object} input Input options contract
 * @param {Array} input.scenarios Array of benchmark scenario objects or registered benchmark IDs
 * @returns {Object} Deeply frozen benchmark suite execution artifact
 */
function runBenchmarkSuite(input) {
    // 1. Guard check input
    if (input === null || input === undefined || typeof input !== "object" || Array.isArray(input)) {
        throw createError(
            "runBenchmarkSuite input must be a non-null object.",
            benchmarkSuiteErrorCodes.INVALID_INPUT
        );
    }

    if (!Array.isArray(input.scenarios)) {
        throw createError(
            "Property 'scenarios' is required and must be an array.",
            benchmarkSuiteErrorCodes.INVALID_INPUT
        );
    }

    // 2. Resolve scenarios and execute benchmark engine for each
    const results = [];
    for (const item of input.scenarios) {
        let scenario;
        try {
            scenario = resolveBenchmarkScenario(item);
        } catch (err) {
            throw createError(
                `Failed to resolve scenario: ${err.message}`,
                err.code || benchmarkSuiteErrorCodes.INVALID_SCENARIO
            );
        }

        let benchmarkResult;
        try {
            benchmarkResult = runBenchmark(scenario.input || {});
        } catch (err) {
            throw createError(
                `Benchmark execution failed for scenario '${scenario.id}': ${err.message}`,
                benchmarkSuiteErrorCodes.INTERNAL_ERROR
            );
        }

        // Attach scenario metadata to result
        const scenarioResult = {
            scenario,
            passed: benchmarkResult.passed,
            score: benchmarkResult.score,
            grade: benchmarkResult.grade,
            metrics: benchmarkResult.metrics,
            summary: benchmarkResult.summary,
            report: benchmarkResult.report
        };

        results.push(scenarioResult);
    }

    // 3. Aggregate benchmark results
    const summary = aggregateBenchmarkResults(results);

    // 4. Build suite report
    const report = buildBenchmarkSuiteReport({ results, summary });

    // 5. Assemble and deep-freeze output contract
    const result = {
        suitePassed: report.suitePassed,
        benchmarkCount: report.benchmarkCount,
        averageScore: report.averageScore,
        highestScore: report.highestScore,
        lowestScore: report.lowestScore,
        gradeDistribution: report.gradeDistribution,
        results,
        summary,
        report
    };

    return deepFreeze(result);
}

module.exports = {
    runBenchmarkSuite
};
