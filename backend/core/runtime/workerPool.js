"use strict";

const { workerPoolErrorCodes } = require("./workerPoolErrors");
const { createWorker } = require("../execution/workerModel");

const WORKER_POOL_VERSION = "1.0";

const workerPoolStates = Object.freeze({
    IDLE: "IDLE",
    ALLOCATED: "ALLOCATED",
    RUNNING: "RUNNING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED"
});

/**
 * Deep freezes an object recursively to guarantee immutability.
 */
function deepFreeze(obj) {
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
            deepFreeze(obj[prop]);
        }
    });
    return obj;
}

/**
 * Validates a worker pool object structure, states, and configurations.
 *
 * @param {Object} pool The worker pool to validate
 */
function validateWorkerPool(pool) {
    if (pool === null || pool === undefined || typeof pool !== "object" || Array.isArray(pool)) {
        return {
            success: false,
            errors: [{
                code: workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT,
                path: "",
                message: "Worker Pool must be a non-null object."
            }]
        };
    }

    if (!Object.isFrozen(pool)) {
        return {
            success: false,
            errors: [{
                code: workerPoolErrorCodes.WORKER_POOL_INVALID_STATE,
                path: "",
                message: "Worker Pool must be frozen (immutable)."
            }]
        };
    }

    const allowedPoolKeys = new Set(["config", "workers", "allocateWorker", "releaseWorker", "getAvailableWorkers", "getActiveWorkers"]);
    const errors = [];

    for (const key of Object.keys(pool)) {
        if (!allowedPoolKeys.has(key)) {
            errors.push({
                code: workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT,
                path: key,
                message: `Unknown property key on pool: '${key}'`
            });
        }
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    // Validate config
    if (!pool.config || typeof pool.config !== "object" || Array.isArray(pool.config)) {
        errors.push({
            code: workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT,
            path: "config",
            message: "Pool config must be a non-null object."
        });
        return { success: false, errors };
    }

    if (!Object.isFrozen(pool.config)) {
        errors.push({
            code: workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT,
            path: "config",
            message: "Pool config must be frozen."
        });
    }

    const maxConcurrentWorkers = pool.config.maxConcurrentWorkers;
    if (typeof maxConcurrentWorkers !== "number" || !Number.isInteger(maxConcurrentWorkers)) {
        errors.push({
            code: workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT,
            path: "config.maxConcurrentWorkers",
            message: "maxConcurrentWorkers must be an integer."
        });
    } else if (maxConcurrentWorkers < 0) {
        errors.push({
            code: workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT,
            path: "config.maxConcurrentWorkers",
            message: "maxConcurrentWorkers cannot be negative."
        });
    }

    // Validate workers
    if (!pool.workers || typeof pool.workers !== "object" || Array.isArray(pool.workers)) {
        errors.push({
            code: workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT,
            path: "workers",
            message: "Pool workers must be a non-null object."
        });
        return { success: false, errors };
    }

    if (!Object.isFrozen(pool.workers)) {
        errors.push({
            code: workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT,
            path: "workers",
            message: "Pool workers map must be frozen."
        });
    }

    const workerIds = new Set();
    const allowedWorkerStates = new Set(["IDLE", "ALLOCATED", "RUNNING", "COMPLETED", "FAILED"]);

    for (const [id, worker] of Object.entries(pool.workers)) {
        if (worker === null || typeof worker !== "object" || Array.isArray(worker)) {
            errors.push({
                code: workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT,
                path: `workers.${id}`,
                message: "Worker must be a non-null object."
            });
            continue;
        }

        if (id !== worker.workerId) {
            errors.push({
                code: workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT,
                path: `workers.${id}`,
                message: `Worker key '${id}' does not match workerId '${worker.workerId}'.`
            });
        }

        if (workerIds.has(worker.workerId)) {
            errors.push({
                code: workerPoolErrorCodes.WORKER_POOL_DUPLICATE_WORKER,
                path: `workers.${worker.workerId}`,
                message: `Duplicate worker ID detected: '${worker.workerId}'`
            });
        }
        workerIds.add(worker.workerId);

        if (!Object.isFrozen(worker)) {
            errors.push({
                code: workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT,
                path: `workers.${id}`,
                message: "Worker object must be frozen."
            });
        }

        const requiredWorkerFields = ["workerId", "status", "currentTask", "completedTasks", "metadata"];
        for (const field of requiredWorkerFields) {
            if (!worker.hasOwnProperty(field)) {
                errors.push({
                    code: workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT,
                    path: `workers.${id}.${field}`,
                    message: `Worker is missing required field: '${field}'`
                });
            }
        }

        if (errors.length > 0) continue;

        if (typeof worker.workerId !== "string" || !worker.workerId.trim()) {
            errors.push({
                code: workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT,
                path: `workers.${id}.workerId`,
                message: "workerId must be a non-empty string."
            });
        }

        if (!allowedWorkerStates.has(worker.status)) {
            errors.push({
                code: workerPoolErrorCodes.WORKER_POOL_INVALID_STATE,
                path: `workers.${id}.status`,
                message: `Invalid worker status: '${worker.status}'`
            });
        }

        if (worker.currentTask !== null && typeof worker.currentTask !== "string") {
            errors.push({
                code: workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT,
                path: `workers.${id}.currentTask`,
                message: "currentTask must be null or string."
            });
        }

        if (!Array.isArray(worker.completedTasks)) {
            errors.push({
                code: workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT,
                path: `workers.${id}.completedTasks`,
                message: "completedTasks must be an array."
            });
        } else if (!Object.isFrozen(worker.completedTasks)) {
            errors.push({
                code: workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT,
                path: `workers.${id}.completedTasks`,
                message: "completedTasks array must be frozen."
            });
        }
    }

    return {
        success: errors.length === 0,
        errors
    };
}

/**
 * Allocates an available worker to a task.
 *
 * @param {Object} pool The frozen worker pool
 * @param {Object} task The task object containing stableId or id
 */
function allocateWorker(pool, task) {
    let targetPool = pool;
    let targetTask = task;
    if (this && this.config && this.workers) {
        targetPool = this;
        targetTask = pool;
    }

    const poolVal = validateWorkerPool(targetPool);
    if (!poolVal.success) {
        const err = new Error(`Invalid pool state: ${poolVal.errors[0].message}`);
        err.code = poolVal.errors[0].code;
        throw err;
    }

    if (targetTask === null || targetTask === undefined || typeof targetTask !== "object") {
        const err = new Error("Task must be a non-null object.");
        err.code = workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT;
        throw err;
    }

    const taskId = targetTask.stableId || targetTask.id;
    if (typeof taskId !== "string" || !taskId.trim()) {
        const err = new Error("Task must have a non-empty stableId or id string.");
        err.code = workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT;
        throw err;
    }

    // Get available workers
    const idleWorkers = Object.values(targetPool.workers).filter(w => w.status === "IDLE");
    if (idleWorkers.length === 0) {
        const err = new Error("No available (IDLE) workers in pool.");
        err.code = workerPoolErrorCodes.WORKER_POOL_NO_AVAILABLE_WORKERS;
        throw err;
    }

    // Sort available workers ascending by workerId for deterministic allocation
    idleWorkers.sort((a, b) => a.workerId.localeCompare(b.workerId));

    const selectedWorker = idleWorkers[0];
    const updatedWorker = deepFreeze({
        ...selectedWorker,
        status: "ALLOCATED",
        currentTask: taskId
    });

    const newWorkers = {
        ...targetPool.workers,
        [selectedWorker.workerId]: updatedWorker
    };

    const newPool = createWorkerPoolInternal(targetPool.config, newWorkers);
    return deepFreeze({
        success: true,
        pool: newPool,
        worker: updatedWorker
    });
}

/**
 * Releases a worker back to the IDLE state.
 *
 * @param {Object} pool The frozen worker pool
 * @param {String} workerId The ID of the worker to release
 */
function releaseWorker(pool, workerId) {
    let targetPool = pool;
    let targetId = workerId;
    if (this && this.config && this.workers) {
        targetPool = this;
        targetId = pool;
    }

    const poolVal = validateWorkerPool(targetPool);
    if (!poolVal.success) {
        const err = new Error(`Invalid pool state: ${poolVal.errors[0].message}`);
        err.code = poolVal.errors[0].code;
        throw err;
    }

    if (typeof targetId !== "string" || !targetId.trim()) {
        const err = new Error("Worker ID must be a non-empty string.");
        err.code = workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT;
        throw err;
    }

    const trimmedId = targetId.trim();
    if (!targetPool.workers.hasOwnProperty(trimmedId)) {
        const err = new Error(`Worker with ID '${trimmedId}' does not exist in pool.`);
        err.code = workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT;
        throw err;
    }

    const worker = targetPool.workers[trimmedId];
    
    // Create new completedTasks array if there was a currentTask
    const newCompleted = [...worker.completedTasks];
    if (worker.currentTask) {
        newCompleted.push(worker.currentTask);
    }

    const updatedWorker = deepFreeze({
        ...worker,
        status: "IDLE",
        currentTask: null,
        completedTasks: newCompleted
    });

    const newWorkers = {
        ...targetPool.workers,
        [trimmedId]: updatedWorker
    };

    const newPool = createWorkerPoolInternal(targetPool.config, newWorkers);
    return deepFreeze({
        success: true,
        pool: newPool,
        worker: updatedWorker
    });
}

/**
 * Returns all available (IDLE) workers.
 */
function getAvailableWorkers(pool) {
    let targetPool = pool;
    if (this && this.config && this.workers) {
        targetPool = this;
    }
    const poolVal = validateWorkerPool(targetPool);
    if (!poolVal.success) {
        const err = new Error(`Invalid pool state: ${poolVal.errors[0].message}`);
        err.code = poolVal.errors[0].code;
        throw err;
    }
    const idle = Object.values(targetPool.workers).filter(w => w.status === "IDLE");
    idle.sort((a, b) => a.workerId.localeCompare(b.workerId));
    return Object.freeze(idle);
}

/**
 * Returns all active workers (non-IDLE, typically ALLOCATED or RUNNING).
 */
function getActiveWorkers(pool) {
    let targetPool = pool;
    if (this && this.config && this.workers) {
        targetPool = this;
    }
    const poolVal = validateWorkerPool(targetPool);
    if (!poolVal.success) {
        const err = new Error(`Invalid pool state: ${poolVal.errors[0].message}`);
        err.code = poolVal.errors[0].code;
        throw err;
    }
    const active = Object.values(targetPool.workers).filter(w => w.status !== "IDLE");
    active.sort((a, b) => a.workerId.localeCompare(b.workerId));
    return Object.freeze(active);
}

/**
 * Internal helper to instantiate the frozen pool structure.
 */
function createWorkerPoolInternal(config, workers) {
    const pool = {
        config: Object.freeze(config),
        workers: Object.freeze(workers),
        allocateWorker(task) {
            return allocateWorker(this, task);
        },
        releaseWorker(workerId) {
            return releaseWorker(this, workerId);
        },
        getAvailableWorkers() {
            return getAvailableWorkers(this);
        },
        getActiveWorkers() {
            return getActiveWorkers(this);
        }
    };
    return Object.freeze(pool);
}

/**
 * Public factory function to instantiate a worker pool.
 *
 * @param {Object} config Config containing maxConcurrentWorkers and optional custom workers list
 */
function createWorkerPool(config) {
    if (config === null || config === undefined || typeof config !== "object") {
        const err = new Error("Config must be a non-null object.");
        err.code = workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT;
        throw err;
    }

    const maxConcurrentWorkers = config.maxConcurrentWorkers;
    if (typeof maxConcurrentWorkers !== "number" || !Number.isInteger(maxConcurrentWorkers) || maxConcurrentWorkers < 0) {
        const err = new Error("maxConcurrentWorkers must be a non-negative integer.");
        err.code = workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT;
        throw err;
    }

    const workers = {};
    if (Array.isArray(config.workers)) {
        for (const w of config.workers) {
            if (w === null || typeof w !== "object") {
                const err = new Error("Custom worker must be an object.");
                err.code = workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT;
                throw err;
            }
            if (workers[w.workerId]) {
                const err = new Error(`Duplicate worker ID: '${w.workerId}'`);
                err.code = workerPoolErrorCodes.WORKER_POOL_DUPLICATE_WORKER;
                throw err;
            }
            workers[w.workerId] = deepFreeze({
                workerId: w.workerId,
                status: w.status || "IDLE",
                currentTask: w.currentTask || null,
                completedTasks: Array.isArray(w.completedTasks) ? [...w.completedTasks] : [],
                metadata: w.metadata || { version: "1.0", createdBy: "ExecutionOrchestrator" }
            });
        }
    } else {
        for (let i = 1; i <= maxConcurrentWorkers; i++) {
            const wId = `worker-${i}`;
            const wRes = createWorker(wId);
            if (!wRes.success) {
                const err = new Error("Failed to create default worker.");
                err.code = workerPoolErrorCodes.WORKER_POOL_INVALID_INPUT;
                throw err;
            }
            workers[wId] = wRes.worker;
        }
    }

    const pool = createWorkerPoolInternal(config, workers);
    const val = validateWorkerPool(pool);
    if (!val.success) {
        const err = new Error(`Invalid worker pool structure: ${val.errors[0].message}`);
        err.code = val.errors[0].code;
        throw err;
    }
    return pool;
}

module.exports = {
    createWorkerPool,
    allocateWorker,
    releaseWorker,
    getAvailableWorkers,
    getActiveWorkers,
    validateWorkerPool,
    workerPoolErrorCodes,
    WORKER_POOL_VERSION
};
