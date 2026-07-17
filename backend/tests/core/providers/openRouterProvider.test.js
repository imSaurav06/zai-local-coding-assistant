"use strict";

const assert = require("assert");
const axios = require("axios");

module.exports = function registerOpenRouterTests(suite, test) {
    const {
        OpenRouterProvider,
        AIProvider,
        providerInterfaceErrorCodes
    } = require("../../../core/providers");

    const originalPost = axios.post;

    suite("OpenRouter Provider Adapter Layer (Phase 10B-3)", () => {
        
        test("z. Restore axios post stub", () => {
            axios.post = originalPost;
        });

        test("1. OpenRouterProvider implements AIProvider and validates interface inheritance", () => {
            const provider = new OpenRouterProvider();
            assert.ok(provider instanceof AIProvider);
        });

        test("2. initialize() configures the provider and throws if apiKey is missing", async () => {
            const provider = new OpenRouterProvider();

            // Missing apiKey
            await assert.rejects(async () => {
                await provider.initialize({});
            }, (err) => {
                return err.code === providerInterfaceErrorCodes.PROVIDER_INTERFACE_INVALID_ARGUMENT;
            });

            // Correct initialize
            await provider.initialize({ apiKey: "test_key_123" });
            assert.strictEqual(provider.initialized, true);
            assert.strictEqual(provider.config.apiKey, "test_key_123");
            assert.strictEqual(provider.config.baseURL, "https://openrouter.ai/api/v1");
        });

        test("3. health() verifies initialization state", async () => {
            const provider = new OpenRouterProvider();
            
            await assert.rejects(async () => {
                await provider.health();
            }, (err) => {
                return err.code === providerInterfaceErrorCodes.PROVIDER_INTERFACE_UNSUPPORTED_OPERATION;
            });

            await provider.initialize({ apiKey: "test" });
            const healthReport = await provider.health();
            assert.strictEqual(healthReport.status, "healthy");
            assert.strictEqual(healthReport.details.provider, "openrouter");
        });

        test("4. chat() dispatches request, calls axios.post, and normalizes the successful response", async () => {
            const provider = new OpenRouterProvider();
            await provider.initialize({ apiKey: "test_key" });

            // Stub axios.post to simulate successful OpenRouter API return
            axios.post = async (url, data, config) => {
                assert.ok(url.includes("/chat/completions"));
                assert.strictEqual(config.headers.Authorization, "Bearer test_key");
                assert.strictEqual(data.messages[0].content, "Hello world");
                
                return {
                    data: {
                        choices: [{
                            message: { role: "assistant", content: "Response content" }
                        }],
                        usage: { prompt_tokens: 10, completion_tokens: 20 }
                    }
                };
            };

            const req = {
                messages: [{ role: "user", content: "Hello world" }],
                model: "google/gemini-2.5-flash",
                config: { temperature: 0.7 }
            };

            const response = await provider.chat(req);
            assert.ok(response);
            assert.strictEqual(response.success, true);
            assert.strictEqual(response.provider, "openrouter");
            assert.strictEqual(response.content, "Response content");
            assert.strictEqual(response.finishReason, "stop");
            assert.strictEqual(response.usage.prompt_tokens, 10);
        });

        test("5. chat() maps axios/API failures into deterministic provider errors", async () => {
            const provider = new OpenRouterProvider();
            await provider.initialize({ apiKey: "test_key" });

            // Stub axios.post to simulate API network error
            axios.post = async () => {
                throw new Error("Connection timed out");
            };

            const req = {
                messages: [{ role: "user", content: "Hello" }]
            };

            await assert.rejects(async () => {
                await provider.chat(req);
            }, (err) => {
                return err.code === "PROVIDER_CHAT_FAILED";
            });
        });

        test("6. complete() translates prompt into chat messages and normalizes response", async () => {
            const provider = new OpenRouterProvider();
            await provider.initialize({ apiKey: "test_key" });

            // Stub axios.post to verify it gets messages array
            axios.post = async (url, data) => {
                assert.strictEqual(data.messages[0].content, "Write code");
                return {
                    data: {
                        choices: [{ message: { role: "assistant", content: "code block" } }]
                    }
                };
            };

            const response = await provider.complete({ prompt: "Write code" });
            assert.ok(response);
            assert.strictEqual(response.success, true);
            assert.strictEqual(response.content, "code block");
        });

        test("7. supports() returns correct capabilities and unsupported methods reject", async () => {
            const provider = new OpenRouterProvider();
            assert.strictEqual(await provider.supports("chat"), true);
            assert.strictEqual(await provider.supports("completion"), true);
            assert.strictEqual(await provider.supports("streaming"), false);

            await assert.rejects(async () => {
                await provider.stream({});
            }, (err) => {
                return err.code === providerInterfaceErrorCodes.PROVIDER_INTERFACE_UNSUPPORTED_OPERATION;
            });
        });

        test("8. Verify openRouterProvider.js has no execution engine or recovery imports", () => {
            const fs = require("fs");
            const fileSource = fs.readFileSync(require.resolve("../../../core/providers/openRouterProvider.js"), "utf8");

            assert.ok(!fileSource.includes("ExecutionOrchestrator"));
            assert.ok(!fileSource.includes("recovery"));
            assert.ok(!fileSource.includes("Checkpoint"));
            assert.ok(!fileSource.includes("Mongo"));
        });
    });
};
