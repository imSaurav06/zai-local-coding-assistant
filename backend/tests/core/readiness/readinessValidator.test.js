"use strict";

const assert = require("assert");

module.exports = function registerReadinessValidatorTests(suite, test) {
    const { validateProductionReadiness } = require("../../../core/readiness/readinessValidator");
    const { readinessErrorCodes } = require("../../../core/readiness/readinessErrors");

    suite("Readiness Validator Public API (Phase 13B)", () => {
        test("1. Rejects invalid or non-object inputs with INVALID_INPUT error code", () => {
            assert.throws(() => validateProductionReadiness(null), (err) => err.code === readinessErrorCodes.INVALID_INPUT);
            assert.throws(() => validateProductionReadiness(undefined), (err) => err.code === readinessErrorCodes.INVALID_INPUT);
            assert.throws(() => validateProductionReadiness([]), (err) => err.code === readinessErrorCodes.INVALID_INPUT);
            assert.throws(() => validateProductionReadiness("invalid"), (err) => err.code === readinessErrorCodes.INVALID_INPUT);
        });

        test("2. Validates a clean complete production metadata bundle cleanly", () => {
            const input = {
                environment: {
                    runtime: "node",
                    nodeVersion: "v18.16.0",
                    environmentType: "production",
                    executionMetadata: { pipelineVersion: "1.0" }
                },
                providers: {
                    primaryProvider: "Z.ai",
                    model: "GLM-5.2",
                    fallbackProvider: "OpenRouter"
                },
                configuration: {
                    jwtConfigured: true,
                    dbConfigured: true,
                    port: 5000,
                    schemaVersion: "1.0"
                },
                build: {
                    status: "SUCCESS",
                    version: "1.0.0",
                    commitHash: "abc1234",
                    timestamp: "2026-07-20T01:00:00Z"
                }
            };

            const result = validateProductionReadiness(input);

            assert.strictEqual(result.ready, true);
            assert.strictEqual(result.score, 100);
            assert.strictEqual(result.checks.environment, true);
            assert.strictEqual(result.checks.providers, true);
            assert.strictEqual(result.checks.configuration, true);
            assert.strictEqual(result.checks.build, true);
            assert.ok(result.report);
            assert.ok(Object.isFrozen(result));
            assert.ok(Object.isFrozen(result.report));
        });

        test("3. Fails readiness when a mandatory check fails", () => {
            const input = {
                environment: { runtime: "node" },
                providers: { primaryProvider: "Z.ai" }, // missing model -> invalid
                configuration: { port: 5000 },
                build: { status: "SUCCESS" }
            };

            const result = validateProductionReadiness(input);

            assert.strictEqual(result.ready, false);
            assert.strictEqual(result.checks.providers, false);
        });

        test("4. Aggregates warnings across all category validators", () => {
            const input = {
                environment: { runtime: "node" }, // warning: missing nodeVersion
                providers: { primaryProvider: "Z.ai", model: "GLM-5.2" }, // warning: missing fallback
                configuration: { port: 5000 },
                build: { status: "SUCCESS" }
            };

            const result = validateProductionReadiness(input);

            assert.ok(Array.isArray(result.warnings));
            assert.ok(result.warnings.length > 0);
        });

        test("5. Output is deeply frozen and immutable", () => {
            const result = validateProductionReadiness({});
            assert.ok(Object.isFrozen(result));
            assert.ok(Object.isFrozen(result.checks));
            assert.ok(Object.isFrozen(result.report));
            assert.throws(() => { result.ready = true; }, TypeError);
        });
    });
};
