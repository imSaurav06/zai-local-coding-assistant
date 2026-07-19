"use strict";

const assert = require("assert");

module.exports = function registerSessionTests(suite, test) {
    const {
        createRepairRequest,
        createRepairSession,
        validateRepairSession,
        isRepairSession,
        repairSessionErrorCodes,
        REPAIR_SESSION_VERSION
    } = require("../../../core/repair");

    const verification = require("../../../core/verification");
    const originalRun = verification.runVerification;

    function getValidRepairRequest() {
        const config = {
            id: "rep_syntax_01",
            executionId: "exec_123",
            taskId: "task_abc",
            type: "SYNTAX",
            severity: "HIGH",
            status: "PENDING",
            reason: "Mock reason text",
            diagnostics: {},
            affectedFiles: ["src/App.jsx"],
            metadata: {}
        };
        return createRepairRequest(config).repairRequest;
    }

    suite("Repair Session Model Layer (Phase 10C-6)", () => {
        
        test("z. Restore verification runVerification", () => {
            verification.runVerification = originalRun;
        });

        // ── 1. Successful first-pass repair ──
        test("1. execute() succeeds on the first pass when verification passes", async () => {
            const req = getValidRepairRequest();
            const session = createRepairSession({ maxRepairAttempts: 2 });

            // Stub verification to succeed immediately
            verification.runVerification = () => ({ success: true, errors: [], warnings: [] });

            const result = await session.execute(req);

            assert.strictEqual(result.status, "SUCCESS");
            assert.strictEqual(result.attempts, 1);
            assert.strictEqual(result.history.length, 1);
            assert.strictEqual(result.history[0].attemptNumber, 1);
            assert.strictEqual(result.history[0].verificationResult.success, true);
            assert.strictEqual(result.finalVerification.success, true);

            // Immutability checks
            assert.ok(Object.isFrozen(result));
            assert.ok(Object.isFrozen(result.history));
            assert.ok(Object.isFrozen(result.history[0]));

            assert.strictEqual(isRepairSession(result), true);
        });

        // ── 2. Successful second-pass repair ──
        test("2. execute() succeeds on the second pass after a failed first pass", async () => {
            const req = getValidRepairRequest();
            const session = createRepairSession({ maxRepairAttempts: 3 });

            // Fail first pass, pass second pass
            let pass = 0;
            verification.runVerification = () => {
                pass++;
                if (pass === 1) {
                    return { success: false, errors: [{ message: "error" }] };
                }
                return { success: true, errors: [] };
            };

            const result = await session.execute(req);

            assert.strictEqual(result.status, "SUCCESS");
            assert.strictEqual(result.attempts, 2);
            assert.strictEqual(result.history.length, 2);
            assert.strictEqual(result.history[0].verificationResult.success, false);
            assert.strictEqual(result.history[1].verificationResult.success, true);
            assert.strictEqual(result.finalVerification.success, true);
        });

        // ── 3. Exhausted repair attempts ──
        test("3. execute() stops and returns EXHAUSTED when retry attempts are exceeded", async () => {
            const req = getValidRepairRequest();
            const session = createRepairSession({ maxRepairAttempts: 2 });

            // Always fail
            verification.runVerification = () => ({ success: false, errors: [{ message: "error" }] });

            const result = await session.execute(req);

            assert.strictEqual(result.status, "EXHAUSTED");
            assert.strictEqual(result.attempts, 2);
            assert.strictEqual(result.history.length, 2);
            assert.strictEqual(result.history[0].verificationResult.success, false);
            assert.strictEqual(result.history[1].verificationResult.success, false);
        });

        // ── 4. Invalid RepairRequest ──
        test("4. execute() throws REPAIR_SESSION_INVALID_INPUT for invalid requests", async () => {
            const session = createRepairSession();
            const badInputs = [null, undefined, {}, { id: "bad" }];

            for (const input of badInputs) {
                await assert.rejects(async () => {
                    await session.execute(input);
                }, (err) => {
                    return err.code === repairSessionErrorCodes.REPAIR_SESSION_INVALID_INPUT;
                });
            }
        });

        // ── 5. Invalid history structure ──
        test("5. validateRepairSession rejects invalid history list formats", async () => {
            const req = getValidRepairRequest();
            const session = createRepairSession();
            
            verification.runVerification = () => ({ success: true });
            const result = await session.execute(req);

            // Clone manually to preserve references to frozen repairRequest, repairPlan, etc.
            const cloned = {
                ...result,
                history: [
                    {
                        ...result.history[0],
                        attemptNumber: "not-a-number" // corrupted type
                    }
                ]
            };

            const val = validateRepairSession(cloned);
            assert.strictEqual(val.success, false);
            assert.strictEqual(val.errors[0].code, repairSessionErrorCodes.REPAIR_SESSION_INVALID_RESULT);
            assert.strictEqual(val.errors[0].path, "history[0].attemptNumber");
        });

        // ── 6. Input non-mutation ──
        test("6. execute() does not mutate original parameters", async () => {
            const req = getValidRepairRequest();
            const originalJson = JSON.stringify(req);

            const session = createRepairSession();
            verification.runVerification = () => ({ success: true });

            await session.execute(req);

            assert.strictEqual(JSON.stringify(req), originalJson);
        });

        // ── 7. Deterministic equality ──
        test("7. Deterministic value equality is preserved across multiple session runs", async () => {
            const r1 = getValidRepairRequest();
            const r2 = getValidRepairRequest();

            const session = createRepairSession();
            verification.runVerification = () => ({ success: true, errors: [], warnings: [] });

            const originalNow = Date.now;
            Date.now = () => 1000;

            try {
                const res1 = await session.execute(r1);
                const res2 = await session.execute(r2);
                assert.deepStrictEqual(res1, res2);
            } finally {
                Date.now = originalNow;
            }
        });

        test("z. Restore verification runVerification", () => {
            verification.runVerification = originalRun;
        });
    });
};
