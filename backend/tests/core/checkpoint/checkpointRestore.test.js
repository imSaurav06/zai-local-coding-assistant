"use strict";

const assert = require("assert");

module.exports = function registerCheckpointRestoreTests(suite, test) {
    const { loadCheckpoint, checkpointRestoreErrorCodes } = require("../../../core/checkpoint/checkpointRestore");

    function getValidCheckpoint() {
        return {
            version: "1.0",
            executionId: "exec_01",
            metadata: {
                createdAt: new Date().toISOString(),
                waveNumber: 1
            },
            queues: {
                pending: ["task_B"],
                completed: ["task_A"]
            },
            statistics: {
                totalTasks: 2
            }
        };
    }

    function getSampleTaskGraph() {
        return {
            nodes: [
                { stableId: "task_A", displayId: "Task A", dependencies: [] },
                { stableId: "task_B", displayId: "Task B", dependencies: ["task_A"] }
            ]
        };
    }

    class MockStore {
        constructor(checkpoint) {
            this.checkpoint = checkpoint;
        }
        async load(id) {
            return this.checkpoint;
        }
    }

    suite("Checkpoint Restore & Resume Validation (Phase 11B-4B)", () => {
        test("1. Successfully restores a valid checkpoint", async () => {
            const checkpoint = getValidCheckpoint();
            const store = new MockStore(checkpoint);
            const graph = getSampleTaskGraph();

            const state = await loadCheckpoint("exec_01", store, graph);
            assert.strictEqual(state.version, "1.0");
            assert.strictEqual(state.metadata.executionId, "exec_01");
            assert.deepStrictEqual(state.queues.completed, ["task_A"]);
            assert.deepStrictEqual(state.queues.pending, ["task_B"]);
            assert.ok(Object.isFrozen(state));
        });

        test("2. Rejects incompatible version with CHECKPOINT_RESUME_INVALID", async () => {
            const checkpoint = {
                ...getValidCheckpoint(),
                version: "2.0"
            };
            const store = new MockStore(checkpoint);
            const graph = getSampleTaskGraph();

            await assert.rejects(async () => {
                await loadCheckpoint("exec_01", store, graph);
            }, (err) => {
                return err.code === checkpointRestoreErrorCodes.CHECKPOINT_RESUME_INVALID;
            });
        });

        test("3. Rejects corrupted checkpoint structure with CHECKPOINT_CORRUPTED", async () => {
            const checkpoint = {
                version: "1.0",
                executionId: "exec_01",
                metadata: { createdAt: new Date().toISOString() }
                // missing queues
            };
            const store = new MockStore(checkpoint);
            const graph = getSampleTaskGraph();

            await assert.rejects(async () => {
                await loadCheckpoint("exec_01", store, graph);
            }, (err) => {
                return err.code === checkpointRestoreErrorCodes.CHECKPOINT_CORRUPTED;
            });
        });

        test("4. Rejects task graph mismatch with CHECKPOINT_STATE_MISMATCH", async () => {
            const checkpoint = getValidCheckpoint();
            const store = new MockStore(checkpoint);
            const graph = {
                nodes: [
                    { stableId: "task_other", displayId: "Other Task", dependencies: [] }
                ]
            };

            await assert.rejects(async () => {
                await loadCheckpoint("exec_01", store, graph);
            }, (err) => {
                return err.code === checkpointRestoreErrorCodes.CHECKPOINT_STATE_MISMATCH;
            });
        });

        test("5. Rejects invalid completed task dependencies with CHECKPOINT_RESUME_INVALID", async () => {
            const checkpoint = {
                ...getValidCheckpoint(),
                queues: {
                    pending: ["task_A"],
                    completed: ["task_B"] // task_B is completed but depends on task_A which is not
                }
            };
            const store = new MockStore(checkpoint);
            const graph = getSampleTaskGraph();

            await assert.rejects(async () => {
                await loadCheckpoint("exec_01", store, graph);
            }, (err) => {
                return err.code === checkpointRestoreErrorCodes.CHECKPOINT_RESUME_INVALID;
            });
        });
    });
};
