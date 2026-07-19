"use strict";

const assert = require("assert");

module.exports = function registerBuildValidatorTests(suite, test) {
    const { validateBuild } = require("../../../core/readiness/buildValidator");

    suite("Build Validator (Phase 13B)", () => {
        test("1. Validates complete build metadata cleanly", () => {
            const input = {
                status: "SUCCESS",
                version: "1.0.0",
                commitHash: "a1b2c3d4",
                timestamp: "2026-07-20T01:00:00Z"
            };

            const result = validateBuild(input);
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.errors.length, 0);
            assert.strictEqual(result.details.status, "SUCCESS");
            assert.strictEqual(result.details.version, "1.0.0");
            assert.strictEqual(result.details.commitHash, "a1b2c3d4");
            assert.ok(Object.isFrozen(result));
        });

        test("2. Detects invalid or unfulfilled build status as error", () => {
            const input = {
                status: "FAILED",
                version: "1.0.0"
            };

            const result = validateBuild(input);
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.some(e => e.includes("Build status")));
        });

        test("3. Captures missing optional build info as warnings", () => {
            const input = {
                status: "SUCCESS"
                // version, commitHash, timestamp missing
            };

            const result = validateBuild(input);
            assert.strictEqual(result.valid, true);
            assert.ok(result.warnings.some(w => w.includes("version")));
            assert.ok(result.warnings.some(w => w.includes("commit")));
        });

        test("4. Returns invalid result on null or invalid input", () => {
            assert.strictEqual(validateBuild(null).valid, false);
            assert.strictEqual(validateBuild([]).valid, false);
        });
    });
};
