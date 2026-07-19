"use strict";

const assert = require("assert");

module.exports = function registerDeploymentChecksTests(suite, test) {
    const {
        checkArtifactCompleteness,
        checkPriorAuditResults,
        checkSpecDeploymentReadiness
    } = require("../../../core/audit/deploymentChecks");

    suite("Deployment Checks (Phase 12D)", () => {
        test("1. checkArtifactCompleteness detects empty or missing entry point files", () => {
            const result1 = checkArtifactCompleteness([]);
            assert.strictEqual(result1.passed, false);
            assert.ok(result1.blockers.some(b => b.includes("empty")));

            const result2 = checkArtifactCompleteness([
                { name: "src/helpers.js", content: "function helper() { return 42; }" }
                // No entry point
            ]);
            assert.strictEqual(result2.passed, false);
            assert.ok(result2.blockers.some(b => b.includes("entry point")));

            const result3 = checkArtifactCompleteness([
                { name: "src/main.jsx", content: "import React from 'react'; export default function App() {}" }
            ]);
            assert.strictEqual(result3.passed, true);
            assert.strictEqual(result3.blockers.length, 0);
        });

        test("2. checkPriorAuditResults blocks on failed verifications and critical secrets", () => {
            const verificationFailed = { success: false, errors: [{ message: "Import error" }] };
            const r1 = checkPriorAuditResults(verificationFailed, null, null, null);
            assert.ok(r1.blockers.some(b => b.includes("Verification")));

            const criticalSecurity = {
                passed: false,
                score: 0,
                secrets: [{ severity: "CRITICAL", type: "Google API Key" }]
            };
            const r2 = checkPriorAuditResults(null, criticalSecurity, null, null);
            assert.ok(r2.blockers.some(b => b.includes("CRITICAL credential")));

            const failedIntegration = { passed: false };
            const r3 = checkPriorAuditResults(null, null, failedIntegration, null);
            assert.ok(r3.blockers.some(b => b.includes("Integration")));

            const failedRequirement = { passed: false, missingRequirements: [{ stableId: "req_1" }] };
            const r4 = checkPriorAuditResults(null, null, null, failedRequirement);
            assert.ok(r4.blockers.some(b => b.includes("Requirement compliance")));
        });

        test("3. checkSpecDeploymentReadiness detects invalid or missing spec fields", () => {
            const r1 = checkSpecDeploymentReadiness(null);
            assert.strictEqual(r1.passed, false);
            assert.ok(r1.blockers.some(b => b.includes("Invalid or missing")));

            const r2 = checkSpecDeploymentReadiness({ projectName: "My App" });
            assert.strictEqual(r2.passed, true);
        });
    });
};
