"use strict";

const assert = require("assert");

module.exports = function registerDependencyAuditTests(suite, test) {
    const { auditDependencies, compareVersions } = require("../../../core/audit/dependencyAudit");

    suite("Dependency Auditor (Phase 12B)", () => {
        test("1. Lightweight semver comparison correctly resolves safe version states", () => {
            assert.strictEqual(compareVersions("4.17.15", "4.17.21"), -1);
            assert.strictEqual(compareVersions("4.17.21", "4.17.21"), 0);
            assert.strictEqual(compareVersions("4.17.22", "4.17.21"), 1);
            assert.strictEqual(compareVersions("^4.17.15", "4.17.21"), -1);
        });

        test("2. Detects vulnerable lodash and axios versions in package.json", () => {
            const manifest = {
                dependencies: {
                    lodash: "4.17.15",
                    axios: "^1.5.0",
                    react: "18.2.0"
                }
            };

            const findings = auditDependencies(manifest);

            assert.strictEqual(findings.length, 2);
            assert.ok(findings.some(f => f.package === "lodash" && f.severity === "HIGH"));
            assert.ok(findings.some(f => f.package === "axios" && f.severity === "HIGH"));
        });

        test("3. Parses and audits Python requirements.txt file streams", () => {
            const manifest = `
                django==4.2.5
                flask>=2.3.0
                requests==2.28.1
                # Comment lines are ignored
            `;

            const findings = auditDependencies(manifest);

            assert.strictEqual(findings.length, 3);
            assert.ok(findings.some(f => f.package === "django" && f.severity === "HIGH"));
            assert.ok(findings.some(f => f.package === "requests" && f.severity === "MEDIUM"));
        });
    });
};
