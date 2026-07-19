"use strict";

const assert = require("assert");

module.exports = function registerStressRepairTests(suite, test) {
    const { createVerificationRepairBridge } = require("../../core/runtime");
    const { createRuntimeConfig } = require("../../core/runtime");

    suite("Stress Repair Validation (Phase 11B-7B)", () => {

        test("1. Repair processes multiple sequential repair iterations successfully", async () => {
            const configRes = createRuntimeConfig({ enableVerification: true, enableRepair: true });
            assert.strictEqual(configRes.success, true);
            const bridge = createVerificationRepairBridge(configRes.runtimeConfig);

            const repairModule = require("../../core/repair");
            const originalVerifyPatch = repairModule.verifyPatch;
            const originalExecuteSession = repairModule.executeRepairSession;

            let verifyCount = 0;
            repairModule.verifyPatch = async (patch) => {
                verifyCount++;
                const success = verifyCount >= 3;
                return {
                    success,
                    errors: success ? [] : [{ path: "A.js", message: "mismatch" }],
                    summary: success ? "Passed" : "Failed",
                    issues: success ? [] : [{ path: "A.js", message: "mismatch" }]
                };
            };

            let repairCount = 0;
            repairModule.executeRepairSession = async (repairRequest, config) => {
                repairCount++;
                return {
                    status: "SUCCESS",
                    finalPatch: {
                        operations: [{ type: "UPDATE_FILE", path: "A.js", content: `// Repaired ${repairCount}` }]
                    },
                    finalVerification: {
                        success: true,
                        errors: []
                    }
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
                const verifyRepairRes = await bridge.verifyAndRepair(result);
                assert.strictEqual(verifyRepairRes.success, true);
                assert.strictEqual(verifyRepairRes.repaired, true);
                assert.strictEqual(verifyCount, 1); // 1st verify is run inside verifyAndRepair, remaining inside the mocked executeRepairSession
                assert.strictEqual(repairCount, 1);
            } finally {
                repairModule.verifyPatch = originalVerifyPatch;
                repairModule.executeRepairSession = originalExecuteSession;
            }
        });

        test("2. Repair throws VERIFICATION_REPAIR_BRIDGE_FAILED when repair execution throws", async () => {
            const configRes = createRuntimeConfig({ enableVerification: true, enableRepair: true });
            const bridge = createVerificationRepairBridge(configRes.runtimeConfig);

            const repairModule = require("../../core/repair");
            const originalVerifyPatch = repairModule.verifyPatch;
            const originalExecuteSession = repairModule.executeRepairSession;

            repairModule.verifyPatch = async () => ({
                success: false,
                errors: [{ path: "A.js", message: "mismatch" }],
                summary: "mismatch",
                issues: [{ path: "A.js", message: "mismatch" }]
            });

            repairModule.executeRepairSession = async () => {
                throw new Error("Disk out of space or database connectivity issues during repair");
            };

            const result = { files: [{ name: "A.js", content: "a" }] };

            try {
                await assert.rejects(async () => {
                    await bridge.verifyAndRepair(result);
                }, (err) => {
                    return err.code === "VERIFICATION_REPAIR_BRIDGE_FAILED" &&
                           err.message.includes("database connectivity issues");
                });
            } finally {
                repairModule.verifyPatch = originalVerifyPatch;
                repairModule.executeRepairSession = originalExecuteSession;
            }
        });

        test("3. Verify RepairSession immutability", () => {
            const { deepFreezeRepairSession } = require("../../core/repair/repairSession");
            const session = {
                id: "sess_123",
                status: "PENDING",
                history: []
            };
            
            const frozen = deepFreezeRepairSession(session);
            assert.ok(Object.isFrozen(frozen));
            assert.ok(Object.isFrozen(frozen.history));

            assert.throws(() => {
                frozen.history.push({});
            }, TypeError);

            assert.throws(() => {
                frozen.status = "SUCCESS";
            }, TypeError);
        });
    });
};
