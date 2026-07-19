"use strict";

const assert = require("assert");

module.exports = function registerCoverageTests(suite, test) {
    const { calculateCoverage } = require("../../../core/audit/requirementCoverage");

    suite("Requirement Coverage Calculator (Phase 12A)", () => {
        test("1. Correctly calculates satisfied/failed counts and percentages", () => {
            const requirements = [
                { stableId: "req_1", displayId: "REQ-001", kind: "pageRoute", semanticKey: "/" },
                { stableId: "req_2", displayId: "REQ-002", kind: "component", semanticKey: "Navbar" },
                { stableId: "req_3", displayId: "REQ-003", kind: "backendApi", semanticKey: "GET /api/tasks" }
            ];

            const evidenceMap = {
                req_1: { satisfied: true, files: [{ path: "src/pages/LandingPage.jsx" }] },
                req_2: { satisfied: true, files: [{ path: "src/components/Navbar.jsx" }] },
                req_3: { satisfied: false, files: [] }
            };

            const result = calculateCoverage(evidenceMap, requirements, []);

            assert.strictEqual(result.coverage, 66.67);
            assert.strictEqual(result.statistics.totalRequirements, 3);
            assert.strictEqual(result.statistics.satisfiedRequirements, 2);
            assert.strictEqual(result.statistics.failedRequirements, 1);
            assert.strictEqual(result.missingRequirements.length, 1);
            assert.strictEqual(result.missingRequirements[0].stableId, "req_3");
        });

        test("2. Detects orphan files correctly ignoring common scaffolds", () => {
            const requirements = [
                { stableId: "req_1", displayId: "REQ-001", kind: "pageRoute", semanticKey: "/" }
            ];

            const evidenceMap = {
                req_1: { satisfied: true, files: [{ path: "src/pages/LandingPage.jsx" }] }
            };

            const generatedFiles = [
                { name: "src/pages/LandingPage.jsx", content: "..." },
                { name: "src/components/ExtraCard.jsx", content: "..." }, // Orphan!
                { name: "README.md", content: "..." }, // Ignored scaffold
                { name: "package.json", content: "{}" } // Ignored scaffold
            ];

            const result = calculateCoverage(evidenceMap, requirements, generatedFiles);

            assert.strictEqual(result.orphanArtifacts.length, 1);
            assert.strictEqual(result.orphanArtifacts[0].path, "src/components/ExtraCard.jsx");
        });
    });
};
