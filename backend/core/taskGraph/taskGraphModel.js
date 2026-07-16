"use strict";

const { taskGraphErrorCodes } = require("./taskGraphErrors");

const TASK_GRAPH_MODEL_VERSION = "1.0";

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

/**
 * Validates requirements input structure for task nodes.
 */
function validateRequirementsInput(requirements) {
    const errors = [];
    const seenStableIds = new Set();

    for (let i = 0; i < requirements.length; i++) {
        const req = requirements[i];
        const path = `requirements[${i}]`;

        if (req === null || typeof req !== "object") {
            errors.push({
                code: taskGraphErrorCodes.TASK_GRAPH_INVALID_REQUIREMENT,
                path,
                message: "Requirement must be a non-null object."
            });
            continue;
        }

        const requiredFields = ["stableId", "displayId", "kind", "semanticKey", "payload"];
        let missingField = false;

        for (const field of requiredFields) {
            if (!req.hasOwnProperty(field)) {
                errors.push({
                    code: taskGraphErrorCodes.TASK_GRAPH_INVALID_REQUIREMENT,
                    path: `${path}.${field}`,
                    message: `Requirement is missing required field: '${field}'`
                });
                missingField = true;
            }
        }

        if (missingField) continue;

        if (seenStableIds.has(req.stableId)) {
            errors.push({
                code: taskGraphErrorCodes.TASK_GRAPH_DUPLICATE_NODE,
                path: path,
                message: `Duplicate requirement stableId detected: '${req.stableId}'`
            });
        } else {
            seenStableIds.add(req.stableId);
        }
    }

    return errors;
}

/**
 * Creates a deterministic, empty TaskGraph structure from canonical requirement identities.
 * 
 * @param {Array} requirements Array of canonical requirement descriptors
 */
function createTaskGraph(requirements) {
    try {
        if (!Array.isArray(requirements)) {
            return deepFreeze({
                success: false,
                graph: null,
                errors: [{
                    code: taskGraphErrorCodes.TASK_GRAPH_INVALID_INPUT,
                    path: "",
                    message: "Input requirements must be an array."
                }]
            });
        }

        // 1. Validate requirement elements
        const validationErrors = validateRequirementsInput(requirements);
        if (validationErrors.length > 0) {
            return deepFreeze({
                success: false,
                graph: null,
                errors: validationErrors
            });
        }

        // 2. Map requirements to task nodes
        const nodes = requirements.map(req => {
            // Deep clone payload to ensure no shared references
            const clonedPayload = JSON.parse(JSON.stringify(req.payload));

            const metadata = {
                graphVersion: TASK_GRAPH_MODEL_VERSION,
                identityVersion: "1.0",
                createdBy: "task-graph"
            };

            return {
                stableId: req.stableId,
                displayId: req.displayId,
                kind: req.kind,
                semanticKey: req.semanticKey,
                status: "PENDING",
                dependencies: [],
                metadata,
                payload: clonedPayload
            };
        });

        const graphMetadata = {
            graphVersion: TASK_GRAPH_MODEL_VERSION,
            identityVersion: "1.0",
            createdBy: "task-graph",
            totalNodes: requirements.length
        };

        const result = {
            success: true,
            graph: {
                graphVersion: TASK_GRAPH_MODEL_VERSION,
                nodes,
                metadata: graphMetadata
            },
            errors: []
        };

        return deepFreeze(result);

    } catch (err) {
        return deepFreeze({
            success: false,
            graph: null,
            errors: [{
                code: taskGraphErrorCodes.TASK_GRAPH_INTERNAL_ERROR,
                path: "",
                message: `Internal error constructing TaskGraph: ${err.message}`
            }]
        });
    }
}

module.exports = {
    createTaskGraph,
    TASK_GRAPH_MODEL_VERSION
};
