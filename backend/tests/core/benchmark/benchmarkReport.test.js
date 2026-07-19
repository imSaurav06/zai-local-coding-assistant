"use strict";

const assert = require("assert");

module.exports = function registerBenchmarkReportTests(suite, test) {
    const { buildBenchmarkReport, resolveBenchmarkGrade, deepFreeze } = require("../../../core/benchmark/benchmarkReport");

    suite("Benchmark Report Builder (Phase 13C)", () => {
        test("1. Resolves grades correctly based on score thresholds", () => {
            assert.strictEqual(resolveBenchmarkGrade(97), "A");
            assert.strictEqual(resolveBenchmarkGrade(95), "A");
            assert.strictEqual(resolveBenchmarkGrade(88), "B");
            assert.strictEqual(resolveBenchmarkGrade(85), "B");
            assert.strictEqual(resolveBenchmarkGrade(75), "C");
            assert.strictEqual(resolveBenchmarkGrade(70), "C");
            assert.strictEqual(resolveBenchmarkGrade(60), "D");
            assert.strictEqual(resolveBenchmarkGrade(50), "D");
            assert.strictEqual(resolveBenchmarkGrade(40), "F");
            assert.strictEqual(resolveBenchmarkGrade(0), "F");
        });

        test("2. Builds deeply frozen benchmark report artifact", () => {
            const metrics = { planningQuality: 100, verificationSuccessRate: 100 };
            const report = buildBenchmarkReport({ metrics, score: 96, version: "1.0.0" });

            assert.strictEqual(report.passed, true);
            assert.strictEqual(report.score, 96);
            assert.strictEqual(report.grade, "A");
            assert.ok(typeof report.text === "string");
            assert.ok(report.text.includes("Grade: A"));
            assert.ok(report.text.includes("PASSED"));

            assert.ok(Object.isFrozen(report));
            assert.ok(Object.isFrozen(report.metrics));
            assert.ok(Object.isFrozen(report.summary));
            assert.throws(() => { report.passed = false; }, TypeError);
        });

        test("3. Report marks passed as false when score < 70 (Grade D or F)", () => {
            const report = buildBenchmarkReport({ metrics: {}, score: 65 });
            assert.strictEqual(report.passed, false);
            assert.strictEqual(report.grade, "D");
            assert.ok(report.text.includes("FAILED"));
        });

        test("4. deepFreeze recursively freezes nested structures", () => {
            const obj = { a: { b: { c: 1 } } };
            deepFreeze(obj);
            assert.ok(Object.isFrozen(obj));
            assert.ok(Object.isFrozen(obj.a));
            assert.ok(Object.isFrozen(obj.a.b));
        });
    });
};
