"use strict";

const assert = require("assert");

module.exports = function registerAuditorTests(suite, test) {
    const { auditRequirements } = require("../../../core/audit/requirementAuditor");
    const { auditErrorCodes } = require("../../../core/audit/requirementAuditErrors");

    suite("Requirement Compliance Auditor Public API (Phase 12A)", () => {
        test("1. Rejects invalid or null inputs with AUDIT_INVALID_INPUT", () => {
            assert.throws(() => {
                auditRequirements(null);
            }, (err) => {
                return err.code === auditErrorCodes.AUDIT_INVALID_INPUT;
            });

            assert.throws(() => {
                auditRequirements({ projectSpec: {} }); // missing generatedFiles
            }, (err) => {
                return err.code === auditErrorCodes.AUDIT_INVALID_INPUT;
            });
        });

        test("2. Rejects invalid projectSpec structure with AUDIT_INVALID_PROJECT_SPEC", () => {
            assert.throws(() => {
                auditRequirements({
                    projectSpec: { projectName: 123 }, // invalid type (missing required properties)
                    generatedFiles: []
                });
            }, (err) => {
                return err.code === auditErrorCodes.AUDIT_INVALID_PROJECT_SPEC;
            });
        });

        test("3. Successfully completes complete audit run and returns deeply frozen result", () => {
            const projectSpec = {
                schemaVersion: "1.0",
                projectName: "FitZone",
                projectType: "React Landing Page",
                frontend: "React (Vite) 18.2",
                backend: "None",
                database: "None",
                authentication: "None",
                designRequirements: "Tailwind CSS",
                pagesAndRoutes: [
                    { path: "/", name: "LandingPage", description: "Hero section" }
                ],
                components: [
                    { name: "Navbar", purpose: "Navigation" }
                ],
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

            const generatedFiles = [
                { name: "src/pages/LandingPage.jsx", content: "export default function LandingPage() {}" },
                { name: "src/components/Navbar.jsx", content: "export default function Navbar() {}" },
                { name: "package.json", content: "React (Vite) 18.2, Tailwind CSS, Vercel" }
            ];

            const result = auditRequirements({
                projectSpec,
                generatedFiles
            });

            assert.strictEqual(result.passed, true);
            assert.strictEqual(result.coverage, 100);
            assert.strictEqual(result.statistics.totalRequirements, 5); // frontend, design, deployment, pageRoute, component
            assert.strictEqual(result.missingRequirements.length, 0);
            assert.ok(result.report);
            assert.ok(Object.isFrozen(result));
        });
    });
};
