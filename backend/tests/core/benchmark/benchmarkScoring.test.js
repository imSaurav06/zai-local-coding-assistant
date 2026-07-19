"use strict";

const assert = require("assert");

module.exports = function registerBenchmarkScoringTests(suite, test) {
    const { calculateBenchmarkScore } = require("../../../core/benchmark/benchmarkScoring");

    suite("Benchmark Scoring (Phase 13C)", () => {
        test("1. Returns 100 for all 100% metrics", () => {
            const metrics = {
                planningQuality: 100,
                requirementCoverage: 100,
                taskGraphCompleteness: 100,
                generationCompleteness: 100,
                verificationSuccessRate: 100,
                repairSuccessRate: 100,
                auditScore: 100,
                releaseScore: 100,
                readinessScore: 100,
                regressionPassRate: 100
            };

            const score = calculateBenchmarkScore(metrics);
            assert.strictEqual(score, 100);
        });

        test("2. Computes weighted score accurately according to specification weights", () => {
            const metrics = {
                planningQuality: 100,        // 100 * 0.10 = 10
                requirementCoverage: 100,    // 100 * 0.10 = 10
                taskGraphCompleteness: 100,  // 100 * 0.10 = 10
                generationCompleteness: 100, // 100 * 0.10 = 10
                verificationSuccessRate: 0,  // 0 * 0.15 = 0
                repairSuccessRate: 100,      // 100 * 0.10 = 10
                auditScore: 100,             // 100 * 0.15 = 15
                releaseScore: 100,           // 100 * 0.10 = 10
                readinessScore: 100,         // 100 * 0.05 = 5
                regressionPassRate: 100      // 100 * 0.05 = 5
            };

            // Total = 10+10+10+10+0+10+15+10+5+5 = 85
            const score = calculateBenchmarkScore(metrics);
            assert.strictEqual(score, 85);
        });

        test("3. Clamps score floor to 0 for all zero metrics", () => {
            const metrics = {
                planningQuality: 0,
                requirementCoverage: 0,
                taskGraphCompleteness: 0,
                generationCompleteness: 0,
                verificationSuccessRate: 0,
                repairSuccessRate: 0,
                auditScore: 0,
                releaseScore: 0,
                readinessScore: 0,
                regressionPassRate: 0
            };

            const score = calculateBenchmarkScore(metrics);
            assert.strictEqual(score, 0);
        });

        test("4. Returns 0 on null or undefined input", () => {
            assert.strictEqual(calculateBenchmarkScore(null), 0);
            assert.strictEqual(calculateBenchmarkScore(undefined), 0);
        });
    });
};
