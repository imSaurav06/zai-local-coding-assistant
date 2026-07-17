"use strict";

const assert = require("assert");

module.exports = function registerCheckpointBridgeTests(suite, test) {
    const {
        createCheckpointBridge,
        validateCheckpointBridgeRequest,
        checkpointBridgeErrorCodes,
        CHECKPOINT_BRIDGE_VERSION
    } = require("../../../core/runtime");

    function getValidExecutionState() {
        return Object.freeze({
            version: "1.0",
            metadata: {
                status: "READY",
                executionId: "exec_123",
                createdAt: new Date().toISOString()
            },
            queues: Object.freeze({
                pending: ["task_01", "task_02"],
                running: [],
                completed: [],
                failed: []
            }),
            statistics: Object.freeze({
                totalTasks: 2,
                pending: 2,
                running: 0,
                completed: 0,
                failed: 0
            })
        });
    }

    suite("Checkpoint Bridge Layer (Phase 11A-4A)", () => {
        // ── 1. Bridge creation ──
        test("1. createCheckpointBridge() configures persistence mapping and default store", () => {
            const bridge = createCheckpointBridge({ enableCheckpointPersistence: true });
            assert.ok(bridge);
            assert.strictEqual(bridge.config.enableCheckpointPersistence, true);
            assert.ok(bridge.config.checkpointStore);
        });

        // ── 2. Initialize checkpoint ──
        test("2. initializeExecutionCheckpoint() translates executionState into valid persisted checkpoint", async () => {
            const bridge = createCheckpointBridge({ enableCheckpointPersistence: true });
            const state = getValidExecutionState();

            const res = await bridge.initializeExecutionCheckpoint(state);
            assert.strictEqual(res.success, true);
            assert.ok(res.checkpoint);
            assert.strictEqual(res.checkpoint.executionId, "exec_123");
            assert.ok(Object.isFrozen(res));
            assert.ok(Object.isFrozen(res.checkpoint));
        });

        // ── 3. Update checkpoint ──
        test("3. updateExecutionCheckpoint() translates runtime executionState and persists it", async () => {
            const bridge = createCheckpointBridge({ enableCheckpointPersistence: true });
            const state = getValidExecutionState();

            const res = await bridge.updateExecutionCheckpoint(state);
            assert.strictEqual(res.success, true);
            assert.ok(res.checkpoint);
            assert.strictEqual(res.checkpoint.executionId, "exec_123");
        });

        // ── 4. Finalize checkpoint ──
        test("4. finalizeExecutionCheckpoint() persists final executionState successfully", async () => {
            const bridge = createCheckpointBridge({ enableCheckpointPersistence: true });
            const state = getValidExecutionState();

            const res = await bridge.finalizeExecutionCheckpoint(state);
            assert.strictEqual(res.success, true);
            assert.ok(res.checkpoint);
            assert.strictEqual(res.checkpoint.executionId, "exec_123");
        });

        // ── 5. Configuration disabled (no-op) ──
        test("5. bridge actions are no-op when enableCheckpointPersistence is false", async () => {
            const bridge = createCheckpointBridge({ enableCheckpointPersistence: false });
            const state = getValidExecutionState();

            const resInit = await bridge.initializeExecutionCheckpoint(state);
            assert.strictEqual(resInit.success, true);
            assert.strictEqual(resInit.checkpoint, null);

            const resUpdate = await bridge.updateExecutionCheckpoint(state);
            assert.strictEqual(resUpdate.success, true);
            assert.strictEqual(resUpdate.checkpoint, null);

            const resFinal = await bridge.finalizeExecutionCheckpoint(state);
            assert.strictEqual(resFinal.success, true);
            assert.strictEqual(resFinal.checkpoint, null);
        });

        // ── 6. Invalid execution state ──
        test("6. bridge operations throw CHECKPOINT_BRIDGE_INVALID_STATE/INPUT on invalid state configurations", async () => {
            const bridge = createCheckpointBridge({ enableCheckpointPersistence: true });
            
            // Null state input
            await assert.rejects(async () => {
                await bridge.initializeExecutionCheckpoint(null);
            }, (err) => {
                return err.code === checkpointBridgeErrorCodes.CHECKPOINT_BRIDGE_INVALID_INPUT;
            });

            // Unfrozen state input
            const unfrozenState = { queues: {}, statistics: {} };
            await assert.rejects(async () => {
                await bridge.initializeExecutionCheckpoint(unfrozenState);
            }, (err) => {
                return err.code === checkpointBridgeErrorCodes.CHECKPOINT_BRIDGE_INVALID_INPUT &&
                       err.message.includes("deeply frozen");
            });

            // Malformed structure
            const badState = Object.freeze({ queues: {} }); // missing statistics
            await assert.rejects(async () => {
                await bridge.initializeExecutionCheckpoint(badState);
            }, (err) => {
                return err.code === checkpointBridgeErrorCodes.CHECKPOINT_BRIDGE_INVALID_STATE;
            });
        });

        // ── 7. Error translation ──
        test("7. bridge catches underlying store crashes and translates to CHECKPOINT_BRIDGE_FAILED", async () => {
            const badStore = {
                save: async () => {
                    throw new Error("Disk read-only corruption");
                }
            };
            const bridge = createCheckpointBridge({
                enableCheckpointPersistence: true,
                checkpointStore: badStore
            });
            const state = getValidExecutionState();

            await assert.rejects(async () => {
                await bridge.initializeExecutionCheckpoint(state);
            }, (err) => {
                return err.code === checkpointBridgeErrorCodes.CHECKPOINT_BRIDGE_FAILED &&
                       err.message.includes("Disk read-only");
            });
        });

        // ── 8. Input non-mutation ──
        test("8. bridge executions do not mutate caller executionState", async () => {
            const state = getValidExecutionState();
            const originalJson = JSON.stringify(state);

            const bridge = createCheckpointBridge({ enableCheckpointPersistence: true });
            await bridge.initializeExecutionCheckpoint(state);

            assert.strictEqual(JSON.stringify(state), originalJson);
        });

        // ── 9. Deterministic equality ──
        test("9. validateCheckpointBridgeRequest output is deterministic", () => {
            const s1 = getValidExecutionState();
            const s2 = getValidExecutionState();
            assert.deepStrictEqual(validateCheckpointBridgeRequest(s1), validateCheckpointBridgeRequest(s2));
        });
    });
};
