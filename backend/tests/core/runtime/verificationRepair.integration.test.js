"use strict";

const assert = require("assert");
const { createVerificationRepairBridge } = require("../../../core/runtime");

module.exports = function registerVerificationRepairIntegrationTests(suite, test) {
    suite("Verification & Repair Modular Integration (Phase 11B-5B)", () => {
        test("1. verifyAndRepair coordinates verification failure and subsequent successful repair", async () => {
            let verifyCount = 0;
            const mockVerification = {
                runVerification: (files, opts) => {
                    verifyCount++;
                    if (verifyCount === 1) {
                        return { success: false, errors: [{ path: "src/App.jsx", message: "Error" }], warnings: [] };
                    }
                    return { success: true, errors: [], warnings: [] };
                }
            };

            const bridge = createVerificationRepairBridge({
                enableVerification: true,
                enableRepair: true
            });

            // Stub core/repair's executeRepairSession to simulate repair pass
            const repairModule = require("../../../core/repair");
            const originalExecute = repairModule.executeRepairSession;
            repairModule.executeRepairSession = async (repairRequest, config) => {
                return {
                    status: "SUCCESS",
                    attempts: 1,
                    finalPatch: {
                        operations: [{ type: "UPDATE_FILE", path: "src/App.jsx", content: "fixed" }]
                    },
                    finalVerification: { success: true }
                };
            };

            // Stub core/repair's verifyPatch to control verification outcomes
            const originalVerifyPatch = repairModule.verifyPatch;
            repairModule.verifyPatch = async (patch) => {
                verifyCount++;
                if (verifyCount === 1) {
                    return { success: false, errors: ["Error"], warnings: [] };
                }
                return { success: true, errors: [], warnings: [] };
            };

            try {
                const initialResult = {
                    files: [{ name: "src/App.jsx", content: "broken" }]
                };

                const res = await bridge.verifyAndRepair(initialResult);
                assert.strictEqual(res.success, true);
                assert.strictEqual(res.repaired, true);
                assert.strictEqual(res.result.files[0].content, "fixed");
            } finally {
                repairModule.executeRepairSession = originalExecute;
                repairModule.verifyPatch = originalVerifyPatch;
            }
        });
    });
};
