"use strict";

const assert = require("assert");

module.exports = function registerIntegrationAuditReportTests(suite, test) {
    const { buildIntegrationAuditReport } = require("../../../core/audit/integrationAuditReport");

    suite("Integration Audit Report Builder (Phase 12C)", () => {
        test("1. Successfully constructs deeply frozen structured integration reports", () => {
            const pipelineResult = {
                success: true,
                errors: [],
                warnings: ["Timestamps missing"]
            };

            const contractResult = {
                success: false,
                errors: ["Footer.jsx missing"],
                warnings: ["Login API missing"]
            };

            const report = buildIntegrationAuditReport(pipelineResult, contractResult);

            // Score: 100 - (1 * 15) - (2 * 5) = 75
            assert.strictEqual(report.score, 75);
            assert.strictEqual(report.passed, false);
            assert.ok(report.text.includes("Overall Status: FAILED"));
            assert.ok(report.text.includes("Integration Score: 75/100"));
            assert.ok(Object.isFrozen(report));
            assert.ok(Object.isFrozen(report.pipeline));
            assert.ok(Object.isFrozen(report.contracts));
        });

        test("2. Passes with 100 score when no pipeline/contract issues are found", () => {
            const pipelineResult = { success: true, errors: [], warnings: [] };
            const contractResult = { success: true, errors: [], warnings: [] };

            const report = buildIntegrationAuditReport(pipelineResult, contractResult);

            assert.strictEqual(report.score, 100);
            assert.strictEqual(report.passed, true);
        });
    });
};
