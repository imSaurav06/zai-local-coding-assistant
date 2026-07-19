"use strict";

const assert = require("assert");

module.exports = function registerCertificationReportTests(suite, test) {
    const { buildCertificationReport, deepFreeze } = require("../../../core/certification/certificationReport");

    suite("Certification Report Builder (Phase 13E)", () => {
        test("1. Builds deeply frozen engineering certification report artifact", () => {
            const subsystems = {
                audit: { passed: true, score: 100 },
                release: { qualified: true, score: 100, level: "RELEASE_CANDIDATE" },
                readiness: { ready: true, score: 100 },
                benchmark: { passed: true, score: 95, grade: "A" }
            };

            const report = buildCertificationReport({
                certified: true,
                engineeringScore: 98,
                grade: "A+",
                overallPassed: true,
                subsystems,
                version: "1.0.0"
            });

            assert.strictEqual(report.certified, true);
            assert.strictEqual(report.engineeringScore, 98);
            assert.strictEqual(report.grade, "A+");
            assert.ok(typeof report.text === "string");
            assert.ok(report.text.includes("PLATFORM CERTIFIED"));

            assert.ok(Object.isFrozen(report));
            assert.ok(Object.isFrozen(report.subsystems));
            assert.ok(Object.isFrozen(report.summary));
            assert.throws(() => { report.certified = false; }, TypeError);
        });

        test("2. Formats text report correctly when certification fails", () => {
            const subsystems = {
                audit: { passed: true, score: 80 },
                release: { qualified: false, score: 50 }
            };

            const report = buildCertificationReport({
                certified: false,
                engineeringScore: 60,
                grade: "F",
                overallPassed: false,
                subsystems
            });

            assert.strictEqual(report.certified, false);
            assert.ok(report.text.includes("CERTIFICATION FAILED"));
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
