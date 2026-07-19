"use strict";

const assert = require("assert");

module.exports = function registerDeploymentScoreTests(suite, test) {
    const { calculateDeploymentScore } = require("../../../core/audit/deploymentScore");

    suite("Deployment Score Calculator (Phase 12D)", () => {
        test("1. Returns APPROVED_FOR_DEPLOYMENT on clean run with no issues", () => {
            const result = calculateDeploymentScore([], []);
            assert.strictEqual(result.score, 100);
            assert.strictEqual(result.passed, true);
            assert.strictEqual(result.recommendation, "APPROVED_FOR_DEPLOYMENT");
        });

        test("2. Returns DEPLOYMENT_BLOCKED when blockers are present", () => {
            const result = calculateDeploymentScore(["BLOCKER: Missing entry point"], []);
            assert.strictEqual(result.score, 75);
            assert.strictEqual(result.passed, false);
            assert.strictEqual(result.recommendation, "DEPLOYMENT_BLOCKED");
        });

        test("3. Returns CONDITIONAL_DEPLOYMENT when score is 60-79 with no blockers", () => {
            // 5 warnings = 100 - 25 = 75
            const result = calculateDeploymentScore([], [
                "WARNING: 1",
                "WARNING: 2",
                "WARNING: 3",
                "WARNING: 4",
                "WARNING: 5"
            ]);
            assert.strictEqual(result.score, 75);
            assert.strictEqual(result.passed, true);
            assert.strictEqual(result.recommendation, "CONDITIONAL_DEPLOYMENT");
        });

        test("4. Score clamps to floor of 0 with many blockers", () => {
            const result = calculateDeploymentScore(
                ["B1", "B2", "B3", "B4", "B5", "B6"],
                ["W1", "W2"]
            );
            assert.strictEqual(result.score, 0);
            assert.strictEqual(result.passed, false);
            assert.strictEqual(result.recommendation, "DEPLOYMENT_BLOCKED");
        });
    });
};
