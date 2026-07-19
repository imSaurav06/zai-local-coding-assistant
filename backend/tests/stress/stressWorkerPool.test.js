"use strict";

const assert = require("assert");

module.exports = function registerStressWorkerPoolTests(suite, test) {
    const {
        createWorkerPool,
        allocateWorker,
        releaseWorker,
        getAvailableWorkers,
        getActiveWorkers
    } = require("../../core/runtime");
    const { createRuntimeConfig } = require("../../core/runtime");

    suite("Stress Worker Pool Validation (Phase 11B-7B)", () => {

        test("1. Worker pool handles maximum worker allocation and release successfully", () => {
            const configRes = createRuntimeConfig({ maxConcurrentWorkers: 100 });
            assert.strictEqual(configRes.success, true);
            
            let pool = createWorkerPool(configRes.runtimeConfig);
            assert.ok(pool);

            const allocatedWorkers = [];
            const task = { stableId: "task_01" };

            // Allocate up to max (100)
            for (let i = 0; i < 100; i++) {
                const res = allocateWorker(pool, task);
                assert.strictEqual(res.success, true);
                assert.ok(res.worker.workerId);
                allocatedWorkers.push(res.worker.workerId);
                pool = res.pool;
            }

            // Next allocation must throw due to limit reached
            assert.throws(() => {
                allocateWorker(pool, task);
            }, (err) => {
                return err.code === "WORKER_POOL_NO_AVAILABLE_WORKERS";
            });

            // Release all workers
            for (const id of allocatedWorkers) {
                const releaseRes = releaseWorker(pool, id);
                assert.strictEqual(releaseRes.success, true);
                pool = releaseRes.pool;
            }

            // Active count must be 0, available must be 100
            assert.strictEqual(getActiveWorkers(pool).length, 0);
            assert.strictEqual(getAvailableWorkers(pool).length, 100);
        });

        test("2. Worker pool recovers gracefully under repeated exhaustion cycles", () => {
            const configRes = createRuntimeConfig({ maxConcurrentWorkers: 5 });
            let pool = createWorkerPool(configRes.runtimeConfig);
            const task = { stableId: "task_01" };

            for (let cycle = 0; cycle < 10; cycle++) {
                const allocated = [];
                for (let i = 0; i < 5; i++) {
                    const res = allocateWorker(pool, task);
                    assert.strictEqual(res.success, true);
                    allocated.push(res.worker.workerId);
                    pool = res.pool;
                }

                // Exhausted - must throw
                assert.throws(() => {
                    allocateWorker(pool, task);
                }, (err) => {
                    return err.code === "WORKER_POOL_NO_AVAILABLE_WORKERS";
                });

                // Release some
                let relRes1 = releaseWorker(pool, allocated[0]);
                assert.strictEqual(relRes1.success, true);
                pool = relRes1.pool;

                let relRes2 = releaseWorker(pool, allocated[1]);
                assert.strictEqual(relRes2.success, true);
                pool = relRes2.pool;

                // Allocate again
                let allocRes1 = allocateWorker(pool, task);
                assert.strictEqual(allocRes1.success, true);
                pool = allocRes1.pool;

                let allocRes2 = allocateWorker(pool, task);
                assert.strictEqual(allocRes2.success, true);
                pool = allocRes2.pool;

                // Exhausted again - must throw
                assert.throws(() => {
                    allocateWorker(pool, task);
                }, (err) => {
                    return err.code === "WORKER_POOL_NO_AVAILABLE_WORKERS";
                });

                // Clean up remainder of this cycle to prevent orphans
                for (const id of getActiveWorkers(pool)) {
                    const cleanRes = releaseWorker(pool, id.workerId);
                    pool = cleanRes.pool;
                }
            }

            assert.strictEqual(getActiveWorkers(pool).length, 0);
        });

        test("3. Registry remains stable and rejects invalid release requests without leakage", () => {
            const configRes = createRuntimeConfig({ maxConcurrentWorkers: 3 });
            const pool = createWorkerPool(configRes.runtimeConfig);

            // Releasing non-existent worker throws
            assert.throws(() => {
                releaseWorker(pool, "worker_unknown");
            }, (err) => {
                return err.code === "WORKER_NOT_FOUND" || err.message.includes("does not exist");
            });
        });
    });
};
