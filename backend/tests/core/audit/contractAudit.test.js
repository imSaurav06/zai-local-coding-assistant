"use strict";

const assert = require("assert");

module.exports = function registerContractAuditTests(suite, test) {
    const { validateContracts } = require("../../../core/audit/contractAudit");

    suite("Contract Audit Engine (Phase 12C)", () => {
        test("1. Successfully matches folder structure, API endpoints, and schemas", () => {
            const contracts = {
                folderStructure: ["src/App.jsx", "src/components/Navbar.jsx"],
                apiEndpoints: [
                    { method: "GET", path: "/api/tasks" }
                ],
                databaseSchemas: [
                    { name: "Task" }
                ]
            };

            const generatedFiles = [
                { name: "src/App.jsx", content: "import Navbar from './components/Navbar'; // GET /api/tasks\nfetch('/api/tasks')" },
                { name: "src/components/Navbar.jsx", content: "export default function Navbar() {}" },
                { name: "src/models/Task.js", content: "const TaskSchema = new Schema();" }
            ];

            const result = validateContracts(contracts, generatedFiles);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.errors.length, 0);
            assert.strictEqual(result.warnings.length, 0);
        });

        test("2. Detects missing files and triggers warnings on unverified endpoints/schemas", () => {
            const contracts = {
                folderStructure: ["src/App.jsx", "src/components/Footer.jsx"], // Footer.jsx is missing
                apiEndpoints: [
                    { method: "POST", path: "/api/login" } // Login is missing
                ],
                databaseSchemas: [
                    { name: "User" }
                ]
            };

            const generatedFiles = [
                { name: "src/App.jsx", content: "console.log('App started')" }
            ];

            const result = validateContracts(contracts, generatedFiles);

            assert.strictEqual(result.success, false);
            assert.strictEqual(result.errors.length, 1);
            assert.ok(result.errors[0].includes("Footer.jsx"));
            assert.strictEqual(result.warnings.length, 2);
            assert.ok(result.warnings.some(w => w.includes("/api/login")));
            assert.ok(result.warnings.some(w => w.includes("User")));
        });
    });
};
