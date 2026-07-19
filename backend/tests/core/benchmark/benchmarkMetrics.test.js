"use strict";

const assert = require("assert");

module.exports = function registerBenchmarkMetricsTests(suite, test) {
    const { calculateBenchmarkMetrics } = require("../../../core/benchmark/benchmarkMetrics");

    suite("Benchmark Metrics (Phase 13C)", () => {
        test("1. Computes 100 for all metrics when perfect evidence is supplied", () => {
            const input = {
                projectSpec: {
                    schemaVersion: "1.0",
                    projectName: "App",
                    projectType: "React",
                    frontend: "Vite",
                    pagesAndRoutes: [{ path: "/" }],
                    components: ["Nav"],
                    architectureConstraints: ["SPA"]
                },
                execution: { status: "COMPLETED", completedTasksCount: 10, totalTasksCount: 10 },
                verification: { success: true, errors: [] },
                repair: { passed: true, failedRepairs: 0 },
                audit: { passed: true, score: 100, coverage: 100 },
                release: { qualified: true, score: 100 },
                readiness: { ready: true, score: 100 },
                regression: { passed: true, total: 100, failed: 0 }
            };

            const metrics = calculateBenchmarkMetrics(input);

            assert.strictEqual(metrics.planningQuality, 100);
            assert.strictEqual(metrics.requirementCoverage, 100);
            assert.strictEqual(metrics.taskGraphCompleteness, 100);
            assert.strictEqual(metrics.generationCompleteness, 100);
            assert.strictEqual(metrics.verificationSuccessRate, 100);
            assert.strictEqual(metrics.repairSuccessRate, 100);
            assert.strictEqual(metrics.auditScore, 100);
            assert.strictEqual(metrics.releaseScore, 100);
            assert.strictEqual(metrics.readinessScore, 100);
            assert.strictEqual(metrics.regressionPassRate, 100);
            assert.ok(Object.isFrozen(metrics));
        });

        test("2. Computes 0 for metrics when evidence is completely missing", () => {
            const metrics = calculateBenchmarkMetrics({});

            assert.strictEqual(metrics.planningQuality, 0);
            assert.strictEqual(metrics.requirementCoverage, 0);
            assert.strictEqual(metrics.taskGraphCompleteness, 0);
            assert.strictEqual(metrics.generationCompleteness, 0);
            assert.strictEqual(metrics.verificationSuccessRate, 0);
            assert.strictEqual(metrics.repairSuccessRate, 100); // 100 because no repairs failed
            assert.strictEqual(metrics.auditScore, 0);
            assert.strictEqual(metrics.releaseScore, 0);
            assert.strictEqual(metrics.readinessScore, 0);
            assert.strictEqual(metrics.regressionPassRate, 0);
        });

        test("3. Handles partial evidence without throwing errors", () => {
            const input = {
                projectSpec: { projectName: "App" },
                audit: { score: 85 }
            };

            const metrics = calculateBenchmarkMetrics(input);
            assert.strictEqual(metrics.planningQuality, 15);
            assert.strictEqual(metrics.auditScore, 85);
        });

        test("4. Pure function behavior: deterministic outputs for same inputs", () => {
            const input = { audit: { score: 90 } };
            const m1 = calculateBenchmarkMetrics(input);
            const m2 = calculateBenchmarkMetrics(input);
            assert.deepStrictEqual(m1, m2);
        });
    });
};
