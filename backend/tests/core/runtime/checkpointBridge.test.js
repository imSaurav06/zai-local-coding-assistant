"use strict";

const assert = require("assert");

module.exports = function registerCheckpointBridgeTests(suite, test) {
    const {
        createCheckpointBridge,
        validateCheckpointBridgeRequest,
        checkpointBridgeErrorCodes,
        CHECKPOINT_BRIDGE_VERSION,
        InMemoryCheckpointStore
    } = require("../../../core/runtime");

    const { MongoCheckpointStore } = require("../../../core/checkpoints");

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

    suite("Checkpoint Bridge Persistence Layer (Phase 11A-4B)", () => {
        // ── 1. Default MongoCheckpointStore injection ──
        test("1. createCheckpointBridge() default instantiates MongoCheckpointStore when enabled", () => {
            const bridge = createCheckpointBridge({ enableCheckpointPersistence: true });
            assert.ok(bridge);
            assert.ok(bridge.config.checkpointStore instanceof MongoCheckpointStore);
        });

        // ── 2. Injected store implementation ──
        test("2. accepts an injected InMemoryCheckpointStore correctly", async () => {
            const store = new InMemoryCheckpointStore();
            const bridge = createCheckpointBridge({
                enableCheckpointPersistence: true,
                checkpointStore: store
            });
            assert.strictEqual(bridge.config.checkpointStore, store);

            const state = getValidExecutionState();
            const res = await bridge.initializeExecutionCheckpoint(state);
            assert.strictEqual(res.success, true);
            
            const exists = await store.exists("exec_123");
            assert.strictEqual(exists, true);
        });

        // ── 3. Invalid store injection ──
        test("3. throws CHECKPOINT_BRIDGE_INVALID_STORE when injected store is malformed", () => {
            const badStore = { save: () => {} }; // missing other methods (load, exists, etc.)
            
            assert.throws(() => {
                createCheckpointBridge({
                    enableCheckpointPersistence: true,
                    checkpointStore: badStore
                });
            }, (err) => {
                return err.code === checkpointBridgeErrorCodes.CHECKPOINT_BRIDGE_INVALID_STORE &&
                       err.message.includes("method");
            });
        });

        // ── 4. Configuration disabled (no-op) ──
        test("4. bridge actions are no-op when enableCheckpointPersistence is false", async () => {
            const bridge = createCheckpointBridge({ enableCheckpointPersistence: false });
            const state = getValidExecutionState();

            const resInit = await bridge.initializeExecutionCheckpoint(state);
            assert.strictEqual(resInit.success, true);
            assert.strictEqual(resInit.checkpoint, null);
        });

        // ── 5. Mongo failure translation ──
        test("5. bridge translates store operational exceptions to CHECKPOINT_BRIDGE_FAILED", async () => {
            const crashStore = new InMemoryCheckpointStore();
            crashStore.save = async () => {
                throw new Error("Mongoose connection timeout");
            };

            const bridge = createCheckpointBridge({
                enableCheckpointPersistence: true,
                checkpointStore: crashStore
            });
            const state = getValidExecutionState();

            await assert.rejects(async () => {
                await bridge.initializeExecutionCheckpoint(state);
            }, (err) => {
                return err.code === checkpointBridgeErrorCodes.CHECKPOINT_BRIDGE_FAILED &&
                       err.message.includes("Mongoose connection timeout");
            });
        });

        // ── 6. Immutable configurations ──
        test("6. bridge configuration and response layouts are frozen", () => {
            const bridge = createCheckpointBridge({ enableCheckpointPersistence: false });
            assert.ok(Object.isFrozen(bridge));
            assert.ok(Object.isFrozen(bridge.config));
        });

        // ── 7. Input non-mutation ──
        test("7. bridge executions do not mutate caller executionState", async () => {
            const state = getValidExecutionState();
            const originalJson = JSON.stringify(state);

            const store = new InMemoryCheckpointStore();
            const bridge = createCheckpointBridge({
                enableCheckpointPersistence: true,
                checkpointStore: store
            });
            await bridge.initializeExecutionCheckpoint(state);

            assert.strictEqual(JSON.stringify(state), originalJson);
        });
    });
};
