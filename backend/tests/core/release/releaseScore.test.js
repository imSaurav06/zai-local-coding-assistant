"use strict";

const assert = require("assert");

module.exports = function registerReleaseScoreTests(suite, test) {
    const { calculateReleaseScore } = require("../../../core/release/releaseScore");

    suite("Release Score Calculation (Phase 13A)", () => {
        test("1. Returns 100 for perfect passing criteria", () => {
            const criteria = {
                auditPassed: true,
                verificationPassed: true,
                repairPassed: true,
                regressionPassed: true,
                metadataComplete: true,
                details: { auditScore: 100, verificationErrorsCount: 0, repairFailuresCount: 0, regressionFailedCount: 0, executionMetaPresent: true, buildMetaPresent: true }
            };

            const score = calculateReleaseScore(criteria);
            assert.strictEqual(score, 100);
        });

        test("2. Deducts score deterministically when audit fails", () => {
            const criteria = {
                auditPassed: false,
                verificationPassed: true,
                repairPassed: true,
                regressionPassed: true,
                metadataComplete: true
            };

            const score = calculateReleaseScore(criteria);
            assert.strictEqual(score, 70); // 100 - 30
        });

        test("3. Deducts score proportionally for lower audit score", () => {
            const criteria = {
                auditPassed: true,
                verificationPassed: true,
                repairPassed: true,
                regressionPassed: true,
                metadataComplete: true,
                details: { auditScore: 80 }
            };

            const score = calculateReleaseScore(criteria);
            assert.strictEqual(score, 80); // 100 - (100 - 80)
        });

        test("4. Deducts score when metadata is incomplete", () => {
            const criteria = {
                auditPassed: true,
                verificationPassed: true,
                repairPassed: true,
                regressionPassed: true,
                metadataComplete: false,
                details: { executionMetaPresent: false, buildMetaPresent: true }
            };

            const score = calculateReleaseScore(criteria);
            assert.strictEqual(score, 95); // 100 - 5
        });

        test("5. Clamps score floor to 0", () => {
            const criteria = {
                auditPassed: false, // -30
                verificationPassed: false, // -25
                repairPassed: false, // -20
                regressionPassed: false, // -30
                metadataComplete: false // -10
            };

            const score = calculateReleaseScore(criteria);
            assert.strictEqual(score, 0); // 100 - 115 = -15 -> 0
        });

        test("6. Returns 0 for invalid or empty input criteria", () => {
            assert.strictEqual(calculateReleaseScore(null), 0);
            assert.strictEqual(calculateReleaseScore(undefined), 0);
        });
    });
};
