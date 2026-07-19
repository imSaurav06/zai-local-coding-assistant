"use strict";

const assert = require("assert");

module.exports = function registerRuntimeParityTests(suite, test) {
    const {
        createExecutionRuntimeAdapter,
        createDifferentialValidator,
        differentialValidationErrorCodes
    } = require("../../../core/runtime");

    const legacyOrchestrator = require("../../../services/generationOrchestrator");
    const originalOrchestrate = legacyOrchestrator.orchestrateGeneration;

    function getValidProjectSpec() {
        return {
            schemaVersion: "1.0",
            projectName: "ParityApp",
            projectType: "React Landing Page",
            frontend: "React (Vite) 18.2",
            backend: "None",
            database: "None",
            authentication: "None",
            designRequirements: "Tailwind CSS",
            pagesAndRoutes: [],
            components: [],
            backendApis: [],
            databaseModels: [],
            integrations: [],
            importantDependencies: [],
            environmentVariables: [],
            architectureConstraints: [],
            runBuildRequirements: { runScript: "npm run dev", buildScript: "npm run build" },
            deploymentRequirements: "Vercel",
            assumptions: []
        };
    }

    function getSampleResponse(runtime, custom = {}) {
        return {
            success: true,
            runtime,
            result: {
                files: [{ name: "A.js", content: "const a = 1;" }],
                runInstructions: "npm start",
                summary: "Scaffolded successfully",
                model: "gemini-3.5-flash",
                projectSpec: getValidProjectSpec()
            },
            metadata: {
                requirementIdentity: "req_123",
                verificationResult: null,
                repaired: false
            },
            ...custom
        };
    }

    suite("Runtime Parity & Differential Integration (Phase 11B-7A)", () => {
        // Clean up global hooks
        test("z. Cleanup global parity hooks", () => {
            global.__onDifferentialReport = null;
            global.__throwDifferentialMismatchInTest = null;
            legacyOrchestrator.orchestrateGeneration = originalOrchestrate;
        });

        test("1. execution adapter executes primary and secondary runtimes when enableShadowValidation is true", async () => {
            const spec = getValidProjectSpec();
            const request = {
                projectSpec: spec,
                metadata: { originalPrompt: "Create parity project" },
                options: {}
            };

            // Set up runtime adapter under LEGACY mode with shadow validation active
            const adapter = createExecutionRuntimeAdapter({
                runtimeMode: "LEGACY",
                enableShadowValidation: true
            });

            // Mock Legacy Orchestrate
            const legacyResponseRaw = getSampleResponse("LEGACY");
            legacyOrchestrator.orchestrateGeneration = async () => legacyResponseRaw.result;

            // Mock Modular Runtime execution
            const modularResponse = getSampleResponse("MODULAR");
            adapter.runtimeRouter = {
                selectRuntime: () => {
                    return {
                        execute: async () => legacyResponseRaw // Primary legacy run returns legacyResponseRaw
                    };
                }
            };

            // We mock the modular adapter via require caching or dynamically by modifying modular runtime adapter mock.
            // Let's modify modular adapter or require it. Wait, the adapter dynamically requires modularRuntimeAdapter.
            // Let's mock require("./modularRuntimeAdapter") by defining modular adapter's execution.
            // Wait, we can mock it by replacing require cache for "./modularRuntimeAdapter".
            const modularPath = require.resolve("../../../core/runtime/modularRuntimeAdapter");
            const originalModularModule = require.cache[modularPath];

            require.cache[modularPath] = {
                exports: {
                    createModularRuntimeAdapter: () => ({
                        execute: async () => modularResponse
                    }),
                    modularRuntimeAdapterErrorCodes: {
                        MODULAR_RUNTIME_INVALID_REQUEST: "MODULAR_RUNTIME_INVALID_REQUEST"
                    }
                }
            };

            let reportReceived = null;
            global.__onDifferentialReport = (report) => {
                reportReceived = report;
            };

            try {
                const res = await adapter.execute(request);

                // Verify that primary result (LEGACY) is returned unaffected
                assert.strictEqual(res.runtime, "LEGACY");
                assert.strictEqual(res.success, true);

                // Verify that report was generated and shows PASSED
                assert.ok(reportReceived);
                assert.strictEqual(reportReceived.comparisonStatus, "PASSED");
                assert.strictEqual(reportReceived.differences.length, 0);
            } finally {
                // Restore cache
                if (originalModularModule) {
                    require.cache[modularPath] = originalModularModule;
                } else {
                    delete require.cache[modularPath];
                }
            }
        });

        test("2. execution adapter throws DIFFERENTIAL_VALIDATION_FAILED if configured and mismatch occurs", async () => {
            const spec = getValidProjectSpec();
            const request = {
                projectSpec: spec,
                metadata: { originalPrompt: "Create mismatched project" },
                options: {}
            };

            const adapter = createExecutionRuntimeAdapter({
                runtimeMode: "LEGACY",
                enableShadowValidation: true
            });

            const legacyResponseRaw = getSampleResponse("LEGACY");
            legacyOrchestrator.orchestrateGeneration = async () => legacyResponseRaw.result;

            const modularResponse = getSampleResponse("MODULAR", { success: false }); // mismatched success status

            adapter.runtimeRouter = {
                selectRuntime: () => {
                    return {
                        execute: async () => legacyResponseRaw
                    };
                }
            };

            const modularPath = require.resolve("../../../core/runtime/modularRuntimeAdapter");
            const originalModularModule = require.cache[modularPath];

            require.cache[modularPath] = {
                exports: {
                    createModularRuntimeAdapter: () => ({
                        execute: async () => modularResponse
                    }),
                    modularRuntimeAdapterErrorCodes: {
                        MODULAR_RUNTIME_INVALID_REQUEST: "MODULAR_RUNTIME_INVALID_REQUEST"
                    }
                }
            };

            global.__throwDifferentialMismatchInTest = true;

            try {
                await assert.rejects(async () => {
                    await adapter.execute(request);
                }, (err) => {
                    return err.code === differentialValidationErrorCodes.DIFFERENTIAL_VALIDATION_FAILED &&
                           err.report.comparisonStatus === "FAILED";
                });
            } finally {
                global.__throwDifferentialMismatchInTest = false;
                if (originalModularModule) {
                    require.cache[modularPath] = originalModularModule;
                } else {
                    delete require.cache[modularPath];
                }
            }
        });

        test("3. legacy runtime execution is unaffected if shadow validation fails without throw configured", async () => {
            const spec = getValidProjectSpec();
            const request = {
                projectSpec: spec,
                metadata: { originalPrompt: "Create parity project" },
                options: {}
            };

            const adapter = createExecutionRuntimeAdapter({
                runtimeMode: "LEGACY",
                enableShadowValidation: true
            });

            const legacyResponseRaw = getSampleResponse("LEGACY");
            legacyOrchestrator.orchestrateGeneration = async () => legacyResponseRaw.result;

            const modularResponse = getSampleResponse("MODULAR", { success: false }); // mismatch

            adapter.runtimeRouter = {
                selectRuntime: () => {
                    return {
                        execute: async () => legacyResponseRaw
                    };
                }
            };

            const modularPath = require.resolve("../../../core/runtime/modularRuntimeAdapter");
            const originalModularModule = require.cache[modularPath];

            require.cache[modularPath] = {
                exports: {
                    createModularRuntimeAdapter: () => ({
                        execute: async () => modularResponse
                    }),
                    modularRuntimeAdapterErrorCodes: {
                        MODULAR_RUNTIME_INVALID_REQUEST: "MODULAR_RUNTIME_INVALID_REQUEST"
                    }
                }
            };

            global.__throwDifferentialMismatchInTest = false; // Production mode: don't throw

            try {
                const res = await adapter.execute(request);
                assert.strictEqual(res.runtime, "LEGACY");
                assert.strictEqual(res.success, true); // Legacy still completes successfully
            } finally {
                if (originalModularModule) {
                    require.cache[modularPath] = originalModularModule;
                } else {
                    delete require.cache[modularPath];
                }
            }
        });

        test("4. modular runtime execution is unaffected if shadow validation fails without throw configured", async () => {
            const spec = getValidProjectSpec();
            const request = {
                projectSpec: spec,
                metadata: { originalPrompt: "Create parity project" },
                options: {}
            };

            const adapter = createExecutionRuntimeAdapter({
                runtimeMode: "MODULAR",
                enableShadowValidation: true
            });

            const modularResponseRaw = getSampleResponse("MODULAR");

            adapter.runtimeRouter = {
                selectRuntime: () => {
                    return {
                        execute: async () => modularResponseRaw
                    };
                }
            };

            const legacyResponse = getSampleResponse("LEGACY", { success: false }); // mismatch

            const legacyPath = require.resolve("../../../core/runtime/legacyRuntimeAdapter");
            const originalLegacyModule = require.cache[legacyPath];

            require.cache[legacyPath] = {
                exports: {
                    createLegacyRuntimeAdapter: () => ({
                        execute: async () => legacyResponse
                    }),
                    LEGACY_RUNTIME_ADAPTER_VERSION: "1.0"
                }
            };

            global.__throwDifferentialMismatchInTest = false; // Production mode: don't throw

            try {
                const res = await adapter.execute(request);
                assert.strictEqual(res.runtime, "MODULAR");
                assert.strictEqual(res.success, true); // Modular still completes successfully
            } finally {
                if (originalLegacyModule) {
                    require.cache[legacyPath] = originalLegacyModule;
                } else {
                    delete require.cache[legacyPath];
                }
            }
        });
    });
};
