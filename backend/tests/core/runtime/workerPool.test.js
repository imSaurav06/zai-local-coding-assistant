"use strict";

const assert = require("assert");

module.exports = function registerWorkerPoolTests(suite, test) {
    const {
        createWorkerPool,
        allocateWorker,
        releaseWorker,
        getAvailableWorkers,
        getActiveWorkers,
        validateWorkerPool,
        workerPoolErrorCodes,
        WORKER_POOL_VERSION
    } = require("../../../core/runtime");

    function getValidConfig(maxConcurrentWorkers = 3) {
        return {
            maxConcurrentWorkers
        };
    }

    suite("Worker Pool Foundation Layer (Phase 11A-6)", () => {
        // ── 1. Pool Creation ──
        test("1. createWorkerPool() successfully instantiates pool with default idle workers", () => {
            const pool = createWorkerPool(getValidConfig(2));
            assert.ok(pool);
            assert.strictEqual(pool.config.maxConcurrentWorkers, 2);
            assert.ok(pool.workers["worker-1"]);
            assert.ok(pool.workers["worker-2"]);
            assert.strictEqual(pool.workers["worker-1"].status, "IDLE");
            assert.strictEqual(pool.workers["worker-2"].status, "IDLE");
        });

        // ── 2. Worker Allocation ──
        test("2. allocateWorker() assigns task to an available worker and transitions state", () => {
            const pool = createWorkerPool(getValidConfig(2));
            const task = { stableId: "task_01" };

            const res = allocateWorker(pool, task);
            assert.strictEqual(res.success, true);
            assert.strictEqual(res.worker.status, "ALLOCATED");
            assert.strictEqual(res.worker.currentTask, "task_01");

            // Verify new pool reflects allocation
            const updatedPool = res.pool;
            assert.strictEqual(updatedPool.workers[res.worker.workerId].status, "ALLOCATED");
            assert.strictEqual(updatedPool.workers[res.worker.workerId].currentTask, "task_01");
        });

        // ── 3. Worker Release ──
        test("3. releaseWorker() returns worker back to IDLE and saves completedTask", () => {
            const pool = createWorkerPool(getValidConfig(2));
            const task = { stableId: "task_01" };

            const allocRes = allocateWorker(pool, task);
            const wId = allocRes.worker.workerId;

            const releaseRes = releaseWorker(allocRes.pool, wId);
            assert.strictEqual(releaseRes.success, true);
            assert.strictEqual(releaseRes.worker.status, "IDLE");
            assert.strictEqual(releaseRes.worker.currentTask, null);
            assert.deepStrictEqual(releaseRes.worker.completedTasks, ["task_01"]);

            // Verify in new pool
            const finalPool = releaseRes.pool;
            assert.strictEqual(finalPool.workers[wId].status, "IDLE");
            assert.strictEqual(finalPool.workers[wId].currentTask, null);
            assert.deepStrictEqual(finalPool.workers[wId].completedTasks, ["task_01"]);
        });

        // ── 4. Worker Lookup ──
        test("4. getAvailableWorkers() and getActiveWorkers() return correct sorted subsets", () => {
            const pool = createWorkerPool(getValidConfig(3));

            // Initial: all 3 available
            let avail = getAvailableWorkers(pool);
            let active = getActiveWorkers(pool);
            assert.strictEqual(avail.length, 3);
            assert.strictEqual(active.length, 0);
            assert.strictEqual(avail[0].workerId, "worker-1");
            assert.strictEqual(avail[1].workerId, "worker-2");
            assert.strictEqual(avail[2].workerId, "worker-3");

            // Allocate one
            const alloc1 = allocateWorker(pool, { stableId: "t1" });
            avail = getAvailableWorkers(alloc1.pool);
            active = getActiveWorkers(alloc1.pool);
            assert.strictEqual(avail.length, 2);
            assert.strictEqual(active.length, 1);
            assert.strictEqual(active[0].workerId, alloc1.worker.workerId);
        });

        // ── 5. Pool Exhaustion ──
        test("5. allocateWorker() throws WORKER_POOL_NO_AVAILABLE_WORKERS when exhausted", () => {
            let pool = createWorkerPool(getValidConfig(1));
            pool = allocateWorker(pool, { stableId: "t1" }).pool;

            assert.throws(() => {
                allocateWorker(pool, { stableId: "t2" });
            }, (err) => {
                return err.code === workerPoolErrorCodes.WORKER_POOL_NO_AVAILABLE_WORKERS;
            });
        });

        // ── 6. Duplicate Workers ──
        test("6. createWorkerPool() throws WORKER_POOL_DUPLICATE_WORKER for duplicate custom IDs", () => {
            const customConfig = {
                maxConcurrentWorkers: 2,
                workers: [
                    { workerId: "w-dup", status: "IDLE", currentTask: null, completedTasks: [] },
                    { workerId: "w-dup", status: "IDLE", currentTask: null, completedTasks: [] }
                ]
            };

            assert.throws(() => {
                createWorkerPool(customConfig);
            }, (err) => {
                return err.code === workerPoolErrorCodes.WORKER_POOL_DUPLICATE_WORKER;
            });
        });

        // ── 7. Invalid State ──
        test("7. validateWorkerPool() identifies and rejects invalid states and parameters", () => {
            const pool = createWorkerPool(getValidConfig(2));
            const valOk = validateWorkerPool(pool);
            assert.strictEqual(valOk.success, true);

            // Null pool
            const valNull = validateWorkerPool(null);
            assert.strictEqual(valNull.success, false);
            assert.strictEqual(valNull.errors[0].code, workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT);

            // Negative workers config
            const valBadConfig = validateWorkerPool(Object.freeze({
                config: Object.freeze({ maxConcurrentWorkers: -5 }),
                workers: Object.freeze({})
            }));
            assert.strictEqual(valBadConfig.success, false);
            assert.strictEqual(valBadConfig.errors[0].code, workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT);
        });

        // ── 8. Deep Freeze ──
        test("8. Worker Pool and returned states are deeply frozen and immutable", () => {
            const pool = createWorkerPool(getValidConfig(2));
            assert.ok(Object.isFrozen(pool));
            assert.ok(Object.isFrozen(pool.config));
            assert.ok(Object.isFrozen(pool.workers));

            const alloc = allocateWorker(pool, { stableId: "t1" });
            assert.ok(Object.isFrozen(alloc.pool));
            assert.ok(Object.isFrozen(alloc.worker));
        });

        // ── 9. Deterministic Allocation ──
        test("9. allocateWorker() chooses worker deterministically (alphabetical sorted workerId)", () => {
            const customConfig = {
                maxConcurrentWorkers: 3,
                workers: [
                    { workerId: "w-charles", status: "IDLE", currentTask: null, completedTasks: [] },
                    { workerId: "w-alice", status: "IDLE", currentTask: null, completedTasks: [] },
                    { workerId: "w-bob", status: "IDLE", currentTask: null, completedTasks: [] }
                ]
            };
            const pool = createWorkerPool(customConfig);

            // First allocation must select w-alice
            const res = allocateWorker(pool, { stableId: "t1" });
            assert.strictEqual(res.worker.workerId, "w-alice");
        });

        // ── 10. Input Non-Mutation ──
        test("10. allocateWorker() and releaseWorker() never mutate parameters", () => {
            const pool = createWorkerPool(getValidConfig(2));
            const origJson = JSON.stringify(pool);

            const alloc = allocateWorker(pool, { stableId: "t1" });
            assert.strictEqual(JSON.stringify(pool), origJson);

            releaseWorker(alloc.pool, alloc.worker.workerId);
            assert.strictEqual(JSON.stringify(pool), origJson);
        });

        // ── 11. Public API Exports ──
        test("11. exposes correct version and API contracts", () => {
            assert.strictEqual(WORKER_POOL_VERSION, "1.0");
            assert.ok(createWorkerPool);
            assert.ok(allocateWorker);
            assert.ok(releaseWorker);
            assert.ok(getAvailableWorkers);
            assert.ok(getActiveWorkers);
            assert.ok(validateWorkerPool);
        });
    });
};
