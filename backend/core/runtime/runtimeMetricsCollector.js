"use strict";

const { validateMetricsSnapshot, deepFreezeMetricsSnapshot } = require("./runtimeMetrics");
const { runtimeMetricsErrorCodes } = require("./runtimeMetricsErrors");

function createMetricsCollector(config = {}) {
    let executionId = "";
    let startTime = 0;
    let endTime = 0;

    let workerAllocationCount = 0;
    let workerExecutionCount = 0;
    let tasksCompleted = 0;
    let tasksFailed = 0;
    let schedulerDecisions = 0;
    let verificationRuns = 0;
    let verificationFailures = 0;
    let repairAttempts = 0;
    let repairSuccesses = 0;
    let checkpointSaves = 0;
    let checkpointRestores = 0;
    let resumeCount = 0;

    const collector = {
        startExecution(execId) {
            executionId = execId || `exec_${Date.now()}`;
            startTime = Date.now();
        },

        endExecution() {
            endTime = Date.now();
        },

        recordWorkerAllocation() {
            workerAllocationCount++;
        },

        recordWorkerExecution() {
            workerExecutionCount++;
        },

        recordTaskCompleted() {
            tasksCompleted++;
        },

        recordTaskFailed() {
            tasksFailed++;
        },

        recordSchedulerDecision() {
            schedulerDecisions++;
        },

        recordVerificationRun() {
            verificationRuns++;
        },

        recordVerificationFailure() {
            verificationFailures++;
        },

        recordRepairAttempt() {
            repairAttempts++;
        },

        recordRepairSuccess() {
            repairSuccesses++;
        },

        recordCheckpointSave() {
            checkpointSaves++;
        },

        recordCheckpointRestore() {
            checkpointRestores++;
        },

        recordResume() {
            resumeCount++;
        },

        getSnapshot() {
            if (endTime === 0) {
                endTime = Date.now();
            }

            const duration = endTime - startTime;

            const snapshot = {
                executionId,
                startTime,
                endTime,
                duration,
                scheduler: {
                    decisions: schedulerDecisions
                },
                workerPool: {
                    allocationCount: workerAllocationCount,
                    executionCount: workerExecutionCount
                },
                verification: {
                    runs: verificationRuns,
                    failures: verificationFailures
                },
                repair: {
                    attempts: repairAttempts,
                    successes: repairSuccesses
                },
                checkpoint: {
                    saves: checkpointSaves,
                    restores: checkpointRestores
                },
                statistics: {
                    tasksCompleted,
                    tasksFailed,
                    resumeCount
                }
            };

            const val = validateMetricsSnapshot(snapshot);
            if (!val.success) {
                const isCorrupted = val.errors.some(e => e.code === runtimeMetricsErrorCodes.RUNTIME_METRICS_CORRUPTED);
                const errorCode = isCorrupted ? runtimeMetricsErrorCodes.RUNTIME_METRICS_CORRUPTED : runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID;
                const err = new Error(`Metrics snapshot validation failed: ${val.errors[0].message}`);
                err.code = errorCode;
                err.errors = val.errors;
                throw err;
            }

            return deepFreezeMetricsSnapshot(snapshot);
        }
    };

    return collector;
}

module.exports = {
    createMetricsCollector
};
