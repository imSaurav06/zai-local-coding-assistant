"use strict";

const assert = require("assert");

module.exports = function registerRuntimeRouterTests(suite, test) {
    const {
        createExecutionRuntimeAdapter,
        createRuntimeRouter,
        selectRuntime,
        executeRuntime,
        validateRuntimeSelection,
        runtimeRouterErrorCodes,
        RUNTIME_ROUTER_VERSION
    } = require("../../../core/runtime");

    function getSampleRequest() {
        return {
            projectSpec: {
                projectName: "RouterApp",
                projectType: "react-vite",
                frontend: "React",
                backend: "None",
                database: "None",
                authentication: "None",
                designRequirements: "None"
            },
            metadata: {
                originalPrompt: "Test routing functionality"
            }
        };
    }

    suite("Runtime Router Layer (Phase 11B-1)", () => {
        // Clear mocks after each test
        test("z. Clean mocks", () => {
            global.__shadowModularMock = null;
            global.__throwShadowErrors = null;
            global.__throwParityMismatchInTest = null;
        });

        // ── 1. Default Selection ──
        test("1. selectRuntime() defaults to LEGACY mode when no config property is provided", () => {
            const mode = selectRuntime({});
            assert.strictEqual(mode, "LEGACY");
        });

        // ── 2. Selection Routing ──
        test("2. selectRuntime() resolves correct runtime mode", () => {
            assert.strictEqual(selectRuntime({ runtimeMode: "LEGACY" }), "LEGACY");
            assert.strictEqual(selectRuntime({ runtimeMode: "MODULAR" }), "MODULAR");
            assert.strictEqual(selectRuntime({ runtimeMode: "SHADOW" }), "SHADOW");
        });

        // ── 3. Invalid Mode ──
        test("3. selectRuntime() throws RUNTIME_ROUTER_INVALID_MODE for unsupported mode values", () => {
            assert.throws(() => {
                selectRuntime({ runtimeMode: "HYBRID" });
            }, (err) => {
                return err.code === runtimeRouterErrorCodes.RUNTIME_ROUTER_INVALID_MODE;
            });
        });

        // ── 4. LEGACY routing execution ──
        test("4. executeRuntime() successfully executes and returns runtime LEGACY response", async () => {
            const adapter = createExecutionRuntimeAdapter({ runtimeMode: "LEGACY" });
            const req = getSampleRequest();
            
            const res = await executeRuntime(adapter, req);
            assert.ok(res);
            assert.strictEqual(res.runtime, "LEGACY");
            assert.strictEqual(res.success, true);
        });

        // ── 5. MODULAR routing execution (STUB ONLY) ──
        test("5. executeRuntime() returns the deterministic NOT_IMPLEMENTED stub in MODULAR mode", async () => {
            const adapter = createExecutionRuntimeAdapter({ runtimeMode: "MODULAR" });
            const req = getSampleRequest();

            const res = await executeRuntime(adapter, req);
            assert.ok(res);
            assert.ok(Object.isFrozen(res));
            assert.deepStrictEqual(res, {
                runtime: "MODULAR",
                status: "NOT_IMPLEMENTED",
                message: "Modular runtime activation is scheduled for Phase 11B-2."
            });
        });

        // ── 6. SHADOW routing execution ──
        test("6. executeRuntime() successfully executes in SHADOW mode triggering parity checks", async () => {
            const adapter = createExecutionRuntimeAdapter({
                runtimeMode: "SHADOW",
                enableShadowRuntime: true,
                enableParityValidation: true
            });
            const req = getSampleRequest();

            // Set global modular mock to return slightly different structure to verify shadow parity triggered
            global.__shadowModularMock = (r, legacy) => {
                const res = JSON.parse(JSON.stringify(legacy));
                res.result.model = "mismatched-model";
                return res;
            };
            global.__throwParityMismatchInTest = true;

            // Should reject with parity mismatch error
            await assert.rejects(async () => {
                await executeRuntime(adapter, req);
            }, (err) => {
                return err.code === "PARITY_VALIDATION_FAILED";
            });
        });

        // ── 7. Deep Freeze & Immutability ──
        test("7. createRuntimeRouter config and selectRuntime output are frozen", () => {
            const router = createRuntimeRouter({ runtimeMode: "LEGACY" });
            assert.ok(Object.isFrozen(router));
            assert.ok(Object.isFrozen(router.config));
        });

        // ── 8. Input Non-Mutation ──
        test("8. executeRuntime() does not mutate input request object", async () => {
            const adapter = createExecutionRuntimeAdapter({ runtimeMode: "LEGACY" });
            const req = getSampleRequest();
            const origJson = JSON.stringify(req);

            await executeRuntime(adapter, req);
            assert.strictEqual(JSON.stringify(req), origJson);
        });

        // ── 9. Validation Rejections ──
        test("9. executeRuntime() throws RUNTIME_ROUTER_INVALID_REQUEST for invalid adapter config structure", async () => {
            await assert.rejects(async () => {
                await executeRuntime(null, getSampleRequest());
            }, (err) => {
                return err.code === runtimeRouterErrorCodes.RUNTIME_ROUTER_INVALID_REQUEST;
            });
        });

        // ── 10. Public API exports ──
        test("10. exposes correct version and router builder exports", () => {
            assert.strictEqual(RUNTIME_ROUTER_VERSION, "1.0");
            assert.ok(createRuntimeRouter);
            assert.ok(selectRuntime);
            assert.ok(executeRuntime);
            assert.ok(validateRuntimeSelection);
        });
    });
};
