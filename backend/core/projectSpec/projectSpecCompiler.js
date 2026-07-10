const { validateProjectSpec } = require("./projectSpecValidator");
const { errorCodes: validatorErrorCodes, createError } = require("./projectSpecErrors");
const { REQUIRED_TOP_LEVEL_FIELDS, NESTED_FIELDS, SCHEMA_VERSION } = require("./projectSpecSchema");

const compilerErrorCodes = {
    INVALID_INPUT: "COMPILE_ERROR_INVALID_INPUT",
    UNKNOWN_FIELD: "COMPILE_ERROR_UNKNOWN_FIELD",
    CIRCULAR_REFERENCE: "COMPILE_ERROR_CIRCULAR_REFERENCE",
    SPARSE_ARRAY: "COMPILE_ERROR_SPARSE_ARRAY",
    INVALID_TYPE: "COMPILE_ERROR_INVALID_TYPE",
    INVALID_VALUE: "COMPILE_ERROR_INVALID_VALUE"
};

const isPlainObject = (val) => {
    if (val === null || typeof val !== "object" || Array.isArray(val)) return false;
    const proto = Object.getPrototypeOf(val);
    return proto === Object.prototype || proto === null;
};

const checkCircular = (val, seen = new Set()) => {
    if (val === null || typeof val !== "object") return false;
    if (seen.has(val)) return true;
    seen.add(val);
    for (const key of Object.keys(val)) {
        try {
            if (checkCircular(val[key], seen)) return true;
        } catch (e) {
            // Getter throwing or other safe access bypass
        }
    }
    seen.delete(val);
    return false;
};

const ALLOWED_LEGACY_FIELDS = [
    "projectName",
    "projectType",
    "frontend",
    "backend",
    "database",
    "authentication",
    "designRequirements",
    "pagesAndRoutes",
    "components",
    "backendApis",
    "databaseModels",
    "integrations",
    "importantDependencies",
    "environmentVariables",
    "architectureConstraints",
    "runBuildRequirements",
    "deploymentRequirements",
    "assumptions",
    "schemaVersion"
];

const compileProjectSpec = (legacyPayload) => {
    try {
        if (!isPlainObject(legacyPayload)) {
            return {
                success: false,
                value: null,
                errors: [
                    createError(compilerErrorCodes.INVALID_INPUT, "", "Legacy payload must be a plain object", "type")
                ]
            };
        }

        // Touch schemaVersion if present to trigger getters
        try {
            if (Object.prototype.hasOwnProperty.call(legacyPayload, "schemaVersion")) {
                const dummy = legacyPayload.schemaVersion;
            }
        } catch (err) {
            return {
                success: false,
                value: null,
                errors: [
                    createError(compilerErrorCodes.INVALID_VALUE, "schemaVersion", `Exception during compilation: ${err.message}`, "custom")
                ]
            };
        }

        if (checkCircular(legacyPayload)) {
            return {
                success: false,
                value: null,
                errors: [
                    createError(compilerErrorCodes.CIRCULAR_REFERENCE, "", "Circular reference detected in input", "custom")
                ]
            };
        }

        const errors = [];

        // Check for unknown top-level fields
        for (const key of Object.keys(legacyPayload)) {
            if (!ALLOWED_LEGACY_FIELDS.includes(key)) {
                errors.push(createError(compilerErrorCodes.UNKNOWN_FIELD, key, `Unknown top-level field '${key}' in legacy payload`, "additionalProperties"));
            }
        }

        const candidate = {
            schemaVersion: SCHEMA_VERSION
        };

        const normalizeStringField = (fieldName, defaultValue, canonicalizeNone = false) => {
            if (!Object.prototype.hasOwnProperty.call(legacyPayload, fieldName) || legacyPayload[fieldName] === undefined || legacyPayload[fieldName] === null) {
                candidate[fieldName] = defaultValue;
                return;
            }
            const val = legacyPayload[fieldName];
            if (typeof val !== "string") {
                errors.push(createError(compilerErrorCodes.INVALID_TYPE, fieldName, `Field '${fieldName}' must be a string`, "type"));
                return;
            }
            const trimmed = val.trim();
            if (canonicalizeNone && trimmed.toLowerCase() === "none") {
                candidate[fieldName] = "None";
            } else if (trimmed.length === 0) {
                candidate[fieldName] = defaultValue;
            } else {
                candidate[fieldName] = trimmed;
            }
        };

        // Normalize string fields
        normalizeStringField("projectName", "MyProject", false);
        normalizeStringField("projectType", "Web Application", true);
        normalizeStringField("frontend", "None", true);
        normalizeStringField("backend", "None", true);
        normalizeStringField("database", "None", true);
        normalizeStringField("authentication", "None", true);
        normalizeStringField("designRequirements", "None", true);
        normalizeStringField("deploymentRequirements", "None", true);

        // Normalize runBuildRequirements
        if (!Object.prototype.hasOwnProperty.call(legacyPayload, "runBuildRequirements") ||
            legacyPayload.runBuildRequirements === undefined ||
            legacyPayload.runBuildRequirements === null) {
            candidate.runBuildRequirements = { runScript: "npm run dev", buildScript: "" };
        } else {
            const rbr = legacyPayload.runBuildRequirements;
            if (!isPlainObject(rbr)) {
                errors.push(createError(compilerErrorCodes.INVALID_TYPE, "runBuildRequirements", "Property 'runBuildRequirements' must be a plain object", "type"));
            } else {
                const normRbr = {};
                for (const key of Object.keys(rbr)) {
                    if (key !== "runScript" && key !== "buildScript") {
                        errors.push(createError(compilerErrorCodes.UNKNOWN_FIELD, `runBuildRequirements.${key}`, `Unknown property '${key}' in runBuildRequirements`, "additionalProperties"));
                    }
                }
                
                if (!Object.prototype.hasOwnProperty.call(rbr, "runScript") || rbr.runScript === undefined || rbr.runScript === null) {
                    normRbr.runScript = "npm run dev";
                } else if (typeof rbr.runScript === "string") {
                    const trimmed = rbr.runScript.trim();
                    if (trimmed.length === 0) {
                        normRbr.runScript = "npm run dev";
                    } else {
                        normRbr.runScript = trimmed;
                    }
                } else {
                    normRbr.runScript = rbr.runScript;
                }

                if (!Object.prototype.hasOwnProperty.call(rbr, "buildScript") || rbr.buildScript === undefined || rbr.buildScript === null) {
                    normRbr.buildScript = "";
                } else if (typeof rbr.buildScript === "string") {
                    normRbr.buildScript = rbr.buildScript.trim();
                } else {
                    normRbr.buildScript = rbr.buildScript;
                }

                candidate.runBuildRequirements = normRbr;
            }
        }

        const normalizeStringArrayField = (fieldName) => {
            if (!Object.prototype.hasOwnProperty.call(legacyPayload, fieldName) || legacyPayload[fieldName] === undefined || legacyPayload[fieldName] === null) {
                candidate[fieldName] = [];
                return;
            }
            const arr = legacyPayload[fieldName];
            if (!Array.isArray(arr)) {
                errors.push(createError(compilerErrorCodes.INVALID_TYPE, fieldName, `Property '${fieldName}' must be an array`, "type"));
                return;
            }
            const normArr = [];
            for (let i = 0; i < arr.length; i++) {
                if (!(i in arr)) {
                    errors.push(createError(compilerErrorCodes.SPARSE_ARRAY, `${fieldName}[${i}]`, `Array '${fieldName}' cannot contain sparse elements`, "type"));
                    continue;
                }
                const item = arr[i];
                if (typeof item === "string") {
                    normArr.push(item.trim());
                } else {
                    normArr.push(item);
                }
            }
            candidate[fieldName] = normArr;
        };

        // Normalize string arrays
        normalizeStringArrayField("integrations");
        normalizeStringArrayField("importantDependencies");
        normalizeStringArrayField("environmentVariables");
        normalizeStringArrayField("architectureConstraints");
        normalizeStringArrayField("assumptions");

        // Custom field normalizers for nested arrays
        const backendApisNormalizer = {
            method: (val) => {
                if (typeof val === "string") {
                    return val.trim().toUpperCase();
                }
                return val;
            }
        };

        const databaseModelsNormalizer = {
            fields: (val, path) => {
                if (val === undefined || val === null) return [];
                if (!Array.isArray(val)) return val;
                const normFields = [];
                for (let idx = 0; idx < val.length; idx++) {
                    if (!(idx in val)) {
                        errors.push(createError(compilerErrorCodes.SPARSE_ARRAY, `${path}[${idx}]`, `Array 'fields' cannot contain sparse elements`, "type"));
                        continue;
                    }
                    const f = val[idx];
                    if (typeof f === "string") {
                        normFields.push(f.trim());
                    } else {
                        normFields.push(f);
                    }
                }
                return normFields;
            }
        };

        const normalizeNestedArrayField = (fieldName, expectedKeys, customFieldNormalizer = null) => {
            if (!Object.prototype.hasOwnProperty.call(legacyPayload, fieldName) || legacyPayload[fieldName] === undefined || legacyPayload[fieldName] === null) {
                candidate[fieldName] = [];
                return;
            }
            const arr = legacyPayload[fieldName];
            if (!Array.isArray(arr)) {
                errors.push(createError(compilerErrorCodes.INVALID_TYPE, fieldName, `Property '${fieldName}' must be an array`, "type"));
                return;
            }
            const normArr = [];
            for (let i = 0; i < arr.length; i++) {
                if (!(i in arr)) {
                    errors.push(createError(compilerErrorCodes.SPARSE_ARRAY, `${fieldName}[${i}]`, `Array '${fieldName}' cannot contain sparse elements`, "type"));
                    continue;
                }
                const item = arr[i];
                if (!isPlainObject(item)) {
                    normArr.push(item);
                    continue;
                }
                
                const normItem = {};
                for (const key of Object.keys(item)) {
                    if (!expectedKeys.includes(key)) {
                        errors.push(createError(compilerErrorCodes.UNKNOWN_FIELD, `${fieldName}[${i}].${key}`, `Unknown property '${key}' in ${fieldName}`, "additionalProperties"));
                    }
                }

                expectedKeys.forEach(key => {
                    if (Object.prototype.hasOwnProperty.call(item, key)) {
                        if (customFieldNormalizer && customFieldNormalizer[key]) {
                            normItem[key] = customFieldNormalizer[key](item[key], `${fieldName}[${i}].${key}`);
                        } else {
                            const val = item[key];
                            if (typeof val === "string") {
                                normItem[key] = val.trim();
                            } else {
                                normItem[key] = val;
                            }
                        }
                    }
                });

                normArr.push(normItem);
            }
            candidate[fieldName] = normArr;
        };

        // Normalize nested object arrays
        normalizeNestedArrayField("pagesAndRoutes", NESTED_FIELDS.pagesAndRoutes);
        normalizeNestedArrayField("components", NESTED_FIELDS.components);
        normalizeNestedArrayField("backendApis", NESTED_FIELDS.backendApis, backendApisNormalizer);
        normalizeNestedArrayField("databaseModels", NESTED_FIELDS.databaseModels, databaseModelsNormalizer);

        if (errors.length > 0) {
            errors.sort((a, b) => {
                const pathCompare = a.path.localeCompare(b.path);
                if (pathCompare !== 0) return pathCompare;
                return a.code.localeCompare(b.code);
            });
            return {
                success: false,
                value: null,
                errors
            };
        }

        return validateProjectSpec(candidate);
    } catch (err) {
        return {
            success: false,
            value: null,
            errors: [
                createError(compilerErrorCodes.INVALID_VALUE, "", `Exception during compilation: ${err.message}`, "custom")
            ]
        };
    }
};

module.exports = {
    compileProjectSpec,
    compilerErrorCodes
};
