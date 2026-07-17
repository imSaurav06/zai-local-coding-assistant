"use strict";

const assert = require("assert");

module.exports = function registerProviderModelTests(suite, test) {
    const {
        createProvider,
        validateProvider,
        isProvider,
        deepFreezeProvider,
        providerErrorCodes,
        PROVIDER_MODEL_VERSION
    } = require("../../../core/providers");

    function getSampleValidConfig() {
        return {
            id: "openai_gpt4",
            name: "GPT-4o",
            type: "chat",
            version: PROVIDER_MODEL_VERSION,
            status: "ACTIVE",
            capabilities: ["chat", "vision", "toolCalling"],
            limits: {
                maxTokens: 4096,
                maxContext: 128000,
                maxRequestsPerMinute: 500
            },
            pricing: {
                inputPerMillion: 5.0,
                outputPerMillion: 15.0
            },
            metadata: {
                releaseDate: "2024-05-13"
            }
        };
    }

    suite("AI Provider Domain Model Layer (Phase 10B-1)", () => {
        // ── 1. Successful creation ──
        test("1. createProvider constructs a valid, deeply frozen Provider object", () => {
            const config = getSampleValidConfig();
            const res = createProvider(config);

            assert.strictEqual(res.success, true);
            assert.deepStrictEqual(res.errors, []);
            assert.ok(res.provider);
            
            // Check status / values
            assert.strictEqual(res.provider.id, "openai_gpt4");
            assert.strictEqual(res.provider.status, "ACTIVE");
            assert.deepStrictEqual(res.provider.capabilities, ["chat", "vision", "toolCalling"]);

            // Immutability checks
            assert.ok(Object.isFrozen(res.provider));
            assert.ok(Object.isFrozen(res.provider.capabilities));
            assert.ok(Object.isFrozen(res.provider.limits));
            assert.ok(Object.isFrozen(res.provider.pricing));
            assert.ok(Object.isFrozen(res.provider.metadata));

            assert.strictEqual(isProvider(res.provider), true);
        });

        // ── 2. Invalid inputs ──
        test("2. createProvider rejects invalid inputs (null, undefined, arrays, non-objects)", () => {
            const badInputs = [null, undefined, "not-an-object", [1, 2, 3], () => {}];
            for (const input of badInputs) {
                const res = createProvider(input);
                assert.strictEqual(res.success, false);
                assert.strictEqual(res.provider, null);
                assert.strictEqual(res.errors[0].code, providerErrorCodes.PROVIDER_INVALID_INPUT);
            }
        });

        // ── 3. Invalid structure ──
        test("3. createProvider rejects missing or invalid canonical fields", () => {
            // Missing id
            const config1 = getSampleValidConfig();
            delete config1.id;
            const res1 = createProvider(config1);
            assert.strictEqual(res1.success, false);
            assert.strictEqual(res1.errors[0].code, providerErrorCodes.PROVIDER_INVALID_STRUCTURE);
            assert.strictEqual(res1.errors[0].path, "id");

            // Invalid status value
            const config2 = getSampleValidConfig();
            config2.status = "UNSUPPORTED_STATUS";
            const res2 = createProvider(config2);
            assert.strictEqual(res2.success, false);
            assert.strictEqual(res2.errors[0].code, providerErrorCodes.PROVIDER_INVALID_STRUCTURE);
            assert.strictEqual(res2.errors[0].path, "status");

            // Limits is not an object
            const config3 = getSampleValidConfig();
            config3.limits = "not-an-object";
            const res3 = createProvider(config3);
            assert.strictEqual(res3.success, false);
            assert.strictEqual(res3.errors[0].code, providerErrorCodes.PROVIDER_INVALID_STRUCTURE);
            assert.strictEqual(res3.errors[0].path, "limits");

            // Limits value is negative
            const config4 = getSampleValidConfig();
            config4.limits.maxTokens = -10;
            const res4 = createProvider(config4);
            assert.strictEqual(res4.success, false);
            assert.strictEqual(res4.errors[0].code, providerErrorCodes.PROVIDER_INVALID_STRUCTURE);
            assert.strictEqual(res4.errors[0].path, "limits.maxTokens");
        });

        // ── 4. Duplicate capabilities ──
        test("4. createProvider rejects duplicate capability items", () => {
            const config = getSampleValidConfig();
            config.capabilities = ["chat", "vision", "chat"]; // duplicate "chat"

            const res = createProvider(config);
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.errors[0].code, providerErrorCodes.PROVIDER_DUPLICATE_CAPABILITY);
            assert.strictEqual(res.errors[0].path, "capabilities[2]");
        });

        // ── 5. Unknown properties ──
        test("5. createProvider rejects unknown properties at the top-level", () => {
            const config = getSampleValidConfig();
            config.unknownSecretKey = "super-secret";

            const res = createProvider(config);
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.errors[0].code, providerErrorCodes.PROVIDER_UNKNOWN_PROPERTY);
            assert.strictEqual(res.errors[0].path, "unknownSecretKey");
        });

        // ── 6. Input non-mutation ──
        test("6. createProvider does not mutate user input config", () => {
            const config = getSampleValidConfig();
            const originalJson = JSON.stringify(config);

            createProvider(config);

            assert.strictEqual(JSON.stringify(config), originalJson);
        });

        // ── 7. Type guards and deepFreeze ──
        test("7. isProvider returns false for unfrozen or partially structured objects", () => {
            const config = getSampleValidConfig();
            
            // Unfrozen object is not a provider
            assert.strictEqual(isProvider(config), false);

            // Manual freezing without validation fails too
            const partial = Object.freeze({ id: "partial" });
            assert.strictEqual(isProvider(partial), false);
        });

        // ── 8. Deterministic equality ──
        test("8. Deterministic value equality is preserved across multiple instantiations", () => {
            const config1 = getSampleValidConfig();
            const config2 = getSampleValidConfig();

            const p1 = createProvider(config1).provider;
            const p2 = createProvider(config2).provider;

            assert.deepStrictEqual(p1, p2);
        });
    });
};
