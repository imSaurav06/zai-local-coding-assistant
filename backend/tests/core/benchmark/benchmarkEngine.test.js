"use strict";

const assert = require("assert");

module.exports = function registerBenchmarkEngineTests(suite, test) {
    const { runBenchmark } = require("../../../core/benchmark/benchmarkEngine");
    const { benchmarkErrorCodes } = require("../../../core/benchmark/benchmarkErrors");

    suite("Benchmark Engine Public API (Phase 13C)", () => {
        test("1. Rejects invalid or non-object inputs with INVALID_INPUT error code", () => {
            assert.throws(() => runBenchmark(null), (err) => err.code === benchmarkErrorCodes.INVALID_INPUT);
            assert.throws(() => runBenchmark(undefined), (err) => err.code === benchmarkErrorCodes.INVALID_INPUT);
            assert.throws(() => runBenchmark([]), (err) => err.code === benchmarkErrorCodes.INVALID_INPUT);
            assert.throws(() => runBenchmark("invalid"), (err) => err.code === benchmarkErrorCodes.INVALID_INPUT);
        });

        test("2. Evaluates clean evidence bundle and returns Grade A benchmark report", () => {
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

            const result = runBenchmark(input);

            assert.strictEqual(result.passed, true);
            assert.strictEqual(result.score, 100);
            assert.strictEqual(result.grade, "A");
            assert.ok(result.metrics);
            assert.ok(result.summary);
            assert.ok(result.report);
            assert.ok(Object.isFrozen(result));
            assert.ok(Object.isFrozen(result.report));
        });

        test("3. Fails benchmark when overall score is below 70", () => {
            const input = {
                // Minimal evidence -> low metrics -> score < 70
                projectSpec: { projectName: "Incomplete" }
            };

            const result = runBenchmark(input);

            assert.strictEqual(result.passed, false);
            assert.ok(result.score < 70);
            assert.ok(["D", "F"].includes(result.grade));
        });

        test("4. Result artifact is deeply frozen and immutable", () => {
            const result = runBenchmark({});
            assert.ok(Object.isFrozen(result));
            assert.ok(Object.isFrozen(result.metrics));
            assert.ok(Object.isFrozen(result.report));
            assert.throws(() => { result.passed = true; }, TypeError);
        });
    });
};
