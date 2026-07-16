"use strict";

const { rtmErrorCodes } = require("./rtmErrors");

const ALLOWED_STATUSES = new Set(["UNTRACKED", "PLANNED", "GENERATED", "VERIFIED", "FAILED"]);

const ALLOWED_CATEGORIES = new Set([
    "UI", "ROUTE", "API", "DATABASE", "AUTH", "INTEGRATION", 
    "DEPLOYMENT", "ARCHITECTURE", "DESIGN", "BACKEND", "FRONTEND", "OTHER"
]);

const isPlainObject = (val) => {
    if (val === null || typeof val !== "object" || Array.isArray(val)) return false;
    const proto = Object.getPrototypeOf(val);
    return proto === Object.prototype || proto === null;
};

/**
 * Validates consistency of RTM structures, metadata schemas, and status bounds.
 * Does not check filesystem.
 * 
 * @param {Object} rtm RTM object candidate under validation
 */
function validateRTM(rtm) {
    try {
        const errors = [];

        // 1. Verify plain object and base structure
        if (!isPlainObject(rtm)) {
            return {
                success: false,
                errors: [{
                    code: rtmErrorCodes.RTM_INVALID_STRUCTURE,
                    path: "",
                    message: "RTM candidate must be a plain object."
                }]
            };
        }

        // Verify top-level structure fields
        if (!rtm.hasOwnProperty("success") || typeof rtm.success !== "boolean") {
            errors.push({
                code: rtmErrorCodes.RTM_INVALID_STRUCTURE,
                path: "success",
                message: "Property 'success' must be a boolean."
            });
        }

        if (!rtm.hasOwnProperty("rtmVersion") || rtm.rtmVersion !== "1.0") {
            errors.push({
                code: rtmErrorCodes.RTM_INVALID_STRUCTURE,
                path: "rtmVersion",
                message: "Property 'rtmVersion' must be string '1.0'."
            });
        }

        if (!rtm.hasOwnProperty("entries") || !Array.isArray(rtm.entries)) {
            errors.push({
                code: rtmErrorCodes.RTM_INVALID_STRUCTURE,
                path: "entries",
                message: "Property 'entries' must be an array."
            });
        }

        if (!rtm.hasOwnProperty("metadata") || !isPlainObject(rtm.metadata)) {
            errors.push({
                code: rtmErrorCodes.RTM_INVALID_STRUCTURE,
                path: "metadata",
                message: "Property 'metadata' must be a plain object."
            });
        }

        if (!rtm.hasOwnProperty("errors") || !Array.isArray(rtm.errors)) {
            errors.push({
                code: rtmErrorCodes.RTM_INVALID_STRUCTURE,
                path: "errors",
                message: "Property 'errors' must be an array."
            });
        }

        if (errors.length > 0) {
            return { success: false, errors };
        }

        // 2. Validate Root Metadata Structure
        const meta = rtm.metadata;
        const requiredMetaFields = ["identityVersion", "classificationVersion", "createdBy", "modelVersion", "totalRequirementsCount"];
        for (const field of requiredMetaFields) {
            if (!meta.hasOwnProperty(field)) {
                errors.push({
                    code: rtmErrorCodes.RTM_INVALID_STRUCTURE,
                    path: `metadata.${field}`,
                    message: `Root metadata is missing required property: '${field}'`
                });
            }
        }

        if (meta.hasOwnProperty("identityVersion") && typeof meta.identityVersion !== "string") {
            errors.push({
                code: rtmErrorCodes.RTM_INVALID_STRUCTURE,
                path: "metadata.identityVersion",
                message: "metadata.identityVersion must be a string."
            });
        }

        if (meta.hasOwnProperty("classificationVersion") && typeof meta.classificationVersion !== "string") {
            errors.push({
                code: rtmErrorCodes.RTM_INVALID_STRUCTURE,
                path: "metadata.classificationVersion",
                message: "metadata.classificationVersion must be a string."
            });
        }

        if (meta.hasOwnProperty("createdBy") && typeof meta.createdBy !== "string") {
            errors.push({
                code: rtmErrorCodes.RTM_INVALID_STRUCTURE,
                path: "metadata.createdBy",
                message: "metadata.createdBy must be a string."
            });
        }

        if (meta.hasOwnProperty("modelVersion") && meta.modelVersion !== "1.0") {
            errors.push({
                code: rtmErrorCodes.RTM_INVALID_STRUCTURE,
                path: "metadata.modelVersion",
                message: "metadata.modelVersion must be string '1.0'."
            });
        }

        if (meta.hasOwnProperty("totalRequirementsCount") && meta.totalRequirementsCount !== rtm.entries.length) {
            errors.push({
                code: rtmErrorCodes.RTM_INVALID_STRUCTURE,
                path: "metadata.totalRequirementsCount",
                message: `metadata.totalRequirementsCount (${meta.totalRequirementsCount}) does not match entries count (${rtm.entries.length}).`
            });
        }

        if (errors.length > 0) {
            return { success: false, errors };
        }

        // 3. Verify Frozen State / Deep Immutability
        if (!Object.isFrozen(rtm)) {
            errors.push({
                code: rtmErrorCodes.RTM_INVALID_STRUCTURE,
                path: "",
                message: "Root RTM structure must be frozen."
            });
        }

        if (!Object.isFrozen(rtm.entries)) {
            errors.push({
                code: rtmErrorCodes.RTM_INVALID_STRUCTURE,
                path: "entries",
                message: "Entries array must be frozen."
            });
        }

        if (errors.length > 0) {
            return { success: false, errors };
        }

        // 4. Validate Entries and Unique constraints
        const seenStableIds = new Set();
        const seenDisplayIds = new Set();
        const seenKeysByKind = new Map(); // kind -> Set of semanticKeys

        for (let i = 0; i < rtm.entries.length; i++) {
            const entry = rtm.entries[i];
            const pathPrefix = `entries[${i}]`;

            if (entry === null || typeof entry !== "object") {
                errors.push({
                    code: rtmErrorCodes.RTM_INVALID_ENTRY,
                    path: pathPrefix,
                    message: "Entry must be a non-null object."
                });
                continue;
            }

            // Verify entry is frozen
            if (!Object.isFrozen(entry)) {
                errors.push({
                    code: rtmErrorCodes.RTM_INVALID_STRUCTURE,
                    path: pathPrefix,
                    message: `Entry at index ${i} must be frozen.`
                });
            }

            // Check required fields
            const requiredFields = ["stableId", "displayId", "kind", "semanticKey", "primaryCategory", "secondaryTags", "status", "evidence", "metadata"];
            let missingField = false;
            for (const field of requiredFields) {
                if (!entry.hasOwnProperty(field)) {
                    errors.push({
                        code: rtmErrorCodes.RTM_INVALID_ENTRY,
                        path: `${pathPrefix}.${field}`,
                        message: `Entry is missing required property: '${field}'`
                    });
                    missingField = true;
                }
            }

            if (missingField) continue;

            // stableId duplicate check
            if (seenStableIds.has(entry.stableId)) {
                errors.push({
                    code: rtmErrorCodes.RTM_DUPLICATE_STABLE_ID,
                    path: `${pathPrefix}.stableId`,
                    message: `Duplicate stableId detected: '${entry.stableId}'`
                });
            } else {
                seenStableIds.add(entry.stableId);
            }

            // displayId format and duplicate check
            const expectedDisplayId = `REQ-${String(i + 1).padStart(3, "0")}`;
            if (entry.displayId !== expectedDisplayId) {
                errors.push({
                    code: rtmErrorCodes.RTM_INVALID_ENTRY,
                    path: `${pathPrefix}.displayId`,
                    message: `displayId at index ${i} must be strictly sequential (expected '${expectedDisplayId}', got '${entry.displayId}').`
                });
            }

            if (seenDisplayIds.has(entry.displayId)) {
                errors.push({
                    code: rtmErrorCodes.RTM_DUPLICATE_DISPLAY_ID,
                    path: `${pathPrefix}.displayId`,
                    message: `Duplicate displayId detected: '${entry.displayId}'`
                });
            } else {
                seenDisplayIds.add(entry.displayId);
            }

            // duplicate semanticKey within same kind checking
            if (!seenKeysByKind.has(entry.kind)) {
                seenKeysByKind.set(entry.kind, new Set());
            }
            const keysSet = seenKeysByKind.get(entry.kind);
            if (keysSet.has(entry.semanticKey)) {
                errors.push({
                    code: rtmErrorCodes.RTM_INVALID_ENTRY,
                    path: `${pathPrefix}.semanticKey`,
                    message: `Duplicate semanticKey '${entry.semanticKey}' within kind '${entry.kind}' detected.`
                });
            } else {
                keysSet.add(entry.semanticKey);
            }

            // Validate status
            if (!ALLOWED_STATUSES.has(entry.status)) {
                errors.push({
                    code: rtmErrorCodes.RTM_INVALID_STATUS,
                    path: `${pathPrefix}.status`,
                    message: `Unsupported status value: '${entry.status}'`
                });
            }

            // Validate primaryCategory
            if (!ALLOWED_CATEGORIES.has(entry.primaryCategory)) {
                errors.push({
                    code: rtmErrorCodes.RTM_INVALID_CATEGORY,
                    path: `${pathPrefix}.primaryCategory`,
                    message: `Unsupported primaryCategory: '${entry.primaryCategory}'`
                });
            }

            // Validate secondaryTags
            if (!Array.isArray(entry.secondaryTags)) {
                errors.push({
                    code: rtmErrorCodes.RTM_INVALID_TAGS,
                    path: `${pathPrefix}.secondaryTags`,
                    message: "secondaryTags must be an array."
                });
            } else {
                if (!Object.isFrozen(entry.secondaryTags)) {
                    errors.push({
                        code: rtmErrorCodes.RTM_INVALID_STRUCTURE,
                        path: `${pathPrefix}.secondaryTags`,
                        message: "secondaryTags array must be frozen."
                    });
                }

                const seenTags = new Set();
                let isSorted = true;
                for (let t = 0; t < entry.secondaryTags.length; t++) {
                    const tag = entry.secondaryTags[t];
                    const tagPath = `${pathPrefix}.secondaryTags[${t}]`;

                    if (typeof tag !== "string") {
                        errors.push({
                            code: rtmErrorCodes.RTM_INVALID_TAGS,
                            path: tagPath,
                            message: "Tag element must be a string."
                        });
                        continue;
                    }

                    if (tag !== tag.toUpperCase()) {
                        errors.push({
                            code: rtmErrorCodes.RTM_INVALID_TAGS,
                            path: tagPath,
                            message: `Tag element must be uppercase (got '${tag}').`
                        });
                    }

                    if (seenTags.has(tag)) {
                        errors.push({
                            code: rtmErrorCodes.RTM_INVALID_TAGS,
                            path: tagPath,
                            message: `Duplicate tag element detected: '${tag}'`
                        });
                    } else {
                        seenTags.add(tag);
                    }

                    if (t > 0 && entry.secondaryTags[t] < entry.secondaryTags[t - 1]) {
                        isSorted = false;
                    }
                }

                if (!isSorted) {
                    errors.push({
                        code: rtmErrorCodes.RTM_INVALID_TAGS,
                        path: `${pathPrefix}.secondaryTags`,
                        message: "secondaryTags array must be sorted alphabetically."
                    });
                }
            }

            // Validate evidence
            if (!isPlainObject(entry.evidence)) {
                errors.push({
                    code: rtmErrorCodes.RTM_INVALID_ENTRY,
                    path: `${pathPrefix}.evidence`,
                    message: "evidence must be a plain object."
                });
            } else {
                if (!Object.isFrozen(entry.evidence)) {
                    errors.push({
                        code: rtmErrorCodes.RTM_INVALID_STRUCTURE,
                        path: `${pathPrefix}.evidence`,
                        message: "evidence object must be frozen."
                    });
                }

                const evidenceFields = ["generatedFiles", "generatedApis", "generatedRoutes", "generatedComponents", "notes"];
                for (const field of evidenceFields) {
                    if (!entry.evidence.hasOwnProperty(field) || !Array.isArray(entry.evidence[field])) {
                        errors.push({
                            code: rtmErrorCodes.RTM_INVALID_ENTRY,
                            path: `${pathPrefix}.evidence.${field}`,
                            message: `evidence.${field} must be an array.`
                        });
                    } else {
                        if (!Object.isFrozen(entry.evidence[field])) {
                            errors.push({
                                code: rtmErrorCodes.RTM_INVALID_STRUCTURE,
                                path: `${pathPrefix}.evidence.${field}`,
                                message: `evidence.${field} array must be frozen.`
                            });
                        }

                        entry.evidence[field].forEach((val, idx) => {
                            if (typeof val !== "string") {
                                errors.push({
                                    code: rtmErrorCodes.RTM_INVALID_ENTRY,
                                    path: `${pathPrefix}.evidence.${field}[${idx}]`,
                                    message: "Evidence item must be a string."
                                });
                            }
                        });
                    }
                }
            }

            // Validate entry metadata
            if (!isPlainObject(entry.metadata)) {
                errors.push({
                    code: rtmErrorCodes.RTM_INVALID_ENTRY,
                    path: `${pathPrefix}.metadata`,
                    message: "metadata must be a plain object."
                });
            } else {
                if (!Object.isFrozen(entry.metadata)) {
                    errors.push({
                        code: rtmErrorCodes.RTM_INVALID_STRUCTURE,
                        path: `${pathPrefix}.metadata`,
                        message: "metadata object must be frozen."
                    });
                }

                const requiredEntryMeta = ["identityVersion", "classificationVersion", "createdBy", "modelVersion"];
                for (const field of requiredEntryMeta) {
                    if (!entry.metadata.hasOwnProperty(field) || typeof entry.metadata[field] !== "string") {
                        errors.push({
                            code: rtmErrorCodes.RTM_INVALID_ENTRY,
                            path: `${pathPrefix}.metadata.${field}`,
                            message: `metadata.${field} must be a string.`
                        });
                    }
                }
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
                code: rtmErrorCodes.RTM_INTERNAL_ERROR,
                path: "",
                message: `Internal validation exception: ${err.message}`
            }]
        };
    }
}

module.exports = {
    validateRTM
};
