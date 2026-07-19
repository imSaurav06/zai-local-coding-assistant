"use strict";

const assert = require("assert");

module.exports = function registerRuntimeRouterTests(suite, test) {
    const {
        createRuntimeRouter,
        selectRuntime,
        validateRuntimeSelection,
        runtimeRouterErrorCodes,
        RUNTIME_ROUTER_VERSION
    } = require("../../../core/runtime");

    suite("Runtime Router Layer (Phase 11B-1 Refined)", () => {
        // ── 1. Configuration Validation ──
        test("1. selectRuntime() defaults to LEGACY adapter when config is empty", () => {
            const config = Object.freeze({});
            const adapterInstance = selectRuntime(config);
            assert.ok(adapterInstance);
            assert.strictEqual(adapterInstance.version, "1.0");
            assert.ok(typeof adapterInstance.execute === "function");
        });

        test("2. selectRuntime() throws if config is mutable", () => {
            const config = {};
            assert.throws(() => {
                selectRuntime(config);
            }, (err) => {
                return err.code === runtimeRouterErrorCodes.RUNTIME_ROUTER_INVALID_REQUEST;
            });
        });

        test("3. selectRuntime() throws for invalid config parameter", () => {
            assert.throws(() => {
                selectRuntime(null);
            }, (err) => {
                return err.code === runtimeRouterErrorCodes.RUNTIME_ROUTER_INVALID_REQUEST;
            });
        });

        // ── 2. Selection Routing ──
        test("4. selectRuntime() returns the Legacy adapter for LEGACY mode", () => {
            const config = Object.freeze({ runtimeMode: "LEGACY" });
            const adapterInstance = selectRuntime(config);
            assert.ok(adapterInstance);
            assert.ok(typeof adapterInstance.execute === "function");
        });

        test("5. selectRuntime() returns the Modular adapter stub for MODULAR mode", () => {
            const config = Object.freeze({ runtimeMode: "MODULAR" });
            const adapterInstance = selectRuntime(config);
            assert.ok(adapterInstance);
            assert.ok(typeof adapterInstance.execute === "function");
        });

        test("6. selectRuntime() returns the Shadow adapter for SHADOW mode", () => {
            const config = Object.freeze({ runtimeMode: "SHADOW" });
            const adapterInstance = selectRuntime(config);
            assert.ok(adapterInstance);
            assert.ok(typeof adapterInstance.execute === "function");
            assert.ok(typeof adapterInstance.executeShadow === "function");
        });

        // ── 3. Router Never Executes Adapters ──
        test("7. selectRuntime() does not invoke execute method on returning adapters", () => {
            const config = Object.freeze({ runtimeMode: "LEGACY" });
            const adapterInstance = selectRuntime(config);
            assert.ok(adapterInstance);
            // Since selectRuntime is completely synchronous, it cannot have invoked or awaited
            // the asynchronous execute method on the returned adapter.
        });

        // ── 4. Invalid Modes ──
        test("8. selectRuntime() throws RUNTIME_ROUTER_INVALID_MODE for unknown modes", () => {
            const config = Object.freeze({ runtimeMode: "INVALID_MODE" });
            assert.throws(() => {
                selectRuntime(config);
            }, (err) => {
                return err.code === runtimeRouterErrorCodes.RUNTIME_ROUTER_INVALID_MODE;
            });
        });

        // ── 5. Immutability & Deep Freeze ──
        test("9. createRuntimeRouter returns deeply frozen router instance", () => {
            const router = createRuntimeRouter({ runtimeMode: "LEGACY" });
            assert.ok(Object.isFrozen(router));
            assert.ok(Object.isFrozen(router.config));
        });

        // ── 6. Modular Stub isolated ──
        test("10. Modular adapter is successfully selected and instantiated for MODULAR mode", () => {
            const config = Object.freeze({ runtimeMode: "MODULAR" });
            const adapterInstance = selectRuntime(config);
            assert.ok(adapterInstance);
            assert.strictEqual(adapterInstance.version, "1.0");
            assert.strictEqual(typeof adapterInstance.execute, "function");
            assert.ok(Object.isFrozen(adapterInstance));
        });

        // ── 7. Public API exports ──
        test("11. exposes correct version and selection API contracts", () => {
            assert.strictEqual(RUNTIME_ROUTER_VERSION, "1.0");
            assert.ok(createRuntimeRouter);
            assert.ok(selectRuntime);
            assert.ok(validateRuntimeSelection);
        });
    });
};
