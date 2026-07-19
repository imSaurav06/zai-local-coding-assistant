"use strict";

const { normalizePath } = require("./requirementEvidence");

/**
 * Validates generatedFiles against structured interface contracts.
 */
function validateContracts(contracts, generatedFiles) {
    const errors = [];
    const warnings = [];

    if (!contracts || typeof contracts !== "object") {
        errors.push("Missing or invalid contracts specification.");
        return { success: false, errors, warnings };
    }

    if (!Array.isArray(generatedFiles)) {
        errors.push("Missing or invalid generated files list.");
        return { success: false, errors, warnings };
    }

    const filePaths = new Set(
        generatedFiles.map(f => normalizePath(f.name || f.path || "").toLowerCase())
    );

    // 1. Validate Folder Structure compliance
    if (Array.isArray(contracts.folderStructure)) {
        for (const expectedPath of contracts.folderStructure) {
            const normalizedExpected = normalizePath(expectedPath).toLowerCase();
            
            // Check for direct match or partial path matching
            let found = false;
            for (const path of filePaths) {
                if (path === normalizedExpected || path.endsWith(normalizedExpected)) {
                    found = true;
                    break;
                }
            }

            if (!found) {
                errors.push(`Contract Violation: Expected file path '${expectedPath}' is missing from generated files.`);
            }
        }
    }

    // 2. Validate API Endpoint contracts compliance
    if (Array.isArray(contracts.apiEndpoints)) {
        for (const api of contracts.apiEndpoints) {
            const apiPath = api.path;
            const apiMethod = (api.method || "").toLowerCase();

            // Search in generated file contents to see if path is referenced
            let referenced = false;
            for (const file of generatedFiles) {
                const content = file.content || "";
                if (apiPath && content.includes(apiPath)) {
                    if (apiMethod && content.toLowerCase().includes(apiMethod)) {
                        referenced = true;
                        break;
                    }
                }
            }

            if (!referenced) {
                warnings.push(`Contract Warning: API endpoint contract '${api.method || "GET"} ${apiPath}' could not be verified in any file content.`);
            }
        }
    }

    // 3. Validate Database Schema contracts compliance
    if (Array.isArray(contracts.databaseSchemas)) {
        for (const schema of contracts.databaseSchemas) {
            const schemaName = schema.name;

            // Search in generated files (specifically in model files or connection files)
            let foundSchema = false;
            for (const file of generatedFiles) {
                const content = file.content || "";
                const nameLower = normalizePath(file.name || file.path || "").toLowerCase();
                
                if (nameLower.includes(schemaName.toLowerCase())) {
                    foundSchema = true;
                    break;
                } else if (content.includes(`mongoose.model`) && content.includes(schemaName)) {
                    foundSchema = true;
                    break;
                }
            }

            if (!foundSchema) {
                warnings.push(`Contract Warning: Database schema contract '${schemaName}' could not be verified in model files.`);
            }
        }
    }

    return {
        success: errors.length === 0,
        errors,
        warnings
    };
}

module.exports = {
    validateContracts
};
