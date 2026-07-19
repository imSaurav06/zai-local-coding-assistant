"use strict";

const assert = require("assert");
const { createRepairBridge } = require("../../../core/runtime");
const { repairErrorCodes } = require("../../../core/repair/repairErrors");

module.exports = function registerRepairIntegrationTests(suite, test) {
    suite("Repair Bridge Integration (Phase 11B-5B)", () => {
        
        test("1. Successful repair on first pass", async () => {
            let verifyCallCount = 0;
            const mockVerificationEngine = {
                runVerification: (files, opts) => {
                    return {
                        success: true,
                        errors: [],
                        warnings: []
                    };
                }
            };

            const bridge = createRepairBridge({
                enableRepair: true,
                maxRepairAttempts: 2,
                verificationEngine: mockVerificationEngine
            });

            // Mock generation execution result that failed verification
            const initialResult = {
                success: false,
                files: [
                    { name: "src/App.jsx", content: "export default const App = () => {}" },
                    { name: "README.md", content: "# My Project" }
                ],
                verificationReport: {
                    status: "FAILED",
                    errors: [{ path: "src/App.jsx", message: "Syntax error in App.jsx" }],
                    warnings: [],
                    statistics: { totalErrors: 1 }
                }
            };

            // Mock targetedRepairService/aiExecutor behaviors by passing a custom option/mock
            const mockRepairSingleFile = async (name, errors, diagnostics, allFiles) => {
                return {
                    success: true,
                    repairedFile: { name: "src/App.jsx", content: "export const App = () => {}" }
                };
            };
            
            // Temporary override repairSingleFile
            const targetedRepair = require("../../../services/targetedRepairService");
            const originalRepairSingleFile = targetedRepair.repairSingleFile;
            targetedRepair.repairSingleFile = mockRepairSingleFile;

            try {
                const result = await bridge.repairResult(initialResult, {
                    projectSpec: { projectName: "TestProject" }
                });

                assert.strictEqual(result.success, true);
                assert.ok(result.repairSession);
                assert.strictEqual(result.repairSession.attemptNumber, 1);
                assert.deepStrictEqual(result.repairSession.repairedFiles, ["src/App.jsx"]);
                assert.strictEqual(result.repairSession.status, "SUCCESS");
                assert.ok(Object.isFrozen(result.repairSession));

                // Verify untouched files are unchanged
                const readme = result.files.find(f => f.name === "README.md");
                assert.strictEqual(readme.content, "# My Project");
            } finally {
                targetedRepair.repairSingleFile = originalRepairSingleFile;
            }
        });

        test("2. Fails after max repair attempts are reached", async () => {
            const mockVerificationEngine = {
                runVerification: (files, opts) => {
                    return {
                        success: false,
                        errors: [{ path: "src/App.jsx", message: "Still failing" }],
                        warnings: []
                    };
                }
            };

            const bridge = createRepairBridge({
                enableRepair: true,
                maxRepairAttempts: 2,
                verificationEngine: mockVerificationEngine
            });

            const initialResult = {
                success: false,
                files: [
                    { name: "src/App.jsx", content: "bad content" }
                ],
                verificationReport: {
                    status: "FAILED",
                    errors: [{ path: "src/App.jsx", message: "Still failing" }],
                    warnings: [],
                    statistics: { totalErrors: 1 }
                }
            };

            const mockRepairSingleFile = async () => ({
                success: true,
                repairedFile: { name: "src/App.jsx", content: "bad content still" }
            });

            const targetedRepair = require("../../../services/targetedRepairService");
            const originalRepairSingleFile = targetedRepair.repairSingleFile;
            targetedRepair.repairSingleFile = mockRepairSingleFile;

            try {
                const result = await bridge.repairResult(initialResult, {
                    projectSpec: { projectName: "TestProject" }
                });

                assert.strictEqual(result.success, false);
                assert.ok(result.repairSession);
                assert.strictEqual(result.repairSession.attemptNumber, 2);
                assert.strictEqual(result.repairSession.status, "FAILED");
            } finally {
                targetedRepair.repairSingleFile = originalRepairSingleFile;
            }
        });

        test("3. Reject if repair modifies unrelated files", async () => {
            const mockVerificationEngine = {
                runVerification: () => ({ success: true, errors: [], warnings: [] })
            };

            const bridge = createRepairBridge({
                enableRepair: true,
                maxRepairAttempts: 2,
                verificationEngine: mockVerificationEngine
            });

            const initialResult = {
                success: false,
                files: [
                    { name: "src/App.jsx", content: "bad App" },
                    { name: "src/unrelated.js", content: "unrelated content" }
                ],
                verificationReport: {
                    status: "FAILED",
                    errors: [{ path: "src/App.jsx", message: "App failed" }],
                    warnings: [],
                    statistics: { totalErrors: 1 }
                }
            };

            // Mock repair to modify src/unrelated.js (unrelated!)
            const mockRepairSingleFile = async (name) => {
                if (name === "src/App.jsx") {
                    return {
                        success: true,
                        repairedFile: { name: "src/unrelated.js", content: "modified unrelated!" }
                    };
                }
                return { success: false };
            };

            const targetedRepair = require("../../../services/targetedRepairService");
            const originalRepairSingleFile = targetedRepair.repairSingleFile;
            targetedRepair.repairSingleFile = mockRepairSingleFile;

            try {
                await assert.rejects(async () => {
                    await bridge.repairResult(initialResult, {
                        projectSpec: { projectName: "TestProject" }
                    });
                }, (err) => {
                    return err.code === "REPAIR_RESULT_INVALID";
                });
            } finally {
                targetedRepair.repairSingleFile = originalRepairSingleFile;
            }
        });
    });
};
