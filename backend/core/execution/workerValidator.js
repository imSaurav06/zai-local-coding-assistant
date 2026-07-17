"use strict";

const { workerErrorCodes } = require("./workerErrors");
const { workerStatuses } = require("./workerModel");

/**
 * Validates a worker object structure, types, status enum, and immutability.
 * Returns a deeply frozen result object containing success and structured errors.
 *
 * @param {Object} worker The worker object to validate
 */
function validateWorker(worker) {
    const errors = [];

    // Helper to deeply freeze the final validator return object
    const deepFreeze = (obj) => {
        if (obj === null || typeof obj !== "object") return obj;
        Object.freeze(obj);
        Object.getOwnPropertyNames(obj).forEach(prop => {
            if (obj.hasOwnProperty(prop) && obj[prop] !== null && typeof obj[prop] === "object" && !Object.isFrozen(obj[prop])) {
                deepFreeze(obj[prop]);
            }
        });
        return obj;
    };

    // 1. Basic Type Validation
    if (worker === null || worker === undefined || typeof worker !== "object" || Array.isArray(worker)) {
        return deepFreeze({
            success: false,
            errors: [{
                code: workerErrorCodes.WORKER_INVALID_INPUT,
                path: "",
                message: "Worker must be a non-null object."
            }]
        });
    }

    // 2. Immutability validation (root must be frozen)
    if (!Object.isFrozen(worker)) {
        errors.push({
            code: workerErrorCodes.WORKER_MUTABLE_INPUT,
            path: "",
            message: "Worker object root must be frozen."
        });
    }

    // 3. Required Fields presence check
    const requiredFields = ["workerId", "status", "currentTask", "completedTasks", "metadata"];
    for (const field of requiredFields) {
        if (!worker.hasOwnProperty(field)) {
            errors.push({
                code: workerErrorCodes.WORKER_INVALID_INPUT,
                path: field,
                message: `Worker is missing required field: '${field}'`
            });
        }
    }

    if (errors.length > 0) {
        return deepFreeze({ success: false, errors });
    }

    // 4. Detailed type/value schema verification
    if (typeof worker.workerId !== "string" || !worker.workerId.trim()) {
        errors.push({
            code: workerErrorCodes.WORKER_INVALID_INPUT,
            path: "workerId",
            message: "workerId must be a non-empty string."
        });
    }

    const validStatuses = Object.values(workerStatuses);
    if (!validStatuses.includes(worker.status)) {
        errors.push({
            code: workerErrorCodes.WORKER_INVALID_STATUS,
            path: "status",
            message: `Invalid worker status: '${worker.status}'`
        });
    }

    if (worker.currentTask !== null && typeof worker.currentTask !== "string") {
        errors.push({
            code: workerErrorCodes.WORKER_INVALID_INPUT,
            path: "currentTask",
            message: "currentTask must be null or a string task ID."
        });
    }

    if (!Array.isArray(worker.completedTasks)) {
        errors.push({
            code: workerErrorCodes.WORKER_INVALID_INPUT,
            path: "completedTasks",
            message: "completedTasks must be an array."
        });
    } else {
        if (!Object.isFrozen(worker.completedTasks)) {
            errors.push({
                code: workerErrorCodes.WORKER_MUTABLE_INPUT,
                path: "completedTasks",
                message: "completedTasks array must be frozen."
            });
        }
        for (let i = 0; i < worker.completedTasks.length; i++) {
            if (typeof worker.completedTasks[i] !== "string" || !worker.completedTasks[i].trim()) {
                errors.push({
                    code: workerErrorCodes.WORKER_INVALID_INPUT,
                    path: `completedTasks[${i}]`,
                    message: "Each completed task ID must be a non-empty string."
                });
            }
        }
    }

    if (worker.metadata === null || typeof worker.metadata !== "object" || Array.isArray(worker.metadata)) {
        errors.push({
            code: workerErrorCodes.WORKER_INVALID_INPUT,
            path: "metadata",
            message: "metadata must be a non-null object."
        });
    } else {
        if (!Object.isFrozen(worker.metadata)) {
            errors.push({
                code: workerErrorCodes.WORKER_MUTABLE_INPUT,
                path: "metadata",
                message: "metadata object must be frozen."
            });
        }
    }

    return deepFreeze({
        success: errors.length === 0,
        errors
    });
}

module.exports = {
    validateWorker
};
