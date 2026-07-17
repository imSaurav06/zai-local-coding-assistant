"use strict";

const { validateWorker } = require("./workerValidator");
const { createWorker } = require("./workerModel");
const { workerErrorCodes } = require("./workerErrors");

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
 * Creates an immutable, deeply frozen WorkerRegistry instance.
 *
 * @param {Array} workers List of validated frozen worker objects to populate
 */
function createWorkerRegistry(workers = []) {
    const registryWorkers = {};
    for (const w of workers) {
        const validation = validateWorker(w);
        if (!validation.success) {
            throw new Error("All registry workers must be valid frozen worker objects.");
        }
        if (registryWorkers[w.workerId]) {
            throw new Error(`Duplicate worker ID detected in registry initialization: ${w.workerId}`);
        }
        registryWorkers[w.workerId] = w;
    }

    const registry = {
        workers: Object.freeze(registryWorkers),

        /**
         * Pure creation method. Validates inputs, checks for duplicates in the registry.
         * Returns a new frozen registry copy with the newly created worker, without mutating anything.
         *
         * @param {String} workerId ID of the worker to construct and register
         */
        create(workerId) {
            if (
                workerId === null ||
                workerId === undefined ||
                typeof workerId !== "string" ||
                !workerId.trim()
            ) {
                return deepFreeze({
                    success: false,
                    registry: null,
                    errors: [{
                        code: workerErrorCodes.WORKER_INVALID_INPUT,
                        path: "workerId",
                        message: "workerId must be a non-empty string."
                    }]
                });
            }

            const trimmedId = workerId.trim();
            if (this.workers.hasOwnProperty(trimmedId)) {
                return deepFreeze({
                    success: false,
                    registry: null,
                    errors: [{
                        code: workerErrorCodes.WORKER_DUPLICATE_ID,
                        path: "workerId",
                        message: `Worker with ID '${trimmedId}' already exists in the registry.`
                    }]
                });
            }

            const workerResult = createWorker(trimmedId);
            if (!workerResult.success) {
                return deepFreeze({
                    success: false,
                    registry: null,
                    errors: workerResult.errors
                });
            }

            const newWorkers = {
                ...this.workers,
                [trimmedId]: workerResult.worker
            };

            return deepFreeze({
                success: true,
                registry: createWorkerRegistry(Object.values(newWorkers)),
                errors: []
            });
        },

        /**
         * Look up a registered worker object by ID.
         *
         * @param {String} workerId The ID to look up
         */
        lookup(workerId) {
            if (workerId === null || workerId === undefined) return null;
            const trimmed = String(workerId).trim();
            return this.workers[trimmed] || null;
        },

        /**
         * Checks if a worker exists in the registry.
         *
         * @param {String} workerId The ID to search
         */
        exists(workerId) {
            if (workerId === null || workerId === undefined) return false;
            const trimmed = String(workerId).trim();
            return this.workers.hasOwnProperty(trimmed);
        }
    };

    return Object.freeze(registry);
}

module.exports = {
    createWorkerRegistry
};
