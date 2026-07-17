"use strict";

const assert = require("assert");

module.exports = function registerVerificationRepairBridgeTests(suite, test) {
    // Force require core/verification and verificationAdapter to ensure they are loaded in require.cache
    const verification = require("../../../core/verification");
    const adapter = require("../../../core/repair/verificationAdapter");

    const {
        createVerificationRepairBridge,
        validateVerificationRepairRequest,
        verificationRepairBridgeErrorCodes,
        VERIFICATION_REPAIR_BRIDGE_VERSION
    } = require("../../../core/runtime");

    function getValidResult() {
        return {
            files: [
                { name: "src/App.jsx", content: "export default function App() {}" }
            ],
            runInstructions: "npm run dev",
            summary: "Mock generation",
            model: "glm-5.2",
            projectSpec: {
                projectName: "MockProject"
            }
        };
    }

    suite("Verification & Repair Bridge Layer (Phase 11A-5)", () => {
        let originalRun;
        let verificationKeys = [];

        // Apply mock handler at the start of our suite's execution to prevent being overwritten by prior suites
        test("0. Setup runVerification mock delegation", () => {
            verificationKeys = Object.keys(require.cache).filter(k => {
                const normalized = k.toLowerCase().replace(/\\/g, "/");
                return normalized.includes("core/verification");
            });

            for (const key of verificationKeys) {
                const mod = require.cache[key].exports;
                if (mod && mod.runVerification) {
                    originalRun = mod.runVerification;
                    break;
                }
            }

            if (!originalRun) {
                originalRun = verification.runVerification;
            }

            // Patch all cache records
            for (const key of verificationKeys) {
                const mod = require.cache[key].exports;
                if (mod && mod.runVerification) {
                    mod.runVerification = (files, opts) => {
                        if (global.__verificationMock) {
                            return global.__verificationMock(files, opts);
                        }
                        return originalRun(files, opts);
                    };
                }
            }

            verification.runVerification = (files, opts) => {
                if (global.__verificationMock) {
                    return global.__verificationMock(files, opts);
                }
                return originalRun(files, opts);
            };
        });

        // ── 1. Verification disabled ──
        test("1. verifyAndRepair() returns result immediately when verification is disabled", async () => {
            global.__verificationMock = null;
            const bridge = createVerificationRepairBridge({ enableVerification: false });
            const result = getValidResult();

            const res = await bridge.verifyAndRepair(result);
            assert.strictEqual(res.success, true);
            assert.strictEqual(res.repaired, false);
            assert.deepStrictEqual(res.result, result);
            assert.strictEqual(res.verificationResult, null);
        });

        // ── 2. Verification enabled, successful ──
        test("2. verifyAndRepair() succeeds without repair when verification passes", async () => {
            const bridge = createVerificationRepairBridge({ enableVerification: true });
            const result = getValidResult();

            global.__verificationMock = () => {
                return { success: true, errors: [], warnings: [] };
            };

            const res = await bridge.verifyAndRepair(result);
            assert.strictEqual(res.success, true);
            assert.strictEqual(res.repaired, false);
            assert.strictEqual(res.verificationResult.status, "PASSED");
        });

        // ── 3. Verification enabled, fails, repair disabled ──
        test("3. verifyAndRepair() throws VERIFICATION_REPAIR_VERIFICATION_FAILED when verification fails and repair is disabled", async () => {
            const bridge = createVerificationRepairBridge({ enableVerification: true, enableRepair: false });
            const result = getValidResult();

            global.__verificationMock = () => {
                return { success: false, errors: [{ file: "src/App.jsx", message: "Syntax error" }], warnings: [] };
            };

            await assert.rejects(async () => {
                await bridge.verifyAndRepair(result);
            }, (err) => {
                return err.code === verificationRepairBridgeErrorCodes.VERIFICATION_REPAIR_VERIFICATION_FAILED &&
                       err.verificationResult.status === "FAILED";
            });
        });

        // ── 4. Verification fails, repair enabled, succeeds ──
        test("4. verifyAndRepair() triggers repair and returns repaired result on success", async () => {
            const bridge = createVerificationRepairBridge({ enableVerification: true, enableRepair: true });
            const result = getValidResult();

            let callCount = 0;
            global.__verificationMock = () => {
                callCount++;
                if (callCount === 1) {
                    // First pass: original verification fails
                    return { success: false, errors: [{ file: "src/App.jsx", message: "Syntax error" }], warnings: [] };
                }
                // Subsequent passes (repair attempts): succeed
                return { success: true, errors: [], warnings: [] };
            };

            const res = await bridge.verifyAndRepair(result);
            assert.strictEqual(res.success, true);
            assert.strictEqual(res.repaired, true);
            assert.strictEqual(res.verificationResult.status, "PASSED");
            assert.ok(res.result.files.some(f => f.name === "src/App.jsx"));
        });

        // ── 5. Verification fails, repair enabled, fails ──
        test("5. verifyAndRepair() throws VERIFICATION_REPAIR_REPAIR_FAILED when repair attempts are exhausted", async () => {
            const bridge = createVerificationRepairBridge({ enableVerification: true, enableRepair: true });
            const result = getValidResult();

            global.__verificationMock = () => {
                return { success: false, errors: [{ file: "src/App.jsx", message: "Syntax error" }], warnings: [] };
            };

            await assert.rejects(async () => {
                await bridge.verifyAndRepair(result);
            }, (err) => {
                return err.code === verificationRepairBridgeErrorCodes.VERIFICATION_REPAIR_REPAIR_FAILED &&
                       err.sessionResult.status === "EXHAUSTED";
            });
        });

        // ── 6. Error translation ──
        test("6. verifyAndRepair() translates unexpected engine exceptions to VERIFICATION_REPAIR_BRIDGE_FAILED", async () => {
            const bridge = createVerificationRepairBridge({ enableVerification: true });
            const result = getValidResult();

            global.__verificationMock = () => {
                throw new Error("Engine memory corruption");
            };

            await assert.rejects(async () => {
                await bridge.verifyAndRepair(result);
            }, (err) => {
                return err.code === verificationRepairBridgeErrorCodes.VERIFICATION_REPAIR_BRIDGE_FAILED &&
                       err.message.includes("Engine memory corruption");
            });
        });

        // ── 7. Input non-mutation ──
        test("7. verifyAndRepair() does not mutate input generation result", async () => {
            global.__verificationMock = null;
            const bridge = createVerificationRepairBridge({ enableVerification: false });
            const result = getValidResult();
            const originalJson = JSON.stringify(result);

            await bridge.verifyAndRepair(result);
            assert.strictEqual(JSON.stringify(result), originalJson);
        });

        // ── 8. Immutable configuration ──
        test("8. bridge configurations and response layouts are frozen", () => {
            const bridge = createVerificationRepairBridge({ enableVerification: false });
            assert.ok(Object.isFrozen(bridge));
            assert.ok(Object.isFrozen(bridge.config));
        });

        // Restore runVerification helper at the end
        test("z. Restore verification runVerification", () => {
            global.__verificationMock = null;
            if (originalRun) {
                for (const key of verificationKeys) {
                    const mod = require.cache[key].exports;
                    if (mod && mod.runVerification) {
                        mod.runVerification = originalRun;
                    }
                }
                verification.runVerification = originalRun;
            }
        });
    });
};
