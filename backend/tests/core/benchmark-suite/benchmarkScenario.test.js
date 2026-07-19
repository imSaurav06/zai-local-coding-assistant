"use strict";

const assert = require("assert");

module.exports = function registerBenchmarkScenarioTests(suite, test) {
    const { normalizeBenchmarkScenario } = require("../../../core/benchmark-suite/benchmarkScenario");
    const { benchmarkSuiteErrorCodes } = require("../../../core/benchmark-suite/benchmarkSuiteErrors");

    suite("Benchmark Scenario Normalizer (Phase 13D)", () => {
        test("1. Normalizes valid scenario input correctly", () => {
            const input = {
                id: "test-scenario",
                name: "Test Scenario",
                category: "REFERENCE",
                complexity: { level: "HIGH", estimatedModules: 10 },
                input: { audit: { score: 100 } }
            };

            const result = normalizeBenchmarkScenario(input);

            assert.strictEqual(result.id, "test-scenario");
            assert.strictEqual(result.name, "Test Scenario");
            assert.strictEqual(result.category, "REFERENCE");
            assert.strictEqual(result.complexity.level, "HIGH");
            assert.strictEqual(result.complexity.estimatedModules, 10);
            assert.strictEqual(result.complexity.estimatedRequirements, 1); // default
            assert.ok(Object.isFrozen(result));
            assert.ok(Object.isFrozen(result.complexity));
        });

        test("2. Rejects invalid scenario inputs with INVALID_SCENARIO error code", () => {
            assert.throws(() => normalizeBenchmarkScenario(null), (err) => err.code === benchmarkSuiteErrorCodes.INVALID_SCENARIO);
            assert.throws(() => normalizeBenchmarkScenario({}), (err) => err.code === benchmarkSuiteErrorCodes.INVALID_SCENARIO);
            assert.throws(() => normalizeBenchmarkScenario([]), (err) => err.code === benchmarkSuiteErrorCodes.INVALID_SCENARIO);
        });

        test("3. Defaults category to USER if unknown category provided", () => {
            const input = { id: "my-custom", category: "UNKNOWN_CAT" };
            const result = normalizeBenchmarkScenario(input);
            assert.strictEqual(result.category, "USER");
        });

        test("4. Complexity metadata is informational only and does not break normalization", () => {
            const input = {
                id: "enterprise-erp",
                name: "Enterprise ERP Platform",
                complexity: {
                    level: "ENTERPRISE",
                    estimatedModules: 150,
                    estimatedRequirements: 1000,
                    estimatedWorkers: 10,
                    estimatedArtifacts: 500
                }
            };
            const result = normalizeBenchmarkScenario(input);
            assert.strictEqual(result.complexity.level, "ENTERPRISE");
            assert.strictEqual(result.complexity.estimatedModules, 150);
        });
    });
};
