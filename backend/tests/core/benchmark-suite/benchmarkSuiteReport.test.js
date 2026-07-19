"use strict";

const assert = require("assert");

module.exports = function registerBenchmarkSuiteReportTests(suite, test) {
    const { buildBenchmarkSuiteReport, deepFreeze } = require("../../../core/benchmark-suite/benchmarkSuiteReport");

    suite("Benchmark Suite Report Builder (Phase 13D)", () => {
        test("1. Builds deeply frozen benchmark suite report artifact", () => {
            const summary = {
                suitePassed: true,
                benchmarkCount: 2,
                averageScore: 92,
                highestScore: 95,
                lowestScore: 90,
                passedCount: 2,
                failedCount: 0,
                gradeDistribution: { A: 1, B: 1, C: 0, D: 0, F: 0 }
            };

            const results = [
                { scenario: { id: "s1" }, score: 95, grade: "A", passed: true },
                { scenario: { id: "s2" }, score: 90, grade: "B", passed: true }
            ];

            const report = buildBenchmarkSuiteReport({ results, summary, version: "1.0.0" });

            assert.strictEqual(report.suitePassed, true);
            assert.strictEqual(report.benchmarkCount, 2);
            assert.strictEqual(report.averageScore, 92);
            assert.ok(typeof report.text === "string");
            assert.ok(report.text.includes("SUITE PASSED"));

            assert.ok(Object.isFrozen(report));
            assert.ok(Object.isFrozen(report.results));
            assert.ok(Object.isFrozen(report.summary));
            assert.throws(() => { report.suitePassed = false; }, TypeError);
        });

        test("2. Formats text report correctly when suite fails", () => {
            const summary = {
                suitePassed: false,
                benchmarkCount: 1,
                averageScore: 40,
                highestScore: 40,
                lowestScore: 40,
                passedCount: 0,
                failedCount: 1,
                gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 1 }
            };

            const report = buildBenchmarkSuiteReport({ results: [], summary });

            assert.strictEqual(report.suitePassed, false);
            assert.ok(report.text.includes("SUITE FAILED"));
        });

        test("3. deepFreeze recursively freezes nested objects", () => {
            const obj = { a: { b: { c: 1 } } };
            deepFreeze(obj);
            assert.ok(Object.isFrozen(obj));
            assert.ok(Object.isFrozen(obj.a));
            assert.ok(Object.isFrozen(obj.a.b));
        });
    });
};
