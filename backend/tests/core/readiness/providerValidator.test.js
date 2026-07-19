"use strict";

const assert = require("assert");

module.exports = function registerProviderValidatorTests(suite, test) {
    const { validateProviders } = require("../../../core/readiness/providerValidator");

    suite("Provider Validator (Phase 13B)", () => {
        test("1. Validates complete provider metadata cleanly", () => {
            const input = {
                primaryProvider: "Z.ai",
                model: "GLM-5.2",
                fallbackProvider: "OpenRouter"
            };

            const result = validateProviders(input);
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.errors.length, 0);
            assert.strictEqual(result.details.primaryProvider, "Z.ai");
            assert.strictEqual(result.details.model, "GLM-5.2");
            assert.ok(Object.isFrozen(result));
        });

        test("2. Detects missing primary provider as error", () => {
            const input = {
                model: "GLM-5.2"
            };

            const result = validateProviders(input);
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.some(e => e.includes("Primary provider")));
        });

        test("3. Detects missing model as error", () => {
            const input = {
                primaryProvider: "Z.ai"
            };

            const result = validateProviders(input);
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.some(e => e.includes("model")));
        });

        test("4. Warns when fallback provider is omitted", () => {
            const input = {
                primaryProvider: "Z.ai",
                model: "GLM-5.2"
            };

            const result = validateProviders(input);
            assert.strictEqual(result.valid, true);
            assert.ok(result.warnings.some(w => w.includes("fallback provider")));
        });

        test("5. Returns invalid result on null or non-object input", () => {
            assert.strictEqual(validateProviders(null).valid, false);
            assert.strictEqual(validateProviders("invalid").valid, false);
        });
    });
};
