"use strict";

const assert = require("assert");

module.exports = function registerReadinessReportTests(suite, test) {
    const { buildReadinessReport, deepFreeze } = require("../../../core/readiness/readinessReport");

    suite("Readiness Report Builder (Phase 13B)", () => {
        test("1. Builds a deeply frozen readiness report artifact", () => {
            const checks = { environment: true, providers: true, configuration: true, build: true };
            const report = buildReadinessReport({
                ready: true,
                score: 100,
                warnings: [],
                checks,
                version: "1.0.0"
            });

            assert.strictEqual(report.ready, true);
            assert.strictEqual(report.score, 100);
            assert.deepStrictEqual(report.checks, checks);
            assert.ok(typeof report.text === "string");
            assert.ok(report.text.includes("READY FOR PRODUCTION"));

            assert.ok(Object.isFrozen(report));
            assert.ok(Object.isFrozen(report.checks));
            assert.throws(() => { report.ready = false; }, TypeError);
        });

        test("2. Correctly formats text when NOT ready", () => {
            const checks = { environment: true, providers: false, configuration: true, build: false };
            const report = buildReadinessReport({
                ready: false,
                score: 50,
                warnings: ["Provider model missing"],
                checks
            });

            assert.strictEqual(report.ready, false);
            assert.strictEqual(report.score, 50);
            assert.ok(report.text.includes("NOT READY"));
            assert.ok(report.text.includes("Provider model missing"));
        });

        test("3. deepFreeze recursively freezes nested structures", () => {
            const obj = { a: { b: { c: 1 } } };
            deepFreeze(obj);
            assert.ok(Object.isFrozen(obj));
            assert.ok(Object.isFrozen(obj.a));
            assert.ok(Object.isFrozen(obj.a.b));
        });
    });
};
