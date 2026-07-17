"use strict";

const path = require("path");
const { verificationErrors, verificationSeverity, verificationCategory } = require("./verificationErrors");
const { createVerificationResult } = require("./verificationResult");
const { checkSyntax } = require("./syntaxChecker");
const { checkImports } = require("./importChecker");
const { checkDependencies } = require("./dependencyChecker");

/**
 * Public coordinator to verify files list.
 * 
 * @param {Array} files List of generated file entries
 * @param {Object} [options] Optional parameters e.g., projectSpec
 */
function runVerification(files, options = {}) {
    try {
        const errors = [];
        const warnings = [];

        if (!Array.isArray(files) || files.length === 0) {
            errors.push({
                code: verificationErrors.VERIFICATION_STRUCTURE_ERROR,
                severity: verificationSeverity.ERROR,
                category: verificationCategory.STRUCTURE,
                path: "",
                message: "No files were generated in the codebase."
            });
            return createVerificationResult(false, errors, warnings);
        }

        // 1. Safe path validation (Global check)
        for (const file of files) {
            if (typeof file !== "object" || file === null) continue;
            const name = file.name || file.path || "";
            if (name.includes("..") || path.isAbsolute(name)) {
                errors.push({
                    code: verificationErrors.VERIFICATION_STRUCTURE_ERROR,
                    severity: verificationSeverity.ERROR,
                    category: verificationCategory.STRUCTURE,
                    path: name,
                    message: `Invalid file path detected: '${name}'`
                });
            }
        }

        // 2. JSON syntax check
        errors.push(...checkSyntax(files));

        // 3. Delegate profile-specific validations
        const projectSpec = options.projectSpec || {};
        const { detectProfile } = require("../../services/stackProfiles");
        const profile = detectProfile(projectSpec);

        if (profile && typeof profile.validate === "function") {
            try {
                const profileErrors = profile.validate(files, projectSpec);
                if (Array.isArray(profileErrors)) {
                    profileErrors.forEach(errStr => {
                        errors.push({
                            code: verificationErrors.VERIFICATION_PROFILE_ERROR,
                            severity: verificationSeverity.ERROR,
                            category: verificationCategory.PROFILE,
                            path: "",
                            message: errStr
                        });
                    });
                }
            } catch (err) {
                errors.push({
                    code: verificationErrors.VERIFICATION_PROFILE_ERROR,
                    severity: verificationSeverity.ERROR,
                    category: verificationCategory.PROFILE,
                    path: "",
                    message: `Profile specific validation failed: ${err.message}`
                });
            }
        }

        // 4. Relative imports validation
        if (profile && profile.name === "mern") {
            const frontendFiles = files.filter(f => {
                if (typeof f !== "object" || f === null) return false;
                const name = f.name || f.path || "";
                return name.startsWith("frontend/");
            });
            const backendFiles = files.filter(f => {
                if (typeof f !== "object" || f === null) return false;
                const name = f.name || f.path || "";
                return name.startsWith("backend/");
            });
            errors.push(...checkImports(frontendFiles));
            errors.push(...checkImports(backendFiles));
        } else {
            errors.push(...checkImports(files));
        }

        // 5. External dependencies validation
        errors.push(...checkDependencies(files));

        // 6. README check (Global check)
        const hasReadme = files.some(f => {
            if (typeof f !== "object" || f === null) return false;
            const name = f.name || f.path || "";
            return name.toLowerCase() === "readme.md";
        });
        if (!hasReadme) {
            errors.push({
                code: verificationErrors.VERIFICATION_STRUCTURE_ERROR,
                severity: verificationSeverity.ERROR,
                category: verificationCategory.STRUCTURE,
                path: "readme.md",
                message: "Missing required file 'README.md'."
            });
        }

        const success = errors.length === 0;
        return createVerificationResult(success, errors, warnings, { profileName: profile ? profile.name : null });

    } catch (err) {
        return createVerificationResult(false, [{
            code: verificationErrors.VERIFICATION_INTERNAL_ERROR,
            severity: verificationSeverity.ERROR,
            category: verificationCategory.INTERNAL,
            path: "",
            message: `Unexpected internal error: ${err.message}`
        }]);
    }
}

module.exports = {
    runVerification,
    verificationErrors,
    verificationResult: { createVerificationResult }
};
