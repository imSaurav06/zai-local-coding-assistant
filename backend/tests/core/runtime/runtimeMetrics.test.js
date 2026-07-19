"use strict";

const assert = require("assert");

module.exports = function registerMetricsTests(suite, test) {
    const { createMetricsCollector, isMetricsSnapshot, runtimeMetricsErrorCodes } = require("../../../core/runtime");
    const { validateMetricsSnapshot } = require("../../../core/runtime/runtimeMetrics");

    suite("Runtime Metrics Domain & Collector", () => {
        test("successfully creates a collector and generates a valid deeply frozen snapshot", () => {
            const collector = createMetricsCollector();
            collector.startExecution("exec_123");
            collector.recordSchedulerDecision();
            collector.recordWorkerAllocation();
            collector.recordWorkerExecution();
            collector.recordVerificationRun();
            collector.recordVerificationFailure();
            collector.recordRepairAttempt();
            collector.recordRepairSuccess();
            collector.recordCheckpointSave();
            collector.recordCheckpointRestore();
            collector.recordResume();
            collector.recordTaskCompleted();

            collector.endExecution();
            const snapshot = collector.getSnapshot();

            assert.strictEqual(isMetricsSnapshot(snapshot), true);
            assert.strictEqual(snapshot.executionId, "exec_123");
            assert.strictEqual(snapshot.scheduler.decisions, 1);
            assert.strictEqual(snapshot.workerPool.allocationCount, 1);
            assert.strictEqual(snapshot.workerPool.executionCount, 1);
            assert.strictEqual(snapshot.verification.runs, 1);
            assert.strictEqual(snapshot.verification.failures, 1);
            assert.strictEqual(snapshot.repair.attempts, 1);
            assert.strictEqual(snapshot.repair.successes, 1);
            assert.strictEqual(snapshot.checkpoint.saves, 1);
            assert.strictEqual(snapshot.checkpoint.restores, 1);
            assert.strictEqual(snapshot.statistics.resumeCount, 1);
            assert.strictEqual(snapshot.statistics.tasksCompleted, 1);
            assert.strictEqual(snapshot.statistics.tasksFailed, 0);

            // Immutability check
            assert.throws(() => {
                snapshot.executionId = "mutated";
            }, TypeError);

            assert.throws(() => {
                snapshot.scheduler.decisions = 999;
            }, TypeError);
        });

        test("rejects invalid, null or array snapshot objects", () => {
            const resNull = validateMetricsSnapshot(null);
            assert.strictEqual(resNull.success, false);
            assert.strictEqual(resNull.errors[0].code, runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID);

            const resArr = validateMetricsSnapshot([]);
            assert.strictEqual(resArr.success, false);
            assert.strictEqual(resArr.errors[0].code, runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID);
        });

        test("rejects negative durations or times", () => {
            const invalidSnapshot = {
                executionId: "exec_err",
                startTime: 100,
                endTime: 50,
                duration: -50,
                scheduler: { decisions: 0 },
                workerPool: { allocationCount: 0, executionCount: 0 },
                verification: { runs: 0, failures: 0 },
                repair: { attempts: 0, successes: 0 },
                checkpoint: { saves: 0, restores: 0 },
                statistics: { tasksCompleted: 0, tasksFailed: 0, resumeCount: 0 }
            };

            const res = validateMetricsSnapshot(invalidSnapshot);
            assert.strictEqual(res.success, false);
            assert.ok(res.errors.some(e => e.code === runtimeMetricsErrorCodes.RUNTIME_METRICS_CORRUPTED));
        });

        test("rejects corrupted statistics (e.g. executionCount > allocationCount)", () => {
            const corruptedSnapshot = {
                executionId: "exec_corr",
                startTime: 100,
                endTime: 110,
                duration: 10,
                scheduler: { decisions: 1 },
                workerPool: { allocationCount: 1, executionCount: 2 }, // Corrupted
                verification: { runs: 0, failures: 0 },
                repair: { attempts: 0, successes: 0 },
                checkpoint: { saves: 0, restores: 0 },
                statistics: { tasksCompleted: 0, tasksFailed: 0, resumeCount: 0 }
            };

            const res = validateMetricsSnapshot(corruptedSnapshot);
            assert.strictEqual(res.success, false);
            assert.ok(res.errors.some(e => e.code === runtimeMetricsErrorCodes.RUNTIME_METRICS_CORRUPTED));
        });

        test("rejects corrupted statistics (e.g. repairSuccesses > repairAttempts)", () => {
            const corruptedSnapshot = {
                executionId: "exec_corr_2",
                startTime: 100,
                endTime: 110,
                duration: 10,
                scheduler: { decisions: 1 },
                workerPool: { allocationCount: 1, executionCount: 1 },
                verification: { runs: 1, failures: 0 },
                repair: { attempts: 0, successes: 1 }, // Corrupted
                checkpoint: { saves: 0, restores: 0 },
                statistics: { tasksCompleted: 0, tasksFailed: 0, resumeCount: 0 }
            };

            const res = validateMetricsSnapshot(corruptedSnapshot);
            assert.strictEqual(res.success, false);
            assert.ok(res.errors.some(e => e.code === runtimeMetricsErrorCodes.RUNTIME_METRICS_CORRUPTED));
        });

        test("rejects mutable snapshots in isMetricsSnapshot helper", () => {
            const validUnfrozen = {
                executionId: "exec_unfrozen",
                startTime: 100,
                endTime: 110,
                duration: 10,
                scheduler: { decisions: 0 },
                workerPool: { allocationCount: 0, executionCount: 0 },
                verification: { runs: 0, failures: 0 },
                repair: { attempts: 0, successes: 0 },
                checkpoint: { saves: 0, restores: 0 },
                statistics: { tasksCompleted: 0, tasksFailed: 0, resumeCount: 0 }
            };
            assert.strictEqual(isMetricsSnapshot(validUnfrozen), false);
        });
    });
};
