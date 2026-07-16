"use strict";

const { taskGraphErrorCodes } = require("./taskGraphErrors");

/**
 * Validates a pre-built TaskGraph structure.
 * 
 * @param {Object} graph The deeply frozen graph to validate
 */
function validateTaskGraph(graph) {
    try {
        const errors = [];

        // 1. Root structure validation
        if (graph === null || typeof graph !== "object") {
            return {
                success: false,
                errors: [{
                    code: taskGraphErrorCodes.TASK_GRAPH_INVALID_GRAPH,
                    path: "",
                    message: "Graph must be a non-null object."
                }]
            };
        }

        if (!graph.hasOwnProperty("graphVersion") || typeof graph.graphVersion !== "string") {
            errors.push({
                code: taskGraphErrorCodes.TASK_GRAPH_INVALID_GRAPH,
                path: "graphVersion",
                message: "Missing or invalid 'graphVersion' property."
            });
        }

        if (!graph.hasOwnProperty("metadata") || graph.metadata === null || typeof graph.metadata !== "object") {
            errors.push({
                code: taskGraphErrorCodes.TASK_GRAPH_INVALID_GRAPH,
                path: "metadata",
                message: "Missing or invalid 'metadata' object."
            });
        }

        if (!graph.hasOwnProperty("nodes") || !Array.isArray(graph.nodes)) {
            return {
                success: false,
                errors: [{
                    code: taskGraphErrorCodes.TASK_GRAPH_INVALID_GRAPH,
                    path: "nodes",
                    message: "Missing or invalid 'nodes' array."
                }]
            };
        }

        // 2. Immutability checks
        if (!Object.isFrozen(graph)) {
            errors.push({
                code: taskGraphErrorCodes.TASK_GRAPH_INVALID_GRAPH,
                path: "",
                message: "Graph root must be frozen."
            });
        }
        if (!Object.isFrozen(graph.nodes)) {
            errors.push({
                code: taskGraphErrorCodes.TASK_GRAPH_INVALID_GRAPH,
                path: "nodes",
                message: "Graph nodes array must be frozen."
            });
        }

        // Map nodes by stableId for fast lookups
        const nodesMap = new Map();
        const seenDisplayIds = new Set();

        // 3. Node-level structural validations
        for (let i = 0; i < graph.nodes.length; i++) {
            const node = graph.nodes[i];
            const path = `nodes[${i}]`;

            if (node === null || typeof node !== "object") {
                errors.push({
                    code: taskGraphErrorCodes.TASK_GRAPH_INVALID_NODE,
                    path,
                    message: "Node must be a non-null object."
                });
                continue;
            }

            if (!Object.isFrozen(node)) {
                errors.push({
                    code: taskGraphErrorCodes.TASK_GRAPH_INVALID_NODE,
                    path,
                    message: "Node must be frozen."
                });
            }

            const requiredFields = ["stableId", "displayId", "kind", "semanticKey", "status", "dependencies", "dependents", "metadata", "payload"];
            let missingField = false;

            for (const field of requiredFields) {
                if (!node.hasOwnProperty(field)) {
                    errors.push({
                        code: taskGraphErrorCodes.TASK_GRAPH_INVALID_NODE,
                        path: `${path}.${field}`,
                        message: `Node is missing required field: '${field}'`
                    });
                    missingField = true;
                }
            }

            if (missingField) continue;

            if (!Array.isArray(node.dependencies)) {
                errors.push({
                    code: taskGraphErrorCodes.TASK_GRAPH_INVALID_NODE,
                    path: `${path}.dependencies`,
                    message: "Dependencies must be an array."
                });
                continue;
            }
            if (!Object.isFrozen(node.dependencies)) {
                errors.push({
                    code: taskGraphErrorCodes.TASK_GRAPH_INVALID_NODE,
                    path: `${path}.dependencies`,
                    message: "Node dependencies array must be frozen."
                });
            }

            if (!Array.isArray(node.dependents)) {
                errors.push({
                    code: taskGraphErrorCodes.TASK_GRAPH_INVALID_NODE,
                    path: `${path}.dependents`,
                    message: "Dependents must be an array."
                });
                continue;
            }
            if (!Object.isFrozen(node.dependents)) {
                errors.push({
                    code: taskGraphErrorCodes.TASK_GRAPH_INVALID_NODE,
                    path: `${path}.dependents`,
                    message: "Node dependents array must be frozen."
                });
            }

            // Uniqueness validation
            if (nodesMap.has(node.stableId)) {
                errors.push({
                    code: taskGraphErrorCodes.TASK_GRAPH_DUPLICATE_NODE,
                    path: `${path}.stableId`,
                    message: `Duplicate node stableId detected: '${node.stableId}'`
                });
            } else {
                nodesMap.set(node.stableId, node);
            }

            if (seenDisplayIds.has(node.displayId)) {
                errors.push({
                    code: taskGraphErrorCodes.TASK_GRAPH_DUPLICATE_NODE,
                    path: `${path}.displayId`,
                    message: `Duplicate node displayId detected: '${node.displayId}'`
                });
            } else {
                seenDisplayIds.add(node.displayId);
            }
        }

        // Return early if there are node-level definition errors before parsing edge relationships
        if (errors.length > 0) {
            return { success: false, errors };
        }

        // 4. Edge Reference, Symmetry, and Self-Dependency Checks
        for (const [stableId, node] of nodesMap) {
            const path = `nodes[stableId:${stableId}]`;

            // Check self dependencies
            if (node.dependencies.includes(stableId)) {
                errors.push({
                    code: taskGraphErrorCodes.TASK_GRAPH_SELF_DEPENDENCY,
                    path: `${path}.dependencies`,
                    message: `Node '${stableId}' depends on itself.`
                });
            }
            if (node.dependents.includes(stableId)) {
                errors.push({
                    code: taskGraphErrorCodes.TASK_GRAPH_SELF_DEPENDENCY,
                    path: `${path}.dependents`,
                    message: `Node '${stableId}' lists itself as a dependent.`
                });
            }

            // Duplicate edges validation within the node's local array lists
            const seenDeps = new Set();
            for (const depId of node.dependencies) {
                if (seenDeps.has(depId)) {
                    errors.push({
                        code: taskGraphErrorCodes.TASK_GRAPH_INVALID_NODE,
                        path: `${path}.dependencies`,
                        message: `Node '${stableId}' has duplicate dependency edge for '${depId}'.`
                    });
                }
                seenDeps.add(depId);
            }

            const seenDependents = new Set();
            for (const childId of node.dependents) {
                if (seenDependents.has(childId)) {
                    errors.push({
                        code: taskGraphErrorCodes.TASK_GRAPH_INVALID_NODE,
                        path: `${path}.dependents`,
                        message: `Node '${stableId}' has duplicate dependent edge for '${childId}'.`
                    });
                }
                seenDependents.add(childId);
            }

            // Broken references and symmetry check
            for (const depId of node.dependencies) {
                if (!nodesMap.has(depId)) {
                    errors.push({
                        code: taskGraphErrorCodes.TASK_GRAPH_BROKEN_REFERENCE,
                        path: `${path}.dependencies`,
                        message: `Node '${stableId}' depends on non-existent node '${depId}'.`
                    });
                } else {
                    const prerequisiteNode = nodesMap.get(depId);
                    if (!prerequisiteNode.dependents.includes(stableId)) {
                        errors.push({
                            code: taskGraphErrorCodes.TASK_GRAPH_ASYMMETRIC_EDGE,
                            path: `${path}.dependencies`,
                            message: `Edge asymmetry: '${stableId}' depends on '${depId}', but '${depId}' does not list '${stableId}' as a dependent.`
                        });
                    }
                }
            }

            for (const childId of node.dependents) {
                if (!nodesMap.has(childId)) {
                    errors.push({
                        code: taskGraphErrorCodes.TASK_GRAPH_BROKEN_REFERENCE,
                        path: `${path}.dependents`,
                        message: `Node '${stableId}' lists non-existent node '${childId}' as a dependent.`
                    });
                } else {
                    const childNode = nodesMap.get(childId);
                    if (!childNode.dependencies.includes(stableId)) {
                        errors.push({
                            code: taskGraphErrorCodes.TASK_GRAPH_ASYMMETRIC_EDGE,
                            path: `${path}.dependents`,
                            message: `Edge asymmetry: '${stableId}' has dependent '${childId}', but '${childId}' does not list '${stableId}' as a dependency.`
                        });
                    }
                }
            }
        }

        // Return early if structural or reference errors exist before traversing the graph for cycles
        if (errors.length > 0) {
            return { success: false, errors };
        }

        // 5. Deterministic Cycle Detection (DFS)
        const visited = new Set();
        const visiting = new Set();

        function dfs(nodeId) {
            visiting.add(nodeId);

            const node = nodesMap.get(nodeId);
            for (const depId of node.dependencies) {
                if (visiting.has(depId)) {
                    errors.push({
                        code: taskGraphErrorCodes.TASK_GRAPH_CYCLE,
                        path: `nodes[stableId:${nodeId}]`,
                        message: `Cyclic dependency detected: '${nodeId}' depends on '${depId}' during traversal.`
                    });
                    return false;
                }
                if (!visited.has(depId)) {
                    if (!dfs(depId)) {
                        return false;
                    }
                }
            }

            visiting.delete(nodeId);
            visited.add(nodeId);
            return true;
        }

        // Run cycle detection starting from each node to cover disconnected components
        const sortedNodeIds = Array.from(nodesMap.keys()).sort();
        for (const nodeId of sortedNodeIds) {
            if (!visited.has(nodeId)) {
                dfs(nodeId);
            }
        }

        if (errors.length > 0) {
            return { success: false, errors };
        }

        return {
            success: true,
            errors: []
        };

    } catch (err) {
        return {
            success: false,
            errors: [{
                code: taskGraphErrorCodes.TASK_GRAPH_INTERNAL_ERROR,
                path: "",
                message: `Internal error validating TaskGraph: ${err.message}`
            }]
        };
    }
}

module.exports = {
    validateTaskGraph
};
