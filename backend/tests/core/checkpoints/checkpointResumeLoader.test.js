"use strict";

const assert = require("assert");

module.exports = function registerResumeLoaderTests(suite, test) {
    const {
        createCheckpoint,
        loadExecutionState,
        restoreExecutionState,
        validateRestorableCheckpoint,
        checkpointErrorCodes,
        checkpointStoreErrorCodes,
        deepFreezeCheckpoint
    } = require("../../../core/checkpoints");

    function getSampleValidCheckpoint(execId = "exec_resume_loader_123") {
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

    suite("Checkpoint Resume Loader Layer (Phase 10A-5B)", () => {
        // ── 1. Successful checkpoint load & restore ──
        test("1. loadExecutionState loads, validates, and restores ExecutionState correctly", async () => {
            const checkpoint = getSampleValidCheckpoint("exec_load_success");
            const mockStore = {
                load: async (id) => {
                    assert.strictEqual(id, "exec_load_success");
                    return checkpoint;
                }
            };

            const state = await loadExecutionState("exec_load_success", mockStore);
            assert.ok(state);
            assert.strictEqual(state.metadata.executionId, "exec_load_success");
            assert.strictEqual(state.metadata.waveNumber, 3);
            assert.deepStrictEqual(state.queues.pending, ["task_c", "task_d"]);
            assert.deepStrictEqual(state.queues.running, ["task_b"]);
            assert.deepStrictEqual(state.queues.completed, ["task_a"]);
            assert.deepStrictEqual(state.workers, ["worker_1"]);

            // Statistics must be populated correctly
            assert.strictEqual(state.statistics.totalTasks, 4);
            assert.strictEqual(state.statistics.pending, 2);
            assert.strictEqual(state.statistics.running, 1);
            assert.strictEqual(state.statistics.completed, 1);
            assert.strictEqual(state.statistics.failed, 0);
        });

        // ── 2. Frozen restored state ──
        test("2. Restored ExecutionState must be deeply frozen", async () => {
            const checkpoint = getSampleValidCheckpoint("exec_freeze_test");
            const mockStore = {
                load: async () => checkpoint
            };

            const state = await loadExecutionState("exec_freeze_test", mockStore);
            assert.ok(Object.isFrozen(state));
            assert.ok(Object.isFrozen(state.metadata));
            assert.ok(Object.isFrozen(state.queues));
            assert.ok(Object.isFrozen(state.statistics));
            assert.ok(Object.isFrozen(state.workers));
        });

        // ── 3. Missing checkpoint handled deterministically ──
        test("3. loadExecutionState returns null when store returns null (missing checkpoint)", async () => {
            const mockStore = {
                load: async () => null
            };

            const state = await loadExecutionState("exec_missing_id", mockStore);
            assert.strictEqual(state, null);
        });

        // ── 4. Invalid checkpoint rejected ──
        test("4. restoreExecutionState throws checkpoint validator code for invalid checkpoints", () => {
            const invalidCheckpoint = {
                version: "1.0",
                executionId: "exec_invalid"
                // missing queues/metadata/statistics
            };

            assert.throws(() => restoreExecutionState(invalidCheckpoint), (err) => {
                return err.code === checkpointErrorCodes.CHECKPOINT_INVALID_STRUCTURE;
            });
        });

        // ── 5. Unsupported version rejected ──
        test("5. restoreExecutionState throws incompatible version error", () => {
            const checkpoint = getSampleValidCheckpoint("exec_version_fail");
            const raw = JSON.parse(JSON.stringify(checkpoint));
            raw.version = "2.0"; // unsupported version

            const frozenRaw = deepFreezeCheckpoint(raw);

            assert.throws(() => restoreExecutionState(frozenRaw), (err) => {
                return err.code === checkpointErrorCodes.CHECKPOINT_INCOMPATIBLE_VERSION;
            });
        });

        // ── 6. Store failures mapped correctly ──
        test("6. Store load failures are mapped to CHECKPOINT_STORE_OPERATION_FAILED", async () => {
            const mockStore = {
                load: async () => {
                    throw new Error("Disk read failure");
                }
            };

            await assert.rejects(async () => {
                await loadExecutionState("exec_fail", mockStore);
            }, (err) => {
                return err.code === checkpointStoreErrorCodes.CHECKPOINT_STORE_OPERATION_FAILED;
            });
        });

        // ── 7. No runtime modules imported ──
        test("7. Verify resume loader module does not import runtime execution/AI gateways", () => {
            const fs = require("fs");
            const fileSource = fs.readFileSync(require.resolve("../../../core/checkpoints/checkpointResumeLoader.js"), "utf8");

            assert.ok(!fileSource.includes("ExecutionOrchestrator"));
            assert.ok(!fileSource.includes("recovery"));
            assert.ok(!fileSource.includes("Scheduler"));
            assert.ok(!fileSource.includes("CodingWorker"));
            assert.ok(!fileSource.includes("AIProviderGateway"));
        });
    });
};
