"use strict";

const assert = require("assert");
const axios = require("axios");

module.exports = function registerZaiTests(suite, test) {
    const {
        ZaiProvider,
        AIProvider,
        providerInterfaceErrorCodes
    } = require("../../../core/providers");

    const originalPost = axios.post;

    suite("Z.ai Provider Adapter Layer (Phase 10B-4)", () => {
        
        test("z. Restore axios post stub", () => {
            axios.post = originalPost;
        });

        test("1. ZaiProvider implements AIProvider and validates interface inheritance", () => {
            const provider = new ZaiProvider();
            assert.ok(provider instanceof AIProvider);
        });

        test("2. initialize() configures the provider and throws if apiKey is missing", async () => {
            const provider = new ZaiProvider();

            // Missing apiKey
            await assert.rejects(async () => {
                await provider.initialize({});
            }, (err) => {
                return err.code === providerInterfaceErrorCodes.PROVIDER_INTERFACE_INVALID_ARGUMENT;
            });

            // Correct initialize with defaults (model = glm-5.2)
            await provider.initialize({ apiKey: "test_key_zai" });
            assert.strictEqual(provider.initialized, true);
            assert.strictEqual(provider.config.apiKey, "test_key_zai");
            assert.strictEqual(provider.config.model, "glm-5.2");
        });

        test("3. initialize() configures the provider with model override", async () => {
            const provider = new ZaiProvider();
            await provider.initialize({ apiKey: "test_key_zai", model: "glm-6.0" });
            assert.strictEqual(provider.config.model, "glm-6.0");
        });

        test("4. health() verifies initialization state", async () => {
            const provider = new ZaiProvider();
            
            await assert.rejects(async () => {
                await provider.health();
            }, (err) => {
                return err.code === providerInterfaceErrorCodes.PROVIDER_INTERFACE_UNSUPPORTED_OPERATION;
            });

            await provider.initialize({ apiKey: "test" });
            const healthReport = await provider.health();
            assert.strictEqual(healthReport.status, "healthy");
            assert.strictEqual(healthReport.details.provider, "zai");
        });

        test("5. chat() dispatches request, calls axios.post, and normalizes the successful response", async () => {
            const provider = new ZaiProvider();
            await provider.initialize({ apiKey: "test_key_zai" });

            // Stub axios.post to simulate successful Z.ai API return
            axios.post = async (url, data, config) => {
                assert.ok(url.includes("/chat/completions"));
                assert.strictEqual(config.headers.Authorization, "Bearer test_key_zai");
                assert.strictEqual(data.messages[0].content, "Hello zai");
                assert.strictEqual(data.model, "glm-5.2");
                
                return {
                    data: {
                        choices: [{
                            message: { role: "assistant", content: "Zai response content" }
                        }],
                        usage: { prompt_tokens: 15, completion_tokens: 25 }
                    }
                };
            };

            const req = {
                messages: [{ role: "user", content: "Hello zai" }],
                model: "glm-5.2",
                config: { temperature: 0.5 }
            };

            const response = await provider.chat(req);
            assert.ok(response);
            assert.strictEqual(response.success, true);
            assert.strictEqual(response.provider, "zai");
            assert.strictEqual(response.content, "Zai response content");
            assert.strictEqual(response.finishReason, "stop");
            assert.strictEqual(response.usage.prompt_tokens, 15);
        });

        test("6. chat() maps axios/API failures into deterministic provider errors", async () => {
            const provider = new ZaiProvider();
            await provider.initialize({ apiKey: "test_key_zai" });

            // Stub axios.post to simulate API network error
            axios.post = async () => {
                throw new Error("Timeout occurred");
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

        test("7. complete() translates prompt into chat messages and normalizes response", async () => {
            const provider = new ZaiProvider();
            await provider.initialize({ apiKey: "test_key_zai" });

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

        test("8. supports() returns correct capabilities and unsupported methods reject", async () => {
            const provider = new ZaiProvider();
            assert.strictEqual(await provider.supports("chat"), true);
            assert.strictEqual(await provider.supports("completion"), true);
            assert.strictEqual(await provider.supports("streaming"), false);

            await assert.rejects(async () => {
                await provider.stream({});
            }, (err) => {
                return err.code === providerInterfaceErrorCodes.PROVIDER_INTERFACE_UNSUPPORTED_OPERATION;
            });
        });

        test("9. Verify zaiProvider.js has no execution engine or recovery imports", () => {
            const fs = require("fs");
            const fileSource = fs.readFileSync(require.resolve("../../../core/providers/zaiProvider.js"), "utf8");

            assert.ok(!fileSource.includes("ExecutionOrchestrator"));
            assert.ok(!fileSource.includes("recovery"));
            assert.ok(!fileSource.includes("Checkpoint"));
            assert.ok(!fileSource.includes("Mongo"));
        });
    });
};
