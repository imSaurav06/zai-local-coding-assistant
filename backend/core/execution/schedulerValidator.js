"use strict";

const { schedulerErrorCodes } = require("./schedulerErrors");

/**
 * Validates the structure and properties of a scheduling decision (Schedule).
 * Returns a deeply frozen result object containing success and errors array.
 *
 * @param {Object} schedule The schedule decision object to validate
 */
function validateSchedule(schedule) {
    const errors = [];
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
    if (schedule === null || schedule === undefined || typeof schedule !== "object" || Array.isArray(schedule)) {
        return deepFreeze({
            success: false,
            errors: [{
                code: schedulerErrorCodes.SCHEDULER_INVALID_INPUT,
                path: "",
                message: "Schedule must be a non-null object."
            }]
        });
    }

    // 2. Required Fields check
    const requiredFields = ["readyTasks", "assignments", "blockedTasks", "metadata"];
    for (const field of requiredFields) {
        if (!schedule.hasOwnProperty(field)) {
            errors.push({
                code: schedulerErrorCodes.SCHEDULER_INVALID_INPUT,
                path: field,
                message: `Schedule is missing required field: '${field}'`
            });
        }
    }

    if (errors.length > 0) {
        return deepFreeze({ success: false, errors });
    }

    // 3. Array fields check
    if (!Array.isArray(schedule.readyTasks)) {
        errors.push({
            code: schedulerErrorCodes.SCHEDULER_INVALID_INPUT,
            path: "readyTasks",
            message: "readyTasks must be an array."
        });
    }

    if (!Array.isArray(schedule.blockedTasks)) {
        errors.push({
            code: schedulerErrorCodes.SCHEDULER_INVALID_INPUT,
            path: "blockedTasks",
            message: "blockedTasks must be an array."
        });
    }

    if (!Array.isArray(schedule.assignments)) {
        errors.push({
            code: schedulerErrorCodes.SCHEDULER_INVALID_INPUT,
            path: "assignments",
            message: "assignments must be an array."
        });
    } else {
        for (let i = 0; i < schedule.assignments.length; i++) {
            const assign = schedule.assignments[i];
            if (assign === null || typeof assign !== "object" || Array.isArray(assign)) {
                errors.push({
                    code: schedulerErrorCodes.SCHEDULER_INVALID_INPUT,
                    path: `assignments[${i}]`,
                    message: "Assignment must be a non-null object."
                });
            } else {
                if (typeof assign.workerId !== "string" || !assign.workerId.trim()) {
                    errors.push({
                        code: schedulerErrorCodes.SCHEDULER_INVALID_INPUT,
                        path: `assignments[${i}].workerId`,
                        message: "Assignment workerId must be a non-empty string."
                    });
                }
                if (typeof assign.taskId !== "string" || !assign.taskId.trim()) {
                    errors.push({
                        code: schedulerErrorCodes.SCHEDULER_INVALID_INPUT,
                        path: `assignments[${i}].taskId`,
                        message: "Assignment taskId must be a non-empty string."
                    });
                }
            }
        }
    }

    // 4. Metadata check
    if (schedule.metadata === null || typeof schedule.metadata !== "object" || Array.isArray(schedule.metadata)) {
        errors.push({
            code: schedulerErrorCodes.SCHEDULER_INVALID_INPUT,
            path: "metadata",
            message: "metadata must be a non-null object."
        });
    } else {
        const metadataFields = ["availableWorkers", "blockedCount", "readyCount"];
        for (const f of metadataFields) {
            if (!schedule.metadata.hasOwnProperty(f) || typeof schedule.metadata[f] !== "number") {
                errors.push({
                    code: schedulerErrorCodes.SCHEDULER_INVALID_INPUT,
                    path: `metadata.${f}`,
                    message: `metadata.${f} must be a number.`
                });
            }
        }
    }

    // 5. Immutability check
    if (!Object.isFrozen(schedule)) {
        errors.push({
            code: schedulerErrorCodes.SCHEDULER_INVALID_INPUT,
            path: "",
            message: "Schedule object root must be frozen."
        });
    }

    return deepFreeze({
        success: errors.length === 0,
        errors
    });
}

module.exports = {
    validateSchedule
};
