const {
    SCHEMA_VERSION,
    REQUIRED_TOP_LEVEL_FIELDS,
    NESTED_FIELDS,
    ALLOWED_HTTP_METHODS
} = require("./projectSpecSchema");
const { errorCodes, createError } = require("./projectSpecErrors");

const isPlainObject = (val) => {
    if (val === null || typeof val !== "object" || Array.isArray(val)) return false;
    const proto = Object.getPrototypeOf(val);
    return proto === Object.prototype || proto === null;
};

const isValidPath = (path) => {
    if (typeof path !== "string") return false;
    if (!path.startsWith("/")) return false;
    if (/\s/.test(path)) return false;
    if (path.includes("//")) return false;
    if (path.includes("?") || path.includes("#")) return false;
    if (path !== "/" && path.endsWith("/")) return false;
    return true;
};

const validateProjectSpec = (candidate) => {
    try {
        const errors = [];

        // 1. Candidate must be a plain object
        if (!isPlainObject(candidate)) {
            errors.push(createError(errorCodes.INVALID_TYPE, "", "ProjectSpec candidate must be a plain object", "type"));
            return { success: false, value: null, errors };
        }

        // 2. Validate schemaVersion
        if (!Object.prototype.hasOwnProperty.call(candidate, "schemaVersion")) {
            errors.push(createError(errorCodes.MISSING_VERSION, "schemaVersion", "Missing required property 'schemaVersion'", "required"));
        } else if (candidate.schemaVersion !== SCHEMA_VERSION) {
            errors.push(createError(errorCodes.INVALID_VERSION, "schemaVersion", `Unsupported schemaVersion: '${candidate.schemaVersion}' (expected '${SCHEMA_VERSION}')`, "const"));
        }

        // 3. Validate required top-level fields (own property only)
        REQUIRED_TOP_LEVEL_FIELDS.forEach(field => {
            if (field !== "schemaVersion" && !Object.prototype.hasOwnProperty.call(candidate, field)) {
                errors.push(createError(errorCodes.MISSING_REQUIRED, field, `Missing required property '${field}'`, "required"));
            }
        });

        // 4. Validate unknown top-level fields
        Object.keys(candidate).forEach(key => {
            if (!REQUIRED_TOP_LEVEL_FIELDS.includes(key)) {
                errors.push(createError(errorCodes.UNKNOWN_FIELD, key, `Unknown top-level field '${key}'`, "additionalProperties"));
            }
        });

        if (errors.length > 0) {
            return finalizeResult(errors);
        }

        // Validate type and structures of individual fields
        const checkStringField = (fieldName) => {
            if (!Object.prototype.hasOwnProperty.call(candidate, fieldName)) return;
            const val = candidate[fieldName];
            if (typeof val !== "string") {
                errors.push(createError(errorCodes.INVALID_TYPE, fieldName, `Property '${fieldName}' must be a string`, "type"));
            } else if (val.trim().length === 0) {
                errors.push(createError(errorCodes.INVALID_VALUE, fieldName, `Property '${fieldName}' cannot be empty or whitespace-only`, "pattern"));
            }
        };

        ["projectName", "projectType", "frontend", "backend", "database", "authentication", "designRequirements", "deploymentRequirements"].forEach(field => {
            checkStringField(field);
        });

        // pagesAndRoutes validation
        if (Object.prototype.hasOwnProperty.call(candidate, "pagesAndRoutes")) {
            const arr = candidate.pagesAndRoutes;
            if (Array.isArray(arr)) {
                const pathsSeen = new Set();
                // Use standard for-loop to catch sparse array elements correctly
                for (let index = 0; index < arr.length; index++) {
                    const item = arr[index];
                    const pathPrefix = `pagesAndRoutes[${index}]`;
                    if (!isPlainObject(item)) {
                        errors.push(createError(errorCodes.INVALID_TYPE, pathPrefix, `pagesAndRoutes item must be a plain object`, "type"));
                        continue;
                    }
                    // Check unknown keys
                    Object.keys(item).forEach(key => {
                        if (!NESTED_FIELDS.pagesAndRoutes.includes(key)) {
                            errors.push(createError(errorCodes.UNKNOWN_FIELD, `${pathPrefix}.${key}`, `Unknown property '${key}' in pagesAndRoutes`, "additionalProperties"));
                        }
                    });
                    // Check path, name, description
                    NESTED_FIELDS.pagesAndRoutes.forEach(field => {
                        if (!Object.prototype.hasOwnProperty.call(item, field)) {
                            errors.push(createError(errorCodes.MISSING_REQUIRED, `${pathPrefix}.${field}`, `Missing required nested property '${field}'`, "required"));
                        } else {
                            const val = item[field];
                            if (typeof val !== "string") {
                                errors.push(createError(errorCodes.INVALID_TYPE, `${pathPrefix}.${field}`, `Nested property '${field}' must be a string`, "type"));
                            } else if (val.trim().length === 0) {
                                errors.push(createError(errorCodes.INVALID_VALUE, `${pathPrefix}.${field}`, `Nested property '${field}' cannot be empty or whitespace-only`, "pattern"));
                            }
                        }
                    });

                    if (Object.prototype.hasOwnProperty.call(item, "path") && typeof item.path === "string" && item.path.trim().length > 0) {
                        if (!isValidPath(item.path)) {
                            errors.push(createError(errorCodes.INVALID_PAGE_ROUTE, `${pathPrefix}.path`, `Page route path '${item.path}' violates path rules`, "pattern"));
                        } else {
                            const normPath = item.path.toLowerCase().trim();
                            if (pathsSeen.has(normPath)) {
                                errors.push(createError(errorCodes.DUPLICATE_ROUTE, `${pathPrefix}.path`, `Duplicate page route detected: '${item.path}'`, "uniqueItem"));
                            }
                            pathsSeen.add(normPath);
                        }
                    }
                }
            } else {
                errors.push(createError(errorCodes.INVALID_TYPE, "pagesAndRoutes", "Property 'pagesAndRoutes' must be an array", "type"));
            }
        }

        // components validation
        if (Object.prototype.hasOwnProperty.call(candidate, "components")) {
            const arr = candidate.components;
            if (Array.isArray(arr)) {
                const compNamesSeen = new Set();
                for (let index = 0; index < arr.length; index++) {
                    const item = arr[index];
                    const pathPrefix = `components[${index}]`;
                    if (!isPlainObject(item)) {
                        errors.push(createError(errorCodes.INVALID_TYPE, pathPrefix, `components item must be a plain object`, "type"));
                        continue;
                    }
                    Object.keys(item).forEach(key => {
                        if (!NESTED_FIELDS.components.includes(key)) {
                            errors.push(createError(errorCodes.UNKNOWN_FIELD, `${pathPrefix}.${key}`, `Unknown property '${key}' in components`, "additionalProperties"));
                        }
                    });
                    NESTED_FIELDS.components.forEach(field => {
                        if (!Object.prototype.hasOwnProperty.call(item, field)) {
                            errors.push(createError(errorCodes.MISSING_REQUIRED, `${pathPrefix}.${field}`, `Missing required nested property '${field}'`, "required"));
                        } else {
                            const val = item[field];
                            if (typeof val !== "string") {
                                errors.push(createError(errorCodes.INVALID_TYPE, `${pathPrefix}.${field}`, `Nested property '${field}' must be a string`, "type"));
                            } else if (val.trim().length === 0) {
                                errors.push(createError(errorCodes.INVALID_VALUE, `${pathPrefix}.${field}`, `Nested property '${field}' cannot be empty or whitespace-only`, "pattern"));
                            }
                        }
                    });

                    if (Object.prototype.hasOwnProperty.call(item, "name") && typeof item.name === "string" && item.name.trim().length > 0) {
                        const normName = item.name.toLowerCase().trim();
                        if (compNamesSeen.has(normName)) {
                            errors.push(createError(errorCodes.DUPLICATE_COMPONENT, `${pathPrefix}.name`, `Duplicate component name detected: '${item.name}'`, "uniqueItem"));
                        }
                        compNamesSeen.add(normName);
                    }
                }
            } else {
                errors.push(createError(errorCodes.INVALID_TYPE, "components", "Property 'components' must be an array", "type"));
            }
        }

        // backendApis validation
        if (Object.prototype.hasOwnProperty.call(candidate, "backendApis")) {
            const arr = candidate.backendApis;
            if (Array.isArray(arr)) {
                const apisSeen = new Set();
                for (let index = 0; index < arr.length; index++) {
                    const item = arr[index];
                    const pathPrefix = `backendApis[${index}]`;
                    if (!isPlainObject(item)) {
                        errors.push(createError(errorCodes.INVALID_TYPE, pathPrefix, `backendApis item must be a plain object`, "type"));
                        continue;
                    }
                    Object.keys(item).forEach(key => {
                        if (!NESTED_FIELDS.backendApis.includes(key)) {
                            errors.push(createError(errorCodes.UNKNOWN_FIELD, `${pathPrefix}.${key}`, `Unknown property '${key}' in backendApis`, "additionalProperties"));
                        }
                    });
                    NESTED_FIELDS.backendApis.forEach(field => {
                        if (!Object.prototype.hasOwnProperty.call(item, field)) {
                            errors.push(createError(errorCodes.MISSING_REQUIRED, `${pathPrefix}.${field}`, `Missing required nested property '${field}'`, "required"));
                        } else {
                            const val = item[field];
                            if (typeof val !== "string") {
                                errors.push(createError(errorCodes.INVALID_TYPE, `${pathPrefix}.${field}`, `Nested property '${field}' must be a string`, "type"));
                            } else if (val.trim().length === 0) {
                                errors.push(createError(errorCodes.INVALID_VALUE, `${pathPrefix}.${field}`, `Nested property '${field}' cannot be empty or whitespace-only`, "pattern"));
                            }
                        }
                    });

                    if (Object.prototype.hasOwnProperty.call(item, "method") && typeof item.method === "string" && item.method.trim().length > 0) {
                        const normMethod = item.method.toUpperCase().trim();
                        if (!ALLOWED_HTTP_METHODS.includes(normMethod)) {
                            errors.push(createError(errorCodes.INVALID_HTTP_METHOD, `${pathPrefix}.method`, `Invalid HTTP method: '${item.method}'`, "pattern"));
                        }
                    }

                    if (Object.prototype.hasOwnProperty.call(item, "path") && typeof item.path === "string" && item.path.trim().length > 0) {
                        if (!isValidPath(item.path)) {
                            errors.push(createError(errorCodes.INVALID_API_PATH, `${pathPrefix}.path`, `API path '${item.path}' violates path rules`, "pattern"));
                        }
                    }

                    if (Object.prototype.hasOwnProperty.call(item, "method") && Object.prototype.hasOwnProperty.call(item, "path") &&
                        typeof item.method === "string" && typeof item.path === "string" &&
                        item.method.trim().length > 0 && item.path.trim().length > 0) {
                        const apiIdentity = `${item.method.toUpperCase().trim()} ${item.path.toLowerCase().trim()}`;
                        if (apisSeen.has(apiIdentity)) {
                            errors.push(createError(errorCodes.DUPLICATE_API, `${pathPrefix}`, `Duplicate API endpoint detected: '${item.method} ${item.path}'`, "uniqueItem"));
                        }
                        apisSeen.add(apiIdentity);
                    }
                }
            } else {
                errors.push(createError(errorCodes.INVALID_TYPE, "backendApis", "Property 'backendApis' must be an array", "type"));
            }
        }

        // databaseModels validation
        if (Object.prototype.hasOwnProperty.call(candidate, "databaseModels")) {
            const arr = candidate.databaseModels;
            if (Array.isArray(arr)) {
                const modelNamesSeen = new Set();
                for (let index = 0; index < arr.length; index++) {
                    const item = arr[index];
                    const pathPrefix = `databaseModels[${index}]`;
                    if (!isPlainObject(item)) {
                        errors.push(createError(errorCodes.INVALID_TYPE, pathPrefix, `databaseModels item must be a plain object`, "type"));
                        continue;
                    }
                    Object.keys(item).forEach(key => {
                        if (!NESTED_FIELDS.databaseModels.includes(key)) {
                            errors.push(createError(errorCodes.UNKNOWN_FIELD, `${pathPrefix}.${key}`, `Unknown property '${key}' in databaseModels`, "additionalProperties"));
                        }
                    });
                    if (!Object.prototype.hasOwnProperty.call(item, "name")) {
                        errors.push(createError(errorCodes.MISSING_REQUIRED, `${pathPrefix}.name`, "Missing required nested property 'name'", "required"));
                    } else if (typeof item.name !== "string") {
                        errors.push(createError(errorCodes.INVALID_TYPE, `${pathPrefix}.name`, "Nested property 'name' must be a string", "type"));
                    } else if (item.name.trim().length === 0) {
                        errors.push(createError(errorCodes.INVALID_VALUE, `${pathPrefix}.name`, "Nested property 'name' cannot be empty or whitespace-only", "pattern"));
                    }

                    if (!Object.prototype.hasOwnProperty.call(item, "fields")) {
                        errors.push(createError(errorCodes.MISSING_REQUIRED, `${pathPrefix}.fields`, "Missing required nested property 'fields'", "required"));
                    } else if (!Array.isArray(item.fields)) {
                        errors.push(createError(errorCodes.INVALID_TYPE, `${pathPrefix}.fields`, "Nested property 'fields' must be an array", "type"));
                    } else {
                        const fieldsArr = item.fields;
                        for (let fIdx = 0; fIdx < fieldsArr.length; fIdx++) {
                            const f = fieldsArr[fIdx];
                            if (typeof f !== "string") {
                                errors.push(createError(errorCodes.INVALID_TYPE, `${pathPrefix}.fields[${fIdx}]`, "Model field description must be a string", "type"));
                            } else if (f.trim().length === 0) {
                                errors.push(createError(errorCodes.INVALID_VALUE, `${pathPrefix}.fields[${fIdx}]`, "Model field description cannot be empty or whitespace-only", "pattern"));
                            }
                        }
                    }

                    if (Object.prototype.hasOwnProperty.call(item, "name") && typeof item.name === "string" && item.name.trim().length > 0) {
                        const normName = item.name.toLowerCase().trim();
                        if (modelNamesSeen.has(normName)) {
                            errors.push(createError(errorCodes.DUPLICATE_MODEL, `${pathPrefix}.name`, `Duplicate database model name detected: '${item.name}'`, "uniqueItem"));
                        }
                        modelNamesSeen.add(normName);
                    }
                }
            } else {
                errors.push(createError(errorCodes.INVALID_TYPE, "databaseModels", "Property 'databaseModels' must be an array", "type"));
            }
        }

        // validations for integrations, importantDependencies, environmentVariables, architectureConstraints, assumptions
        const validateStringArray = (fieldName, validatorFn, customErrorCode, customMessage) => {
            if (!Object.prototype.hasOwnProperty.call(candidate, fieldName)) return;
            const arr = candidate[fieldName];
            if (Array.isArray(arr)) {
                for (let index = 0; index < arr.length; index++) {
                    const item = arr[index];
                    const itemPath = `${fieldName}[${index}]`;
                    if (typeof item !== "string") {
                        errors.push(createError(errorCodes.INVALID_TYPE, itemPath, `Elements of array '${fieldName}' must be strings`, "type"));
                    } else if (item.trim().length === 0) {
                        errors.push(createError(errorCodes.INVALID_VALUE, itemPath, `Element of array '${fieldName}' cannot be empty or whitespace-only`, "pattern"));
                    } else if (validatorFn && !validatorFn(item)) {
                        errors.push(createError(customErrorCode, itemPath, `${customMessage}: '${item}'`, "pattern"));
                    }
                }
            } else {
                errors.push(createError(errorCodes.INVALID_TYPE, fieldName, `Property '${fieldName}' must be an array`, "type"));
            }
        };

        validateStringArray("integrations");
        
        // package name rule: standard alphanumeric + dashes/dots/underscores and optional @scope
        const pkgNameRegex = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i;
        validateStringArray(
            "importantDependencies", 
            (dep) => pkgNameRegex.test(dep), 
            errorCodes.INVALID_DEP_NAME, 
            "Invalid dependency package name"
        );

        // environment variables name check
        const envVarRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
        validateStringArray(
            "environmentVariables",
            (env) => envVarRegex.test(env),
            errorCodes.INVALID_ENV_VAR,
            "Invalid environment variable name identifier"
        );

        validateStringArray("architectureConstraints");
        validateStringArray("assumptions");

        // runBuildRequirements validation
        if (Object.prototype.hasOwnProperty.call(candidate, "runBuildRequirements")) {
            const item = candidate.runBuildRequirements;
            if (!isPlainObject(item)) {
                errors.push(createError(errorCodes.INVALID_TYPE, "runBuildRequirements", "Property 'runBuildRequirements' must be a plain object", "type"));
            } else {
                Object.keys(item).forEach(key => {
                    if (!NESTED_FIELDS.runBuildRequirements.includes(key)) {
                        errors.push(createError(errorCodes.UNKNOWN_FIELD, `runBuildRequirements.${key}`, `Unknown property '${key}' in runBuildRequirements`, "additionalProperties"));
                    }
                });
                NESTED_FIELDS.runBuildRequirements.forEach(field => {
                    if (!Object.prototype.hasOwnProperty.call(item, field)) {
                        errors.push(createError(errorCodes.MISSING_REQUIRED, `runBuildRequirements.${field}`, `Missing required nested property '${field}' in runBuildRequirements`, "required"));
                    } else {
                        const val = item[field];
                        if (typeof val !== "string") {
                            errors.push(createError(errorCodes.INVALID_TYPE, `runBuildRequirements.${field}`, `Nested property '${field}' must be a string`, "type"));
                        } else if (field === "runScript" && val.trim().length === 0) {
                            errors.push(createError(errorCodes.INVALID_VALUE, `runBuildRequirements.${field}`, `Nested property '${field}' cannot be empty or whitespace-only`, "pattern"));
                        }
                    }
                });
            }
        }

        return finalizeResult(errors, candidate);
    } catch (err) {
        return {
            success: false,
            value: null,
            errors: [
                createError(errorCodes.INVALID_VALUE, "", `Exception during validation: ${err.message}`, "custom")
            ]
        };
    }
};

const finalizeResult = (errors, candidate = null) => {
    if (errors.length > 0) {
        // Deterministic Error Ordering: by path, then code
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

    // JSON-compatible deep clone
    const clone = JSON.parse(JSON.stringify(candidate));
    // deep freeze
    const immutable = deepFreeze(clone);

    return {
        success: true,
        value: immutable,
        errors: []
    };
};

const deepFreeze = (obj) => {
    if (obj === null || typeof obj !== "object") return obj;
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach(prop => {
        if (Object.prototype.hasOwnProperty.call(obj, prop) &&
            obj[prop] !== null &&
            (typeof obj[prop] === "object") &&
            !Object.isFrozen(obj[prop])) {
            deepFreeze(obj[prop]);
        }
    });
    return obj;
};

module.exports = {
    validateProjectSpec
};
