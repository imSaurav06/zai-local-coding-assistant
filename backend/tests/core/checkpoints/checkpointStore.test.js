"use strict";

const assert = require("assert");

module.exports = function registerStoreTests(suite, test) {
    const {
        createCheckpointStore,
        CheckpointStore,
        checkpointStoreErrorCodes
    } = require("../../../core/checkpoints");

    suite("CheckpointStore Interface Layer (Phase 10A-3)", () => {
        // ── 1. Interface creation ──
        test("1. createCheckpointStore instantiates a default abstract CheckpointStore", () => {
            const store = createCheckpointStore();
            assert.ok(store instanceof CheckpointStore);
        });

        // ── 2. Public API exports ──
        test("2. Verify CheckpointStore instance exports all abstract methods", () => {
            const store = createCheckpointStore();
            assert.strictEqual(typeof store.save, "function");
            assert.strictEqual(typeof store.load, "function");
            assert.strictEqual(typeof store.exists, "function");
            assert.strictEqual(typeof store.delete, "function");
            assert.strictEqual(typeof store.list, "function");
            assert.strictEqual(typeof store.health, "function");
        });

        // ── 3. save() throws NOT_IMPLEMENTED ──
        test("3. save() throws NOT_IMPLEMENTED error", async () => {
            const store = createCheckpointStore();
            await assert.rejects(async () => {
                await store.save({});
            }, (err) => {
                return err.code === checkpointStoreErrorCodes.CHECKPOINT_STORE_NOT_IMPLEMENTED;
            });
        });

        // ── 4. load() throws NOT_IMPLEMENTED ──
        test("4. load() throws NOT_IMPLEMENTED error", async () => {
            const store = createCheckpointStore();
            await assert.rejects(async () => {
                await store.load("exec_123");
            }, (err) => {
                return err.code === checkpointStoreErrorCodes.CHECKPOINT_STORE_NOT_IMPLEMENTED;
            });
        });

        // ── 5. exists() throws NOT_IMPLEMENTED ──
        test("5. exists() throws NOT_IMPLEMENTED error", async () => {
            const store = createCheckpointStore();
            await assert.rejects(async () => {
                await store.exists("exec_123");
            }, (err) => {
                return err.code === checkpointStoreErrorCodes.CHECKPOINT_STORE_NOT_IMPLEMENTED;
            });
        });

        // ── 6. delete() throws NOT_IMPLEMENTED ──
        test("6. delete() throws NOT_IMPLEMENTED error", async () => {
            const store = createCheckpointStore();
            await assert.rejects(async () => {
                await store.delete("exec_123");
            }, (err) => {
                return err.code === checkpointStoreErrorCodes.CHECKPOINT_STORE_NOT_IMPLEMENTED;
            });
        });

        // ── 7. list() throws NOT_IMPLEMENTED ──
        test("7. list() throws NOT_IMPLEMENTED error", async () => {
            const store = createCheckpointStore();
            await assert.rejects(async () => {
                await store.list();
            }, (err) => {
                return err.code === checkpointStoreErrorCodes.CHECKPOINT_STORE_NOT_IMPLEMENTED;
            });
        });

        // ── 8. health() throws NOT_IMPLEMENTED ──
        test("8. health() throws NOT_IMPLEMENTED error", async () => {
            const store = createCheckpointStore();
            await assert.rejects(async () => {
                await store.health();
            }, (err) => {
                return err.code === checkpointStoreErrorCodes.CHECKPOINT_STORE_NOT_IMPLEMENTED;
            });
        });

        // ── 9. Error codes immutable ──
        test("9. CheckpointStore error codes are deeply frozen and immutable", () => {
            assert.ok(Object.isFrozen(checkpointStoreErrorCodes));
            assert.throws(() => {
                checkpointStoreErrorCodes.NEW_ERROR = "MUTATE";
            });
        });

        // ── 10. Public API immutable ──
        test("10. CheckpointStore instance is frozen and cannot be modified", () => {
            const store = createCheckpointStore();
            assert.ok(Object.isFrozen(store));
            assert.throws(() => {
                store.newMethod = () => {};
            });
        });

        // ── 11. No runtime dependencies introduced ──
        test("11. Verify abstract CheckpointStore module does not load active runtime database drivers", () => {
            const serializerSource = require("fs").readFileSync(require.resolve("../../../core/checkpoints/checkpointStore.js"), "utf8");
            assert.ok(!serializerSource.includes("mongodb"));
            assert.ok(!serializerSource.includes("mongoose"));
            assert.ok(!serializerSource.includes("fs"));
        });
    });
};
