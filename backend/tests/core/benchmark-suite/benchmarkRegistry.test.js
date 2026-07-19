"use strict";

const assert = require("assert");

module.exports = function registerBenchmarkRegistryTests(suite, test) {
    const {
        registerBenchmarkScenario,
        getRegisteredBenchmark,
        resolveBenchmarkScenario,
        listRegisteredBenchmarks
    } = require("../../../core/benchmark-suite/benchmarkRegistry");
    const { benchmarkSuiteErrorCodes } = require("../../../core/benchmark-suite/benchmarkSuiteErrors");

    suite("Benchmark Registry (Phase 13D)", () => {
        test("1. Pre-registers official reference benchmarks (LearnSphere, CRUD, Dashboard, E-Commerce, Portfolio)", () => {
            const references = listRegisteredBenchmarks("REFERENCE");
            assert.ok(references.length >= 5);

            const names = references.map(r => r.name);
            assert.ok(names.includes("LearnSphere"));
            assert.ok(names.includes("CRUD Application"));
            assert.ok(names.includes("Admin Dashboard"));
            assert.ok(names.includes("E-Commerce Store"));
            assert.ok(names.includes("Portfolio Website"));
        });

        test("2. Looks up registered benchmark by ID case-insensitively", () => {
            const found1 = getRegisteredBenchmark("learnsphere");
            const found2 = getRegisteredBenchmark("LEARNSPHERE");

            assert.ok(found1);
            assert.strictEqual(found1.name, "LearnSphere");
            assert.deepStrictEqual(found1, found2);
        });

        test("3. Registers user-defined and custom benchmark scenarios cleanly", () => {
            const userScenario = {
                id: "build-netflix",
                name: "Build Netflix Platform",
                category: "USER",
                complexity: { level: "HIGH" }
            };

            const registered = registerBenchmarkScenario(userScenario);
            assert.strictEqual(registered.id, "build-netflix");
            assert.strictEqual(registered.category, "USER");

            const retrieved = getRegisteredBenchmark("build-netflix");
            assert.strictEqual(retrieved.name, "Build Netflix Platform");
        });

        test("4. Throws UNKNOWN_BENCHMARK error when resolving unregistered string ID", () => {
            assert.throws(() => resolveBenchmarkScenario("non-existent-benchmark-id"),
                (err) => err.code === benchmarkSuiteErrorCodes.UNKNOWN_BENCHMARK
            );
        });

        test("5. Resolves raw scenario object without requiring registration", () => {
            const rawScenario = {
                id: "adhoc-test",
                name: "Ad-hoc Benchmark Test"
            };

            const resolved = resolveBenchmarkScenario(rawScenario);
            assert.strictEqual(resolved.id, "adhoc-test");
            assert.strictEqual(resolved.name, "Ad-hoc Benchmark Test");
        });
    });
};
