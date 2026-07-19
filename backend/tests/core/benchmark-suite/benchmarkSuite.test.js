"use strict";

const assert = require("assert");

module.exports = function registerBenchmarkSuiteTests(suite, test) {
    const { runBenchmarkSuite } = require("../../../core/benchmark-suite/benchmarkSuite");
    const { benchmarkSuiteErrorCodes } = require("../../../core/benchmark-suite/benchmarkSuiteErrors");

    suite("Benchmark Suite Orchestrator API (Phase 13D)", () => {
        test("1. Rejects invalid or missing input contract with INVALID_INPUT error code", () => {
            assert.throws(() => runBenchmarkSuite(null), (err) => err.code === benchmarkSuiteErrorCodes.INVALID_INPUT);
            assert.throws(() => runBenchmarkSuite(undefined), (err) => err.code === benchmarkSuiteErrorCodes.INVALID_INPUT);
            assert.throws(() => runBenchmarkSuite({}), (err) => err.code === benchmarkSuiteErrorCodes.INVALID_INPUT);
        });

        test("2. Executes reference benchmark scenario IDs registered in registry", () => {
            const input = {
                scenarios: ["portfolio-website", "crud-application"]
            };

            const result = runBenchmarkSuite(input);

            assert.strictEqual(result.benchmarkCount, 2);
            assert.ok(typeof result.averageScore === "number");
            assert.ok(result.results);
            assert.strictEqual(result.results.length, 2);
            assert.strictEqual(result.results[0].scenario.id, "portfolio-website");
            assert.strictEqual(result.results[1].scenario.id, "crud-application");
            assert.ok(Object.isFrozen(result));
            assert.ok(Object.isFrozen(result.report));
        });

        test("3. Executes custom user scenario objects", () => {
            const userScenario = {
                id: "build-netflix",
                name: "Build Netflix Platform",
                category: "USER",
                complexity: { level: "HIGH", estimatedModules: 25 },
                input: {
                    projectSpec: {
                        schemaVersion: "1.0",
                        projectName: "Netflix Clone",
                        projectType: "Streaming Platform",
                        frontend: "React",
                        pagesAndRoutes: [{ path: "/" }],
                        components: ["VideoPlayer"],
                        architectureConstraints: ["Microservices"]
                    },
                    execution: { status: "COMPLETED" },
                    verification: { success: true }
                }
            };

            const result = runBenchmarkSuite({
                scenarios: [userScenario]
            });

            assert.strictEqual(result.benchmarkCount, 1);
            assert.strictEqual(result.results[0].scenario.name, "Build Netflix Platform");
            assert.ok(result.results[0].score > 0);
        });

        test("4. Throws UNKNOWN_BENCHMARK error when resolving unregistered string ID", () => {
            assert.throws(() => runBenchmarkSuite({ scenarios: ["non-existent-benchmark"] }),
                (err) => err.code === benchmarkSuiteErrorCodes.UNKNOWN_BENCHMARK
            );
        });

        test("5. Result contract is deeply frozen and immutable", () => {
            const result = runBenchmarkSuite({
                scenarios: ["portfolio-website"]
            });

            assert.ok(Object.isFrozen(result));
            assert.ok(Object.isFrozen(result.results));
            assert.ok(Object.isFrozen(result.report));
            assert.throws(() => { result.suitePassed = false; }, TypeError);
        });
    });
};
