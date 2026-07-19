"use strict";

const assert = require("assert");

module.exports = function registerReleaseReportTests(suite, test) {
    const { buildReleaseReport, resolveQualificationLevel, deepFreeze } = require("../../../core/release/releaseReport");

    suite("Release Report Builder (Phase 13A)", () => {
        test("1. Resolves RELEASE_CANDIDATE level when mandatory criteria pass and score >= 85", () => {
            const criteria = { mandatoryPassed: true };
            const level = resolveQualificationLevel(criteria, 90);
            assert.strictEqual(level, "RELEASE_CANDIDATE");
        });

        test("2. Resolves RELEASE_WITH_WARNINGS level when mandatory criteria pass and 70 <= score < 85", () => {
            const criteria = { mandatoryPassed: true };
            const level = resolveQualificationLevel(criteria, 75);
            assert.strictEqual(level, "RELEASE_WITH_WARNINGS");
        });

        test("3. Resolves NOT_READY level when mandatory criteria fail", () => {
            const criteria = { mandatoryPassed: false };
            const level = resolveQualificationLevel(criteria, 95);
            assert.strictEqual(level, "NOT_READY");
        });

        test("4. Resolves NOT_READY level when score < 70 despite mandatory pass", () => {
            const criteria = { mandatoryPassed: true };
            const level = resolveQualificationLevel(criteria, 65);
            assert.strictEqual(level, "NOT_READY");
        });

        test("5. Builds a deeply frozen release report artifact", () => {
            const criteria = { mandatoryPassed: true, auditPassed: true, verificationPassed: true, repairPassed: true, regressionPassed: true, metadataComplete: true };
            const report = buildReleaseReport({ criteria, score: 95, version: "1.0.0" });

            assert.strictEqual(report.qualified, true);
            assert.strictEqual(report.level, "RELEASE_CANDIDATE");
            assert.strictEqual(report.score, 95);
            assert.ok(typeof report.summaryText === "string");
            assert.ok(report.summaryText.includes("RELEASE_CANDIDATE"));

            assert.ok(Object.isFrozen(report));
            assert.ok(Object.isFrozen(report.criteria));
            assert.throws(() => { report.qualified = false; }, TypeError);
        });

        test("6. deepFreeze recursively freezes nested objects", () => {
            const obj = { a: { b: { c: 1 } } };
            deepFreeze(obj);
            assert.ok(Object.isFrozen(obj));
            assert.ok(Object.isFrozen(obj.a));
            assert.ok(Object.isFrozen(obj.a.b));
        });
    });
};
