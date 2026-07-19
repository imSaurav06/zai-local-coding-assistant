"use strict";

const assert = require("assert");

module.exports = function registerEvidenceTests(suite, test) {
    const { collectEvidence } = require("../../../core/audit/requirementEvidence");

    suite("Requirement Evidence Collector (Phase 12A)", () => {
        test("1. Successfully scans generated files and collects matches for pages and components", () => {
            const requirements = [
                {
                    stableId: "req_page_classes",
                    displayId: "REQ-001",
                    kind: "pageRoute",
                    semanticKey: "/classes",
                    payload: { path: "/classes", name: "ClassesPage" }
                },
                {
                    stableId: "req_comp_navbar",
                    displayId: "REQ-002",
                    kind: "component",
                    semanticKey: "Navbar",
                    payload: { name: "Navbar" }
                }
            ];

            const generatedFiles = [
                { name: "src/pages/ClassesPage.jsx", content: "export default function ClassesPage() {}" },
                { name: "src/components/Navbar.js", content: "export default function Navbar() {}" },
                { name: "src/App.jsx", content: "import Navbar from './components/Navbar'; import ClassesPage from './pages/ClassesPage';" }
            ];

            const evidenceMap = collectEvidence(requirements, generatedFiles, {}, {}, []);

            assert.ok(evidenceMap.req_page_classes);
            assert.strictEqual(evidenceMap.req_page_classes.satisfied, true);
            assert.strictEqual(evidenceMap.req_page_classes.files.length, 1);
            assert.strictEqual(evidenceMap.req_page_classes.files[0].path, "src/pages/ClassesPage.jsx");

            assert.ok(evidenceMap.req_comp_navbar);
            assert.strictEqual(evidenceMap.req_comp_navbar.satisfied, true);
            // Navbar.js matches by name, and App.jsx matches by importing 'Navbar'
            assert.strictEqual(evidenceMap.req_comp_navbar.files.length, 2);
        });

        test("2. Correctly traces backend API and databaseModel contracts", () => {
            const requirements = [
                {
                    stableId: "req_api_tasks",
                    displayId: "REQ-003",
                    kind: "backendApi",
                    semanticKey: "GET /api/tasks",
                    payload: { method: "GET", path: "/api/tasks" }
                },
                {
                    stableId: "req_model_task",
                    displayId: "REQ-004",
                    kind: "databaseModel",
                    semanticKey: "Task",
                    payload: { name: "Task", fields: ["title", "completed"] }
                }
            ];

            const contracts = {
                apiEndpoints: [
                    { method: "GET", path: "/api/tasks", description: "Fetch tasks" }
                ],
                databaseSchemas: [
                    { name: "Task", fields: ["title", "completed"] }
                ]
            };

            const evidenceMap = collectEvidence(requirements, [], contracts, {}, []);

            assert.ok(evidenceMap.req_api_tasks);
            assert.strictEqual(evidenceMap.req_api_tasks.satisfied, true);
            assert.strictEqual(evidenceMap.req_api_tasks.contracts.length, 1);
            assert.strictEqual(evidenceMap.req_api_tasks.contracts[0].type, "apiEndpoint");

            assert.ok(evidenceMap.req_model_task);
            assert.strictEqual(evidenceMap.req_model_task.satisfied, true);
            assert.strictEqual(evidenceMap.req_model_task.contracts.length, 1);
            assert.strictEqual(evidenceMap.req_model_task.contracts[0].type, "databaseSchema");
        });

        test("3. Unsatisfied on critical verification errors on matched files", () => {
            const requirements = [
                {
                    stableId: "req_page_home",
                    displayId: "REQ-005",
                    kind: "pageRoute",
                    semanticKey: "/",
                    payload: { path: "/", name: "HomePage" }
                }
            ];

            const generatedFiles = [
                { name: "src/pages/HomePage.jsx", content: "export default function HomePage() { return <div>Home</div>" } // syntax error (missing tag closure)
            ];

            const verificationReport = {
                success: false,
                errors: [
                    { path: "src/pages/HomePage.jsx", message: "SyntaxError: Unexpected token", severity: "ERROR" }
                ]
            };

            const evidenceMap = collectEvidence(requirements, generatedFiles, {}, verificationReport, []);

            assert.ok(evidenceMap.req_page_home);
            assert.strictEqual(evidenceMap.req_page_home.satisfied, false);
            assert.strictEqual(evidenceMap.req_page_home.verificationIssues.length, 1);
        });
    });
};
