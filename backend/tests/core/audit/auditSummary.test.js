"use strict";

const assert = require("assert");

module.exports = function registerAuditSummaryTests(suite, test) {
    const { buildAuditSummary } = require("../../../core/audit/auditSummary");

    const makeResult = (passed, score, coverage) => ({
        passed,
        score: score != null ? score : undefined,
        coverage: coverage != null ? coverage : undefined
    });

    suite("Audit Summary Builder (Phase 12E)", () => {
        test("1. allPassed is true only when every stage passes", () => {
            const summary = buildAuditSummary(
                makeResult(true, null, 100),
                makeResult(true, 100),
                makeResult(true, 100),
                makeResult(true, 100)
            );
            assert.strictEqual(summary.allPassed, true);
            assert.strictEqual(summary.failedCount, 0);
            assert.strictEqual(summary.passedCount, 4);
        });

        test("2. allPassed is false when any stage fails", () => {
            const summary = buildAuditSummary(
                makeResult(false, null, 60),
                makeResult(true, 90),
                makeResult(true, 85),
                makeResult(true, 95)
            );
            assert.strictEqual(summary.allPassed, false);
            assert.strictEqual(summary.failedCount, 1);
            assert.ok(summary.failedStages.includes("Requirement Compliance"));
        });

        test("3. overallScore is the rounded mean of numeric scores", () => {
            // security=80, integration=60, deployment=80 → mean of those 3 = 73.33 → 73
            // requirement has coverage=100 → contributes 100 → mean of 4 = (100+80+60+80)/4 = 80
            const summary = buildAuditSummary(
                makeResult(true, null, 100),
                makeResult(true, 80),
                makeResult(true, 60),
                makeResult(true, 80)
            );
            assert.strictEqual(summary.overallScore, 80);
        });

        test("4. Summary result is deeply frozen", () => {
            const summary = buildAuditSummary(
                makeResult(true, null, 100),
                makeResult(true, 100),
                makeResult(true, 100),
                makeResult(true, 100)
            );
            assert.ok(Object.isFrozen(summary));
            assert.ok(Object.isFrozen(summary.stages));
            assert.throws(() => { summary.allPassed = false; }, TypeError);
        });

        test("5. stages array contains all four entries with correct labels", () => {
            const summary = buildAuditSummary(
                makeResult(true, null, 100),
                makeResult(true, 100),
                makeResult(true, 100),
                makeResult(true, 100)
            );
            const labels = summary.stages.map(s => s.label);
            assert.ok(labels.includes("Requirement Compliance"));
            assert.ok(labels.includes("Security Audit"));
            assert.ok(labels.includes("Integration Audit"));
            assert.ok(labels.includes("Deployment Qualification"));
        });
    });
};
