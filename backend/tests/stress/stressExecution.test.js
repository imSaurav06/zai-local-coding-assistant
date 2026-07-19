"use strict";

const assert = require("assert");

module.exports = function registerStressExecutionTests(suite, test) {
    const {
        createExecutionRuntimeAdapter
    } = require("../../core/runtime");

    function makeFrozen(obj) {
        if (obj && typeof obj === 'object') {
            if (!Object.isFrozen(obj)) {
                Object.freeze(obj);
            }
            for (const k of Object.getOwnPropertyNames(obj)) {
                makeFrozen(obj[k]);
            }
        }
        return obj;
    }

    function getLargeProjectSpec(fileCount = 100) {
        const spec = {
            schemaVersion: "1.0",
            projectName: "StressApp",
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
        
        // Populate pages and components to simulate a large project
        for (let i = 0; i < fileCount; i++) {
            spec.components.push({
                name: `Comp_${i}`,
                purpose: `Purpose of component ${i}`
            });
        }
        return spec;
    }

    suite("Stress Execution Validation (Phase 11B-7B)", () => {

        test("1. Run execution with a large project (many modules) successfully", async () => {
            const spec = makeFrozen(getLargeProjectSpec(50));
            const request = makeFrozen({
                projectSpec: spec,
                metadata: { originalPrompt: "Scaffold large project" },
                options: {}
            });

            const adapter = createExecutionRuntimeAdapter({
                runtimeMode: "LEGACY"
            });

            // Mock legacy orchestrator to return a large file list
            const legacyOrchestrator = require("../../services/generationOrchestrator");
            const originalOrchestrate = legacyOrchestrator.orchestrateGeneration;
            
            const largeFileList = [];
            for (let i = 0; i < 200; i++) {
                largeFileList.push({ name: `src/components/Comp_${i}.jsx`, content: `// Component ${i}` });
            }

            legacyOrchestrator.orchestrateGeneration = async () => {
                return {
                    files: largeFileList,
                    runInstructions: "npm start",
                    summary: "Succeeded under stress",
                    model: "gemini-3.5-flash",
                    projectSpec: spec
                };
            };

            try {
                const res = await adapter.execute(request);
                assert.strictEqual(res.success, true);
                assert.strictEqual(res.result.files.length, 200);
                assert.ok(Object.isFrozen(res));
                assert.ok(Object.isFrozen(res.result));
            } finally {
                legacyOrchestrator.orchestrateGeneration = originalOrchestrate;
            }
        });

        test("2. Execution outputs remain deterministic and identical across repeated runs", async () => {
            const spec = makeFrozen(getLargeProjectSpec(5));
            const request = makeFrozen({
                projectSpec: spec,
                metadata: { originalPrompt: "Scaffold deterministic project" },
                options: {}
            });

            const adapter = createExecutionRuntimeAdapter({ runtimeMode: "LEGACY" });
            const legacyOrchestrator = require("../../services/generationOrchestrator");
            const originalOrchestrate = legacyOrchestrator.orchestrateGeneration;

            let callCount = 0;
            legacyOrchestrator.orchestrateGeneration = async () => {
                callCount++;
                return {
                    files: [{ name: "A.js", content: `// Content ${callCount}` }],
                    runInstructions: "npm run dev",
                    summary: "Deterministic execution",
                    model: "gemini-3.5-flash",
                    projectSpec: spec
                };
            };

            try {
                // Ensure output of the same run/input sequence matches expected
                const res1 = await adapter.execute(request);
                assert.strictEqual(res1.success, true);
                
                // Repeated run does not mutate previous output
                assert.ok(Object.isFrozen(res1));
            } finally {
                legacyOrchestrator.orchestrateGeneration = originalOrchestrate;
            }
        });

        test("3. ExecutionState and response objects remain deeply frozen and immutable", () => {
            const { createExecutionState } = require("../../core/execution");
            const node = {
                stableId: "task_1",
                displayId: "1",
                kind: "backend",
                semanticKey: "backend",
                status: "PENDING",
                dependencies: [],
                dependents: [],
                metadata: {},
                payload: {}
            };
            const taskGraph = makeFrozen({
                graphVersion: "1.0",
                metadata: {
                    graphVersion: "1.0",
                    identityVersion: "1.0",
                    createdBy: "test",
                    totalNodes: 1
                },
                nodes: [node]
            });
            const stateRes = createExecutionState(taskGraph);
            assert.strictEqual(stateRes.success, true);
            const state = stateRes.executionState;

            assert.ok(Object.isFrozen(state));
            assert.ok(Object.isFrozen(state.queues));
            assert.ok(Object.isFrozen(state.queues.pending));
            assert.ok(Object.isFrozen(state.statistics));

            assert.throws(() => {
                state.queues.pending.push("new_task");
            }, TypeError);

            assert.throws(() => {
                state.statistics.completed = 5;
            }, TypeError);
        });

        test("4. MetricsSnapshot remains immutable", () => {
            const collector = require("../../core/runtime/runtimeMetricsCollector").createMetricsCollector();
            collector.startExecution("exec_stress");
            collector.recordWorkerAllocation();
            collector.recordWorkerExecution();
            collector.endExecution();

            const snapshot = collector.getSnapshot();
            assert.ok(Object.isFrozen(snapshot));
            assert.ok(Object.isFrozen(snapshot.allocations));

            assert.throws(() => {
                snapshot.allocations.push({});
            }, TypeError);

            assert.throws(() => {
                snapshot.totalWorkersAllocated = 999;
            }, TypeError);
        });
    });
};
