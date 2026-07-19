"use strict";

const assert = require("assert");

module.exports = function registerEdgeCasesTests(suite, test) {
    const {
        createExecutionRuntimeAdapter,
        validateExecutionRequest,
        isExecutionRequest
    } = require("../../core/runtime");

    function getMinimalProjectSpec() {
        return {
            schemaVersion: "1.0",
            projectName: "MinimalApp",
            projectType: "React Landing Page",
            frontend: "React (Vite) 18.2",
            backend: "None",
            database: "None",
            authentication: "None",
            designRequirements: "None",
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

    suite("Edge Cases Validation (Phase 11B-7B)", () => {

        test("1. Validate minimal project spec successfully", () => {
            const spec = getMinimalProjectSpec();
            const request = {
                projectSpec: spec,
                metadata: {} // minimal metadata
            };

            const frozenReq = Object.freeze(request);
            const res = validateExecutionRequest(frozenReq);
            assert.strictEqual(res.success, true);
        });

        test("2. Rejects completely empty project spec validation", () => {
            const request = {
                projectSpec: {} // missing required fields like projectName, projectType, etc.
            };

            const res = validateExecutionRequest(request);
            assert.strictEqual(res.success, false);
            assert.ok(res.errors.length > 0);
        });

        test("3. execution adapter executes successfully when optional metadata is missing", async () => {
            const spec = getMinimalProjectSpec();
            const request = Object.freeze({
                projectSpec: spec
                // metadata is completely omitted
            });

            const adapter = createExecutionRuntimeAdapter({ runtimeMode: "LEGACY" });
            const legacyOrchestrator = require("../../services/generationOrchestrator");
            const originalOrchestrate = legacyOrchestrator.orchestrateGeneration;

            legacyOrchestrator.orchestrateGeneration = async () => {
                return {
                    files: [],
                    runInstructions: "npm start",
                    summary: "Successful legacy execution",
                    model: "gemini"
                };
            };

            try {
                const res = await adapter.execute(request);
                assert.strictEqual(res.success, true);
                assert.strictEqual(res.runtime, "LEGACY");
            } finally {
                legacyOrchestrator.orchestrateGeneration = originalOrchestrate;
            }
        });

        test("4. isExecutionRequest returns false for non-frozen request", () => {
            const spec = getMinimalProjectSpec();
            const request = {
                projectSpec: spec
            };

            // Non-frozen should return false
            assert.strictEqual(isExecutionRequest(request), false);
            
            // Once frozen, isExecutionRequest should return true
            Object.freeze(request);
            assert.strictEqual(isExecutionRequest(request), true);
        });
    });
};
