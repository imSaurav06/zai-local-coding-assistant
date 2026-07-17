"use strict";

const assert = require("assert");

module.exports = function registerProviderInterfaceTests(suite, test) {
    const {
        createProviderInterface,
        AIProvider,
        providerInterfaceErrorCodes
    } = require("../../../core/providers");

    suite("AI Provider Interface Layer (Phase 10B-2)", () => {
        // ── 1. Interface creation ──
        test("1. createProviderInterface returns a frozen instance of AIProvider", () => {
            const provider = createProviderInterface();
            assert.ok(provider instanceof AIProvider);
            assert.ok(Object.isFrozen(provider));
        });

        // ── 2. Error codes immutability ──
        test("2. providerInterfaceErrorCodes is deeply frozen and immutable", () => {
            assert.ok(Object.isFrozen(providerInterfaceErrorCodes));
            assert.throws(() => {
                providerInterfaceErrorCodes.NEW_CODE = "TEST";
            });
        });

        // ── 3. Every method throws PROVIDER_INTERFACE_NOT_IMPLEMENTED ──
        test("3. Every method on AIProvider interface throws PROVIDER_INTERFACE_NOT_IMPLEMENTED", async () => {
            const provider = createProviderInterface();

            const methods = [
                () => provider.initialize({}),
                () => provider.health(),
                () => provider.chat({}),
                () => provider.complete({}),
                () => provider.stream({}),
                () => provider.countTokens({}),
                () => provider.listModels(),
                () => provider.supports("chat"),
                () => provider.shutdown()
            ];

            for (const fn of methods) {
                await assert.rejects(async () => {
                    await fn();
                }, (err) => {
                    return err.code === providerInterfaceErrorCodes.PROVIDER_INTERFACE_NOT_IMPLEMENTED;
                });
            }
        });

        // ── 4. Isolation Checks ──
        test("4. Verify interface module does not import axios, fetch, or runtime execution layers", () => {
            const fs = require("fs");
            const fileSource = fs.readFileSync(require.resolve("../../../core/providers/providerInterface.js"), "utf8");

            assert.ok(!fileSource.includes("axios"));
            assert.ok(!fileSource.includes("fetch"));
            assert.ok(!fileSource.includes("ExecutionOrchestrator"));
            assert.ok(!fileSource.includes("AIProviderGateway"));
        });
    });
};
