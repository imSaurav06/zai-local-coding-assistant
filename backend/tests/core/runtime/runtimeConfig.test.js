"use strict";

const assert = require("assert");

module.exports = function registerRuntimeConfigTests(suite, test) {
    const {
        createRuntimeConfig,
        loadRuntimeConfig,
        validateRuntimeConfig,
        isRuntimeConfig,
        runtimeConfigErrorCodes,
        RUNTIME_CONFIG_VERSION
    } = require("../../../core/runtime");

    suite("Runtime Configuration Model Layer (Phase 11A-1)", () => {
        // ── 1. Default configuration ──
        test("1. createRuntimeConfig() successfully creates default config structure", () => {
            const res = createRuntimeConfig({});
            assert.strictEqual(res.success, true);
            assert.ok(res.runtimeConfig);
            assert.strictEqual(res.runtimeConfig.runtimeMode, "LEGACY");
            assert.strictEqual(res.runtimeConfig.maxConcurrentWorkers, 3);
            assert.strictEqual(res.runtimeConfig.enableShadowValidation, false);
            assert.strictEqual(res.runtimeConfig.enableRuntimeMetrics, false);
            assert.strictEqual(res.runtimeConfig.enableCheckpointPersistence, false);

            assert.strictEqual(isRuntimeConfig(res.runtimeConfig), true);
        });

        // ── 2. LEGACY, MODULAR, SHADOW modes ──
        test("2. validates and accepts all supported modes", () => {
            const modes = ["LEGACY", "MODULAR", "SHADOW"];
            for (const mode of modes) {
                const res = createRuntimeConfig({ runtimeMode: mode });
                assert.strictEqual(res.success, true);
                assert.strictEqual(res.runtimeConfig.runtimeMode, mode);
            }
        });

        // ── 3. Invalid mode ──
        test("3. rejects invalid mode strings", () => {
            const res = createRuntimeConfig({ runtimeMode: "INVALID_MODE" });
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.errors[0].code, runtimeConfigErrorCodes.RUNTIME_CONFIG_INVALID_MODE);
        });

        // ── 4. Invalid worker count ──
        test("4. rejects negative or non-integer worker counts", () => {
            const badCounts = [-1, 2.5, "five"];
            for (const workers of badCounts) {
                const res = createRuntimeConfig({ maxConcurrentWorkers: workers });
                assert.strictEqual(res.success, false);
                assert.strictEqual(res.errors[0].code, runtimeConfigErrorCodes.RUNTIME_CONFIG_INVALID_STRUCTURE);
            }
        });

        // ── 5. Unknown property ──
        test("5. rejects unknown/non-canonical configuration keys", () => {
            const res = createRuntimeConfig({ runtimeMode: "LEGACY", unknownProp: "value" });
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.errors[0].code, runtimeConfigErrorCodes.RUNTIME_CONFIG_UNKNOWN_PROPERTY);
        });

        // ── 6. Deep freeze ──
        test("6. outputs are deeply frozen and immutable", () => {
            const res = createRuntimeConfig({});
            const config = res.runtimeConfig;
            
            assert.ok(Object.isFrozen(config));
            assert.throws(() => {
                config.runtimeMode = "MODULAR";
            }, TypeError);
        });

        // ── 7. Deterministic equality ──
        test("7. deterministic equality is preserved across matching instances", () => {
            const config1 = createRuntimeConfig({ runtimeMode: "MODULAR", maxConcurrentWorkers: 5 });
            const config2 = createRuntimeConfig({ runtimeMode: "MODULAR", maxConcurrentWorkers: 5 });
            assert.deepStrictEqual(config1, config2);
        });

        // ── 8. Input non-mutation ──
        test("8. does not mutate input config objects", () => {
            const original = { runtimeMode: "LEGACY", maxConcurrentWorkers: 2 };
            const cloned = { ...original };
            createRuntimeConfig(original);
            assert.deepStrictEqual(original, cloned);
        });

        // ── 9. Environment loading via loadRuntimeConfig ──
        test("9. loadRuntimeConfig loads configuration from environment", () => {
            const originalMode = process.env.RUNTIME_MODE;
            const originalWorkers = process.env.MAX_CONCURRENT_WORKERS;

            try {
                process.env.RUNTIME_MODE = "MODULAR";
                process.env.MAX_CONCURRENT_WORKERS = "4";

                const config = loadRuntimeConfig();
                assert.strictEqual(config.runtimeMode, "MODULAR");
                assert.strictEqual(config.maxConcurrentWorkers, 4);
                assert.strictEqual(isRuntimeConfig(config), true);
            } finally {
                process.env.RUNTIME_MODE = originalMode;
                process.env.MAX_CONCURRENT_WORKERS = originalWorkers;
            }
        });
    });
};
