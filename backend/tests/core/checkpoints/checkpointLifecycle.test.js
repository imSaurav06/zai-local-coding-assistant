"use strict";

const assert = require("assert");

module.exports = function registerLifecycleTests(suite, test) {
    const {
        createInitialCheckpoint,
        createRuntimeCheckpoint,
        persistCheckpoint,
        shouldCreateCheckpoint,
        createCheckpointStore,
        checkpointErrorCodes,
        checkpointStoreErrorCodes
    } = require("../../../core/checkpoints");

    function getSampleValidExecutionState() {
        return {
            version: "1.0",
            metadata: {
                status: "READY",
                executionId: "exec_lifecycle_123",
                createdAt: "2026-07-17T12:00:00.000Z",
                waveNumber: 2
            },
            queues: {
                pending: ["task_2"],
                running: [],
                completed: ["task_1"],
                failed: []
            },
            workers: ["worker_1"],
            statistics: {
                completed: 1,
                failed: 0,
                totalTasks: 2
            }
        };
    }

    suite("Checkpoint Lifecycle Layer (Phase 10A-5A)", () => {
        // ── 1. Initial checkpoint creation ──
        test("1. createInitialCheckpoint creates a valid initial checkpoint (waveNumber = 0)", () => {
            const state = getSampleValidExecutionState();
            const checkpoint = createInitialCheckpoint(state);

            assert.ok(checkpoint);
            assert.strictEqual(checkpoint.executionId, "exec_lifecycle_123");
            assert.strictEqual(checkpoint.metadata.waveNumber, 0); // initial is forced to 0
            assert.deepStrictEqual(checkpoint.queues.pending, ["task_2"]);
            assert.deepStrictEqual(checkpoint.queues.completed, ["task_1"]);
            assert.deepStrictEqual(checkpoint.workers, []); // initial has no workers
        });

        // ── 2. Runtime checkpoint creation ──
        test("2. createRuntimeCheckpoint creates a runtime checkpoint preserving waveNumber and active workers", () => {
            const state = getSampleValidExecutionState();
            const checkpoint = createRuntimeCheckpoint(state);

            assert.ok(checkpoint);
            assert.strictEqual(checkpoint.executionId, "exec_lifecycle_123");
            assert.strictEqual(checkpoint.metadata.waveNumber, 2); // runtime preserves waveNumber
            assert.deepStrictEqual(checkpoint.workers, ["worker_1"]); // runtime preserves workers
            assert.deepStrictEqual(checkpoint.queues.pending, ["task_2"]);
        });

        // ── 3. Event policy ──
        test("3. shouldCreateCheckpoint returns true for allowed lifecycle events", () => {
            assert.strictEqual(shouldCreateCheckpoint("EXECUTION_STARTED"), true);
            assert.strictEqual(shouldCreateCheckpoint("WORKER_COMPLETED"), true);
            assert.strictEqual(shouldCreateCheckpoint("PIPELINE_COMPLETED"), true);
            assert.strictEqual(shouldCreateCheckpoint("PIPELINE_FAILED"), true);
        });

        // ── 4. Unknown events ignored ──
        test("4. shouldCreateCheckpoint returns false for unknown events", () => {
            assert.strictEqual(shouldCreateCheckpoint("UNKNOWN_EVENT"), false);
            assert.strictEqual(shouldCreateCheckpoint("WORKER_STARTED"), false);
            assert.strictEqual(shouldCreateCheckpoint(""), false);
            assert.strictEqual(shouldCreateCheckpoint(null), false);
        });

        // ── 5. Persist delegates to CheckpointStore ──
        test("5. persistCheckpoint delegates save operation to CheckpointStore", async () => {
            const state = getSampleValidExecutionState();
            const checkpoint = createRuntimeCheckpoint(state);

            let savedCheckpoint = null;
            const mockStore = {
                save: async (cp) => {
                    savedCheckpoint = cp;
                }
            };

            await persistCheckpoint(checkpoint, mockStore);
            assert.strictEqual(savedCheckpoint, checkpoint);
        });

        // ── 6. Invalid checkpoint rejected ──
        test("6. createInitialCheckpoint rejects invalid inputs", () => {
            assert.throws(() => createInitialCheckpoint(null), (err) => {
                return err.code === checkpointErrorCodes.CHECKPOINT_INVALID_INPUT;
            });
            assert.throws(() => createInitialCheckpoint("not-an-object"), (err) => {
                return err.code === checkpointErrorCodes.CHECKPOINT_INVALID_INPUT;
            });
        });

        test("7. persistCheckpoint rejects invalid parameters", async () => {
            const state = getSampleValidExecutionState();
            const checkpoint = createRuntimeCheckpoint(state);

            // Invalid checkpoint
            await assert.rejects(async () => {
                await persistCheckpoint(null, {});
            }, (err) => {
                return err.code === checkpointErrorCodes.CHECKPOINT_INVALID_INPUT;
            });

            // Invalid store
            await assert.rejects(async () => {
                await persistCheckpoint(checkpoint, null);
            }, (err) => {
                return err.code === checkpointStoreErrorCodes.CHECKPOINT_STORE_INVALID_ARGUMENT;
            });
        });

        // ── 7. Storage independence and runtime isolation ──
        test("8. Verify lifecycle module remains storage independent and isolated from execution components", () => {
            const fs = require("fs");
            const fileSource = fs.readFileSync(require.resolve("../../../core/checkpoints/checkpointLifecycle.js"), "utf8");
            
            // Should not contain database terms
            assert.ok(!fileSource.includes("mongoose"));
            assert.ok(!fileSource.includes("mongodb"));
            assert.ok(!fileSource.includes("mongoCheckpointStore"));

            // Should not contain execution runtime terms
            assert.ok(!fileSource.includes("ExecutionOrchestrator"));
            assert.ok(!fileSource.includes("recovery"));
            assert.ok(!fileSource.includes("Scheduler"));
            assert.ok(!fileSource.includes("CodingWorker"));
        });
    });
};
