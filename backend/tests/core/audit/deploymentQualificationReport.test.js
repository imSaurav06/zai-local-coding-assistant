"use strict";

const assert = require("assert");

module.exports = function registerDeploymentQualificationReportTests(suite, test) {
    const { buildDeploymentQualificationReport } = require("../../../core/audit/deploymentQualificationReport");

    suite("Deployment Qualification Report Builder (Phase 12D)", () => {
        test("1. Successfully builds a deeply frozen qualified report", () => {
            const report = buildDeploymentQualificationReport(true, 100, "APPROVED_FOR_DEPLOYMENT", [], []);

            assert.strictEqual(report.passed, true);
            assert.strictEqual(report.score, 100);
            assert.strictEqual(report.recommendation, "APPROVED_FOR_DEPLOYMENT");
            assert.ok(report.text.includes("Qualification Status: QUALIFIED"));
            assert.ok(report.text.includes("APPROVED_FOR_DEPLOYMENT"));
            assert.ok(Object.isFrozen(report));
            assert.throws(() => { report.passed = false; }, TypeError);
        });

        test("2. Correctly renders DISQUALIFIED status with blocker details", () => {
            const report = buildDeploymentQualificationReport(
                false, 50, "DEPLOYMENT_BLOCKED",
                ["BLOCKER: Critical secret exposed"],
                ["WARNING: No deploy target"]
            );

            assert.strictEqual(report.passed, false);
            assert.ok(report.text.includes("Qualification Status: DISQUALIFIED"));
            assert.ok(report.text.includes("Critical secret exposed"));
            assert.ok(report.text.includes("No deploy target"));
        });
    });
};
