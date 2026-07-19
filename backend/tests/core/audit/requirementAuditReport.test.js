"use strict";

const assert = require("assert");

module.exports = function registerAuditReportTests(suite, test) {
    const { buildAuditReport } = require("../../../core/audit/requirementAuditReport");

    suite("Requirement Audit Report Builder (Phase 12A)", () => {
        test("1. Successfully builds deeply frozen and structured audit reports", () => {
            const summary = {
                passed: true,
                coverage: 100,
                statistics: {
                    totalRequirements: 1,
                    satisfiedRequirements: 1,
                    failedRequirements: 0,
                    byKind: {
                        pageRoute: { total: 1, satisfied: 1, percentage: 100 }
                    }
                },
                missingRequirements: [],
                orphanArtifacts: []
            };

            const evidenceMap = {
                req_1: {
                    displayId: "REQ-001",
                    kind: "pageRoute",
                    semanticKey: "/",
                    satisfied: true,
                    files: [{ path: "src/pages/LandingPage.jsx" }],
                    verificationIssues: []
                }
            };

            const report = buildAuditReport(summary, evidenceMap);

            assert.strictEqual(report.passed, true);
            assert.strictEqual(report.coverage, 100);
            assert.ok(report.text.includes("Overall Status: PASSED"));
            assert.ok(report.text.includes("Total Coverage: 100%"));
            
            // Check immutability
            assert.ok(Object.isFrozen(report));
            assert.ok(Object.isFrozen(report.statistics));
            assert.throws(() => {
                report.passed = false;
            }, TypeError);
        });
    });
};
