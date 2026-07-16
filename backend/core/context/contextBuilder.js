"use strict";

const { contextErrorCodes } = require("./contextErrors");

const CONTEXT_MODEL_VERSION = "1.0";

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
 * Resolves a relative import path relative to the fromPath directory.
 */
function resolveRelativePath(fromPath, importPath) {
    const normalizedFrom = fromPath.replace(/\\/g, "/");
    const normalizedImport = importPath.replace(/\\/g, "/");

    const pathParts = normalizedFrom.split("/");
    pathParts.pop(); // Remove filename

    const importParts = normalizedImport.split("/");
    for (const part of importParts) {
        if (part === "." || part === "") {
            continue;
        }
        if (part === "..") {
            if (pathParts.length > 0) {
                pathParts.pop();
            }
        } else {
            pathParts.push(part);
        }
    }
    return pathParts.join("/");
}

/**
 * Deterministically constructs a frozen context sidecar for a generation task.
 * 
 * @param {Object} projectSpec Validated ProjectSpec
 * @param {Object} requirement Identity Requirement
 * @param {Object} plannerTask Active execution PlannerTask
 * @param {Array} [repository] Optional list of canonical file descriptors
 */
function buildContext(projectSpec, requirement, plannerTask, repository, options) {
    try {
        options = options || {};
        // 1. General non-null inputs validation
        if (
            projectSpec === null || projectSpec === undefined ||
            requirement === null || requirement === undefined ||
            plannerTask === null || plannerTask === undefined
        ) {
            return deepFreeze({
                success: false,
                context: null,
                errors: [{
                    code: contextErrorCodes.CONTEXT_INVALID_INPUT,
                    path: "",
                    message: "Parameters projectSpec, requirement, and plannerTask must all be non-null objects."
                }]
            });
        }

        // 2. Validate projectSpec structure
        if (
            typeof projectSpec !== "object" ||
            !projectSpec.hasOwnProperty("projectName") ||
            !projectSpec.hasOwnProperty("projectType") ||
            typeof projectSpec.projectName !== "string" ||
            typeof projectSpec.projectType !== "string"
        ) {
            return deepFreeze({
                success: false,
                context: null,
                errors: [{
                    code: contextErrorCodes.CONTEXT_INVALID_PROJECT_SPEC,
                    path: "projectSpec",
                    message: "ProjectSpec is malformed or missing key parameters (projectName, projectType)."
                }]
            });
        }

        // 3. Validate requirement structure
        if (
            typeof requirement !== "object" ||
            !requirement.hasOwnProperty("stableId") ||
            !requirement.hasOwnProperty("displayId") ||
            !requirement.hasOwnProperty("kind") ||
            !requirement.hasOwnProperty("description") ||
            typeof requirement.stableId !== "string" ||
            typeof requirement.displayId !== "string" ||
            typeof requirement.kind !== "string" ||
            typeof requirement.description !== "string"
        ) {
            return deepFreeze({
                success: false,
                context: null,
                errors: [{
                    code: contextErrorCodes.CONTEXT_INVALID_REQUIREMENT,
                    path: "requirement",
                    message: "Requirement is malformed or missing key fields (stableId, displayId, kind, description)."
                }]
            });
        }

        // 4. Validate plannerTask structure
        if (
            typeof plannerTask !== "object" ||
            !plannerTask.hasOwnProperty("stableId") ||
            !plannerTask.hasOwnProperty("displayId") ||
            !plannerTask.hasOwnProperty("status") ||
            !plannerTask.hasOwnProperty("dependencies") ||
            !plannerTask.hasOwnProperty("dependents") ||
            typeof plannerTask.stableId !== "string" ||
            typeof plannerTask.displayId !== "string" ||
            typeof plannerTask.status !== "string" ||
            !Array.isArray(plannerTask.dependencies) ||
            !Array.isArray(plannerTask.dependents)
        ) {
            return deepFreeze({
                success: false,
                context: null,
                errors: [{
                    code: contextErrorCodes.CONTEXT_INVALID_TASK,
                    path: "plannerTask",
                    message: "PlannerTask is malformed or missing key fields (stableId, displayId, status, dependencies, dependents)."
                }]
            });
        }

        // 5. Semantic keys consistency validation
        if (requirement.stableId !== plannerTask.stableId || requirement.displayId !== plannerTask.displayId) {
            return deepFreeze({
                success: false,
                context: null,
                errors: [{
                    code: contextErrorCodes.CONTEXT_INVALID_INPUT,
                    path: "",
                    message: "StableId and DisplayId must match between requirement and plannerTask."
                }]
            });
        }

        // 6. Optional repository validations and target resolution
        let repositoryContext = null;
        if (repository !== undefined && repository !== null) {
            if (!Array.isArray(repository)) {
                return deepFreeze({
                    success: false,
                    context: null,
                    errors: [{
                        code: contextErrorCodes.CONTEXT_INVALID_REPOSITORY,
                        path: "repository",
                        message: "Repository must be an array of file descriptors."
                    }]
                });
            }

            for (let i = 0; i < repository.length; i++) {
                const file = repository[i];
                if (
                    typeof file !== "object" || file === null ||
                    typeof file.path !== "string" ||
                    typeof file.language !== "string" ||
                    !Array.isArray(file.imports)
                ) {
                    return deepFreeze({
                        success: false,
                        context: null,
                        errors: [{
                            code: contextErrorCodes.CONTEXT_INVALID_REPOSITORY,
                            path: `repository[${i}]`,
                            message: "Repository file descriptor is malformed. Must contain path (string), language (string), and imports (array)."
                        }]
                    });
                }

                if (file.hasOwnProperty("importMetadata") && file.importMetadata !== undefined && file.importMetadata !== null) {
                    if (!Array.isArray(file.importMetadata)) {
                        return deepFreeze({
                            success: false,
                            context: null,
                            errors: [{
                                code: contextErrorCodes.CONTEXT_INVALID_IMPORT_METADATA,
                                path: `repository[${i}].importMetadata`,
                                message: "importMetadata must be an array."
                            }]
                        });
                    }

                    for (let j = 0; j < file.importMetadata.length; j++) {
                        const meta = file.importMetadata[j];
                        if (
                            typeof meta !== "object" || meta === null ||
                            typeof meta.source !== "string" || !meta.source.trim() ||
                            typeof meta.symbol !== "string" || !meta.symbol.trim() ||
                            typeof meta.importType !== "string" || !meta.importType.trim()
                        ) {
                            return deepFreeze({
                                success: false,
                                context: null,
                                errors: [{
                                    code: contextErrorCodes.CONTEXT_INVALID_IMPORT_METADATA,
                                    path: `repository[${i}].importMetadata[${j}]`,
                                    message: "Each importMetadata entry must be an object with source (string), symbol (string), and importType (string)."
                                }]
                            });
                        }
                    }
                }
            }

            // Find target file path using any of our candidate lookup fields
            let targetPath = null;
            if (plannerTask && typeof plannerTask.targetFile === "string") {
                targetPath = plannerTask.targetFile;
            } else if (requirement && typeof requirement.targetFile === "string") {
                targetPath = requirement.targetFile;
            } else if (plannerTask && plannerTask.metadata && typeof plannerTask.metadata.targetFile === "string") {
                targetPath = plannerTask.metadata.targetFile;
            } else if (requirement && requirement.payload && typeof requirement.payload.targetFile === "string") {
                targetPath = requirement.payload.targetFile;
            } else if (plannerTask && typeof plannerTask.filePath === "string") {
                targetPath = plannerTask.filePath;
            } else if (requirement && typeof requirement.filePath === "string") {
                targetPath = requirement.filePath;
            } else if (plannerTask && plannerTask.metadata && typeof plannerTask.metadata.filePath === "string") {
                targetPath = plannerTask.metadata.filePath;
            } else if (requirement && requirement.payload && typeof requirement.payload.filePath === "string") {
                targetPath = requirement.payload.filePath;
            }

            if (!targetPath) {
                return deepFreeze({
                    success: false,
                    context: null,
                    errors: [{
                        code: contextErrorCodes.CONTEXT_TARGET_NOT_FOUND,
                        path: "",
                        message: "Target file path could not be located in plannerTask or requirement."
                    }]
                });
            }

            const targetFileObj = repository.find(file => file.path.replace(/\\/g, "/") === targetPath.replace(/\\/g, "/"));
            if (!targetFileObj) {
                return deepFreeze({
                    success: false,
                    context: null,
                    errors: [{
                        code: contextErrorCodes.CONTEXT_TARGET_NOT_FOUND,
                        path: "repository",
                        message: `Target file '${targetPath}' was not found in the repository.`
                    }]
                });
            }

            // Resolve direct relative imports only
            const importedFiles = [];
            const resolvedSet = new Set();
            if (Array.isArray(targetFileObj.imports)) {
                for (const imp of targetFileObj.imports) {
                    if (typeof imp !== "string") continue;
                    // Check if it's a relative import path (starts with ./ or ../)
                    if (imp.startsWith("./") || imp.startsWith("../")) {
                        const resolved = resolveRelativePath(targetFileObj.path, imp);
                        const matchedFile = repository.find(file => {
                            const fPath = file.path.replace(/\\/g, "/");
                            if (fPath === resolved) return true;
                            const extensions = [".js", ".jsx", ".ts", ".tsx", ".css", ".json"];
                            for (const ext of extensions) {
                                if (fPath === resolved + ext) return true;
                                if (fPath === resolved + "/index" + ext) return true;
                            }
                            return false;
                        });
                        if (matchedFile && !resolvedSet.has(matchedFile.path)) {
                            resolvedSet.add(matchedFile.path);
                            importedFiles.push(matchedFile);
                        }
                    }
                }
            }

            // Sort importedFiles by path to ensure deterministic output
            importedFiles.sort((a, b) => a.path.localeCompare(b.path));

            repositoryContext = {
                targetFile: JSON.parse(JSON.stringify(targetFileObj)),
                importedFiles: JSON.parse(JSON.stringify(importedFiles))
            };

            if (options && options.includeImportedSymbols === true) {
                const importedSymbols = [];
                if (Array.isArray(targetFileObj.importMetadata)) {
                    for (const entry of targetFileObj.importMetadata) {
                        const source = entry.source;
                        // Skip if not relative import path (starts with ./ or ../)
                        if (!source.startsWith("./") && !source.startsWith("../")) {
                            continue;
                        }

                        // Ignore unsupported import styles
                        if (
                            entry.importType !== "default" &&
                            entry.importType !== "named" &&
                            entry.importType !== "namespace"
                        ) {
                            continue;
                        }

                        // Resolve source path relative to target file path
                        const resolved = resolveRelativePath(targetFileObj.path, source);

                        // Find the matching file in repository
                        const matchedFile = repository.find(file => {
                            const fPath = file.path.replace(/\\/g, "/");
                            if (fPath === resolved) return true;
                            const extensions = [".js", ".jsx", ".ts", ".tsx", ".css", ".json"];
                            for (const ext of extensions) {
                                if (fPath === resolved + ext) return true;
                                if (fPath === resolved + "/index" + ext) return true;
                            }
                            return false;
                        });

                        if (matchedFile) {
                            importedSymbols.push({
                                file: matchedFile.path,
                                symbol: entry.symbol,
                                importType: entry.importType
                            });
                        }
                    }
                }

                // Sort importedSymbols by: file ascending, then symbol ascending
                importedSymbols.sort((a, b) => {
                    const fileComp = a.file.localeCompare(b.file);
                    if (fileComp !== 0) return fileComp;
                    return a.symbol.localeCompare(b.symbol);
                });

                repositoryContext.importedSymbols = JSON.parse(JSON.stringify(importedSymbols));
            }
        }

        // 7. Deep clone and return frozen context
        const clonedProjectSpec = JSON.parse(JSON.stringify(projectSpec));
        const clonedRequirement = JSON.parse(JSON.stringify(requirement));
        const clonedPlannerTask = JSON.parse(JSON.stringify(plannerTask));

        const context = {
            version: CONTEXT_MODEL_VERSION,
            metadata: {
                contextVersion: CONTEXT_MODEL_VERSION,
                plannerVersion: "1.0",
                graphVersion: "1.0",
                identityVersion: "1.0",
                createdBy: "contextBuilder"
            },
            projectSpec: clonedProjectSpec,
            requirement: clonedRequirement,
            plannerTask: clonedPlannerTask
        };

        if (repositoryContext) {
            context.repositoryContext = repositoryContext;
        }

        return deepFreeze({
            success: true,
            context,
            errors: []
        });

    } catch (err) {
        return deepFreeze({
            success: false,
            context: null,
            errors: [{
                code: contextErrorCodes.CONTEXT_INTERNAL_ERROR,
                path: "",
                message: `Unexpected internal error during context compilation: ${err.message}`
            }]
        });
    }
}

module.exports = {
    buildContext,
    CONTEXT_MODEL_VERSION
};
