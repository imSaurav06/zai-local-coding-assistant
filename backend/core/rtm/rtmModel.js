"use strict";

const { rtmErrorCodes } = require("./rtmErrors");
const { classifyRequirements } = require("../requirementsClassification");

const RTM_MODEL_VERSION = "1.0";

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
 * Validates requirements structural inputs for the RTM contract.
 */
function validateRequirementsInput(requirements) {
    const errors = [];
    const seenStableIds = new Set();

    for (let i = 0; i < requirements.length; i++) {
        const req = requirements[i];
        const path = `requirements[${i}]`;

        if (req === null || typeof req !== "object") {
            errors.push({
                code: rtmErrorCodes.RTM_INVALID_REQUIREMENT,
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
                    code: rtmErrorCodes.RTM_INVALID_REQUIREMENT,
                    path: `${path}.${field}`,
                    message: `Requirement is missing required field: '${field}'`
                });
                missingField = true;
            }
        }

        if (missingField) continue;

        if (seenStableIds.has(req.stableId)) {
            errors.push({
                code: rtmErrorCodes.RTM_DUPLICATE_REQUIREMENT,
                path,
                message: `Duplicate requirement stableId detected: '${req.stableId}'`
            });
        } else {
            seenStableIds.add(req.stableId);
        }
    }

    return errors;
}

/**
 * Creates a deterministic, empty RTM-Lite domain structure from canonical requirements.
 * 
 * @param {Array} requirements Array of canonical requirements
 */
function createRTM(requirements, precomputedClassifications = null) {
    try {
        if (!Array.isArray(requirements)) {
            return deepFreeze({
                success: false,
                rtmVersion: RTM_MODEL_VERSION,
                entries: [],
                metadata: {},
                errors: [{
                    code: rtmErrorCodes.RTM_INVALID_INPUT,
                    path: "",
                    message: "Input requirements must be an array."
                }]
            });
        }

        // 1. Validate requirement structures and duplicates
        const validationErrors = validateRequirementsInput(requirements);
        if (validationErrors.length > 0) {
            return deepFreeze({
                success: false,
                rtmVersion: RTM_MODEL_VERSION,
                entries: [],
                metadata: {},
                errors: validationErrors
            });
        }

        // 2. Classify requirements to get primaryCategory and secondaryTags
        let classifications = precomputedClassifications;
        if (!classifications) {
            const classificationRes = classifyRequirements(requirements);
            if (!classificationRes.success) {
                const mappedErrors = (classificationRes.errors || []).map(err => ({
                    code: rtmErrorCodes.RTM_INVALID_REQUIREMENT,
                    path: err.path,
                    message: `Classification failed: ${err.message}`
                }));
                return deepFreeze({
                    success: false,
                    rtmVersion: RTM_MODEL_VERSION,
                    entries: [],
                    metadata: {},
                    errors: mappedErrors
                });
            }
            classifications = classificationRes.classifications;
        }

        // 3. Assemble RTM entries
        const entries = requirements.map((req, idx) => {
            const classification = classifications[idx];

            const evidence = {
                generatedFiles: [],
                generatedApis: [],
                generatedRoutes: [],
                generatedComponents: [],
                notes: []
            };

            const metadata = {
                identityVersion: "1.0",
                classificationVersion: "1.0",
                createdBy: "rtm-lite",
                modelVersion: RTM_MODEL_VERSION
            };

            return {
                stableId: req.stableId,
                displayId: req.displayId,
                kind: req.kind,
                semanticKey: req.semanticKey,
                primaryCategory: classification.primaryCategory,
                secondaryTags: classification.secondaryTags,
                status: "UNTRACKED",
                evidence,
                metadata
            };
        });

        const rtmMetadata = {
            identityVersion: "1.0",
            classificationVersion: "1.0",
            createdBy: "rtm-lite",
            modelVersion: RTM_MODEL_VERSION,
            totalRequirementsCount: requirements.length
        };

        const result = {
            success: true,
            rtmVersion: RTM_MODEL_VERSION,
            entries,
            metadata: rtmMetadata,
            errors: []
        };

        return deepFreeze(result);

    } catch (err) {
        return deepFreeze({
            success: false,
            rtmVersion: RTM_MODEL_VERSION,
            entries: [],
            metadata: {},
            errors: [{
                code: rtmErrorCodes.RTM_INTERNAL_ERROR,
                path: "",
                message: `Internal error constructing RTM: ${err.message}`
            }]
        });
    }
}

module.exports = {
    createRTM,
    RTM_MODEL_VERSION
};
