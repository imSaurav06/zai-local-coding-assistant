"use strict";

const assert = require("assert");

module.exports = function registerGatewayTests(suite, test) {
    const {
        createAIProviderGateway,
        AIProviderGateway,
        gatewayErrorCodes
    } = require("../../../core/providers");

    function getMockProvider(id = "mock_provider") {
        return {
            id,
            config: { model: "mock-model" },
            initialized: true,
            health: async () => ({ status: "healthy" }),
            chat: async (req) => {
                return {
                    success: true,
                    provider: id,
                    model: "mock-model",
                    content: `Response from ${id}`,
                    usage: { prompt_tokens: 5 },
                    finishReason: "stop",
                    metadata: {}
                };
            }
        };
    }

    suite("AI Provider Gateway Core Layer (Phase 10B-5A)", () => {
        // ── 1. Gateway creation ──
        test("1. createAIProviderGateway returns an instance of AIProviderGateway", () => {
            const gateway = createAIProviderGateway();
            assert.ok(gateway instanceof AIProviderGateway);
        });

        // ── 2. Register & Remove provider ──
        test("2. registerProvider registers adapters and listProviders returns IDs", () => {
            const gateway = createAIProviderGateway();
            const provider1 = getMockProvider("p1");
            const provider2 = getMockProvider("p2");

            gateway.registerProvider(provider1);
            gateway.registerProvider(provider2);

            const list = gateway.listProviders();
            assert.ok(list.includes("p1"));
            assert.ok(list.includes("p2"));
            assert.strictEqual(list.length, 2);

            // Lookup provider
            assert.strictEqual(gateway.getProvider("p1"), provider1);

            // Remove provider
            gateway.unregisterProvider("p1");
            assert.strictEqual(gateway.getProvider("p1"), null);
            assert.strictEqual(gateway.listProviders().length, 1);
        });

        // ── 3. Duplicate provider rejection ──
        test("3. registerProvider rejects duplicate provider IDs", () => {
            const gateway = createAIProviderGateway();
            const provider1 = getMockProvider("p1");
            const provider2 = getMockProvider("p1");

            gateway.registerProvider(provider1);
            assert.throws(() => {
                gateway.registerProvider(provider2);
            }, (err) => {
                return err.code === gatewayErrorCodes.GATEWAY_DUPLICATE_PROVIDER;
            });
        });

        // ── 4. Execute request ──
        test("4. execute() resolves provider, invokes chat, and normalizes response", async () => {
            const gateway = createAIProviderGateway();
            const provider = getMockProvider("openai_gpt4");
            gateway.registerProvider(provider);

            const req = {
                providerId: "openai_gpt4",
                messages: [{ role: "user", content: "Hi" }]
            };

            const response = await gateway.execute(req);
            assert.ok(response);
            assert.strictEqual(response.success, true);
            assert.strictEqual(response.provider, "openai_gpt4");
            assert.strictEqual(response.content, "Response from openai_gpt4");
            assert.strictEqual(response.usage.prompt_tokens, 5);
        });

        // ── 5. Unknown provider ──
        test("5. execute() throws GATEWAY_PROVIDER_NOT_FOUND when requesting unregistered ID", async () => {
            const gateway = createAIProviderGateway();

            const req = {
                providerId: "non_existent",
                messages: []
            };

            await assert.rejects(async () => {
                await gateway.execute(req);
            }, (err) => {
                return err.code === gatewayErrorCodes.GATEWAY_PROVIDER_NOT_FOUND;
            });
        });

        // ── 6. Request validation ──
        test("6. execute() rejects invalid request formats", async () => {
            const gateway = createAIProviderGateway();

            // Null request
            await assert.rejects(async () => {
                await gateway.execute(null);
            }, (err) => {
                return err.code === gatewayErrorCodes.GATEWAY_INVALID_REQUEST;
            });

            // Missing messages
            await assert.rejects(async () => {
                await gateway.execute({ providerId: "test" });
            }, (err) => {
                return err.code === gatewayErrorCodes.GATEWAY_INVALID_REQUEST;
            });
        });

        // ── 7. Health status aggregation ──
        test("7. health() aggregates status reports from all registered providers", async () => {
            const gateway = createAIProviderGateway();
            
            const p1 = getMockProvider("p1");
            const p2 = {
                id: "p2",
                health: async () => {
                    throw new Error("API rate limits exceeded");
                }
            };

            gateway.registerProvider(p1);
            gateway.registerProvider(p2);

            const status = await gateway.health();
            assert.strictEqual(status.status, "unhealthy");
            assert.strictEqual(status.providers.p1.status, "healthy");
            assert.strictEqual(status.providers.p2.status, "unhealthy");
            assert.strictEqual(status.providers.p2.error, "API rate limits exceeded");
        });

        // ── 8. No runtime dependencies ──
        test("8. Verify aiProviderGateway.js has no execution orchestrator or recovery dependencies", () => {
            const fs = require("fs");
            const fileSource = fs.readFileSync(require.resolve("../../../core/providers/aiProviderGateway.js"), "utf8");

            assert.ok(!fileSource.includes("ExecutionOrchestrator"));
            assert.ok(!fileSource.includes("recovery"));
            assert.ok(!fileSource.includes("Checkpoint"));
            assert.ok(!fileSource.includes("Mongo"));
        });
    });
};
