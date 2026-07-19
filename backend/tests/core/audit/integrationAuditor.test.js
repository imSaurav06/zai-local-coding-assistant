"use strict";

const assert = require("assert");

module.exports = function registerIntegrationAuditorTests(suite, test) {
    const { auditIntegration } = require("../../../core/audit/integrationAuditor");
    const { integrationAuditErrorCodes } = require("../../../core/audit/integrationAuditErrors");

    suite("Integration Auditor Public API (Phase 12C)", () => {
        test("1. Rejects invalid inputs with INTEGRATION_AUDIT_INVALID_INPUT", () => {
            assert.throws(() => {
                auditIntegration(null);
            }, (err) => {
                return err.code === integrationAuditErrorCodes.INTEGRATION_AUDIT_INVALID_INPUT;
            });

            assert.throws(() => {
                auditIntegration({}); // missing projectSpec
            }, (err) => {
                return err.code === integrationAuditErrorCodes.INTEGRATION_AUDIT_INVALID_INPUT;
            });
        });

        test("2. Successfully audits complete integration parameters and aggregates VerificationEngine errors", () => {
            const projectSpec = { projectName: "TestProject" };
            const executionMetadata = {
                stages: ["PLAN", "GENERATE", "VERIFY"],
                startTime: "2026-07-19T10:00:00Z",
                endTime: "2026-07-19T10:05:00Z",
                steps: []
            };

            const contracts = {
                folderStructure: ["src/App.jsx"]
            };

            const generatedFiles = [
                { name: "src/App.jsx", content: "console.log('App');" }
            ];

            const verificationReport = {
                success: false,
                errors: [
                    { path: "src/App.jsx", message: "Import target invalid" }
                ]
            };

            const result = auditIntegration({
                projectSpec,
                executionMetadata,
                contracts,
                generatedFiles,
                verificationReport
            });

            assert.strictEqual(result.passed, false); // verificationReport.success === false should fail integration audit
            assert.strictEqual(result.errors.length, 1);
            assert.ok(result.errors[0].includes("Import target invalid"));
            assert.ok(result.report);
            assert.ok(Object.isFrozen(result));
        });
    });
};
