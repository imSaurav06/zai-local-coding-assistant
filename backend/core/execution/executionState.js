"use strict";

const { validateTaskGraph } = require("../taskGraph/taskGraphValidator");
const { executionErrorCodes } = require("./executionErrors");

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
 * Pure, synchronous, deterministic function that translates a validated
 * immutable TaskGraph into a canonical ExecutionState.
 *
 * @param {Object} taskGraph Validated, frozen TaskGraph object
 */
function createExecutionState(taskGraph) {
    try {
        // 1. Basic Type Validation
        if (
            taskGraph === null ||
            taskGraph === undefined ||
            typeof taskGraph !== "object" ||
            Array.isArray(taskGraph) ||
            typeof taskGraph === "function"
        ) {
            return deepFreeze({
                success: false,
                executionState: null,
                errors: [{
                    code: executionErrorCodes.EXECUTION_INVALID_INPUT,
                    path: "",
                    message: "Input taskGraph must be a non-null object."
                }]
            });
        }

        // 2. Immutability validation (reject mutable objects)
        if (!Object.isFrozen(taskGraph)) {
            return deepFreeze({
                success: false,
                executionState: null,
                errors: [{
                    code: executionErrorCodes.EXECUTION_MUTABLE_INPUT,
                    path: "",
                    message: "Input taskGraph must be a deeply frozen immutable object."
                }]
            });
        }

        // 3. Basic TaskGraph structure checking
        if (!taskGraph.hasOwnProperty("nodes") || !Array.isArray(taskGraph.nodes)) {
            return deepFreeze({
                success: false,
                executionState: null,
                errors: [{
                    code: executionErrorCodes.EXECUTION_INVALID_TASK_GRAPH,
                    path: "nodes",
                    message: "TaskGraph is malformed: missing nodes array."
                }]
            });
        }

        // Check node elements immutability
        if (!Object.isFrozen(taskGraph.nodes)) {
            return deepFreeze({
                success: false,
                executionState: null,
                errors: [{
                    code: executionErrorCodes.EXECUTION_MUTABLE_INPUT,
                    path: "nodes",
                    message: "TaskGraph nodes array must be frozen."
                }]
            });
        }

        // 4. Validate duplicate task IDs
        const seenStableIds = new Set();
        const seenDisplayIds = new Set();
        let duplicateFound = null;

        for (let i = 0; i < taskGraph.nodes.length; i++) {
            const node = taskGraph.nodes[i];
            if (node === null || typeof node !== "object") {
                return deepFreeze({
                    success: false,
                    executionState: null,
                    errors: [{
                        code: executionErrorCodes.EXECUTION_INVALID_TASK_GRAPH,
                        path: `nodes[${i}]`,
                        message: "TaskGraph contains an invalid or null node."
                    }]
                });
            }

            if (!node.hasOwnProperty("stableId") || !node.hasOwnProperty("displayId")) {
                return deepFreeze({
                    success: false,
                    executionState: null,
                    errors: [{
                        code: executionErrorCodes.EXECUTION_INVALID_TASK_GRAPH,
                        path: `nodes[${i}]`,
                        message: "TaskGraph node is missing stableId or displayId."
                    }]
                });
            }

            if (seenStableIds.has(node.stableId)) {
                duplicateFound = {
                    path: `nodes[${i}].stableId`,
                    message: `Duplicate task stableId detected: '${node.stableId}'`
                };
                break;
            }
            seenStableIds.add(node.stableId);

            if (seenDisplayIds.has(node.displayId)) {
                duplicateFound = {
                    path: `nodes[${i}].displayId`,
                    message: `Duplicate task displayId detected: '${node.displayId}'`
                };
                break;
            }
            seenDisplayIds.add(node.displayId);
        }

        if (duplicateFound) {
            return deepFreeze({
                success: false,
                executionState: null,
                errors: [{
                    code: executionErrorCodes.EXECUTION_DUPLICATE_TASK,
                    path: duplicateFound.path,
                    message: duplicateFound.message
                }]
            });
        }

        // 5. Delegate structural validation to validateTaskGraph
        const validationResult = validateTaskGraph(taskGraph);
        if (!validationResult.success) {
            const mappedErrors = (validationResult.errors || []).map(err => {
                let code = executionErrorCodes.EXECUTION_INVALID_TASK_GRAPH;
                if (err.code === "TASK_GRAPH_DUPLICATE_NODE") {
                    code = executionErrorCodes.EXECUTION_DUPLICATE_TASK;
                }
                return {
                    code,
                    path: err.path,
                    message: err.message
                };
            });
            return deepFreeze({
                success: false,
                executionState: null,
                errors: mappedErrors
            });
        }

        // 6. Build the execution state.
        // Sibling nodes are sorted ascendingly by displayId (e.g. REQ-001 < REQ-002) to guarantee complete determinism.
        const sortedStableIds = [...taskGraph.nodes]
            .sort((a, b) => a.displayId.localeCompare(b.displayId))
            .map(node => node.stableId);

        const totalTasks = taskGraph.nodes.length;

        const executionState = {
            version: "1.0",
            metadata: {
                status: "READY",
                executionId: null,
                createdAt: null
            },
            queues: {
                pending: sortedStableIds,
                running: [],
                completed: [],
                failed: []
            },
            statistics: {
                totalTasks,
                pending: totalTasks,
                running: 0,
                completed: 0,
                failed: 0
            }
        };

        return deepFreeze({
            success: true,
            executionState,
            errors: []
        });

    } catch (err) {
        return deepFreeze({
            success: false,
            executionState: null,
            errors: [{
                code: executionErrorCodes.EXECUTION_INVALID_TASK_GRAPH,
                path: "",
                message: `Unexpected internal error during createExecutionState: ${err.message}`
            }]
        });
    }
}

module.exports = {
    createExecutionState
};
