"use strict";

const { validateRepairRequest } = require("./repairValidator");
const { repairErrorCodes } = require("./repairErrors");

const REPAIR_MODEL_VERSION = "1.0";

/**
 * Deep freezes a repair request object recursively to guarantee strict immutability.
 *
 * @param {Object} obj The object to freeze
 */
function deepFreezeRepairRequest(obj) {
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
            deepFreezeRepairRequest(obj[prop]);
        }
    });
    return obj;
}

/**
 * Checks if the given object is an instantiated deeply frozen RepairRequest domain model.
 *
 * @param {Object} obj The object to inspect
 */
function isRepairRequest(obj) {
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
        return false;
    }
    if (!Object.isFrozen(obj)) {
        return false;
    }
    const val = validateRepairRequest(obj);
    return val.success;
}

/**
 * Pure function to construct a deeply frozen, validated RepairRequest domain model.
 *
 * @param {Object} config The repair request config input
 */
function createRepairRequest(config) {
    if (config === null || config === undefined || typeof config !== "object" || Array.isArray(config)) {
        return {
            success: false,
            repairRequest: null,
            errors: [{
                code: repairErrorCodes.REPAIR_INVALID_INPUT,
                path: "",
                message: "Input configuration must be a non-null object."
            }]
        };
    }

    // Deep clone to prevent any input mutations or reference sharing
    const cloned = JSON.parse(JSON.stringify(config));

    const val = validateRepairRequest(cloned);
    if (!val.success) {
        return {
            success: false,
            repairRequest: null,
            errors: val.errors
        };
    }

    // Freeze and return
    const repairRequest = deepFreezeRepairRequest(cloned);

    return {
        success: true,
        repairRequest,
        errors: []
    };
}

module.exports = {
    createRepairRequest,
    isRepairRequest,
    deepFreezeRepairRequest,
    REPAIR_MODEL_VERSION
};
