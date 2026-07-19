"use strict";

const assert = require("assert");

module.exports = function registerDeploymentQualifierTests(suite, test) {
    const { qualifyDeployment } = require("../../../core/audit/deploymentQualifier");
    const { deploymentQualificationErrorCodes } = require("../../../core/audit/deploymentQualificationErrors");

    suite("Deployment Qualifier Public API (Phase 12D)", () => {
        test("1. Rejects invalid inputs with DEPLOYMENT_QUALIFICATION_INVALID_INPUT", () => {
            assert.throws(() => {
                qualifyDeployment(null);
            }, (err) => {
                return err.code === deploymentQualificationErrorCodes.DEPLOYMENT_QUALIFICATION_INVALID_INPUT;
            });

            assert.throws(() => {
                qualifyDeployment({ projectSpec: { projectName: "Test" } }); // missing generatedFiles
            }, (err) => {
                return err.code === deploymentQualificationErrorCodes.DEPLOYMENT_QUALIFICATION_INVALID_INPUT;
            });
        });

        test("2. Qualifies a clean project as APPROVED_FOR_DEPLOYMENT", () => {
            const result = qualifyDeployment({
                projectSpec: {
                    projectName: "MyApp",
                    projectType: "React Landing Page",
                    deploymentRequirements: "Vercel"
                },
                generatedFiles: [
                    { name: "src/main.jsx", content: "import React from 'react'; export default function App() { return <div>Hello</div>; }" }
                ],
                verificationReport: { success: true, errors: [] },
                securityReport: { passed: true, score: 100, secrets: [], vulnerabilities: [] },
                integrationReport: { passed: true, score: 100 },
                requirementReport: { passed: true, missingRequirements: [] }
            });

            assert.strictEqual(result.passed, true);
            assert.strictEqual(result.recommendation, "APPROVED_FOR_DEPLOYMENT");
            assert.strictEqual(result.blockers.length, 0);
            assert.ok(result.report);
            assert.ok(Object.isFrozen(result));
        });

        test("3. Blocks deployment when verification has failures", () => {
            const result = qualifyDeployment({
                projectSpec: { projectName: "BrokenApp" },
                generatedFiles: [
                    { name: "server.js", content: "console.log('broken app');" }
                ],
                verificationReport: {
                    success: false,
                    errors: [{ message: "SyntaxError: Unexpected token" }]
                }
            });

            assert.strictEqual(result.passed, false);
            assert.strictEqual(result.recommendation, "DEPLOYMENT_BLOCKED");
            assert.ok(result.blockers.some(b => b.includes("Verification")));
        });

        test("4. Output is deeply frozen and immutable", () => {
            const result = qualifyDeployment({
                projectSpec: { projectName: "TestApp" },
                generatedFiles: [
                    { name: "server.js", content: "const app = require('express')(); app.listen(3000);" }
                ]
            });

            assert.ok(Object.isFrozen(result));
            assert.ok(Object.isFrozen(result.report));
            assert.ok(Object.isFrozen(result.blockers));
            assert.throws(() => { result.passed = true; }, TypeError);
        });
    });
};
