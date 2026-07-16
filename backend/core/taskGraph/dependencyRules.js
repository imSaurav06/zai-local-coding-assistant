"use strict";

const { taskGraphErrorCodes } = require("./taskGraphErrors");

const taskGraphDependencyVersion = "1.0";

// Define the conceptual kind dependencies
const DEPENDENCY_RULES = {
    architectureConstraint: [],
    designRequirement: ["architectureConstraint"],
    designRequirements: ["architectureConstraint"],
    database: ["architectureConstraint"],
    databaseModel: ["database", "architectureConstraint"],
    authentication: ["database", "databaseModel", "architectureConstraint"],
    backend: ["database", "architectureConstraint"],
    backendApi: ["backend", "authentication", "databaseModel", "architectureConstraint"],
    frontend: ["backend", "architectureConstraint"],
    pageRoute: ["frontend", "designRequirement", "designRequirements", "architectureConstraint"],
    component: ["pageRoute", "frontend", "designRequirement", "designRequirements", "architectureConstraint"],
    integration: ["backend", "databaseModel", "architectureConstraint"],
    deploymentRequirement: ["frontend", "backend", "database", "architectureConstraint"],
    deploymentRequirements: ["frontend", "backend", "database", "architectureConstraint"]
};

/**
 * Deep freezes an object recursively to ensure immutability.
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

// Pre-freeze the main rules object so getDependencyRules doesn't have to freeze it on every call.
const frozenDependencyRules = deepFreeze(JSON.parse(JSON.stringify(DEPENDENCY_RULES)));

/**
 * Returns the complete dependency rules object.
 * Output is deeply frozen.
 */
function getDependencyRules() {
    return frozenDependencyRules;
}

/**
 * Returns the allowed/expected dependencies for a specific requirement kind.
 * 
 * @param {String} kind The requirement kind to resolve
 */
function getDependenciesForKind(kind) {
    try {
        if (kind === null || kind === undefined || typeof kind !== "string") {
            const err = new Error("Invalid kind type: must be a string");
            err.code = taskGraphErrorCodes.TASK_GRAPH_INVALID_KIND;
            throw err;
        }

        const trimmedKind = kind.trim();
        if (trimmedKind.length === 0) {
            const err = new Error("Invalid kind: cannot be empty or whitespace-only");
            err.code = taskGraphErrorCodes.TASK_GRAPH_INVALID_KIND;
            throw err;
        }

        if (!frozenDependencyRules.hasOwnProperty(trimmedKind)) {
            const err = new Error(`Unknown requirement kind: '${trimmedKind}'`);
            err.code = taskGraphErrorCodes.TASK_GRAPH_UNKNOWN_KIND;
            throw err;
        }

        // Return the pre-frozen array mapped to the kind
        return frozenDependencyRules[trimmedKind];

    } catch (err) {
        if (err.code === taskGraphErrorCodes.TASK_GRAPH_INVALID_KIND || 
            err.code === taskGraphErrorCodes.TASK_GRAPH_UNKNOWN_KIND) {
            throw err;
        }
        const internalErr = new Error(`Internal error looking up dependency rules for kind: ${err.message}`);
        internalErr.code = taskGraphErrorCodes.TASK_GRAPH_INTERNAL_ERROR;
        throw internalErr;
    }
}

module.exports = {
    getDependencyRules,
    getDependenciesForKind,
    taskGraphDependencyVersion
};
