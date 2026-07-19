"use strict";

const assert = require("assert");

module.exports = function registerReadinessScoreTests(suite, test) {
    const { calculateReadinessScore } = require("../../../core/readiness/readinessScore");

    suite("Readiness Score Calculator (Phase 13B)", () => {
        test("1. Returns 100 for all valid categories with zero warnings", () => {
            const results = {
                environment: { valid: true, warnings: [] },
                providers: { valid: true, warnings: [] },
                configuration: { valid: true, warnings: [] },
                build: { valid: true, warnings: [] }
            };

            const score = calculateReadinessScore(results);
            assert.strictEqual(score, 100);
        });

        test("2. Deducts 25 points for each invalid category", () => {
            const results = {
                environment: { valid: true, warnings: [] }, // 25
                providers: { valid: false, warnings: [] },  // 0
                configuration: { valid: true, warnings: [] },// 25
                build: { valid: false, warnings: [] }      // 0
            };

            const score = calculateReadinessScore(results);
            assert.strictEqual(score, 50);
        });

        test("3. Deducts points proportionally for warnings in valid categories", () => {
            const results = {
                environment: { valid: true, warnings: ["W1"] }, // 25 - 5 = 20
                providers: { valid: true, warnings: ["W1", "W2"] }, // 25 - 10 = 15
                configuration: { valid: true, warnings: [] }, // 25
                build: { valid: true, warnings: [] } // 25
            };

            const score = calculateReadinessScore(results);
            assert.strictEqual(score, 85); // 20 + 15 + 25 + 25
        });

        test("4. Returns 0 for invalid or null input results", () => {
            assert.strictEqual(calculateReadinessScore(null), 0);
            assert.strictEqual(calculateReadinessScore(undefined), 0);
        });
    });
};
