"use strict";

const assert = require("assert");

module.exports = function registerBenchmarkAggregatorTests(suite, test) {
    const { aggregateBenchmarkResults } = require("../../../core/benchmark-suite/benchmarkAggregator");

    suite("Benchmark Aggregator (Phase 13D)", () => {
        test("1. Aggregates clean execution results accurately", () => {
            const results = [
                { score: 95, grade: "A", passed: true },
                { score: 85, grade: "B", passed: true },
                { score: 60, grade: "D", passed: false }
            ];

            const summary = aggregateBenchmarkResults(results);

            assert.strictEqual(summary.benchmarkCount, 3);
            assert.strictEqual(summary.averageScore, 80); // (95 + 85 + 60) / 3 = 80
            assert.strictEqual(summary.highestScore, 95);
            assert.strictEqual(summary.lowestScore, 60);
            assert.strictEqual(summary.passedCount, 2);
            assert.strictEqual(summary.failedCount, 1);
            assert.strictEqual(summary.suitePassed, false); // failedCount > 0
            assert.strictEqual(summary.gradeDistribution.A, 1);
            assert.strictEqual(summary.gradeDistribution.B, 1);
            assert.strictEqual(summary.gradeDistribution.D, 1);
            assert.ok(Object.isFrozen(summary));
        });

        test("2. Marks suitePassed as true only when all scenarios pass", () => {
            const results = [
                { score: 95, grade: "A", passed: true },
                { score: 90, grade: "A", passed: true }
            ];

            const summary = aggregateBenchmarkResults(results);

            assert.strictEqual(summary.suitePassed, true);
            assert.strictEqual(summary.passedCount, 2);
            assert.strictEqual(summary.failedCount, 0);
        });

        test("3. Handles empty results array gracefully", () => {
            const summary = aggregateBenchmarkResults([]);

            assert.strictEqual(summary.benchmarkCount, 0);
            assert.strictEqual(summary.averageScore, 0);
            assert.strictEqual(summary.highestScore, 0);
            assert.strictEqual(summary.lowestScore, 0);
            assert.strictEqual(summary.suitePassed, false);
        });
    });
};
