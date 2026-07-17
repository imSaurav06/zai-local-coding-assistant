"use strict";

const assert = require("assert");

module.exports = function registerVerificationTests(suite, test) {
    const {
        createPatch,
        createVerificationAdapter,
        validateVerificationResult,
        isVerificationResult,
        verificationAdapterErrorCodes,
        VERIFICATION_ADAPTER_VERSION
    } = require("../../../core/repair");

    const verification = require("../../../core/verification");

    function getValidPatch() {
        const config = {
            id: "patch_01",
            repairId: "rep_01",
            executionId: "exec_123",
            taskId: "task_abc",
            strategy: "AI",
            status: "PENDING",
            operations: [
                {
                    type: "UPDATE_FILE",
                    path: "package.json",
                    content: JSON.stringify({ name: "valid_package", private: true })
                }
            ],
            affectedFiles: ["package.json"],
            metadata: {}
        };
        return createPatch(config).patch;
    }

    suite("Verification Adapter Layer (Phase 10C-5)", () => {
        // ── 1. Successful verification ──
        test("1. verifyPatch executes runVerification and returns PASSED VerificationResult", async () => {
            const patch = getValidPatch();
            const adapter = createVerificationAdapter();

            const originalRun = verification.runVerification;
            verification.runVerification = () => {
                return {
                    success: true,
                    errors: [],
                    warnings: []
                };
            };

            try {
                const result = await adapter.verify(patch);

                assert.strictEqual(result.success, true);
                assert.strictEqual(result.patchId, "patch_01");
                assert.strictEqual(result.status, "PASSED");
                assert.deepStrictEqual(result.issues, []);
                assert.ok(result.summary.includes("PASSED"));

                // Immutability checks
                assert.ok(Object.isFrozen(result));
                assert.ok(Object.isFrozen(result.issues));

                assert.strictEqual(isVerificationResult(result), true);
            } finally {
                verification.runVerification = originalRun;
            }
        });

        // ── 2. Failed verification ──
        test("2. verifyPatch executes runVerification and returns FAILED VerificationResult on syntax failures", async () => {
            const patch = getValidPatch();
            const adapter = createVerificationAdapter();

            const originalRun = verification.runVerification;
            verification.runVerification = () => {
                return {
                    success: false,
                    errors: [{ message: "Syntax error on line 2" }],
                    warnings: []
                };
            };

            try {
                const result = await adapter.verify(patch);

                assert.strictEqual(result.success, false);
                assert.strictEqual(result.status, "FAILED");
                assert.ok(result.issues.length > 0);
                assert.ok(result.summary.includes("FAILED"));
            } finally {
                verification.runVerification = originalRun;
            }
        });

        // ── 3. Invalid patch ──
        test("3. verifyPatch throws VERIFICATION_ADAPTER_INVALID_INPUT for invalid patches", async () => {
            const adapter = createVerificationAdapter();
            const badInputs = [null, undefined, {}, { id: "bad_patch" }];

            for (const input of badInputs) {
                await assert.rejects(async () => {
                    await adapter.verify(input);
                }, (err) => {
                    return err.code === verificationAdapterErrorCodes.VERIFICATION_ADAPTER_INVALID_INPUT;
                });
            }
        });

        // ── 4. Invalid verification result ──
        test("4. validateVerificationResult rejects invalid schemas", () => {
            // Null input
            const res1 = validateVerificationResult(null);
            assert.strictEqual(res1.success, false);
            assert.strictEqual(res1.errors[0].code, verificationAdapterErrorCodes.VERIFICATION_ADAPTER_INVALID_INPUT);

            // Missing required keys
            const res2 = validateVerificationResult({ success: true });
            assert.strictEqual(res2.success, false);
            assert.strictEqual(res2.errors[0].code, verificationAdapterErrorCodes.VERIFICATION_ADAPTER_INVALID_RESULT);
            assert.strictEqual(res2.errors[0].path, "patchId");
        });

        // ── 5. Adapter error translation ──
        test("5. verifyPatch catches underlying engine crashes and maps them to VERIFICATION_ADAPTER_FAILED", async () => {
            const patch = getValidPatch();
            const adapter = createVerificationAdapter();

            const originalRun = verification.runVerification;
            verification.runVerification = () => {
                throw new Error("Internal hardware failure");
            };

            try {
                await assert.rejects(async () => {
                    await adapter.verify(patch);
                }, (err) => {
                    return err.code === verificationAdapterErrorCodes.VERIFICATION_ADAPTER_FAILED;
                });
            } finally {
                verification.runVerification = originalRun;
            }
        });

        // ── 6. Input non-mutation ──
        test("6. verifyPatch does not mutate input patch", async () => {
            const patch = getValidPatch();
            const originalJson = JSON.stringify(patch);

            const adapter = createVerificationAdapter();
            const originalRun = verification.runVerification;
            verification.runVerification = () => ({ success: true });

            try {
                await adapter.verify(patch);
                assert.strictEqual(JSON.stringify(patch), originalJson);
            } finally {
                verification.runVerification = originalRun;
            }
        });

        // ── 7. Deterministic equality ──
        test("7. Deterministic value equality is preserved across multiple verify runs", async () => {
            const p1 = getValidPatch();
            const p2 = getValidPatch();

            const adapter = createVerificationAdapter();
            const originalRun = verification.runVerification;
            verification.runVerification = () => ({ success: true, errors: [], warnings: [] });

            try {
                const res1 = await adapter.verify(p1);
                const res2 = await adapter.verify(p2);
                assert.deepStrictEqual(res1, res2);
            } finally {
                verification.runVerification = originalRun;
            }
        });
    });
};
