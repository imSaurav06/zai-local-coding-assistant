"use strict";

const crypto = require("crypto");
const { validateProjectSpec } = require("../projectSpec");
const { identityErrorCodes } = require("./requirementIdentityErrors");

const REQUIREMENT_IDENTITY_VERSION = "1.0";

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
 * Recursive deterministic JSON serialization.
 * Sorts object keys lexicographically using code-point sorting to ensure deterministic output
 * independent of object property insertion order.
 */
function canonicalStringify(val) {
    if (val === null) {
        return "null";
    }
    if (typeof val === "string") {
        return JSON.stringify(val);
    }
    if (typeof val === "number" || typeof val === "boolean") {
        return String(val);
    }
    if (Array.isArray(val)) {
        return "[" + val.map(item => canonicalStringify(item)).join(",") + "]";
    }
    if (typeof val === "object") {
        const keys = Object.keys(val).sort();
        const parts = keys.map(k => `${JSON.stringify(k)}:${canonicalStringify(val[k])}`);
        return "{" + parts.join(",") + "}";
    }
    throw new Error(`Unsupported type: ${typeof val}`);
}

/**
 * Serializes requirement payload into a canonical JSON string.
 */
function canonicalizePayload(kind, payload) {
    if (kind === "databaseModel") {
        // Clone and sort fields using deterministic code-point ordering (UTF-16) without deduplication
        const sortedFields = [...payload.fields].sort();
        const normalizedPayload = {
            name: payload.name,
            fields: sortedFields
        };
        return canonicalStringify(normalizedPayload);
    }
    return canonicalStringify(payload);
}

/**
 * Deterministically derives a semanticKey from the payload metadata.
 */
function deriveSemanticKey(kind, payload) {
    if (typeof payload === "string") {
        return payload;
    }
    if (kind === "pageRoute") {
        return payload.path;
    }
    if (kind === "component") {
        return payload.name;
    }
    if (kind === "backendApi") {
        return `${payload.method} ${payload.path}`;
    }
    if (kind === "databaseModel") {
        return payload.name;
    }
    throw new Error(`Unsupported requirement kind: ${kind}`);
}

/**
 * Derives requirement identities from a validated ProjectSpec.
 * Production API takes exactly one parameter.
 * 
 * @param {Object} projectSpec Validated ProjectSpec object
 */
function deriveRequirementIdentities(projectSpec) {
    return _deriveRequirementIdentitiesInternal(projectSpec);
}

/**
 * Internal helper exposing the hasher test seam.
 */
function _deriveRequirementIdentitiesInternal(projectSpec, hasher = null) {
    const activeHasher = hasher || ((data) => {
        return crypto.createHash("sha256").update(data).digest("hex");
    });

    try {
        // 1. Guard against non-objects at input boundary
        if (projectSpec === null || typeof projectSpec !== "object" || Array.isArray(projectSpec)) {
            return {
                success: false,
                requirements: [],
                duplicates: [],
                errors: [{
                    code: identityErrorCodes.REQUIREMENT_ID_INVALID_INPUT,
                    path: "",
                    message: "Input projectSpec must be a plain object.",
                    keyword: "projectSpec"
                }]
            };
        }

        // Pre-flight check for circular reference and throwing getters
        try {
            JSON.stringify(projectSpec);
        } catch (jsonErr) {
            return {
                success: false,
                requirements: [],
                duplicates: [],
                errors: [{
                    code: identityErrorCodes.REQUIREMENT_ID_INTERNAL_ERROR,
                    path: "",
                    message: `Internal error: ${jsonErr.message}`,
                    keyword: "internal"
                }]
            };
        }

        // 2. Revalidate using validateProjectSpec() at the public boundary
        const validationResult = validateProjectSpec(projectSpec);
        if (!validationResult.success) {
            const formattedErrors = (validationResult.errors || []).map(err => ({
                code: identityErrorCodes.REQUIREMENT_ID_VALIDATION_FAILED,
                path: err.path,
                message: `Validation failed: ${err.message}`,
                keyword: err.keyword || "validation"
            }));
            return {
                success: false,
                requirements: [],
                duplicates: [],
                errors: formattedErrors
            };
        }

        const spec = validationResult.value;
        const requirements = [];
        const duplicates = [];
        const stableIdMap = new Map();
        let displayCounter = 0;

        // Helper to extract a requirement
        function addRequirement(kind, sourcePath, payload) {
            try {
                if (payload && typeof payload === "object") {
                    JSON.stringify(payload);
                }
            } catch (e) {
                throw new Error(`Unsupported value encountered: ${e.message}`);
            }

            const canonicalPayload = canonicalizePayload(kind, payload);
            const hashInput = `${REQUIREMENT_IDENTITY_VERSION}:${kind}:${canonicalPayload}`;
            const digest = activeHasher(hashInput);
            const stableId = `req_v1_${digest}`;

            // Check for stableId collision
            if (stableIdMap.has(stableId)) {
                const stored = stableIdMap.get(stableId);
                if (stored.kind !== kind || stored.canonicalPayload !== canonicalPayload) {
                    // Hash collision!
                    const err = new Error(`Hash collision detected for stableId ${stableId}`);
                    err.code = identityErrorCodes.REQUIREMENT_ID_COLLISION;
                    err.path = sourcePath;
                    err.keyword = "stableId";
                    throw err;
                }

                // Duplicate semantic requirement occurrence metadata
                duplicates.push({
                    stableId,
                    displayId: stored.displayId,
                    canonicalSourcePath: stored.sourcePath,
                    duplicateSourcePath: sourcePath
                });
                return;
            }

            // Fresh requirement gets new contiguous displayId
            displayCounter++;
            const displayId = `REQ-${String(displayCounter).padStart(3, "0")}`;

            stableIdMap.set(stableId, { kind, canonicalPayload, displayId, sourcePath });
            requirements.push({
                stableId,
                displayId,
                kind,
                sourcePath,
                semanticKey: deriveSemanticKey(kind, payload),
                payload: JSON.parse(JSON.stringify(payload))
            });
        }

        // 3. Deterministic traversal and extraction using exact None sentinel matches
        const isNone = (val) => val === "None";

        // tech_frontend
        if (spec.frontend && !isNone(spec.frontend)) {
            addRequirement("frontend", "frontend", spec.frontend);
        }

        // tech_backend
        if (spec.backend && !isNone(spec.backend)) {
            addRequirement("backend", "backend", spec.backend);
        }

        // tech_database
        if (spec.database && !isNone(spec.database)) {
            addRequirement("database", "database", spec.database);
        }

        // tech_authentication
        if (spec.authentication && !isNone(spec.authentication)) {
            addRequirement("authentication", "authentication", spec.authentication);
        }

        // designRequirements
        if (spec.designRequirements && !isNone(spec.designRequirements)) {
            addRequirement("designRequirements", "designRequirements", spec.designRequirements);
        }

        // deploymentRequirement
        if (spec.deploymentRequirements && !isNone(spec.deploymentRequirements)) {
            addRequirement("deploymentRequirement", "deploymentRequirements", spec.deploymentRequirements);
        }

        // pagesAndRoutes
        if (Array.isArray(spec.pagesAndRoutes)) {
            spec.pagesAndRoutes.forEach((route, idx) => {
                addRequirement("pageRoute", `pagesAndRoutes[${idx}]`, route);
            });
        }

        // components
        if (Array.isArray(spec.components)) {
            spec.components.forEach((comp, idx) => {
                addRequirement("component", `components[${idx}]`, comp);
            });
        }

        // backendApis
        if (Array.isArray(spec.backendApis)) {
            spec.backendApis.forEach((api, idx) => {
                addRequirement("backendApi", `backendApis[${idx}]`, api);
            });
        }

        // databaseModels
        if (Array.isArray(spec.databaseModels)) {
            spec.databaseModels.forEach((model, idx) => {
                addRequirement("databaseModel", `databaseModels[${idx}]`, model);
            });
        }

        // integrations (None internal text remains requirement)
        if (Array.isArray(spec.integrations)) {
            spec.integrations.forEach((integration, idx) => {
                addRequirement("integration", `integrations[${idx}]`, integration);
            });
        }

        // architectureConstraints (None internal text remains requirement)
        if (Array.isArray(spec.architectureConstraints)) {
            spec.architectureConstraints.forEach((constraint, idx) => {
                addRequirement("architectureConstraint", `architectureConstraints[${idx}]`, constraint);
            });
        }

        const result = {
            success: true,
            requirements,
            duplicates,
            errors: []
        };

        // 4. Return deeply frozen isolated result
        return deepFreeze(result);

    } catch (err) {
        if (err.code === identityErrorCodes.REQUIREMENT_ID_COLLISION) {
            return {
                success: false,
                requirements: [],
                duplicates: [],
                errors: [{
                    code: err.code,
                    path: err.path,
                    message: "Hash collision detected in requirement stableId.",
                    keyword: err.keyword
                }]
            };
        }

        if (err.message && err.message.includes("Unsupported value")) {
            return {
                success: false,
                requirements: [],
                duplicates: [],
                errors: [{
                    code: identityErrorCodes.REQUIREMENT_ID_UNSUPPORTED_VALUE,
                    path: "",
                    message: "Unsupported value encountered in ProjectSpec.",
                    keyword: "value"
                }]
            };
        }

        // Catch-all internal errors
        return {
            success: false,
            requirements: [],
            duplicates: [],
            errors: [{
                code: identityErrorCodes.REQUIREMENT_ID_INTERNAL_ERROR,
                path: "",
                message: `Internal error: ${err.message}`,
                keyword: "internal"
            }]
        };
    }
}

module.exports = {
    deriveRequirementIdentities,
    _deriveRequirementIdentitiesInternal,
    REQUIREMENT_IDENTITY_VERSION
};
