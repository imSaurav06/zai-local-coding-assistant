"use strict";

const { workerErrorCodes } = require("./workerErrors");

const workerStatuses = Object.freeze({
    IDLE: "IDLE",
    ASSIGNED: "ASSIGNED",
    RUNNING: "RUNNING",
    FAILED: "FAILED",
    COMPLETED: "COMPLETED"
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
 * Pure, stateless, deterministic worker builder that returns a deeply frozen worker model.
 *
 * @param {String} workerId Non-empty worker identifier string
 */
function createWorker(workerId) {
    if (
        workerId === null ||
        workerId === undefined ||
        typeof workerId !== "string" ||
        !workerId.trim()
    ) {
        return deepFreeze({
            success: false,
            worker: null,
            errors: [{
                code: workerErrorCodes.WORKER_INVALID_INPUT,
                path: "workerId",
                message: "workerId must be a non-empty string."
            }]
        });
    }

    const worker = {
        workerId: workerId.trim(),
        status: workerStatuses.IDLE,
        currentTask: null,
        completedTasks: [],
        metadata: {
            createdBy: "ExecutionOrchestrator",
            version: "1.0"
        }
    };

    return deepFreeze({
        success: true,
        worker,
        errors: []
    });
}

module.exports = {
    createWorker,
    workerStatuses
};
