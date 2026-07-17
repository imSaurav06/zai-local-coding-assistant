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

            const modes = ["LEGACY", "MODULAR", "SHADOW"];
            for (const mode of modes) {
                mockCalled = false;
                const adapter = createExecutionRuntimeAdapter({ runtimeMode: mode });
                const res = await adapter.execute(request);

                if (mode === "MODULAR") {
                    assert.strictEqual(mockCalled, false);
                    assert.deepStrictEqual(res, {
                        runtime: "MODULAR",
                        status: "NOT_IMPLEMENTED",
                        message: "Modular runtime activation is scheduled for Phase 11B-2."
                    });
                } else {
                    assert.strictEqual(mockCalled, true);
                    assert.strictEqual(res.success, true);
                    assert.strictEqual(res.runtime, "LEGACY");
                    assert.strictEqual(res.result.runInstructions, "run it");
                }
                assert.ok(Object.isFrozen(res));
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

        // ── 7. Deterministic equality ──
        test("7. validateExecutionRequest returns consistent schemas", () => {
            const spec = getValidProjectSpec();
            const r1 = { projectSpec: spec };
            const r2 = { projectSpec: spec };

            assert.deepStrictEqual(validateExecutionRequest(r1), validateExecutionRequest(r2));
        });
    });
};
