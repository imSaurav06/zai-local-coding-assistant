"use strict";

const assert = require("assert");

module.exports = function registerReleaseCriteriaTests(suite, test) {
    const { evaluateReleaseCriteria } = require("../../../core/release/releaseCriteria");

    suite("Release Criteria Evaluation (Phase 13A)", () => {
        test("1. Evaluates all passing criteria cleanly when complete evidence is provided", () => {
            const input = {
                audit: { passed: true, score: 100 },
                verification: { success: true, errors: [] },
                repair: { passed: true, failedRepairs: 0 },
                execution: { pipelineVersion: "1.0", status: "COMPLETED" },
                build: { buildId: "b-123", status: "SUCCESS" },
                regression: { passed: true, failed: 0, total: 984 }
            };

            const result = evaluateReleaseCriteria(input);
            assert.strictEqual(result.auditPassed, true);
            assert.strictEqual(result.verificationPassed, true);
            assert.strictEqual(result.repairPassed, true);
            assert.strictEqual(result.regressionPassed, true);
            assert.strictEqual(result.metadataComplete, true);
            assert.strictEqual(result.mandatoryPassed, true);
            assert.ok(Object.isFrozen(result));
        });

        test("2. Detects failing audit gate", () => {
            const input = {
                audit: { passed: false },
                verification: { success: true, errors: [] },
                repair: { passed: true },
                execution: { status: "COMPLETED" },
                build: { status: "SUCCESS" },
                regression: { passed: true, failed: 0, total: 10 }
            };

            const result = evaluateReleaseCriteria(input);
            assert.strictEqual(result.auditPassed, false);
            assert.strictEqual(result.mandatoryPassed, false);
        });

        test("3. Detects failing verification gate with error count", () => {
            const input = {
                audit: { passed: true },
                verification: { success: false, errors: [{ message: "Syntax error" }] },
                repair: { passed: true },
                execution: { status: "COMPLETED" },
                build: { status: "SUCCESS" },
                regression: { passed: true, failed: 0, total: 10 }
            };

            const result = evaluateReleaseCriteria(input);
            assert.strictEqual(result.verificationPassed, false);
            assert.strictEqual(result.details.verificationErrorsCount, 1);
            assert.strictEqual(result.mandatoryPassed, false);
        });

        test("4. Detects failing repair history", () => {
            const input = {
                audit: { passed: true },
                verification: { success: true },
                repair: [{ file: "src/app.js", success: false }],
                execution: {},
                build: {},
                regression: { passed: true, failed: 0, total: 10 }
            };

            const result = evaluateReleaseCriteria(input);
            assert.strictEqual(result.repairPassed, false);
            assert.strictEqual(result.details.repairFailuresCount, 1);
            assert.strictEqual(result.mandatoryPassed, false);
        });

        test("5. Detects incomplete metadata", () => {
            const input = {
                audit: { passed: true },
                verification: { success: true },
                repair: { passed: true },
                execution: null, // missing execution metadata
                build: { status: "SUCCESS" },
                regression: { passed: true, failed: 0, total: 10 }
            };

            const result = evaluateReleaseCriteria(input);
            assert.strictEqual(result.metadataComplete, false);
            assert.strictEqual(result.mandatoryPassed, true); // metadata incomplete doesn't fail mandatory, but flags metadataComplete
        });

        test("6. Pure function behavior: same inputs yield same outputs without side effects", () => {
            const input = { audit: { passed: true } };
            const r1 = evaluateReleaseCriteria(input);
            const r2 = evaluateReleaseCriteria(input);
            assert.deepStrictEqual(r1, r2);
        });
    });
};
