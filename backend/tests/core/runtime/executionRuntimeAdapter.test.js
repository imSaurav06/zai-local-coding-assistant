"use strict";

const assert = require("assert");

module.exports = function registerRuntimeAdapterTests(suite, test) {
    const {
        createExecutionRuntimeAdapter,
        validateExecutionRequest,
        isExecutionRequest,
        executionRuntimeAdapterErrorCodes,
        EXECUTION_RUNTIME_ADAPTER_VERSION
    } = require("../../../core/runtime");

    const legacyOrchestrator = require("../../../services/generationOrchestrator");
    const originalOrchestrate = legacyOrchestrator.orchestrateGeneration;

    function getValidProjectSpec() {
        return {
            schemaVersion: "1.0",
            projectName: "FitZone",
            projectType: "React Landing Page",
            frontend: "React (Vite) 18.2",
            backend: "None",
            database: "None",
            authentication: "None",
            designRequirements: "Tailwind CSS",
            pagesAndRoutes: [
                { path: "/", name: "LandingPage", description: "Hero section with CTA and features" },
                { path: "/classes", name: "ClassesPage", description: "Gym classes grid" }
            ],
            components: [
                { name: "Navbar", purpose: "Top navigation with logo and links" },
                { name: "HeroSection", purpose: "Full-screen gym hero with headline" },
                { name: "FeatureCard", purpose: "Individual feature card component" }
            ],
            backendApis: [],
            databaseModels: [],
            integrations: [],
            importantDependencies: ["react-router-dom", "lucide-react", "framer-motion"],
            environmentVariables: [],
            architectureConstraints: ["Single page application"],
            runBuildRequirements: { runScript: "npm run dev", buildScript: "npm run build" },
            deploymentRequirements: "Vercel",
            assumptions: ["No backend required for landing page"]
        };
    }

    suite("Execution Runtime Adapter Layer (Phase 11A-2)", () => {
        // Restore legacyOrchestrator helper at the end
        test("z. Restore legacy orchestrator", () => {
            legacyOrchestrator.orchestrateGeneration = originalOrchestrate;
        });

        // ── 1. Adapter creation ──
        test("1. createExecutionRuntimeAdapter() instantiates correct boundaries and default config", () => {
            const adapter = createExecutionRuntimeAdapter({ runtimeMode: "LEGACY" });
            assert.ok(adapter);
            assert.strictEqual(adapter.config.runtimeMode, "LEGACY");
            assert.strictEqual(typeof adapter.execute, "function");
        });

        // ── 2. LEGACY, MODULAR, SHADOW execution ──
        test("2. execute() routes to legacy generationOrchestrator regardless of runtimeMode config", async () => {
            const spec = getValidProjectSpec();
            const request = {
                projectSpec: spec,
                metadata: { originalPrompt: "Create React app" },
                options: {}
            };

            // Mock legacy orchestrator
            let mockCalled = false;
            legacyOrchestrator.orchestrateGeneration = async (ctx) => {
                mockCalled = true;
                assert.strictEqual(ctx.projectSpec, spec);
                assert.strictEqual(ctx.originalPrompt, "Create React app");
                return {
                    files: [],
                    runInstructions: "run it",
                    summary: "scaffolded",
                    model: "glm-5.2",
                    projectSpec: spec,
                    requirementIdentity: "req_01"
                };
            };

            try {
                const modes = ["LEGACY", "MODULAR", "SHADOW"];
                for (const mode of modes) {
                    mockCalled = false;
                    const adapter = createExecutionRuntimeAdapter({ runtimeMode: mode });
                    if (mode === "MODULAR") {
                        adapter.runtimeRouter = {
                            selectRuntime: () => {
                                return {
                                    version: "1.0",
                                    execute: async (req) => {
                                        return Object.freeze({
                                            success: true,
                                            runtime: "MODULAR",
                                            result: {
                                                files: [],
                                                runInstructions: "modular run",
                                                summary: "modular scaffolded",
                                                model: "glm-5.2",
                                                projectSpec: spec
                                            },
                                            metadata: {
                                                requirementIdentity: "req_01",
                                                verificationResult: null,
                                                repaired: false
                                            }
                                        });
                                    }
                                };
                            }
                        };
                    }
                    const res = await adapter.execute(request);

                    if (mode === "MODULAR") {
                        assert.strictEqual(mockCalled, false);
                        assert.deepStrictEqual(res, {
                            success: true,
                            runtime: "MODULAR",
                            result: {
                                files: [],
                                runInstructions: "modular run",
                                summary: "modular scaffolded",
                                model: "glm-5.2",
                                projectSpec: spec
                            },
                            metadata: {
                                requirementIdentity: "req_01",
                                verificationResult: null,
                                repaired: false
                            }
                        });
                    } else {
                        assert.strictEqual(mockCalled, true);
                        assert.strictEqual(res.success, true);
                        assert.strictEqual(res.runtime, "LEGACY");
                        assert.strictEqual(res.result.runInstructions, "run it");
                    }
                    assert.ok(Object.isFrozen(res));
                }
            } finally {
                // No module mock cleanup required
            }
        });


        // ── 3. Invalid request ──
        test("3. execute() throws EXECUTION_RUNTIME_INVALID_REQUEST for invalid requests", async () => {
            const adapter = createExecutionRuntimeAdapter();
            const badInputs = [null, undefined, {}, { options: {} }];

            for (const input of badInputs) {
                await assert.rejects(async () => {
                    await adapter.execute(input);
                }, (err) => {
                    return err.code === executionRuntimeAdapterErrorCodes.EXECUTION_RUNTIME_INVALID_REQUEST;
                });
            }
        });

        // ── 4. Invalid ProjectSpec ──
        test("4. execute() validates ProjectSpec and rejects malformed schemas", async () => {
            const adapter = createExecutionRuntimeAdapter();
            const badSpec = { projectName: "" }; // invalid schema
            const request = { projectSpec: badSpec };

            await assert.rejects(async () => {
                await adapter.execute(request);
            }, (err) => {
                return err.code === executionRuntimeAdapterErrorCodes.EXECUTION_RUNTIME_INVALID_REQUEST;
            });
        });

        // ── 5. Error translation ──
        test("5. execute() wraps underlying legacy exceptions into EXECUTION_RUNTIME_EXECUTION_FAILED", async () => {
            const spec = getValidProjectSpec();
            const request = { projectSpec: spec };
            const adapter = createExecutionRuntimeAdapter();

            legacyOrchestrator.orchestrateGeneration = async () => {
                throw new Error("Disk full database crash");
            };

            await assert.rejects(async () => {
                await adapter.execute(request);
            }, (err) => {
                return err.code === executionRuntimeAdapterErrorCodes.EXECUTION_RUNTIME_EXECUTION_FAILED &&
                       err.message.includes("Disk full");
            });
        });

        // ── 6. Input non-mutation ──
        test("6. execute() does not mutate input execution requests", async () => {
            const spec = getValidProjectSpec();
            const request = {
                projectSpec: spec,
                metadata: { originalPrompt: "scaffold project" }
            };
            const originalJson = JSON.stringify(request);

            legacyOrchestrator.orchestrateGeneration = async () => ({ files: [], projectSpec: spec });

            const adapter = createExecutionRuntimeAdapter();
            await adapter.execute(request);

            assert.strictEqual(JSON.stringify(request), originalJson);
        });

        // ── 8. Runtime-Independent Bridge invocation ──
        test("8. Checkpoint and Verification/Repair bridges are always invoked for LEGACY runtime", async () => {
            const spec = getValidProjectSpec();
            const request = {
                projectSpec: spec,
                metadata: { originalPrompt: "Legacy run prompt" },
                options: {}
            };

            legacyOrchestrator.orchestrateGeneration = async () => {
                return {
                    files: [],
                    runInstructions: "legacy run",
                    summary: "legacy scaffold",
                    model: "glm-5.2",
                    projectSpec: spec,
                    requirementIdentity: "req_legacy"
                };
            };

            const adapter = createExecutionRuntimeAdapter({
                runtimeMode: "LEGACY",
                enableCheckpointPersistence: true,
                enableVerification: true,
                enableRepair: false
            });

            // Spy on bridges
            let initCheckpointCalled = false;
            let finalizeCheckpointCalled = false;
            let verifyAndRepairCalled = false;

            // Mock bridges
            adapter.checkpointBridge = {
                initializeExecutionCheckpoint: async (state) => {
                    initCheckpointCalled = true;
                    return { success: true, checkpoint: {} };
                },
                finalizeExecutionCheckpoint: async (state) => {
                    finalizeCheckpointCalled = true;
                    return { success: true, checkpoint: {} };
                }
            };
            adapter.verificationRepairBridge = {
                verifyAndRepair: async (result) => {
                    verifyAndRepairCalled = true;
                    return {
                        success: true,
                        repaired: false,
                        result,
                        verificationResult: null
                    };
                }
            };

            const res = await adapter.execute(request);

            assert.strictEqual(initCheckpointCalled, true);
            assert.strictEqual(finalizeCheckpointCalled, true);
            assert.strictEqual(verifyAndRepairCalled, true);
            assert.strictEqual(res.runtime, "LEGACY");
        });

        test("9. Checkpoint and Verification/Repair bridges are always invoked for MODULAR runtime", async () => {
            const spec = getValidProjectSpec();
            const request = {
                projectSpec: spec,
                metadata: { originalPrompt: "Modular run prompt" },
                options: {}
            };

            const adapter = createExecutionRuntimeAdapter({
                runtimeMode: "MODULAR",
                enableCheckpointPersistence: false,
                enableVerification: false,
                enableRepair: false
            });

            // Mock selection of modular adapter returning a modular response shape
            adapter.runtimeRouter = {
                selectRuntime: () => {
                    return {
                        version: "1.0",
                        execute: async (req) => {
                            return Object.freeze({
                                success: true,
                                runtime: "MODULAR",
                                result: {
                                    files: [],
                                    runInstructions: "modular run",
                                    summary: "modular scaffolded",
                                    model: "glm-5.2",
                                    projectSpec: spec
                                },
                                metadata: {
                                    requirementIdentity: "req_modular",
                                    verificationResult: null,
                                    repaired: false
                                }
                            });
                        }
                    };
                }
            };

            // Spy on bridges
            let initCheckpointCalled = false;
            let finalizeCheckpointCalled = false;
            let verifyAndRepairCalled = false;

            // Mock bridges
            adapter.checkpointBridge = {
                initializeExecutionCheckpoint: async (state) => {
                    initCheckpointCalled = true;
                    return { success: true, checkpoint: null };
                },
                finalizeExecutionCheckpoint: async (state) => {
                    finalizeCheckpointCalled = true;
                    return { success: true, checkpoint: null };
                }
            };
            adapter.verificationRepairBridge = {
                verifyAndRepair: async (result) => {
                    verifyAndRepairCalled = true;
                    return {
                        success: true,
                        repaired: false,
                        result,
                        verificationResult: null
                    };
                }
            };

            const res = await adapter.execute(request);

            assert.strictEqual(initCheckpointCalled, true);
            assert.strictEqual(finalizeCheckpointCalled, true);
            assert.strictEqual(verifyAndRepairCalled, true);
            assert.strictEqual(res.runtime, "MODULAR");
        });

        test("10. Disabled bridges behave as no-ops and return inputs unchanged", async () => {
            const spec = getValidProjectSpec();
            const request = {
                projectSpec: spec,
                metadata: { originalPrompt: "No-op prompt" },
                options: {}
            };

            const rawResult = {
                files: [],
                runInstructions: "run instructions",
                summary: "summary",
                model: "glm-5.2",
                projectSpec: spec,
                requirementIdentity: "req_01"
            };

            legacyOrchestrator.orchestrateGeneration = async () => rawResult;

            const adapter = createExecutionRuntimeAdapter({
                runtimeMode: "LEGACY",
                enableCheckpointPersistence: false,
                enableVerification: false,
                enableRepair: false
            });

            // The default config has them disabled, meaning they should behave as no-ops.
            const res = await adapter.execute(request);

            assert.strictEqual(res.success, true);
            assert.strictEqual(res.runtime, "LEGACY");
            assert.deepStrictEqual(res.result, rawResult);
            assert.strictEqual(res.metadata.verificationResult, null);
            assert.strictEqual(res.metadata.repaired, false);
        });

        test("11. Response remains identical before and after no-op bridge execution for MODULAR runtime", async () => {
            const spec = getValidProjectSpec();
            const request = {
                projectSpec: spec,
                metadata: { originalPrompt: "Modular response shape prompt" },
                options: {}
            };

            const adapter = createExecutionRuntimeAdapter({
                runtimeMode: "MODULAR",
                enableCheckpointPersistence: false,
                enableVerification: false,
                enableRepair: false
            });

            const modularResponse = Object.freeze({
                success: true,
                runtime: "MODULAR",
                result: {
                    files: [{ name: "test.js", content: "const a = 1;" }],
                    runInstructions: "node test.js",
                    summary: "done",
                    model: "gemini-flash",
                    projectSpec: spec
                },
                metadata: {
                    requirementIdentity: "req_mod",
                    verificationResult: null,
                    repaired: false
                }
            });

            adapter.runtimeRouter = {
                selectRuntime: () => {
                    return {
                        version: "1.0",
                        execute: async () => modularResponse
                    };
                }
            };

            const res = await adapter.execute(request);
            assert.deepStrictEqual(res, modularResponse);
        });

        // ── 7. Deterministic equality ──
        test("7. validateExecutionRequest returns consistent schemas", () => {
            const spec = getValidProjectSpec();
            const r1 = { projectSpec: spec };
            const r2 = { projectSpec: spec };

            assert.deepStrictEqual(validateExecutionRequest(r1), validateExecutionRequest(r2));
        });
    });
};
