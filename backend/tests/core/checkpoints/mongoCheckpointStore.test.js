"use strict";

const assert = require("assert");
const mongoose = require("mongoose");

module.exports = function registerMongoStoreTests(suite, test) {
    const {
        createCheckpoint,
        createMongoCheckpointStore,
        MongoCheckpointStore,
        checkpointStoreErrorCodes,
        checkpointErrorCodes
    } = require("../../../core/checkpoints");
    const CheckpointModel = require("../../../core/checkpoints/checkpointSchema");

    // In-memory mock database state
    let mockDb = [];
    
    // Save original Model functions for restoration
    const originalFindOneAndUpdate = CheckpointModel.findOneAndUpdate;
    const originalFindOne = CheckpointModel.findOne;
    const originalCountDocuments = CheckpointModel.countDocuments;
    const originalDeleteOne = CheckpointModel.deleteOne;
    const originalFind = CheckpointModel.find;
    
    let originalReadyStateDescriptor;

    function getSampleValidCheckpoint(execId = "exec_mongo_test_123") {
        const opts = {
            version: "1.0",
            executionId: execId,
            metadata: {
                createdAt: "2026-07-17T12:00:00.000Z",
                updatedAt: "2026-07-17T12:30:00.000Z",
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
                completedTasks: 1,
                failedTasks: 0,
                totalTasks: 2
            }
        };
        const buildResult = createCheckpoint(opts);
        return buildResult.checkpoint;
    }

    suite("MongoCheckpointStore Implementation (Phase 10A-4)", () => {
        
        // Mock Mongoose model queries and connection state before running tests
        test("0. Setup Mongoose Mocks", () => {
            mockDb = [];

            // Mock connection state: Connected (1)
            originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, "readyState");
            Object.defineProperty(mongoose.connection, "readyState", {
                get: () => 1,
                configurable: true
            });

            CheckpointModel.findOneAndUpdate = async (query, update, options) => {
                const idx = mockDb.findIndex(d => d.executionId === query.executionId);
                const data = {
                    executionId: update.executionId || query.executionId,
                    version: update.version,
                    payload: update.payload
                };
                if (idx !== -1) {
                    mockDb[idx] = data;
                } else {
                    mockDb.push(data);
                }
                return data;
            };

            CheckpointModel.findOne = async (query) => {
                const doc = mockDb.find(d => d.executionId === query.executionId);
                return doc || null;
            };

            CheckpointModel.countDocuments = async (query) => {
                const count = mockDb.filter(d => d.executionId === query.executionId).length;
                return count;
            };

            CheckpointModel.deleteOne = async (query) => {
                mockDb = mockDb.filter(d => d.executionId !== query.executionId);
                return { deletedCount: 1 };
            };

            CheckpointModel.find = (query, projections) => {
                return {
                    lean: () => {
                        return mockDb.map(d => ({ executionId: d.executionId }));
                    }
                };
            };

            assert.strictEqual(mongoose.connection.readyState, 1);
        });

        // ── 1. Create store instance ──
        test("1. createMongoCheckpointStore instantiates MongoCheckpointStore", () => {
            const store = createMongoCheckpointStore();
            assert.ok(store instanceof MongoCheckpointStore);
        });

        // ── 2. Save & Load checkpoint ──
        test("2. Save and Load a valid checkpoint from MongoDB", async () => {
            const store = createMongoCheckpointStore();
            const checkpoint = getSampleValidCheckpoint("exec_save_load");

            // Save to mock database
            await store.save(checkpoint);

            // Load from mock database
            const loaded = await store.load("exec_save_load");
            assert.ok(loaded);
            assert.strictEqual(loaded.executionId, "exec_save_load");
            assert.strictEqual(loaded.version, "1.0");
            assert.deepStrictEqual(loaded.statistics, checkpoint.statistics);
            
            // Loaded checkpoint must be deeply frozen
            assert.ok(Object.isFrozen(loaded));
            assert.ok(Object.isFrozen(loaded.metadata));

            // Clean up
            await store.delete("exec_save_load");
        });

        // ── 3. Exists ──
        test("3. Verify exists() checks record presence correctly", async () => {
            const store = createMongoCheckpointStore();
            const checkpoint = getSampleValidCheckpoint("exec_exists_test");

            const before = await store.exists("exec_exists_test");
            assert.strictEqual(before, false);

            await store.save(checkpoint);

            const after = await store.exists("exec_exists_test");
            assert.strictEqual(after, true);

            // Cleanup
            await store.delete("exec_exists_test");
        });

        // ── 4. Delete ──
        test("4. Verify delete() removes checkpoints successfully", async () => {
            const store = createMongoCheckpointStore();
            const checkpoint = getSampleValidCheckpoint("exec_delete_test");

            await store.save(checkpoint);
            assert.strictEqual(await store.exists("exec_delete_test"), true);

            await store.delete("exec_delete_test");
            assert.strictEqual(await store.exists("exec_delete_test"), false);
        });

        // ── 5. List ──
        test("5. Verify list() returns all active checkpoint execution IDs", async () => {
            const store = createMongoCheckpointStore();
            const cp1 = getSampleValidCheckpoint("exec_list_1");
            const cp2 = getSampleValidCheckpoint("exec_list_2");

            await store.save(cp1);
            await store.save(cp2);

            const ids = await store.list();
            assert.ok(ids.includes("exec_list_1"));
            assert.ok(ids.includes("exec_list_2"));

            // Cleanup
            await store.delete("exec_list_1");
            await store.delete("exec_list_2");
        });

        // ── 6. Health ──
        test("6. Verify health() reports connection healthy state", async () => {
            const store = createMongoCheckpointStore();
            const report = await store.health();
            assert.ok(report);
            assert.strictEqual(report.status, "healthy");
            assert.strictEqual(report.details.connectionState, "connected");
        });

        // ── 7. Serializer & Validator Invoked ──
        test("7. Save invokes validateCheckpoint and serializeCheckpoint", async () => {
            const store = createMongoCheckpointStore();
            const checkpoint = getSampleValidCheckpoint("exec_serialize_invoke");

            await store.save(checkpoint);

            // Direct check on mock db state
            const doc = mockDb.find(d => d.executionId === "exec_serialize_invoke");
            assert.ok(doc);
            assert.strictEqual(typeof doc.payload, "string");
            
            // Should contain serialized key properties
            assert.ok(doc.payload.includes('"executionId":"exec_serialize_invoke"'));

            // Cleanup
            await store.delete("exec_serialize_invoke");
        });

        // ── 8. Invalid checkpoint rejected ──
        test("8. Save rejects invalid checkpoint and returns validator error code", async () => {
            const store = createMongoCheckpointStore();
            const invalidCheckpoint = {
                version: "1.0",
                executionId: "exec_invalid_save"
                // missing queues and statistics
            };

            await assert.rejects(async () => {
                await store.save(invalidCheckpoint);
            }, (err) => {
                return err.code === checkpointErrorCodes.CHECKPOINT_INVALID_STRUCTURE;
            });
        });

        // ── 9. Missing checkpoint handled deterministically ──
        test("9. Load for non-existent checkpoint returns null", async () => {
            const store = createMongoCheckpointStore();
            const loaded = await store.load("exec_non_existent_id");
            assert.strictEqual(loaded, null);
        });

        // ── 10. Database failures mapped correctly ──
        test("10. Database failures are mapped to CHECKPOINT_STORE_OPERATION_FAILED", async () => {
            const store = createMongoCheckpointStore();
            const checkpoint = getSampleValidCheckpoint("exec_fail_test");

            CheckpointModel.findOneAndUpdate = async () => {
                throw new Error("Simulated database write crash");
            };

            try {
                await assert.rejects(async () => {
                    await store.save(checkpoint);
                }, (err) => {
                    return err.code === checkpointStoreErrorCodes.CHECKPOINT_STORE_OPERATION_FAILED;
                });
            } finally {
                // Restore findOneAndUpdate mock
                CheckpointModel.findOneAndUpdate = async (query, update, options) => {
                    const idx = mockDb.findIndex(d => d.executionId === query.executionId);
                    const data = {
                        executionId: update.executionId || query.executionId,
                        version: update.version,
                        payload: update.payload
                    };
                    if (idx !== -1) {
                        mockDb[idx] = data;
                    } else {
                        mockDb.push(data);
                    }
                    return data;
                };
            }
        });

        // Cleanup mocks at the end of the suite
        test("z. Restore Mongoose Mocks", () => {
            // Restore original model functions
            CheckpointModel.findOneAndUpdate = originalFindOneAndUpdate;
            CheckpointModel.findOne = originalFindOne;
            CheckpointModel.countDocuments = originalCountDocuments;
            CheckpointModel.deleteOne = originalDeleteOne;
            CheckpointModel.find = originalFind;

            // Restore connection state descriptor
            if (originalReadyStateDescriptor) {
                Object.defineProperty(mongoose.connection, "readyState", originalReadyStateDescriptor);
            } else {
                delete mongoose.connection.readyState;
            }
        });
    });
};
