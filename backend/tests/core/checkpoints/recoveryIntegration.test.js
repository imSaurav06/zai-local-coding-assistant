"use strict";

const assert = require("assert");

module.exports = function registerRecoveryIntegrationTests(suite, test) {
    const {
        createCheckpoint,
        checkpointErrorCodes,
        checkpointStoreErrorCodes
    } = require("../../../core/checkpoints");
    const { recoverExecution } = require("../../../core/execution");

    function getSampleValidCheckpoint(execId = "exec_recovery_test_123") {
        const opts = {
            version: "1.0",
            executionId: execId,
            metadata: {
                createdAt: "2026-07-17T12:00:00.000Z",
                updatedAt: "2026-07-17T12:30:00.000Z",
                waveNumber: 3
            },
            queues: {
                pending: ["task_c", "task_d"],
                running: ["task_b"],
                completed: ["task_a"],
                failed: []
            },
            workers: ["worker_1"],
            statistics: {
                completedTasks: 1,
                failedTasks: 0,
                totalTasks: 4
            }
        };
        const buildResult = createCheckpoint(opts);
        return buildResult.checkpoint;
    }

    suite("Checkpoint Recovery Integration Layer (Phase 10A-5C)", () => {
        // ── 1. Successful recovery ──
        test("1. recoverExecution successfully restores ExecutionState and returns RecoveryResult", async () => {
            const checkpoint = getSampleValidCheckpoint("exec_rec_success");
            const mockStore = {
                load: async (id) => {
                    assert.strictEqual(id, "exec_rec_success");
                    return checkpoint;
                }
            };

            const result = await recoverExecution("exec_rec_success", mockStore);
            assert.ok(result);
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.checkpointVersion, "1.0");
            assert.strictEqual(result.reason, "SUCCESS");
            assert.ok(result.recoveredAt);

            const state = result.executionState;
            assert.ok(state);
            assert.strictEqual(state.metadata.executionId, "exec_rec_success");
            assert.strictEqual(state.metadata.waveNumber, 3);
            assert.deepStrictEqual(state.queues.pending, ["task_c", "task_d"]);
        });

        // ── 2. Missing checkpoint ──
        test("2. recoverExecution throws error when checkpoint is missing", async () => {
            const mockStore = {
                load: async () => null
            };

            await assert.rejects(async () => {
                await recoverExecution("exec_missing", mockStore);
            }, (err) => {
                return err.code === "RESUME_INVALID_CHECKPOINT";
            });
        });

        // ── 3. Invalid checkpoint ──
        test("3. recoverExecution throws error when checkpoint is corrupted", async () => {
            const invalidCheckpoint = {
                version: "1.0",
                executionId: "exec_corrupted"
                // missing queues/metadata/statistics
            };
            const mockStore = {
                load: async () => invalidCheckpoint
            };

            await assert.rejects(async () => {
                await recoverExecution("exec_corrupted", mockStore);
            }, (err) => {
                return err.code === checkpointErrorCodes.CHECKPOINT_INVALID_STRUCTURE;
            });
        });

        // ── 4. Unsupported version ──
        test("4. recoverExecution throws error when checkpoint version is incompatible", async () => {
            const { deepFreezeCheckpoint } = require("../../../core/checkpoints");
            const checkpoint = getSampleValidCheckpoint("exec_ver_fail");
            const raw = JSON.parse(JSON.stringify(checkpoint));
            raw.version = "2.0"; // unsupported version

            const mockStore = {
                load: async () => deepFreezeCheckpoint(raw)
            };

            await assert.rejects(async () => {
                await recoverExecution("exec_ver_fail", mockStore);
            }, (err) => {
                return err.code === checkpointErrorCodes.CHECKPOINT_INCOMPATIBLE_VERSION;
            });
        });

        // ── 5. Store failure mapping ──
        test("5. recoverExecution maps store failures correctly", async () => {
            const mockStore = {
                load: async () => {
                    throw new Error("Simulated db connectivity loss");
                }
            };

            await assert.rejects(async () => {
                await recoverExecution("exec_store_fail", mockStore);
            }, (err) => {
                return err.code === checkpointStoreErrorCodes.CHECKPOINT_STORE_OPERATION_FAILED;
            });
        });

        // ── 6. Immutable RecoveryResult ──
        test("6. recoverExecution returns deeply frozen RecoveryResult", async () => {
            const checkpoint = getSampleValidCheckpoint("exec_freeze_test");
            const mockStore = {
                load: async () => checkpoint
            };

            const result = await recoverExecution("exec_freeze_test", mockStore);
            assert.ok(Object.isFrozen(result));
            assert.ok(Object.isFrozen(result.executionState));
        });

        // ── 7. Runtime and Scheduler isolation ──
        test("7. Verify recovery integration layer does not import or execute Scheduler or AI modules", () => {
            const fs = require("fs");
            const recoverySource = fs.readFileSync(require.resolve("../../../core/execution/recovery.js"), "utf8");

            assert.ok(!recoverySource.includes("ExecutionOrchestrator"));
            assert.ok(!recoverySource.includes("Scheduler.computeSchedule"));
            assert.ok(!recoverySource.includes("aiProviderGateway"));
            assert.ok(!recoverySource.includes("codingWorker"));
        });
    });
};
