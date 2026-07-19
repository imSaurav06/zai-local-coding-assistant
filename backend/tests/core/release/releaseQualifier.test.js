"use strict";

const assert = require("assert");

module.exports = function registerReleaseQualifierTests(suite, test) {
    const { qualifyRelease } = require("../../../core/release/releaseQualifier");
    const { releaseErrorCodes } = require("../../../core/release/releaseErrors");

    suite("Release Qualifier Public API (Phase 13A)", () => {
        test("1. Rejects invalid or non-object inputs with INVALID_INPUT error code", () => {
            assert.throws(() => qualifyRelease(null), (err) => err.code === releaseErrorCodes.INVALID_INPUT);
            assert.throws(() => qualifyRelease(undefined), (err) => err.code === releaseErrorCodes.INVALID_INPUT);
            assert.throws(() => qualifyRelease([]), (err) => err.code === releaseErrorCodes.INVALID_INPUT);
            assert.throws(() => qualifyRelease("invalid"), (err) => err.code === releaseErrorCodes.INVALID_INPUT);
        });

        test("2. Qualifies a clean evidence bundle as RELEASE_CANDIDATE", () => {
            const input = {
                audit: { passed: true, score: 100 },
                verification: { success: true, errors: [] },
                repair: { passed: true, failedRepairs: 0 },
                execution: { pipelineVersion: "1.0", status: "COMPLETED" },
                build: { buildId: "b-100", status: "SUCCESS" },
                regression: { passed: true, failed: 0, total: 984 }
            };

            const result = qualifyRelease(input);

            assert.strictEqual(result.qualified, true);
            assert.strictEqual(result.level, "RELEASE_CANDIDATE");
            assert.strictEqual(result.score, 100);
            assert.ok(result.criteria);
            assert.ok(result.report);
            assert.ok(Object.isFrozen(result));
            assert.ok(Object.isFrozen(result.report));
        });

        test("3. Qualifies evidence bundle with minor warning as RELEASE_WITH_WARNINGS", () => {
            const input = {
                audit: { passed: true, score: 75 }, // deduct 25 -> score 75
                verification: { success: true, errors: [] },
                repair: { passed: true },
                execution: { status: "COMPLETED" },
                build: { status: "SUCCESS" },
                regression: { passed: true, failed: 0, total: 984 }
            };

            const result = qualifyRelease(input);

            assert.strictEqual(result.qualified, true);
            assert.strictEqual(result.level, "RELEASE_WITH_WARNINGS");
            assert.strictEqual(result.score, 75);
        });

        test("4. Returns NOT_READY when a mandatory criteria fails", () => {
            const input = {
                audit: { passed: false, score: 50 },
                verification: { success: true },
                repair: { passed: true },
                execution: { status: "COMPLETED" },
                build: { status: "SUCCESS" },
                regression: { passed: true, failed: 0, total: 984 }
            };

            const result = qualifyRelease(input);

            assert.strictEqual(result.qualified, false);
            assert.strictEqual(result.level, "NOT_READY");
        });

        test("5. Enforces output immutability (deep freeze)", () => {
            const result = qualifyRelease({});
            assert.ok(Object.isFrozen(result));
            assert.ok(Object.isFrozen(result.criteria));
            assert.ok(Object.isFrozen(result.report));
            assert.throws(() => { result.qualified = true; }, TypeError);
        });
    });
};
