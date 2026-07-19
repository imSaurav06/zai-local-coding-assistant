"use strict";

const assert = require("assert");

module.exports = function registerSecurityAuditReportTests(suite, test) {
    const { buildSecurityAuditReport } = require("../../../core/audit/securityAuditReport");

    suite("Security Audit Report Builder (Phase 12B)", () => {
        test("1. Successfully creates deeply frozen structured reports and score values", () => {
            const vulnerabilities = [
                { package: "lodash", severity: "HIGH", vulnerability: "Prototype pollution", version: "4.17.15", safeVersion: "4.17.21" }
            ];

            const secrets = [
                { file: "src/config.js", line: 3, type: "Google API Key", severity: "CRITICAL", preview: "AIza... [REDACTED]" }
            ];

            const report = buildSecurityAuditReport(vulnerabilities, secrets, ["No env files provided"]);

            // Score should deduct 25 (critical secret) + 12 (high vulnerability) = 63/100
            assert.strictEqual(report.score, 63);
            assert.strictEqual(report.passed, false);
            assert.ok(report.text.includes("Overall Status: FAILED"));
            assert.ok(report.text.includes("Security Score: 63/100"));
            assert.ok(Object.isFrozen(report));
        });

        test("2. Passes when score is high and no critical items exist", () => {
            const report = buildSecurityAuditReport([], [], []);
            assert.strictEqual(report.score, 100);
            assert.strictEqual(report.passed, true);
        });
    });
};
