"use strict";

const assert = require("assert");

module.exports = function registerAuditOrchestratorTests(suite, test) {
    const { runFullAudit } = require("../../../core/audit/auditOrchestrator");
    const { auditOrchestratorErrorCodes } = require("../../../core/audit/auditOrchestratorErrors");

    // A fully-valid canonical project spec mirroring the requirementAuditor's complete schema.
    const VALID_SPEC = {
        schemaVersion: "1.0",
        projectName: "Z.AI Gym App",
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
            { name: "Navbar", purpose: "Top navigation bar" }
        ],
        backendApis: [],
        databaseModels: [],
        integrations: [],
        importantDependencies: ["react-router-dom"],
        environmentVariables: [],
        architectureConstraints: ["Single page application"],
        runBuildRequirements: { runScript: "npm run dev", buildScript: "npm run build" },
        deploymentRequirements: "Vercel",
        assumptions: ["No backend required for landing page"]
    };

    const VALID_FILES = [
        { name: "src/main.jsx", content: "import React from 'react'; export default function App() { return <div>Hello</div>; }" },
        { name: "src/App.jsx", content: "import React from 'react'; export default function App() { return <div>App</div>; }" },
        { name: "README.md", content: "# Z.AI Gym App — full featured landing page with multiple pages." }
    ];

    suite("Audit Orchestrator Public API (Phase 12E)", () => {
        test("1. Rejects null and non-object inputs with AUDIT_ORCHESTRATOR_INVALID_INPUT", () => {
            assert.throws(() => runFullAudit(null), err => err.code === auditOrchestratorErrorCodes.AUDIT_ORCHESTRATOR_INVALID_INPUT);
            assert.throws(() => runFullAudit([]), err => err.code === auditOrchestratorErrorCodes.AUDIT_ORCHESTRATOR_INVALID_INPUT);
        });

        test("2. Rejects missing projectSpec with AUDIT_ORCHESTRATOR_INVALID_INPUT", () => {
            assert.throws(() => runFullAudit({ generatedFiles: [] }),
                err => err.code === auditOrchestratorErrorCodes.AUDIT_ORCHESTRATOR_INVALID_INPUT
            );
        });

        test("3. Rejects missing generatedFiles with AUDIT_ORCHESTRATOR_INVALID_INPUT", () => {
            assert.throws(() => runFullAudit({ projectSpec: VALID_SPEC }),
                err => err.code === auditOrchestratorErrorCodes.AUDIT_ORCHESTRATOR_INVALID_INPUT
            );
        });

        test("4. Returns a valid result structure on a clean project", () => {
            const result = runFullAudit({
                projectSpec: VALID_SPEC,
                generatedFiles: VALID_FILES
            });

            assert.ok(typeof result.passed === "boolean");
            assert.ok(result.certification);
            assert.ok(result.summary);
            assert.ok(result.audits);
            assert.ok(result.audits.requirement);
            assert.ok(result.audits.security);
            assert.ok(result.audits.integration);
            assert.ok(result.audits.deployment);
            assert.ok(typeof result.report === "string");
        });

        test("5. Result is deeply frozen and immutable", () => {
            const result = runFullAudit({
                projectSpec: VALID_SPEC,
                generatedFiles: VALID_FILES
            });

            assert.ok(Object.isFrozen(result));
            assert.ok(Object.isFrozen(result.certification));
            assert.ok(Object.isFrozen(result.summary));
            assert.ok(Object.isFrozen(result.audits));
            assert.throws(() => { result.passed = true; }, TypeError);
        });

        test("6. certification.tier is one of the three valid tiers", () => {
            const result = runFullAudit({
                projectSpec: VALID_SPEC,
                generatedFiles: VALID_FILES
            });

            const validTiers = ["CERTIFIED", "CONDITIONALLY_CERTIFIED", "NOT_CERTIFIED"];
            assert.ok(validTiers.includes(result.certification.tier));
        });

        test("7. Summary stage count is always 4", () => {
            const result = runFullAudit({
                projectSpec: VALID_SPEC,
                generatedFiles: VALID_FILES
            });

            assert.strictEqual(result.summary.stageCount, 4);
        });

        test("8. Report string contains certification header text", () => {
            const result = runFullAudit({
                projectSpec: VALID_SPEC,
                generatedFiles: VALID_FILES
            });

            assert.ok(result.report.includes("Z.AI FULL AUDIT REPORT"));
            assert.ok(result.report.includes("Full Audit Certification Report"));
        });

        test("9. Deployment qualification receives live 12A/12B/12C results as gate inputs", () => {
            // Use a spec with no pages so 12A and 12C produce failures.
            // Then verify those failures are surfaced as 12D blockers — proving the chain works.
            const sparseSpec = {
                schemaVersion: "1.0",
                projectName: "Z.AI Gym App",
                projectType: "React Landing Page",
                frontend: "React (Vite) 18.2",
                backend: "None",
                database: "None",
                authentication: "None",
                designRequirements: "Tailwind CSS",
                pagesAndRoutes: [
                    { path: "/", name: "LandingPage", description: "Hero section with CTA" }
                ],
                components: [{ name: "Navbar", purpose: "Top navigation bar" }],
                backendApis: [],
                databaseModels: [],
                integrations: [],
                importantDependencies: [],
                environmentVariables: [],
                architectureConstraints: ["Single page application"],
                runBuildRequirements: { runScript: "npm run dev", buildScript: "npm run build" },
                deploymentRequirements: "Vercel",
                assumptions: []
            };

            // Only provide a stub file — requirements will fail, blocker from 12A should appear in 12D.
            const stubFiles = [{ name: "src/stub.js", content: "// stub" }];

            const result = runFullAudit({
                projectSpec: sparseSpec,
                generatedFiles: stubFiles,
                verificationReport: { success: true, errors: [] }
            });

            // 12D should have blockers because 12A and/or 12C failed — proving live gate chaining.
            const deploymentBlockers = result.audits.deployment.blockers || [];
            assert.ok(deploymentBlockers.length > 0, "Expected deployment to be blocked by failing upstream audits");

            // And the overall result should not be certified.
            assert.strictEqual(result.passed, false);
        });
    });
};
