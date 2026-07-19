"use strict";

const assert = require("assert");

module.exports = function registerEnvironmentValidatorTests(suite, test) {
    const { validateEnvironment } = require("../../../core/readiness/environmentValidator");

    suite("Environment Validator (Phase 13B)", () => {
        test("1. Validates complete environment metadata cleanly", () => {
            const input = {
                runtime: "node",
                nodeVersion: "v18.16.0",
                environmentType: "production",
                executionMetadata: { pipelineVersion: "1.0" }
            };

            const result = validateEnvironment(input);
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.errors.length, 0);
            assert.strictEqual(result.warnings.length, 0);
            assert.strictEqual(result.details.runtime, "node");
            assert.strictEqual(result.details.nodeVersion, "v18.16.0");
            assert.strictEqual(result.details.environmentType, "production");
            assert.ok(Object.isFrozen(result));
        });

        test("2. Detects missing runtime as error", () => {
            const input = {
                nodeVersion: "v18.16.0",
                environmentType: "production"
            };

            const result = validateEnvironment(input);
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.some(e => e.includes("Runtime")));
        });

        test("3. Captures missing optional fields as warnings", () => {
            const input = {
                runtime: "node"
                // nodeVersion, environmentType, executionMetadata missing
            };

            const result = validateEnvironment(input);
            assert.strictEqual(result.valid, true); // missing optional fields are warnings, not blocking errors
            assert.ok(result.warnings.length > 0);
            assert.ok(result.warnings.some(w => w.includes("Node version")));
        });

        test("4. Returns invalid result on null or non-object input", () => {
            const r1 = validateEnvironment(null);
            assert.strictEqual(r1.valid, false);

            const r2 = validateEnvironment([]);
            assert.strictEqual(r2.valid, false);
        });

        test("5. Pure function behavior: deterministic output with no process.env side effects", () => {
            const input = { runtime: "node", nodeVersion: "v18" };
            const res1 = validateEnvironment(input);
            const res2 = validateEnvironment(input);
            assert.deepStrictEqual(res1, res2);
        });
    });
};
