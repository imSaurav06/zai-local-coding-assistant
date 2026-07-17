"use strict";

const assert = require("assert");

module.exports = function registerSerializerTests(suite, test) {
    const {
        createCheckpoint,
        validateCheckpoint,
        serializeCheckpoint,
        deserializeCheckpoint,
        cloneCheckpoint,
        normalizeCheckpoint,
        isSerializedCheckpoint,
        CURRENT_SERIALIZER_VERSION,
        checkpointErrorCodes
    } = require("../../../core/checkpoints");

    function getSampleValidCheckpoint() {
        const opts = {
            version: "1.0",
            executionId: "exec_555",
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
            workers: ["worker_alpha", "worker_beta"],
            statistics: {
                completedTasks: 1,
                failedTasks: 0,
                totalTasks: 4
            }
        };
        const buildResult = createCheckpoint(opts);
        return buildResult.checkpoint;
    }

    suite("Checkpoint Serializer Layer (Phase 10A-2)", () => {
        // ── 1. Serialize valid checkpoint ──
        test("1. Serialize valid checkpoint to JSON string", () => {
            const checkpoint = getSampleValidCheckpoint();
            const serialized = serializeCheckpoint(checkpoint);
            
            assert.strictEqual(typeof serialized, "string");
            assert.ok(serialized.includes('"version":"1.0"'));
            assert.ok(serialized.includes('"executionId":"exec_555"'));
        });

        // ── 2. Deserialize valid checkpoint ──
        test("2. Deserialize valid checkpoint from JSON string", () => {
            const checkpoint = getSampleValidCheckpoint();
            const serialized = serializeCheckpoint(checkpoint);
            const restored = deserializeCheckpoint(serialized);

            assert.deepStrictEqual(restored, checkpoint);
        });

        // ── 3. Deep freeze restored checkpoint ──
        test("3. Deep freeze restored checkpoint", () => {
            const checkpoint = getSampleValidCheckpoint();
            const serialized = serializeCheckpoint(checkpoint);
            const restored = deserializeCheckpoint(serialized);

            assert.ok(Object.isFrozen(restored));
            assert.ok(Object.isFrozen(restored.metadata));
            assert.ok(Object.isFrozen(restored.queues));
            assert.ok(Object.isFrozen(restored.statistics));
            assert.ok(Object.isFrozen(restored.workers));
        });

        // ── 4. Reject invalid payload ──
        test("4. Reject invalid serialization/deserialization inputs", () => {
            assert.throws(() => serializeCheckpoint(null), (err) => {
                return err.code === checkpointErrorCodes.CHECKPOINT_INVALID_INPUT;
            });
            assert.throws(() => serializeCheckpoint(undefined), (err) => {
                return err.code === checkpointErrorCodes.CHECKPOINT_INVALID_INPUT;
            });

            assert.throws(() => deserializeCheckpoint(null), (err) => {
                return err.code === checkpointErrorCodes.CHECKPOINT_INVALID_INPUT;
            });
            assert.throws(() => deserializeCheckpoint(undefined), (err) => {
                return err.code === checkpointErrorCodes.CHECKPOINT_INVALID_INPUT;
            });
        });

        // ── 5. Reject malformed structures ──
        test("5. Reject deserialization of malformed JSON", () => {
            assert.throws(() => deserializeCheckpoint("This is not JSON!"), (err) => {
                return err.code === checkpointErrorCodes.CHECKPOINT_INVALID_STRUCTURE;
            });
        });

        test("6. Reject deserialization of malformed structures", () => {
            const malformed = { version: "1.0", executionId: "exec_1" }; // missing metadata/queues/stats
            assert.throws(() => deserializeCheckpoint(malformed), (err) => {
                return err.code === checkpointErrorCodes.CHECKPOINT_INVALID_STRUCTURE;
            });
        });

        // ── 6. Reject incompatible version ──
        test("7. Reject incompatible version with CHECKPOINT_INCOMPATIBLE_VERSION", () => {
            const checkpoint = getSampleValidCheckpoint();
            const raw = JSON.parse(JSON.stringify(checkpoint));
            raw.version = "2.0"; // Incompatible version

            assert.throws(() => deserializeCheckpoint(raw), (err) => {
                return err.code === checkpointErrorCodes.CHECKPOINT_INCOMPATIBLE_VERSION;
            });
        });

        // ── 7. Reject unknown properties ──
        test("8. Reject unknown properties during normalization/deserialization", () => {
            const checkpoint = getSampleValidCheckpoint();
            const raw = JSON.parse(JSON.stringify(checkpoint));
            raw.unknownKey = "violating";

            assert.throws(() => deserializeCheckpoint(raw), (err) => {
                return err.code === checkpointErrorCodes.CHECKPOINT_UNKNOWN_PROPERTY;
            });
        });

        // ── 8. Preserve timestamps ──
        test("9. Preserve timestamps during serialization roundtrip", () => {
            const checkpoint = getSampleValidCheckpoint();
            const serialized = serializeCheckpoint(checkpoint);
            const restored = deserializeCheckpoint(serialized);

            assert.strictEqual(restored.metadata.createdAt, checkpoint.metadata.createdAt);
            assert.strictEqual(restored.metadata.updatedAt, checkpoint.metadata.updatedAt);
        });

        // ── 9. Preserve executionId, stats, queues, workers ──
        test("10. Preserve structural elements during roundtrip", () => {
            const checkpoint = getSampleValidCheckpoint();
            const serialized = serializeCheckpoint(checkpoint);
            const restored = deserializeCheckpoint(serialized);

            assert.strictEqual(restored.executionId, checkpoint.executionId);
            assert.deepStrictEqual(restored.statistics, checkpoint.statistics);
            assert.deepStrictEqual(restored.queues, checkpoint.queues);
            assert.deepStrictEqual(restored.workers, checkpoint.workers);
        });

        // ── 10. Deterministic ordering ──
        test("11. normalizeCheckpoint produces deterministic property ordering", () => {
            const checkpoint = getSampleValidCheckpoint();
            const normalized = normalizeCheckpoint(checkpoint);

            const keys = Object.keys(normalized);
            // Verify top-level keys order
            assert.strictEqual(keys[0], "version");
            assert.strictEqual(keys[1], "executionId");
            assert.strictEqual(keys[2], "metadata");
            assert.strictEqual(keys[3], "queues");
            assert.strictEqual(keys[4], "workers");
            assert.strictEqual(keys[5], "statistics");

            // Verify alphabetical sort on metadata keys
            const metaKeys = Object.keys(normalized.metadata);
            assert.deepStrictEqual(metaKeys, [
                "checkpointVersion",
                "createdAt",
                "createdBy",
                "graphVersion",
                "identityVersion",
                "plannerVersion",
                "updatedAt",
                "waveNumber"
            ]);

            // Verify queues keys ordering
            const queueKeys = Object.keys(normalized.queues);
            assert.deepStrictEqual(queueKeys, ["completed", "failed", "pending", "running"]);
        });

        // ── 11. Input never mutated ──
        test("12. Input argument is never mutated during serialization", () => {
            const checkpoint = getSampleValidCheckpoint();
            const originalString = JSON.stringify(checkpoint);

            serializeCheckpoint(checkpoint);
            assert.strictEqual(JSON.stringify(checkpoint), originalString);
        });

        // ── 12. cloneCheckpoint produces deep clone ──
        test("13. cloneCheckpoint produces a deep clone that is deeply frozen", () => {
            const checkpoint = getSampleValidCheckpoint();
            const clone = cloneCheckpoint(checkpoint);

            assert.notStrictEqual(clone, checkpoint);
            assert.deepStrictEqual(clone, checkpoint);
            assert.ok(Object.isFrozen(clone));
            assert.ok(Object.isFrozen(clone.metadata));
        });

        // ── 13. isSerializedCheckpoint check ──
        test("14. isSerializedCheckpoint validates JSON strings and parsed objects correctly", () => {
            const checkpoint = getSampleValidCheckpoint();
            const serializedStr = serializeCheckpoint(checkpoint);

            assert.strictEqual(isSerializedCheckpoint(serializedStr), true);
            assert.strictEqual(isSerializedCheckpoint(checkpoint), true);

            assert.strictEqual(isSerializedCheckpoint(null), false);
            assert.strictEqual(isSerializedCheckpoint("not-json-string"), false);
            assert.strictEqual(isSerializedCheckpoint({ version: "1.0" }), false);
        });

        // ── 14. Public API exports ──
        test("15. Verify all required Public APIs are exported", () => {
            assert.strictEqual(typeof serializeCheckpoint, "function");
            assert.strictEqual(typeof deserializeCheckpoint, "function");
            assert.strictEqual(typeof cloneCheckpoint, "function");
            assert.strictEqual(typeof normalizeCheckpoint, "function");
            assert.strictEqual(typeof isSerializedCheckpoint, "function");
            assert.strictEqual(typeof CURRENT_SERIALIZER_VERSION, "string");
        });

        // ── 15. Patch 1: Preserve Queue and Worker array sequence ──
        test("16. Preserve queue list order and worker order exactly", () => {
            const opts = {
                version: "1.0",
                executionId: "exec_order_test",
                metadata: {
                    createdAt: "2026-07-17T12:00:00.000Z",
                    updatedAt: "2026-07-17T12:30:00.000Z",
                    waveNumber: 1
                },
                queues: {
                    pending: ["task_z", "task_a", "task_m"],
                    running: ["task_y", "task_b"],
                    completed: ["task_x", "task_c"],
                    failed: []
                },
                workers: ["worker_zeta", "worker_alpha"],
                statistics: {
                    completedTasks: 2,
                    failedTasks: 0,
                    totalTasks: 7
                }
            };
            const buildRes = createCheckpoint(opts);
            assert.strictEqual(buildRes.success, true);
            const cp = buildRes.checkpoint;

            const serialized = serializeCheckpoint(cp);
            const restored = deserializeCheckpoint(serialized);

            assert.deepStrictEqual(restored.queues.pending, ["task_z", "task_a", "task_m"]);
            assert.deepStrictEqual(restored.queues.running, ["task_y", "task_b"]);
            assert.deepStrictEqual(restored.queues.completed, ["task_x", "task_c"]);
            assert.deepStrictEqual(restored.workers, ["worker_zeta", "worker_alpha"]);
        });

        // ── 16. Patch 2: Reject functions and undefined values ──
        test("17. Reject functions in checkpoints during serialization", () => {
            const checkpoint = getSampleValidCheckpoint();
            const raw = JSON.parse(JSON.stringify(checkpoint));
            raw.invalidFn = () => {};

            assert.throws(() => serializeCheckpoint(raw), (err) => {
                return err.code === checkpointErrorCodes.CHECKPOINT_INVALID_INPUT;
            });
        });

        test("18. Reject undefined values in checkpoints during serialization", () => {
            const checkpoint = getSampleValidCheckpoint();
            const raw = JSON.parse(JSON.stringify(checkpoint));
            raw.invalidUndef = undefined;

            assert.throws(() => serializeCheckpoint(raw), (err) => {
                return err.code === checkpointErrorCodes.CHECKPOINT_INVALID_INPUT;
            });
        });
    });
};
