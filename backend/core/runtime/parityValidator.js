"use strict";

const { parityValidatorErrorCodes } = require("./parityValidatorErrors");

const PARITY_VALIDATOR_VERSION = "1.0";

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
 * Helper to extract simple imports/requires from a source string.
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
 * Helper to extract simple exports from a source string.
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
 * Validates the inputs for parity check, ensuring they match standard structure schemas.
 */
function validateOutputStructures(output) {
    if (output === null || output === undefined || typeof output !== "object" || Array.isArray(output)) {
        return false;
    }
    if (!output.hasOwnProperty("result") || output.result === null || typeof output.result !== "object") {
        return false;
    }
    if (!Array.isArray(output.result.files)) {
        return false;
    }
    return true;
}

/**
 * Compares two generation outputs for parity and lists structural and content differences.
 *
 * @param {Object} legacyOutput Production result from legacy orchestrator
 * @param {Object} modularOutput Result from the modular runtime pipeline
 */
function validateParity(legacyOutput, modularOutput) {
    if (!validateOutputStructures(legacyOutput)) {
        const err = new Error("Invalid legacy output structure.");
        err.code = parityValidatorErrorCodes.PARITY_INVALID_RESULT;
        throw err;
    }
    if (!validateOutputStructures(modularOutput)) {
        const err = new Error("Invalid modular output structure.");
        err.code = parityValidatorErrorCodes.PARITY_INVALID_RESULT;
        throw err;
    }

    const differences = [];

    // 1. Compare File Paths & Count
    const legacyFiles = legacyOutput.result.files;
    const modularFiles = modularOutput.result.files;
    const legacyPaths = legacyFiles.map(f => f.name || f.path).filter(Boolean).sort();
    const modularPaths = modularFiles.map(f => f.name || f.path).filter(Boolean).sort();

    if (legacyPaths.length !== modularPaths.length) {
        differences.push({
            type: "FILE_COUNT_MISMATCH",
            message: `Legacy output has ${legacyPaths.length} files, but Modular has ${modularPaths.length}.`,
            legacy: legacyPaths.length,
            modular: modularPaths.length
        });
    }

    // Compare paths set
    const legacySet = new Set(legacyPaths);
    const modularSet = new Set(modularPaths);

    for (const p of legacyPaths) {
        if (!modularSet.has(p)) {
            differences.push({
                type: "PATH_MISMATCH_MISSING_IN_MODULAR",
                message: `File path '${p}' exists in Legacy but is missing in Modular.`,
                path: p
            });
        }
    }
    for (const p of modularPaths) {
        if (!legacySet.has(p)) {
            differences.push({
                type: "PATH_MISMATCH_MISSING_IN_LEGACY",
                message: `File path '${p}' exists in Modular but is missing in Legacy.`,
                path: p
            });
        }
    }

    // 2. Compare file contents, imports, exports
    const legacyFileMap = new Map(legacyFiles.map(f => [f.name || f.path, f.content || ""]));
    const modularFileMap = new Map(modularFiles.map(f => [f.name || f.path, f.content || ""]));

    for (const p of legacyPaths) {
        if (modularFileMap.has(p)) {
            const legacyContent = legacyFileMap.get(p).trim();
            const modularContent = modularFileMap.get(p).trim();

            if (legacyContent !== modularContent) {
                differences.push({
                    type: "CONTENT_MISMATCH",
                    message: `Content mismatch detected in file: '${p}'.`,
                    path: p
                });
            }

            // Compare imports
            const legacyImports = extractImports(legacyContent);
            const modularImports = extractImports(modularContent);
            if (JSON.stringify(legacyImports) !== JSON.stringify(modularImports)) {
                differences.push({
                    type: "IMPORTS_MISMATCH",
                    message: `Imports mismatch detected in file: '${p}'.`,
                    path: p,
                    legacy: legacyImports,
                    modular: modularImports
                });
            }

            // Compare exports
            const legacyExports = extractExports(legacyContent);
            const modularExports = extractExports(modularContent);
            if (JSON.stringify(legacyExports) !== JSON.stringify(modularExports)) {
                differences.push({
                    type: "EXPORTS_MISMATCH",
                    message: `Exports mismatch detected in file: '${p}'.`,
                    path: p,
                    legacy: legacyExports,
                    modular: modularExports
                });
            }
        }
    }

    // 3. Compare Metadata & Run Instructions
    const legacyResult = legacyOutput.result;
    const modularResult = modularOutput.result;

    if ((legacyResult.runInstructions || "").trim() !== (modularResult.runInstructions || "").trim()) {
        differences.push({
            type: "RUN_INSTRUCTIONS_MISMATCH",
            message: "Run instructions mismatch.",
            legacy: legacyResult.runInstructions,
            modular: modularResult.runInstructions
        });
    }

    if (legacyResult.summary !== modularResult.summary) {
        differences.push({
            type: "SUMMARY_MISMATCH",
            message: "Summary mismatch.",
            legacy: legacyResult.summary,
            modular: modularResult.summary
        });
    }

    if (legacyResult.model !== modularResult.model) {
        differences.push({
            type: "MODEL_MISMATCH",
            message: "Model mismatch.",
            legacy: legacyResult.model,
            modular: modularResult.model
        });
    }

    // Compare Project Spec (Canonical properties)
    const specFields = ["projectName", "projectType", "frontend", "backend", "database", "authentication", "designRequirements"];
    const legacySpec = legacyResult.projectSpec || {};
    const modularSpec = modularResult.projectSpec || {};

    for (const field of specFields) {
        if (legacySpec[field] !== modularSpec[field]) {
            differences.push({
                type: `PROJECT_SPEC_${field.toUpperCase()}_MISMATCH`,
                message: `ProjectSpec field '${field}' mismatch.`,
                legacy: legacySpec[field],
                modular: modularSpec[field]
            });
        }
    }

    // Compare Verification Status
    const legacyMeta = legacyOutput.metadata || {};
    const modularMeta = modularOutput.metadata || {};

    const legacyVer = legacyMeta.verificationResult || {};
    const modularVer = modularMeta.verificationResult || {};

    if (legacyVer.status !== modularVer.status) {
        differences.push({
            type: "VERIFICATION_STATUS_MISMATCH",
            message: `Verification status mismatch. Legacy status is '${legacyVer.status}', Modular status is '${modularVer.status}'.`,
            legacy: legacyVer.status,
            modular: modularVer.status
        });
    }

    if (legacyMeta.repaired !== modularMeta.repaired) {
        differences.push({
            type: "REPAIRED_FLAG_MISMATCH",
            message: `Repaired flag mismatch. Legacy repaired: ${legacyMeta.repaired}, Modular repaired: ${modularMeta.repaired}.`,
            legacy: legacyMeta.repaired,
            modular: modularMeta.repaired
        });
    }

    return deepFreeze({
        success: differences.length === 0,
        differences
    });
}

/**
 * Compares outputs and returns a structured report object.
 */
function generateParityReport(legacyOutput, modularOutput) {
    const res = validateParity(legacyOutput, modularOutput);
    
    let reportString = "=== Z.AI PARITY VALIDATION REPORT ===\n";
    if (res.success) {
        reportString += "STATUS: PASSED (100% parity matched)\n";
    } else {
        reportString += `STATUS: FAILED (${res.differences.length} differences detected)\n`;
        res.differences.forEach((diff, index) => {
            reportString += `\n[${index + 1}] Difference: ${diff.type}\n`;
            reportString += `    Message: ${diff.message}\n`;
            if (diff.legacy !== undefined) reportString += `    Legacy: ${JSON.stringify(diff.legacy)}\n`;
            if (diff.modular !== undefined) reportString += `    Modular: ${JSON.stringify(diff.modular)}\n`;
        });
    }

    return deepFreeze({
        success: res.success,
        differences: res.differences,
        reportString
    });
}

/**
 * Factory instantiating a parity validator instance.
 */
function createParityValidator() {
    return deepFreeze({
        validateParity,
        generateParityReport,
        version: PARITY_VALIDATOR_VERSION
    });
}

module.exports = {
    createParityValidator,
    validateParity,
    generateParityReport,
    PARITY_VALIDATOR_VERSION
};
