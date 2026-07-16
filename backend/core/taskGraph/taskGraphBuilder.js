"use strict";

const { createTaskGraph } = require("./taskGraphModel");
const { getDependenciesForKind } = require("./dependencyRules");
const { taskGraphErrorCodes } = require("./taskGraphErrors");

/**
 * Deep freezes an object recursively.
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
 * Builds the canonical TaskGraph (DAG) with resolved dependency and dependent edges.
 * 
 * @param {Array} requirements List of requirement identities
 */
function buildTaskGraph(requirements) {
    try {
        // 1. Initialize baseline nodes and validate structure using model
        const baseResult = createTaskGraph(requirements);
        if (!baseResult.success) {
            return deepFreeze({
                success: false,
                graph: null,
                errors: baseResult.errors.map(err => ({
                    code: err.code === taskGraphErrorCodes.TASK_GRAPH_INVALID_REQUIREMENT 
                        ? taskGraphErrorCodes.TASK_GRAPH_INVALID_REQUIREMENT
                        : taskGraphErrorCodes.TASK_GRAPH_BUILD_FAILED,
                    path: err.path,
                    message: err.message
                }))
            });
        }

        // Deep clone the graph to prepare for edge population
        const graph = JSON.parse(JSON.stringify(baseResult.graph));

        // Initialize dependents arrays for all nodes
        graph.nodes.forEach(node => {
            node.dependents = [];
            node.dependencies = [];
        });

        // 2. Resolve dependency and dependent edges using the rules engine
        for (const node of graph.nodes) {
            let allowedKinds;
            try {
                allowedKinds = getDependenciesForKind(node.kind);
            } catch (err) {
                // If rules engine throws, wrap it
                return deepFreeze({
                    success: false,
                    graph: null,
                    errors: [{
                        code: taskGraphErrorCodes.TASK_GRAPH_BUILD_FAILED,
                        path: `nodes[kind:${node.kind}]`,
                        message: `Failed resolving dependency rules: ${err.message}`
                    }]
                });
            }

            // Find matching prerequisite nodes
            for (const prerequisiteNode of graph.nodes) {
                if (prerequisiteNode.stableId === node.stableId) {
                    continue;
                }

                if (allowedKinds.includes(prerequisiteNode.kind)) {
                    // Node N depends on prerequisiteNode
                    if (!node.dependencies.includes(prerequisiteNode.stableId)) {
                        node.dependencies.push(prerequisiteNode.stableId);
                    }
                    // prerequisiteNode is depended on by Node N (dependent)
                    if (!prerequisiteNode.dependents.includes(node.stableId)) {
                        prerequisiteNode.dependents.push(node.stableId);
                    }
                }
            }
        }

        // Sort dependencies and dependents to guarantee complete output determinism
        graph.nodes.forEach(node => {
            node.dependencies.sort();
            node.dependents.sort();
        });

        return deepFreeze({
            success: true,
            graph,
            errors: []
        });

    } catch (err) {
        return deepFreeze({
            success: false,
            graph: null,
            errors: [{
                code: taskGraphErrorCodes.TASK_GRAPH_INTERNAL_ERROR,
                path: "",
                message: `Internal error building TaskGraph DAG: ${err.message}`
            }]
        });
    }
}

module.exports = {
    buildTaskGraph
};
