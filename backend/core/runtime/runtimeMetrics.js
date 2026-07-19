"use strict";

const { runtimeMetricsErrorCodes } = require("./runtimeMetricsErrors");

const CANONICAL_SNAPSHOT_FIELDS = new Set([
    "executionId",
    "startTime",
    "endTime",
    "duration",
    "scheduler",
    "workerPool",
    "verification",
    "repair",
    "checkpoint",
    "statistics"
]);

/**
 * Deep freezes a metrics snapshot object recursively.
 *
 * @param {Object} obj The snapshot object to freeze
 */
function deepFreezeMetricsSnapshot(obj) {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach(prop => {
        if (
            obj.hasOwnProperty(prop) &&
            obj[prop] !== null &&
            (typeof obj[prop] === "object" || typeof obj[prop] === "function") &&
            !Object.isFrozen(obj[prop])
        ) {
            deepFreezeMetricsSnapshot(obj[prop]);
        }
    });
    return obj;
}

/**
 * Validates the schema and invariant conditions of a MetricsSnapshot.
 *
 * @param {Object} snapshot The snapshot object to validate
 * @returns {Object} Validation outcome { success, errors }
 */
function validateMetricsSnapshot(snapshot) {
    if (snapshot === null || snapshot === undefined || typeof snapshot !== "object" || Array.isArray(snapshot)) {
        return {
            success: false,
            errors: [{
                code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID,
                path: "",
                message: "MetricsSnapshot must be a non-null object."
            }]
        };
    }

    const errors = [];

    // 1. Unknown properties check
    for (const key of Object.keys(snapshot)) {
        if (!CANONICAL_SNAPSHOT_FIELDS.has(key)) {
            errors.push({
                code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID,
                path: key,
                message: `Unknown property key: '${key}'`
            });
        }
    }

    // 2. Required properties check
    const required = [
        "executionId", "startTime", "endTime", "duration",
        "scheduler", "workerPool", "verification", "repair", "checkpoint", "statistics"
    ];
    for (const req of required) {
        if (!snapshot.hasOwnProperty(req)) {
            errors.push({
                code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID,
                path: req,
                message: `Property '${req}' is required.`
            });
        }
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    // 3. Types validation
    if (typeof snapshot.executionId !== "string" || snapshot.executionId.trim() === "") {
        errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "executionId", message: "executionId must be a non-empty string" });
    }
    if (typeof snapshot.startTime !== "number" || snapshot.startTime < 0) {
        errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "startTime", message: "startTime must be a non-negative number" });
    }
    if (typeof snapshot.endTime !== "number" || snapshot.endTime < 0) {
        errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "endTime", message: "endTime must be a non-negative number" });
    }
    if (typeof snapshot.duration !== "number" || snapshot.duration < 0) {
        errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "duration", message: "duration must be a non-negative number" });
    }

    // Invariant checks (Corrupted check)
    if (snapshot.endTime < snapshot.startTime) {
        errors.push({
            code: runtimeMetricsErrorCodes.RUNTIME_METRICS_CORRUPTED,
            path: "endTime",
            message: "endTime cannot be less than startTime"
        });
    }

    const calculatedDuration = snapshot.endTime - snapshot.startTime;
    if (Math.abs(snapshot.duration - calculatedDuration) > 1000) { // allow small drift/delay if computed differently, but negative/wrong durations are caught
        errors.push({
            code: runtimeMetricsErrorCodes.RUNTIME_METRICS_CORRUPTED,
            path: "duration",
            message: `duration ${snapshot.duration} is inconsistent with calculated duration ${calculatedDuration}`
        });
    }

    // Validate scheduler
    const scheduler = snapshot.scheduler;
    if (scheduler === null || typeof scheduler !== "object" || Array.isArray(scheduler)) {
        errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "scheduler", message: "scheduler must be an object" });
    } else {
        if (typeof scheduler.decisions !== "number" || scheduler.decisions < 0) {
            errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "scheduler.decisions", message: "scheduler.decisions must be non-negative number" });
        }
    }

    // Validate workerPool
    const wp = snapshot.workerPool;
    if (wp === null || typeof wp !== "object" || Array.isArray(wp)) {
        errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "workerPool", message: "workerPool must be an object" });
    } else {
        if (typeof wp.allocationCount !== "number" || wp.allocationCount < 0) {
            errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "workerPool.allocationCount", message: "workerPool.allocationCount must be non-negative number" });
        }
        if (typeof wp.executionCount !== "number" || wp.executionCount < 0) {
            errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "workerPool.executionCount", message: "workerPool.executionCount must be non-negative number" });
        }
        if (wp.executionCount > wp.allocationCount) {
            errors.push({
                code: runtimeMetricsErrorCodes.RUNTIME_METRICS_CORRUPTED,
                path: "workerPool.executionCount",
                message: "workerExecutionCount cannot exceed workerAllocationCount"
            });
        }
    }

    // Validate verification
    const verification = snapshot.verification;
    if (verification === null || typeof verification !== "object" || Array.isArray(verification)) {
        errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "verification", message: "verification must be an object" });
    } else {
        if (typeof verification.runs !== "number" || verification.runs < 0) {
            errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "verification.runs", message: "verification.runs must be non-negative number" });
        }
        if (typeof verification.failures !== "number" || verification.failures < 0) {
            errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "verification.failures", message: "verification.failures must be non-negative number" });
        }
        if (verification.failures > verification.runs) {
            errors.push({
                code: runtimeMetricsErrorCodes.RUNTIME_METRICS_CORRUPTED,
                path: "verification.failures",
                message: "verificationFailures cannot exceed verificationRuns"
            });
        }
    }

    // Validate repair
    const repair = snapshot.repair;
    if (repair === null || typeof repair !== "object" || Array.isArray(repair)) {
        errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "repair", message: "repair must be an object" });
    } else {
        if (typeof repair.attempts !== "number" || repair.attempts < 0) {
            errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "repair.attempts", message: "repair.attempts must be non-negative number" });
        }
        if (typeof repair.successes !== "number" || repair.successes < 0) {
            errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "repair.successes", message: "repair.successes must be non-negative number" });
        }
        if (repair.successes > repair.attempts) {
            errors.push({
                code: runtimeMetricsErrorCodes.RUNTIME_METRICS_CORRUPTED,
                path: "repair.successes",
                message: "repairSuccesses cannot exceed repairAttempts"
            });
        }
    }

    // Validate checkpoint
    const cp = snapshot.checkpoint;
    if (cp === null || typeof cp !== "object" || Array.isArray(cp)) {
        errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "checkpoint", message: "checkpoint must be an object" });
    } else {
        if (typeof cp.saves !== "number" || cp.saves < 0) {
            errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "checkpoint.saves", message: "checkpoint.saves must be non-negative number" });
        }
        if (typeof cp.restores !== "number" || cp.restores < 0) {
            errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "checkpoint.restores", message: "checkpoint.restores must be non-negative number" });
        }
    }

    // Validate statistics
    const stats = snapshot.statistics;
    if (stats === null || typeof stats !== "object" || Array.isArray(stats)) {
        errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "statistics", message: "statistics must be an object" });
    } else {
        if (typeof stats.tasksCompleted !== "number" || stats.tasksCompleted < 0) {
            errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "statistics.tasksCompleted", message: "statistics.tasksCompleted must be non-negative number" });
        }
        if (typeof stats.tasksFailed !== "number" || stats.tasksFailed < 0) {
            errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "statistics.tasksFailed", message: "statistics.tasksFailed must be non-negative number" });
        }
        if (typeof stats.resumeCount !== "number" || stats.resumeCount < 0) {
            errors.push({ code: runtimeMetricsErrorCodes.RUNTIME_METRICS_INVALID, path: "statistics.resumeCount", message: "statistics.resumeCount must be non-negative number" });
        }
    }

    return {
        success: errors.length === 0,
        errors
    };
}

/**
 * Checks if the given object is a valid deeply frozen MetricsSnapshot model.
 *
 * @param {Object} obj The object to inspect
 */
function isMetricsSnapshot(obj) {
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
        return false;
    }
    if (!Object.isFrozen(obj)) {
        return false;
    }
    const val = validateMetricsSnapshot(obj);
    return val.success;
}

module.exports = {
    validateMetricsSnapshot,
    deepFreezeMetricsSnapshot,
    isMetricsSnapshot
};
