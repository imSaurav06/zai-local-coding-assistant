"use strict";

const assert = require("assert");

module.exports = function registerStressVerificationTests(suite, test) {
    const { createVerificationRepairBridge } = require("../../core/runtime");
    const { createRuntimeConfig } = require("../../core/runtime");

    suite("Stress Verification Validation (Phase 11B-7B)", () => {

        test("1. Verification handles extremely large diagnostics and error files list successfully", async () => {
            const configRes = createRuntimeConfig({ enableVerification: true, enableRepair: false });
            assert.strictEqual(configRes.success, true);
            const bridge = createVerificationRepairBridge(configRes.runtimeConfig);

            const repairModule = require("../../core/repair");
            const originalVerifyPatch = repairModule.verifyPatch;

            const largeErrors = [];
            for (let i = 0; i < 1000; i++) {
                largeErrors.push({
                    path: `src/components/Comp_${i}.jsx`,
                    message: `SyntaxError at line 12: Unexpected token`
                });
            }

            repairModule.verifyPatch = async () => {
                return {
                    success: false,
                    errors: largeErrors,
                    summary: "Found 1000 errors",
                    issues: largeErrors
                };
            };

            const result = {
                files: [{ name: "A.js", content: "const a = 1;" }],
                runInstructions: "npm start",
                summary: "summary",
                model: "gemini",
                projectSpec: {}
            };

            try {
                await bridge.verifyAndRepair(result);
                assert.fail("Should have thrown VERIFICATION_REPAIR_VERIFICATION_FAILED");
            } catch (err) {
                assert.strictEqual(err.code, "VERIFICATION_REPAIR_VERIFICATION_FAILED");
                assert.strictEqual(err.verificationResult.errors.length, 1000);
            } finally {
                repairModule.verifyPatch = originalVerifyPatch;
            }
        });

        test("2. Verification throws VERIFICATION_REPAIR_BRIDGE_FAILED when verification exceptions occur", async () => {
            const configRes = createRuntimeConfig({ enableVerification: true, enableRepair: false });
            const bridge = createVerificationRepairBridge(configRes.runtimeConfig);

            const repairModule = require("../../core/repair");
            const originalVerifyPatch = repairModule.verifyPatch;

            repairModule.verifyPatch = async () => {
                throw new Error("Verification process crashed due to segmentation fault");
            };

            const result = { files: [{ name: "A.js", content: "const a = 1;" }] };

            try {
                await assert.rejects(async () => {
                    await bridge.verifyAndRepair(result);
                }, (err) => {
                    return err.code === "VERIFICATION_REPAIR_BRIDGE_FAILED" &&
                           err.message.includes("crashed due to segmentation fault");
                });
            } finally {
                repairModule.verifyPatch = originalVerifyPatch;
            }
        });
    });
};
