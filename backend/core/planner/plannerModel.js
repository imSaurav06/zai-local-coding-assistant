"use strict";

const { plannerErrorCodes } = require("./plannerErrors");

const PLANNER_MODEL_VERSION = "1.0";

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
 * Creates a planner instance from a TaskGraph structure.
 * 
 * @param {Object} taskGraph The validated TaskGraph
 */
function createPlanner(taskGraph) {
    try {
        // 1. Validation of input structure
        if (taskGraph === null || taskGraph === undefined || typeof taskGraph !== "object") {
            return deepFreeze({
                success: false,
                planner: null,
                errors: [{
                    code: plannerErrorCodes.PLANNER_INVALID_INPUT,
                    path: "",
                    message: "TaskGraph input must be a non-null object."
                }]
            });
        }

        if (!taskGraph.hasOwnProperty("graphVersion") || typeof taskGraph.graphVersion !== "string") {
            return deepFreeze({
                success: false,
                planner: null,
                errors: [{
                    code: plannerErrorCodes.PLANNER_INVALID_GRAPH,
                    path: "graphVersion",
                    message: "TaskGraph graphVersion is missing or invalid."
                }]
            });
        }

        if (!taskGraph.hasOwnProperty("metadata") || taskGraph.metadata === null || typeof taskGraph.metadata !== "object") {
            return deepFreeze({
                success: false,
                planner: null,
                errors: [{
                    code: plannerErrorCodes.PLANNER_INVALID_GRAPH,
                    path: "metadata",
                    message: "TaskGraph metadata is missing or invalid."
                }]
            });
        }

        if (!taskGraph.hasOwnProperty("nodes") || !Array.isArray(taskGraph.nodes)) {
            return deepFreeze({
                success: false,
                planner: null,
                errors: [{
                    code: plannerErrorCodes.PLANNER_INVALID_GRAPH,
                    path: "nodes",
                    message: "TaskGraph nodes array is missing or invalid."
                }]
            });
        }

        const tasks = [];
        const seenStableIds = new Set();
        const seenDisplayIds = new Set();

        // 2. Validate and build each task from the graph nodes
        for (let i = 0; i < taskGraph.nodes.length; i++) {
            const node = taskGraph.nodes[i];
            const path = `nodes[${i}]`;

            if (node === null || typeof node !== "object") {
                return deepFreeze({
                    success: false,
                    planner: null,
                    errors: [{
                        code: plannerErrorCodes.PLANNER_INVALID_GRAPH,
                        path,
                        message: "Graph node must be a non-null object."
                    }]
                });
            }

            const requiredNodeFields = ["stableId", "displayId", "kind", "dependencies", "dependents", "metadata"];
            for (const field of requiredNodeFields) {
                if (!node.hasOwnProperty(field)) {
                    return deepFreeze({
                        success: false,
                        planner: null,
                        errors: [{
                            code: plannerErrorCodes.PLANNER_INVALID_GRAPH,
                            path: `${path}.${field}`,
                            message: `Node is missing required field: '${field}'`
                        }]
                    });
                }
            }

            if (!Array.isArray(node.dependencies)) {
                return deepFreeze({
                    success: false,
                    planner: null,
                    errors: [{
                        code: plannerErrorCodes.PLANNER_INVALID_GRAPH,
                        path: `${path}.dependencies`,
                        message: "Node dependencies must be an array."
                    }]
                });
            }

            if (!Array.isArray(node.dependents)) {
                return deepFreeze({
                    success: false,
                    planner: null,
                    errors: [{
                        code: plannerErrorCodes.PLANNER_INVALID_GRAPH,
                        path: `${path}.dependents`,
                        message: "Node dependents must be an array."
                    }]
                });
            }

            // Uniqueness validation
            if (seenStableIds.has(node.stableId)) {
                return deepFreeze({
                    success: false,
                    planner: null,
                    errors: [{
                        code: plannerErrorCodes.PLANNER_DUPLICATE_TASK,
                        path: `${path}.stableId`,
                        message: `Duplicate task stableId detected: '${node.stableId}'`
                    }]
                });
            }
            seenStableIds.add(node.stableId);

            if (seenDisplayIds.has(node.displayId)) {
                return deepFreeze({
                    success: false,
                    planner: null,
                    errors: [{
                        code: plannerErrorCodes.PLANNER_DUPLICATE_TASK,
                        path: `${path}.displayId`,
                        message: `Duplicate task displayId detected: '${node.displayId}'`
                    }]
                });
            }
            seenDisplayIds.add(node.displayId);

            // Construct new clean task object (no timestamps, deep clone references)
            const cleanDependencies = JSON.parse(JSON.stringify(node.dependencies));
            const cleanDependents = JSON.parse(JSON.stringify(node.dependents));
            const cleanMetadata = JSON.parse(JSON.stringify(node.metadata));

            tasks.push({
                stableId: node.stableId,
                displayId: node.displayId,
                kind: node.kind,
                status: "PENDING",
                dependencies: cleanDependencies,
                dependents: cleanDependents,
                ready: false,
                blocked: false,
                metadata: cleanMetadata
            });
        }

        // Return builder result object containing deeply frozen planner state
        return deepFreeze({
            success: true,
            planner: {
                version: PLANNER_MODEL_VERSION,
                metadata: {
                    plannerVersion: PLANNER_MODEL_VERSION,
                    graphVersion: taskGraph.graphVersion,
                    identityVersion: taskGraph.metadata.identityVersion || "1.0",
                    createdBy: "planner"
                },
                tasks
            },
            errors: []
        });

    } catch (err) {
        return deepFreeze({
            success: false,
            planner: null,
            errors: [{
                code: plannerErrorCodes.PLANNER_INTERNAL_ERROR,
                path: "",
                message: `Unexpected internal error during planner initialization: ${err.message}`
            }]
        });
    }
}

module.exports = {
    createPlanner,
    PLANNER_MODEL_VERSION
};
