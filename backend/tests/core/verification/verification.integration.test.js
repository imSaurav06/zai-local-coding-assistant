"use strict";

const assert = require("assert");

module.exports = function registerVerificationIntegrationTests(suite, test) {
    const { createVerificationBridge } = require("../../../core/runtime");
    const { verificationErrorCodes } = require("../../../core/runtime");

    suite("Verification Bridge Integration (Phase 11B-5A)", () => {
        test("1. Appends a valid PASSED VerificationReport on successful verification", async () => {
            const bridge = createVerificationBridge({
                enableVerification: true,
                verificationEngine: require("../../../core/verification/verificationEngine")
            });
            const executionResult = {
                success: true,
                files: [
                    { name: "README.md", content: "# My Project\nDescription here." },
                    { name: "package.json", content: '{"dependencies": {}}' },
                    { name: "index.js", content: "const x = 1;" },
                    { name: "index.html", content: "<!DOCTYPE html><html><body>Hello</body></html>" }
                ]
            };

            const verified = await bridge.verifyResult(executionResult);
            assert.strictEqual(verified.success, true);
            assert.ok(verified.verificationReport);
            assert.strictEqual(verified.verificationReport.status, "PASSED");
            assert.strictEqual(verified.verificationReport.statistics.totalErrors, 0);
            assert.ok(Object.isFrozen(verified.verificationReport));
        });

        test("2. Appends a FAILED VerificationReport and fails execution on failed verification", async () => {
            const bridge = createVerificationBridge({
                enableVerification: true,
                verificationEngine: require("../../../core/verification/verificationEngine")
            });
            // Missing README.md will trigger structure validation failure
            const executionResult = {
                success: true,
                files: [
                    { name: "index.js", content: "const x = 1;" }
                ]
            };

            const verified = await bridge.verifyResult(executionResult);
            assert.strictEqual(verified.success, false);
            assert.strictEqual(verified.verificationReport.status, "FAILED");
            assert.ok(verified.verificationReport.statistics.totalErrors > 0);
        });

        test("3. Behaves as transparent no-op when enableVerification is false", async () => {
            const bridge = createVerificationBridge({ enableVerification: false });
            const executionResult = {
                success: true,
                files: [
                    { name: "index.js", content: "const x = 1;" }
                ]
            };

            const verified = await bridge.verifyResult(executionResult);
            assert.strictEqual(verified.success, true);
            assert.strictEqual(verified.verificationReport, undefined);
        });
    });
};
