"use strict";

const { isRepairRequest } = require("./repairModel");
const { repairPlannerErrorCodes } = require("./repairPlannerErrors");

const REPAIR_PLANNER_VERSION = "1.0";

const CANONICAL_PLAN_FIELDS = new Set([
    "id",
    "repairId",
    "executionId",
    "taskId",
    "strategy",
    "priority",
    "steps",
    "estimatedComplexity",
    "metadata"
]);

const ALLOWED_PLAN_STRATEGIES = new Set([
    "AI",
    "DETERMINISTIC",
    "AST",
    "MANUAL"
]);

const ALLOWED_PLAN_PRIORITIES = new Set([
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL"
]);

const ALLOWED_STEP_TYPES = new Set([
    "ANALYZE",
    "GENERATE_PATCH",
    "VALIDATE_PATCH",
    "APPLY_PATCH",
    "VERIFY_RESULT"
]);

/**
 * Deep freezes a repair plan recursively to ensure immutability.
 *
 * @param {Object} obj The object to freeze
 */
function deepFreezeRepairPlan(obj) {
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
            deepFreezeRepairPlan(obj[prop]);
        }
    });
    return obj;
}

/**
 * Checks if the given object is an instantiated deeply frozen RepairPlan domain model.
 *
 * @param {Object} obj The object to inspect
 */
function isRepairPlan(obj) {
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
        return false;
    }
    if (!Object.isFrozen(obj)) {
        return false;
    }
    const val = validateRepairPlan(obj);
    return val.success;
}

/**
 * Validates a RepairPlan configuration object or model.
 *
 * @param {Object} plan The repair plan to validate
 */
function validateRepairPlan(plan) {
    if (plan === null || plan === undefined || typeof plan !== "object" || Array.isArray(plan)) {
        return {
            success: false,
            errors: [{
                code: repairPlannerErrorCodes.REPAIR_PLAN_INVALID_INPUT,
                path: "",
                message: "Repair plan must be a non-null object."
            }]
        };
    }

    const errors = [];

    // 1. Unknown properties checks
    for (const key of Object.keys(plan)) {
        if (!CANONICAL_PLAN_FIELDS.has(key)) {
            errors.push({
                code: repairPlannerErrorCodes.REPAIR_PLAN_UNKNOWN_PROPERTY,
                path: key,
                message: `Unknown property key: '${key}'`
            });
        }
    }

    // 2. Required properties check
    const required = ["id", "repairId", "executionId", "taskId", "strategy", "priority", "steps"];
    for (const req of required) {
        if (!plan.hasOwnProperty(req)) {
            errors.push({
                code: repairPlannerErrorCodes.REPAIR_PLAN_INVALID_STRUCTURE,
                path: req,
                message: `Property '${req}' is required.`
            });
        }
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    // 3. String values validation
    if (typeof plan.id !== "string" || plan.id.trim() === "") {
        errors.push({ code: repairPlannerErrorCodes.REPAIR_PLAN_INVALID_STRUCTURE, path: "id", message: "id must be non-empty string" });
    }
    if (typeof plan.repairId !== "string" || plan.repairId.trim() === "") {
        errors.push({ code: repairPlannerErrorCodes.REPAIR_PLAN_INVALID_STRUCTURE, path: "repairId", message: "repairId must be non-empty string" });
    }
    if (typeof plan.executionId !== "string" || plan.executionId.trim() === "") {
        errors.push({ code: repairPlannerErrorCodes.REPAIR_PLAN_INVALID_STRUCTURE, path: "executionId", message: "executionId must be non-empty string" });
    }
    if (typeof plan.taskId !== "string" || plan.taskId.trim() === "") {
        errors.push({ code: repairPlannerErrorCodes.REPAIR_PLAN_INVALID_STRUCTURE, path: "taskId", message: "taskId must be non-empty string" });
    }

    // 4. Validate strategy
    if (!ALLOWED_PLAN_STRATEGIES.has(plan.strategy)) {
        errors.push({
            code: repairPlannerErrorCodes.REPAIR_PLAN_INVALID_STRUCTURE,
            path: "strategy",
            message: `Property 'strategy' must be one of: ${Array.from(ALLOWED_PLAN_STRATEGIES).join(", ")}.`
        });
    }

    // 5. Validate priority
    if (!ALLOWED_PLAN_PRIORITIES.has(plan.priority)) {
        errors.push({
            code: repairPlannerErrorCodes.REPAIR_PLAN_INVALID_PRIORITY,
            path: "priority",
            message: `Property 'priority' must be one of: ${Array.from(ALLOWED_PLAN_PRIORITIES).join(", ")}.`
        });
    }

    // 6. Validate steps array
    if (!Array.isArray(plan.steps)) {
        errors.push({
            code: repairPlannerErrorCodes.REPAIR_PLAN_INVALID_STRUCTURE,
            path: "steps",
            message: "steps must be an array."
        });
    } else if (plan.steps.length === 0) {
        errors.push({
            code: repairPlannerErrorCodes.REPAIR_PLAN_INVALID_STEP,
            path: "steps",
            message: "steps array cannot be empty."
        });
    } else {
        const seenTypes = new Set();
        for (let i = 0; i < plan.steps.length; i++) {
            const step = plan.steps[i];
            if (step === null || typeof step !== "object" || Array.isArray(step)) {
                errors.push({
                    code: repairPlannerErrorCodes.REPAIR_PLAN_INVALID_STEP,
                    path: `steps[${i}]`,
                    message: "Step must be a non-null object."
                });
                continue;
            }

            if (!step.hasOwnProperty("type") || !ALLOWED_STEP_TYPES.has(step.type)) {
                errors.push({
                    code: repairPlannerErrorCodes.REPAIR_PLAN_INVALID_STEP,
                    path: `steps[${i}].type`,
                    message: `Step type must be one of: ${Array.from(ALLOWED_STEP_TYPES).join(", ")}.`
                });
            } else {
                if (seenTypes.has(step.type)) {
                    errors.push({
                        code: repairPlannerErrorCodes.REPAIR_PLAN_DUPLICATE_STEP,
                        path: `steps[${i}].type`,
                        message: `Duplicate step type found: '${step.type}'`
                    });
                } else {
                    seenTypes.add(step.type);
                }
            }
        }
    }

    return {
        success: errors.length === 0,
        errors
    };
}

/**
 * Transforms a RepairRequest domain model into a deeply frozen RepairPlan.
 *
 * @param {Object} repairRequest The validated RepairRequest object
 */
function createRepairPlan(repairRequest) {
    if (!repairRequest || !isRepairRequest(repairRequest)) {
        return {
            success: false,
            repairPlan: null,
            errors: [{
                code: repairPlannerErrorCodes.REPAIR_PLAN_INVALID_INPUT,
                path: "repairRequest",
                message: "Must provide a valid, instantiated RepairRequest object."
            }]
        };
    }

    // Strategy Selection Strategy
    let strategy = "DETERMINISTIC";
    if (repairRequest.type === "RUNTIME" || repairRequest.type === "VERIFICATION") {
        strategy = "AI";
    }

    // Default priority mapping
    let priority = "MEDIUM";
    if (ALLOWED_PLAN_PRIORITIES.has(repairRequest.severity)) {
        priority = repairRequest.severity;
    }

    // Canonical planning steps
    const steps = [
        { type: "ANALYZE" },
        { type: "GENERATE_PATCH" },
        { type: "VALIDATE_PATCH" },
        { type: "APPLY_PATCH" },
        { type: "VERIFY_RESULT" }
    ];

    const planConfig = {
        id: `plan_${repairRequest.id}`,
        repairId: repairRequest.id,
        executionId: repairRequest.executionId,
        taskId: repairRequest.taskId,
        strategy,
        priority,
        steps,
        estimatedComplexity: repairRequest.severity === "CRITICAL" || repairRequest.severity === "HIGH" ? "HIGH" : "MEDIUM",
        metadata: {}
    };

    const val = validateRepairPlan(planConfig);
    if (!val.success) {
        return {
            success: false,
            repairPlan: null,
            errors: val.errors
        };
    }

    return {
        success: true,
        repairPlan: deepFreezeRepairPlan(planConfig),
        errors: []
    };
}

module.exports = {
    createRepairPlan,
    validateRepairPlan,
    isRepairPlan,
    deepFreezeRepairPlan,
    repairPlannerErrorCodes,
    REPAIR_PLANNER_VERSION
};
