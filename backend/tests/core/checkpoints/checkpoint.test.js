"use strict";

const assert = require("assert");

module.exports = function registerCheckpointTests(suite, test) {
    const {
        createCheckpoint,
        isCheckpoint,
        deepFreezeCheckpoint,
        CHECKPOINT_MODEL_VERSION,
        checkpointErrorCodes,
        validateCheckpoint
    } = require("../../../core/checkpoints");

    // Helper to create a basic valid domain checkpoint options object
    function getValidOptions() {
        return {
            version: "1.0",
            executionId: "exec_123",
            metadata: {
                createdAt: "2026-07-17T00:00:00.000Z",
                updatedAt: "2026-07-17T00:00:00.000Z",
                waveNumber: 2
            },
            queues: {
                pending: ["task_3", "task_4"],
                running: ["task_2"],
                completed: ["task_1"],
                failed: []
            },
            workers: ["worker_1", "worker_2"],
            statistics: {
                completedTasks: 1,
                failedTasks: 0,
                totalTasks: 4
            }
        };
    }

    suite("Durable Checkpoint Domain Model (Phase 10A-1)", () => {
        // ── 1. Reject invalid inputs ──
        test("1. Reject invalid checkpoint creation inputs", () => {
            const res1 = createCheckpoint(null);
            assert.strictEqual(res1.success, false);
            assert.strictEqual(res1.errors[0].code, checkpointErrorCodes.CHECKPOINT_INVALID_INPUT);

            const res2 = createCheckpoint(undefined);
            assert.strictEqual(res2.success, false);
            assert.strictEqual(res2.errors[0].code, checkpointErrorCodes.CHECKPOINT_INVALID_INPUT);

            const res3 = createCheckpoint(12345);
            assert.strictEqual(res3.success, false);
            assert.strictEqual(res3.errors[0].code, checkpointErrorCodes.CHECKPOINT_INVALID_INPUT);
        });

        test("2. Reject invalid checkpoint validation inputs", () => {
            const res1 = validateCheckpoint(null);
            assert.strictEqual(res1.success, false);
            assert.strictEqual(res1.errors[0].code, checkpointErrorCodes.CHECKPOINT_INVALID_INPUT);

            const res2 = validateCheckpoint(undefined);
            assert.strictEqual(res2.success, false);
            assert.strictEqual(res2.errors[0].code, checkpointErrorCodes.CHECKPOINT_INVALID_INPUT);

            const res3 = validateCheckpoint([1, 2, 3]);
            assert.strictEqual(res3.success, false);
            assert.strictEqual(res3.errors[0].code, checkpointErrorCodes.CHECKPOINT_INVALID_INPUT);
        });

        // ── 2. Reject mutable inputs ──
        test("3. Reject validation of non-frozen/mutable checkpoints", () => {
            const validObj = getValidOptions();
            const createRes = createCheckpoint(validObj);
            assert.strictEqual(createRes.success, true);

            // A plain cloned object is mutable by default
            const mutableCheckpoint = JSON.parse(JSON.stringify(createRes.checkpoint));
            
            const validationRes = validateCheckpoint(mutableCheckpoint);
            assert.strictEqual(validationRes.success, false);
            assert.strictEqual(validationRes.errors[0].code, checkpointErrorCodes.CHECKPOINT_MUTABLE_INPUT);
        });

        // ── 3. Reject duplicate ids ──
        test("4. Reject duplicate task IDs in queues", () => {
            const opts = getValidOptions();
            // Duplicate 'task_1' in both completed and pending
            opts.queues.pending.push("task_1");
            opts.statistics.totalTasks = 5;

            const createRes = createCheckpoint(opts);
            assert.strictEqual(createRes.success, true);

            const validationRes = validateCheckpoint(createRes.checkpoint);
            assert.strictEqual(validationRes.success, false);
            assert.strictEqual(validationRes.errors[0].code, checkpointErrorCodes.CHECKPOINT_DUPLICATE_TASK);
        });

        test("5. Reject duplicate worker IDs", () => {
            const opts = getValidOptions();
            opts.workers.push("worker_1");

            const createRes = createCheckpoint(opts);
            assert.strictEqual(createRes.success, true);

            const validationRes = validateCheckpoint(createRes.checkpoint);
            assert.strictEqual(validationRes.success, false);
            assert.strictEqual(validationRes.errors[0].code, checkpointErrorCodes.CHECKPOINT_DUPLICATE_WORKER);
        });

        // ── 4. Reject malformed queues ──
        test("6. Reject malformed queues structure", () => {
            const opts = getValidOptions();
            delete opts.queues.pending;

            const createRes = createCheckpoint(opts);
            assert.strictEqual(createRes.success, true);

            const validationRes = validateCheckpoint(createRes.checkpoint);
            assert.strictEqual(validationRes.success, false);
            assert.strictEqual(validationRes.errors[0].code, checkpointErrorCodes.CHECKPOINT_INVALID_QUEUE);
        });

        // ── 5. Reject malformed statistics ──
        test("7. Reject malformed statistics (totalTasks mismatch)", () => {
            const opts = getValidOptions();
            opts.statistics.totalTasks = 99; // Mismatch with actual task counts

            const createRes = createCheckpoint(opts);
            assert.strictEqual(createRes.success, true);

            const validationRes = validateCheckpoint(createRes.checkpoint);
            assert.strictEqual(validationRes.success, false);
            assert.strictEqual(validationRes.errors[0].code, checkpointErrorCodes.CHECKPOINT_INVALID_STATISTICS);
        });

        // ── 6. Reject malformed metadata ──
        test("8. Reject malformed metadata (negative waveNumber)", () => {
            const opts = getValidOptions();
            opts.metadata.waveNumber = -5;

            const createRes = createCheckpoint(opts);
            assert.strictEqual(createRes.success, true);

            const validationRes = validateCheckpoint(createRes.checkpoint);
            assert.strictEqual(validationRes.success, false);
            assert.strictEqual(validationRes.errors[0].code, checkpointErrorCodes.CHECKPOINT_INVALID_METADATA);
        });

        // ── 7. Reject unknown properties ──
        test("9. Reject unknown top-level properties", () => {
            const opts = getValidOptions();
            opts.invalidKey = "unallowed";

            const createRes = createCheckpoint(opts);
            assert.strictEqual(createRes.success, true);

            const validationRes = validateCheckpoint(createRes.checkpoint);
            assert.strictEqual(validationRes.success, false);
            assert.strictEqual(validationRes.errors[0].code, checkpointErrorCodes.CHECKPOINT_UNKNOWN_PROPERTY);
        });

        // ── 8. Deep freeze outputs ──
        test("10. Deep freeze created checkpoints and validations", () => {
            const opts = getValidOptions();
            const createRes = createCheckpoint(opts);
            assert.strictEqual(createRes.success, true);

            const checkpoint = createRes.checkpoint;
            assert.ok(Object.isFrozen(checkpoint));
            assert.ok(Object.isFrozen(checkpoint.metadata));
            assert.ok(Object.isFrozen(checkpoint.queues));
            assert.ok(Object.isFrozen(checkpoint.statistics));
            assert.ok(Object.isFrozen(checkpoint.workers));
        });

        test("11. deepFreezeCheckpoint returns deeply frozen object", () => {
            const mutableObj = { a: { b: 1 } };
            const frozenObj = deepFreezeCheckpoint(mutableObj);
            assert.ok(Object.isFrozen(frozenObj));
            assert.ok(Object.isFrozen(frozenObj.a));
        });

        // ── 9. Deterministic ordering ──
        test("12. Deterministic execution states and properties", () => {
            const opts1 = getValidOptions();
            const opts2 = {
                statistics: { totalTasks: 4, completedTasks: 1, failedTasks: 0 },
                workers: ["worker_1", "worker_2"],
                queues: { completed: ["task_1"], running: ["task_2"], pending: ["task_3", "task_4"], failed: [] },
                metadata: { waveNumber: 2, updatedAt: "2026-07-17T00:00:00.000Z", createdAt: "2026-07-17T00:00:00.000Z" },
                executionId: "exec_123",
                version: "1.0"
            };

            const res1 = createCheckpoint(opts1);
            const res2 = createCheckpoint(opts2);

            assert.deepStrictEqual(res1.checkpoint, res2.checkpoint);
        });

        // ── 10. Input objects never mutated ──
        test("13. Input arguments are never mutated", () => {
            const opts = getValidOptions();
            const originalString = JSON.stringify(opts);

            createCheckpoint(opts);
            assert.strictEqual(JSON.stringify(opts), originalString);
        });

        // ── 11. Error codes immutable ──
        test("14. Error codes enum is deeply frozen", () => {
            assert.ok(Object.isFrozen(checkpointErrorCodes));
            assert.throws(() => {
                checkpointErrorCodes.NEW_ERROR = "MUTATE";
            });
        });

        // ── 12. Public API exported ──
        test("15. Verify all required Public APIs are exported", () => {
            assert.strictEqual(typeof createCheckpoint, "function");
            assert.strictEqual(typeof validateCheckpoint, "function");
            assert.strictEqual(typeof isCheckpoint, "function");
            assert.strictEqual(typeof deepFreezeCheckpoint, "function");
            assert.strictEqual(typeof CHECKPOINT_MODEL_VERSION, "string");
        });
    });
};
