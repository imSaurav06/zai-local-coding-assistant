"use strict";

const assert = require("assert");

module.exports = function registerModularRuntimeAdapterTests(suite, test) {
    const {
        createModularRuntimeAdapter,
        execute,
        modularRuntimeAdapterErrorCodes,
        MODULAR_RUNTIME_ADAPTER_VERSION
    } = require("../../../core/runtime/modularRuntimeAdapter");

    const aiExecutor = require("../../../services/aiGenerationExecutor");
    const { createExecutionRuntimeAdapter } = require("../../../core/runtime");

    const validAppContent = `import React from 'react';
export default function App() {
    return (
        <div className="fitzone-app-container">
            <h1>Welcome to FitZone Gym Project</h1>
            <p>This is a complete landing page containing at least ninety characters to satisfy the content guard and verification profile checks.</p>
        </div>
    );
}`;

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
                { path: "/", name: "LandingPage", description: "Hero section with CTA and features" }
            ],
            components: [
                { name: "Navbar", purpose: "Top navigation with logo and links" }
            ],
            backendApis: [],
            databaseModels: [],
            integrations: [],
            importantDependencies: ["react-router-dom", "lucide-react"],
            environmentVariables: [],
            architectureConstraints: ["Single page application"],
            runBuildRequirements: { runScript: "npm run dev", buildScript: "npm run build" },
            deploymentRequirements: "Vercel",
            assumptions: ["No backend required"]
        };
    }

    function makeMockAiResponse(files) {
        const lines = ["--- START_FILES ---"];
        for (const f of files) {
            lines.push(`--- FILE: ${f.name} ---`);
            lines.push("```jsx");
            lines.push(f.content);
            lines.push("```");
            lines.push("--- END_FILE ---");
        }
        lines.push("--- END_FILES ---");
        return lines.join("\n");
    }

    function getMockResponseFiles() {
        return [
            { name: "src/App.jsx", content: validAppContent },
            { name: "src/components/Navbar.jsx", content: "import React from 'react'; export default function Navbar() { return <nav className='navbar'>Navbar</nav>; }" },
            { name: "src/pages/LandingPage.jsx", content: "import React from 'react'; export default function LandingPage() { return <div>Landing</div>; }" },
            { name: "src/main.jsx", content: "import React from 'react'; import ReactDOM from 'react-dom/client'; import App from './App'; ReactDOM.createRoot(document.getElementById('root')).render(<App />);" },
            { name: "src/index.css", content: "@tailwind base; @tailwind components; @tailwind utilities;" },
            { name: "README.md", content: "# FitZone\nThis is a complete landing page with at least thirty characters to satisfy validation checks." }
        ];
    }

    suite("Modular Runtime Adapter (Phase 11B-2)", () => {
        // 1. Public API exports
        test("1. exposes correct API contracts and frozen error codes", () => {
            assert.strictEqual(MODULAR_RUNTIME_ADAPTER_VERSION, "1.0");
            assert.ok(createModularRuntimeAdapter);
            assert.ok(execute);
            assert.ok(Object.isFrozen(modularRuntimeAdapterErrorCodes));
            assert.strictEqual(modularRuntimeAdapterErrorCodes.MODULAR_RUNTIME_INVALID_REQUEST, "MODULAR_RUNTIME_INVALID_REQUEST");
            assert.strictEqual(modularRuntimeAdapterErrorCodes.MODULAR_RUNTIME_PIPELINE_FAILED, "MODULAR_RUNTIME_PIPELINE_FAILED");
            assert.strictEqual(modularRuntimeAdapterErrorCodes.MODULAR_RUNTIME_INVALID_RESULT, "MODULAR_RUNTIME_INVALID_RESULT");
        });

        // 2. Successful ExecutionPipeline invocation and Canonical response mapping
        test("2. execute() successfully runs ExecutionPipeline and maps canonical response", async () => {
            const spec = getValidProjectSpec();
            const request = {
                projectSpec: spec,
                metadata: { originalPrompt: "Create gym landing page" },
                options: {}
            };

            const originalExecuteAiRequest = aiExecutor.executeAiRequest;
            aiExecutor.executeAiRequest = async () => {
                return makeMockAiResponse(getMockResponseFiles());
            };

            try {
                const adapter = createModularRuntimeAdapter();
                const res = await adapter.execute(request);

                assert.strictEqual(res.success, true);
                assert.strictEqual(res.runtime, "MODULAR");
                assert.ok(res.result);
                assert.ok(Array.isArray(res.result.files));
                assert.ok(res.result.files.length > 0);
                assert.strictEqual(res.result.model, process.env.ZAI_MODEL || "gemini-3.5-flash");
                assert.deepStrictEqual(res.result.projectSpec, spec);
                assert.ok(res.result.runInstructions);
                assert.ok(res.result.summary);
                assert.ok(res.metadata.requirementIdentity);
                assert.strictEqual(res.metadata.verificationResult, null);
                assert.strictEqual(res.metadata.repaired, false);

                // Deep freeze check
                assert.ok(Object.isFrozen(res));
                assert.ok(Object.isFrozen(res.result));
                assert.ok(Object.isFrozen(res.result.files));
                assert.ok(Object.isFrozen(res.metadata));
            } finally {
                aiExecutor.executeAiRequest = originalExecuteAiRequest;
            }
        });

        // 3. Invalid request rejection
        test("3. execute() rejects invalid request (null, undefined, invalid type)", async () => {
            const adapter = createModularRuntimeAdapter();
            const badInputs = [null, undefined, [], "string", 123, {}, { options: {} }];

            for (const input of badInputs) {
                await assert.rejects(async () => {
                    await adapter.execute(input);
                }, (err) => {
                    return err.code === "MODULAR_RUNTIME_INVALID_REQUEST";
                });
            }
        });

        // 4. Invalid ProjectSpec rejection
        test("4. execute() rejects invalid ProjectSpec", async () => {
            const adapter = createModularRuntimeAdapter();
            const badSpec = { projectName: "" }; // invalid schema
            const request = { projectSpec: badSpec };

            await assert.rejects(async () => {
                await adapter.execute(request);
            }, (err) => {
                return err.code === "MODULAR_RUNTIME_INVALID_REQUEST";
            });
        });

        // 5. Input non-mutation
        test("5. execute() does not mutate input request", async () => {
            const spec = getValidProjectSpec();
            const request = {
                projectSpec: spec,
                metadata: { originalPrompt: "Create React App" },
                options: {}
            };
            const originalJson = JSON.stringify(request);

            const originalExecuteAiRequest = aiExecutor.executeAiRequest;
            aiExecutor.executeAiRequest = async () => {
                return makeMockAiResponse(getMockResponseFiles());
            };

            try {
                const adapter = createModularRuntimeAdapter();
                await adapter.execute(request);

                assert.strictEqual(JSON.stringify(request), originalJson);
            } finally {
                aiExecutor.executeAiRequest = originalExecuteAiRequest;
            }
        });

        // 6. Pipeline exception mapping
        test("6. execute() maps pipeline exceptions to MODULAR_RUNTIME_PIPELINE_FAILED", async () => {
            const spec = getValidProjectSpec();
            const request = {
                projectSpec: spec,
                metadata: { originalPrompt: "Create gym page" },
                options: {}
            };

            const originalExecuteAiRequest = aiExecutor.executeAiRequest;
            aiExecutor.executeAiRequest = async () => {
                throw new Error("API limit or network error");
            };

            try {
                const adapter = createModularRuntimeAdapter();
                await assert.rejects(async () => {
                    await adapter.execute(request);
                }, (err) => {
                    return err.code === "MODULAR_RUNTIME_PIPELINE_FAILED" &&
                           err.message.includes("Pipeline execution failed");
                });
            } finally {
                aiExecutor.executeAiRequest = originalExecuteAiRequest;
            }
        });

        // 7. Pipeline success=false validation
        test("7. execute() throws MODULAR_RUNTIME_PIPELINE_FAILED when pipeline execution fails", async () => {
            const spec = getValidProjectSpec();
            const request = {
                projectSpec: spec,
                metadata: { originalPrompt: "Create gym page" },
                options: {}
            };

            const originalExecuteAiRequest = aiExecutor.executeAiRequest;
            aiExecutor.executeAiRequest = async () => {
                return makeMockAiResponse([
                    { name: "src/App.jsx", content: "INVALID CODE syntax error @%#^" }
                ]);
            };

            try {
                const adapter = createModularRuntimeAdapter();
                await assert.rejects(async () => {
                    await adapter.execute(request);
                }, (err) => {
                    return err.code === "MODULAR_RUNTIME_PIPELINE_FAILED" &&
                           err.message.includes("Pipeline execution failed");
                });
            } finally {
                aiExecutor.executeAiRequest = originalExecuteAiRequest;
            }
        });

        // 8. PipelineResult validation (mutable result)
        test("8. execute() rejects mutable pipeline result with MODULAR_RUNTIME_INVALID_RESULT", async () => {
            const spec = getValidProjectSpec();
            const request = {
                projectSpec: spec,
                metadata: { originalPrompt: "Create gym page" },
                options: {}
            };

            const originalExecuteAiRequest = aiExecutor.executeAiRequest;
            aiExecutor.executeAiRequest = async () => {
                return makeMockAiResponse(getMockResponseFiles());
            };

            const executionMod = require("../../../core/execution");
            const originalCreate = executionMod.createExecutionPipeline;
            executionMod.createExecutionPipeline = (opts) => {
                return {
                    executePipeline: async () => {
                        // Return a mutable object (not frozen)
                        return {
                            success: true,
                            execution: { schedule: {}, vfsState: { files: [] } },
                            verification: {},
                            diagnostics: {},
                            metadata: {}
                        };
                    }
                };
            };

            // Clear cache and re-require modularRuntimeAdapter to bind to the mocked function
            delete require.cache[require.resolve("../../../core/runtime/modularRuntimeAdapter")];
            const { createModularRuntimeAdapter: createModularMock } = require("../../../core/runtime/modularRuntimeAdapter");

            try {
                const adapter = createModularMock();
                await assert.rejects(async () => {
                    await adapter.execute(request);
                }, (err) => {
                    return err.code === "MODULAR_RUNTIME_INVALID_RESULT" &&
                           err.message.includes("PipelineResult is mutable");
                });
            } finally {
                executionMod.createExecutionPipeline = originalCreate;
                aiExecutor.executeAiRequest = originalExecuteAiRequest;
                delete require.cache[require.resolve("../../../core/runtime/modularRuntimeAdapter")];
            }
        });

        // 9. PipelineResult validation (missing fields / invalid result structure)
        test("9. execute() rejects invalid pipelineResult schema with MODULAR_RUNTIME_INVALID_RESULT", async () => {
            const spec = getValidProjectSpec();
            const request = {
                projectSpec: spec,
                metadata: { originalPrompt: "Create gym page" },
                options: {}
            };

            const originalExecuteAiRequest = aiExecutor.executeAiRequest;
            aiExecutor.executeAiRequest = async () => {
                return makeMockAiResponse(getMockResponseFiles());
            };

            const executionMod = require("../../../core/execution");
            const originalCreate = executionMod.createExecutionPipeline;
            executionMod.createExecutionPipeline = (opts) => {
                return {
                    executePipeline: async () => {
                        // Return an invalid schema result
                        return Object.freeze({
                            success: true,
                            execution: { schedule: {} }
                            // Missing verification, diagnostics, metadata
                        });
                    }
                };
            };

            // Clear cache and re-require modularRuntimeAdapter to bind to the mocked function
            delete require.cache[require.resolve("../../../core/runtime/modularRuntimeAdapter")];
            const { createModularRuntimeAdapter: createModularMock } = require("../../../core/runtime/modularRuntimeAdapter");

            try {
                const adapter = createModularMock();
                await assert.rejects(async () => {
                    await adapter.execute(request);
                }, (err) => {
                    return err.code === "MODULAR_RUNTIME_INVALID_RESULT" &&
                           err.message.includes("PipelineResult validation failed");
                });
            } finally {
                executionMod.createExecutionPipeline = originalCreate;
                aiExecutor.executeAiRequest = originalExecuteAiRequest;
                delete require.cache[require.resolve("../../../core/runtime/modularRuntimeAdapter")];
            }
        });

        // 10. Legacy adapter is unaffected by modular runtime configuration
        test("10. Legacy adapter execute is unaffected by MODULAR runtime mode", async () => {
            const spec = getValidProjectSpec();
            const request = {
                projectSpec: spec,
                metadata: { originalPrompt: "Create React app" },
                options: {}
            };

            const legacyOrchestrator = require("../../../services/generationOrchestrator");
            const originalOrchestrate = legacyOrchestrator.orchestrateGeneration;

            let legacyCalled = false;
            legacyOrchestrator.orchestrateGeneration = async (ctx) => {
                legacyCalled = true;
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
                const adapter = createExecutionRuntimeAdapter({ runtimeMode: "LEGACY" });
                const res = await adapter.execute(request);

                assert.strictEqual(legacyCalled, true);
                assert.strictEqual(res.success, true);
                assert.strictEqual(res.runtime, "LEGACY");
                assert.strictEqual(res.result.runInstructions, "run it");
            } finally {
                legacyOrchestrator.orchestrateGeneration = originalOrchestrate;
            }
        });
    });
};
