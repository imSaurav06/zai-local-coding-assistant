"use strict";

const assert = require("assert");

module.exports = function registerGatewayTests(suite, test) {
    const {
        createAIProviderGateway,
        AIProviderGateway,
        gatewayErrorCodes
    } = require("../../../core/providers");

    function getMockProvider(id, priority = 100) {
        return {
            id,
            priority,
            config: { model: "mock-model" },
            initialized: true,
            health: async () => ({ status: "healthy" }),
            supports: async (cap) => cap === "chat",
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

    suite("AI Provider Gateway Core Layer (Phase 10B-5B)", () => {
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

        // ── 5. Request validation ──
        test("5. execute() rejects invalid request formats", async () => {
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

        // ── 6. Priority selection: Z.ai Preferred over OpenRouter ──
        test("6. execute() selects highest-priority provider (Z.ai over OpenRouter) by default", async () => {
            const gateway = createAIProviderGateway();
            
            // Register OpenRouter (Priority 2)
            const openrouter = getMockProvider("openrouter", 2);
            // Register Zai (Priority 1)
            const zai = getMockProvider("zai", 1);

            gateway.registerProvider(openrouter);
            gateway.registerProvider(zai);

            const req = {
                messages: [{ role: "user", content: "hi" }]
            };

            const response = await gateway.execute(req);
            assert.strictEqual(response.provider, "zai"); // Zai is Priority 1, so it is preferred!
        });

        // ── 7. Automatic Fallback ──
        test("7. execute() falls back to OpenRouter when Z.ai fails", async () => {
            const gateway = createAIProviderGateway();
            
            // Zai fails transiently
            const zai = getMockProvider("zai", 1);
            zai.chat = async () => {
                throw new Error("API rate limit exceeded");
            };

            // OpenRouter succeeds
            const openrouter = getMockProvider("openrouter", 2);

            gateway.registerProvider(zai);
            gateway.registerProvider(openrouter);

            const req = {
                messages: [{ role: "user", content: "hello" }],
                maxRetries: 0 // turn off retries to trigger immediate fallback
            };

            const response = await gateway.execute(req);
            assert.strictEqual(response.provider, "openrouter"); // Fails back to OpenRouter!
            
            // Zai metrics should show failedRequests and fallbackCount
            const zaiMetrics = gateway.getProviderMetrics("zai");
            assert.strictEqual(zaiMetrics.failedRequests, 1);
            assert.strictEqual(zaiMetrics.fallbackCount, 1);
        });

        // ── 8. Retry success & exhaustion ──
        test("8. execute() retries on transient errors and succeeds on retry", async () => {
            const gateway = createAIProviderGateway();
            const provider = getMockProvider("zai", 1);
            
            let attempts = 0;
            provider.chat = async () => {
                attempts++;
                if (attempts === 1) {
                    throw new Error("Transient connection error");
                }
                return {
                    success: true,
                    provider: "zai",
                    content: "Recovered response"
                };
            };

            gateway.registerProvider(provider);

            const req = {
                messages: [{ role: "user", content: "hello" }],
                maxRetries: 1
            };

            const response = await gateway.execute(req);
            assert.strictEqual(response.content, "Recovered response");
            assert.strictEqual(attempts, 2);

            const metrics = gateway.getProviderMetrics("zai");
            assert.strictEqual(metrics.failedRequests, 1);
            assert.strictEqual(metrics.successfulRequests, 1);
        });

        test("9. execute() retries up to maxRetries and then throws error on exhaustion", async () => {
            const gateway = createAIProviderGateway();
            const provider = getMockProvider("zai", 1);
            
            let attempts = 0;
            provider.chat = async () => {
                attempts++;
                throw new Error("Persistent error");
            };

            gateway.registerProvider(provider);

            const req = {
                messages: [{ role: "user", content: "hello" }],
                maxRetries: 2
            };

            await assert.rejects(async () => {
                await gateway.execute(req);
            }, (err) => {
                return err.code === gatewayErrorCodes.GATEWAY_ALL_PROVIDERS_FAILED;
            });

            assert.strictEqual(attempts, 3); // 1 initial + 2 retries
        });

        // ── 9. Timeout fallback ──
        test("10. execute() triggers fallback when request times out", async () => {
            const gateway = createAIProviderGateway();
            
            // Zai times out
            const zai = getMockProvider("zai", 1);
            zai.chat = async () => {
                return new Promise((resolve) => setTimeout(resolve, 500)); // slow response
            };

            const openrouter = getMockProvider("openrouter", 2);

            gateway.registerProvider(zai);
            gateway.registerProvider(openrouter);

            const req = {
                messages: [{ role: "user", content: "hello" }],
                timeout: 50, // very short timeout
                maxRetries: 0
            };

            const response = await gateway.execute(req);
            assert.strictEqual(response.provider, "openrouter"); // Fails back to OpenRouter due to timeout!
        });

        // ── 10. Capability Routing ──
        test("11. execute() filters providers by capability supports", async () => {
            const gateway = createAIProviderGateway();
            
            const zai = getMockProvider("zai", 1);
            zai.supports = async (cap) => cap === "vision"; // supports vision only

            const openrouter = getMockProvider("openrouter", 2);
            openrouter.supports = async (cap) => cap === "chat"; // supports chat only

            gateway.registerProvider(zai);
            gateway.registerProvider(openrouter);

            // Chat request should route to openrouter, skipping zai
            const req = {
                capability: "chat",
                messages: [{ role: "user", content: "ping" }]
            };

            const response = await gateway.execute(req);
            assert.strictEqual(response.provider, "openrouter");
        });

        test("12. execute() throws GATEWAY_CAPABILITY_UNSUPPORTED when no provider supports capability", async () => {
            const gateway = createAIProviderGateway();
            const provider = getMockProvider("zai", 1);
            provider.supports = async () => false;

            gateway.registerProvider(provider);

            const req = {
                capability: "unsupported_cap",
                messages: []
            };

            await assert.rejects(async () => {
                await gateway.execute(req);
            }, (err) => {
                return err.code === gatewayErrorCodes.GATEWAY_CAPABILITY_UNSUPPORTED;
            });
        });

        // ── 11. Metrics updates ──
        test("13. health() includes metrics in provider status", async () => {
            const gateway = createAIProviderGateway();
            const provider = getMockProvider("zai", 1);
            gateway.registerProvider(provider);

            await gateway.execute({ messages: [] }); // execute request
            const status = await gateway.health();

            assert.strictEqual(status.providers.zai.metrics.successfulRequests, 1);
            assert.ok(status.providers.zai.metrics.averageLatency >= 0);
        });

        // ── 12. No runtime dependencies ──
        test("14. Verify aiProviderGateway.js has no execution orchestrator or recovery dependencies", () => {
            const fs = require("fs");
            const fileSource = fs.readFileSync(require.resolve("../../../core/providers/aiProviderGateway.js"), "utf8");

            assert.ok(!fileSource.includes("ExecutionOrchestrator"));
            assert.ok(!fileSource.includes("recovery"));
            assert.ok(!fileSource.includes("Checkpoint"));
            assert.ok(!fileSource.includes("Mongo"));
        });
    });
};
