"use strict";

const { differentialValidationErrorCodes } = require("./differentialValidationErrors");
const { validateReport, deepFreeze } = require("./differentialValidationReport");

const DIFFERENTIAL_VALIDATOR_VERSION = "1.0";

const ALLOWED_IGNORED_FIELDS = new Set([
    "runtime",
    "duration",
    "metrics",
    "timestamp",
    "checkpointId",
    "executionId",
    "createdAt",
    "updatedAt"
]);

/**
 * Extract imports/requires from code content.
 */
function extractImports(content) {
    if (typeof content !== "string") return [];
    const imports = [];
    const importRegex = /import\s+.*?\s+from\s+['"](.*?)['"]/g;
    const requireRegex = /require\s*\(\s*['"](.*?)['"]\s*\)/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[0].trim());
    }
    while ((match = requireRegex.exec(content)) !== null) {
        imports.push(match[0].trim());
    }
    return imports.sort();
}

/**
 * Extract exports from code content.
 */
function extractExports(content) {
    if (typeof content !== "string") return [];
    const exportsList = [];
    const exportNamedRegex = /export\s+(const|let|var|function|class|default)\s+(\w+)/g;
    const moduleExportsRegex = /module\.exports\s*=\s*/g;
    
    let match;
    while ((match = exportNamedRegex.exec(content)) !== null) {
        exportsList.push(match[0].trim());
    }
    if (moduleExportsRegex.test(content)) {
        exportsList.push("module.exports");
    }
    return exportsList.sort();
}

/**
 * Factory instantiating a differential validator instance.
 *
 * @param {Object} [config] Configuration overrides for validation
 */
function createDifferentialValidator(config = {}) {
    const customIgnored = config.ignoredFields || [];
    for (const field of customIgnored) {
        if (!ALLOWED_IGNORED_FIELDS.has(field)) {
            const err = new Error(`Unknown ignored field: '${field}'`);
            err.code = differentialValidationErrorCodes.DIFFERENTIAL_VALIDATION_FAILED;
            throw err;
        }
    }

    const ignoredSet = new Set([...customIgnored]);

    /**
     * Determines if a given field path/key matches the ignore list rules.
     */
    function isIgnoredField(key, value) {
        if (ignoredSet.has(key)) return true;
        if (key === "runtime") return true;
        if (key === "duration" || key === "executionDuration") return true;
        if (key === "metrics" || key === "metricsCollector" || key === "metricsSnapshot") return true;
        if (key === "timestamp" || key === "createdAt" || key === "updatedAt" || /timestamp|date|time/i.test(key)) return true;
        if (key === "checkpointId" || key === "executionId" || /Id$/i.test(key)) return true;

        if (typeof value === "string" && !isNaN(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
            return true;
        }
        return false;
    }

    /**
     * Compares legacy runtime output with modular runtime output.
     * Generates and returns a deeply frozen report.
     *
     * @param {Object} legacyResponse The production output from legacy runtime
     * @param {Object} modularResponse The production output from modular runtime
     */
    function generateReport(legacyResponse, modularResponse) {
        if (
            legacyResponse === null || legacyResponse === undefined || typeof legacyResponse !== "object" || Array.isArray(legacyResponse) ||
            modularResponse === null || modularResponse === undefined || typeof modularResponse !== "object" || Array.isArray(modularResponse)
        ) {
            const err = new Error("Invalid comparison target: targets must be non-null objects.");
            err.code = differentialValidationErrorCodes.DIFFERENTIAL_VALIDATION_FAILED;
            throw err;
        }

        // Validate expected runtimes
        if (legacyResponse.hasOwnProperty("runtime") && legacyResponse.runtime !== "LEGACY") {
            const err = new Error(`Unknown runtime in legacy response: '${legacyResponse.runtime}'`);
            err.code = differentialValidationErrorCodes.DIFFERENTIAL_VALIDATION_FAILED;
            throw err;
        }
        if (modularResponse.hasOwnProperty("runtime") && modularResponse.runtime !== "MODULAR") {
            const err = new Error(`Unknown runtime in modular response: '${modularResponse.runtime}'`);
            err.code = differentialValidationErrorCodes.DIFFERENTIAL_VALIDATION_FAILED;
            throw err;
        }

        const matchedFields = [];
        const ignoredFields = [];
        const differences = [];
        const warnings = [];

        const statistics = {
            totalCompared: 0,
            totalMatched: 0,
            totalIgnored: 0,
            totalDifferences: 0
        };

        function compareDeep(obj1, obj2, path = "") {
            const key = path.split(".").pop();
            
            // Check if ignored key/value
            if (isIgnoredField(key, obj1) || isIgnoredField(key, obj2)) {
                ignoredFields.push(path);
                statistics.totalIgnored++;
                return;
            }

            statistics.totalCompared++;

            if (obj1 === obj2) {
                matchedFields.push(path);
                statistics.totalMatched++;
                return;
            }

            if (typeof obj1 !== typeof obj2) {
                differences.push({
                    type: "TYPE_MISMATCH",
                    path,
                    message: `Type mismatch at '${path}': expected '${typeof obj1}', got '${typeof obj2}'`,
                    legacy: obj1,
                    modular: obj2
                });
                statistics.totalDifferences++;
                return;
            }

            if (obj1 === null || obj2 === null || typeof obj1 !== "object") {
                differences.push({
                    type: "VALUE_MISMATCH",
                    path,
                    message: `Value mismatch at '${path}': expected '${obj1}', got '${obj2}'`,
                    legacy: obj1,
                    modular: obj2
                });
                statistics.totalDifferences++;
                return;
            }

            if (Array.isArray(obj1)) {
                if (!Array.isArray(obj2)) {
                    differences.push({
                        type: "TYPE_MISMATCH",
                        path,
                        message: `Type mismatch at '${path}': expected Array, got '${typeof obj2}'`,
                        legacy: obj1,
                        modular: obj2
                    });
                    statistics.totalDifferences++;
                    return;
                }

                if (obj1.length !== obj2.length) {
                    // Check if comparing files
                    if (path === "result.files" || path.endsWith(".files")) {
                        differences.push({
                            type: "FILE_COUNT_MISMATCH",
                            path,
                            message: `File count mismatch: Legacy has ${obj1.length} files, Modular has ${obj2.length}.`,
                            legacy: obj1.length,
                            modular: obj2.length
                        });
                        statistics.totalDifferences++;
                    } else {
                        differences.push({
                            type: "ARRAY_LENGTH_MISMATCH",
                            path,
                            message: `Array length mismatch at '${path}': expected '${obj1.length}', got '${obj2.length}'`,
                            legacy: obj1.length,
                            modular: obj2.length
                        });
                        statistics.totalDifferences++;
                        return;
                    }
                }

                // If comparing files, run detailed semantic comparison
                if (path === "result.files" || path.endsWith(".files")) {
                    const map1 = new Map(obj1.map(f => [f.name || f.path, f]));
                    const map2 = new Map(obj2.map(f => [f.name || f.path, f]));

                    for (const p of map1.keys()) {
                        const f1 = map1.get(p);
                        if (!map2.has(p)) {
                            differences.push({
                                type: "PATH_MISMATCH_MISSING_IN_MODULAR",
                                path: `${path}.${p}`,
                                message: `File path '${p}' exists in Legacy but is missing in Modular.`,
                                legacy: p,
                                modular: undefined
                            });
                            statistics.totalDifferences++;
                        } else {
                            const f2 = map2.get(p);
                            if (f1.content !== f2.content) {
                                differences.push({
                                    type: "CONTENT_MISMATCH",
                                    path: `${path}.${p}.content`,
                                    message: `Content mismatch detected in file: '${p}'.`,
                                    legacy: f1.content,
                                    modular: f2.content
                                });
                                statistics.totalDifferences++;
                            }

                            const imp1 = extractImports(f1.content);
                            const imp2 = extractImports(f2.content);
                            if (JSON.stringify(imp1) !== JSON.stringify(imp2)) {
                                differences.push({
                                    type: "IMPORTS_MISMATCH",
                                    path: `${path}.${p}.imports`,
                                    message: `Imports mismatch detected in file: '${p}'.`,
                                    legacy: imp1,
                                    modular: imp2
                                });
                                statistics.totalDifferences++;
                            }

                            const exp1 = extractExports(f1.content);
                            const exp2 = extractExports(f2.content);
                            if (JSON.stringify(exp1) !== JSON.stringify(exp2)) {
                                differences.push({
                                    type: "EXPORTS_MISMATCH",
                                    path: `${path}.${p}.exports`,
                                    message: `Exports mismatch detected in file: '${p}'.`,
                                    legacy: exp1,
                                    modular: exp2
                                });
                                statistics.totalDifferences++;
                            }
                        }
                    }

                    for (const p of map2.keys()) {
                        if (!map1.has(p)) {
                            differences.push({
                                type: "PATH_MISMATCH_MISSING_IN_LEGACY",
                                path: `${path}.${p}`,
                                message: `File path '${p}' exists in Modular but is missing in Legacy.`,
                                legacy: undefined,
                                modular: p
                            });
                            statistics.totalDifferences++;
                        }
                    }

                    matchedFields.push(path);
                    statistics.totalMatched++;
                    return;
                }

                // General array items comparison
                const minLen = Math.min(obj1.length, obj2.length);
                for (let i = 0; i < minLen; i++) {
                    compareDeep(obj1[i], obj2[i], `${path}[${i}]`);
                }
                return;
            }

            // Object keys comparison
            const keys1 = Object.keys(obj1);
            const keys2 = Object.keys(obj2);
            const allKeys = new Set([...keys1, ...keys2]);

            for (const k of allKeys) {
                const subPath = `${path}.${k}`;
                compareDeep(obj1[k], obj2[k], subPath);
            }
        }

        compareDeep(legacyResponse, modularResponse, "");

        const comparisonStatus = differences.length === 0 ? "PASSED" : "FAILED";

        const report = {
            comparisonStatus,
            matchedFields,
            ignoredFields,
            differences,
            warnings,
            statistics,
            runtimeVersions: {
                LEGACY: legacyResponse.version || "1.0",
                MODULAR: modularResponse.version || "1.0"
            }
        };

        return deepFreeze(report);
    }

    return deepFreeze({
        generateReport,
        version: DIFFERENTIAL_VALIDATOR_VERSION
    });
}

module.exports = {
    createDifferentialValidator,
    DIFFERENTIAL_VALIDATOR_VERSION
};
