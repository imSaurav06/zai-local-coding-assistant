"use strict";

const assert = require("assert");

module.exports = function registerSecurityAuditorTests(suite, test) {
    const { auditSecurity } = require("../../../core/audit/securityAuditor");
    const { securityAuditErrorCodes } = require("../../../core/audit/securityAuditErrors");

    suite("Security Auditor Public API (Phase 12B)", () => {
        test("1. Rejects invalid inputs with SECURITY_AUDIT_INVALID_INPUT", () => {
            assert.throws(() => {
                auditSecurity(null);
            }, (err) => {
                return err.code === securityAuditErrorCodes.SECURITY_AUDIT_INVALID_INPUT;
            });

            assert.throws(() => {
                auditSecurity({}); // missing projectFiles
            }, (err) => {
                return err.code === securityAuditErrorCodes.SECURITY_AUDIT_INVALID_INPUT;
            });
        });

        test("2. Runs complete audit flow successfully and outputs frozen report result", () => {
            const projectFiles = [
                { name: "src/config.js", content: "console.log('App started');" }
            ];

            const packageManifest = {
                dependencies: {
                    lodash: "4.17.21" // safe version
                }
            };

            const result = auditSecurity({
                projectFiles,
                packageManifest
            });

            assert.strictEqual(result.passed, true);
            assert.strictEqual(result.score, 100);
            assert.strictEqual(result.vulnerabilities.length, 0);
            assert.strictEqual(result.secrets.length, 0);
            // Missing env files should trigger warning
            assert.strictEqual(result.warnings.length, 1);
            assert.ok(result.report);
            assert.ok(Object.isFrozen(result));
        });
    });
};
