"use strict";

const { runVerification } = require("../core/verification");
const { checkImports } = require("../core/verification/importChecker");

/**
 * Legacy compatibility wrapper validating generated project files list.
 * Delegates to the new decoupled VerificationEngine.
 */
const validateProjectFiles = (files, projectSpec) => {
    const result = runVerification(files, { projectSpec });
    return result.errors.map(err => err.message);
};

/**
 * Legacy JSON syntax validator.
 */
const validateJsonSyntax = (content) => {
    try {
        JSON.parse(content);
        return null;
    } catch (err) {
        return err.message;
    }
};

/**
 * Legacy relative import validator.
 */
const validateRelativeImports = (files) => {
    const errors = checkImports(files);
    return errors.map(err => err.message);
};

module.exports = {
    validateProjectFiles,
    validateJsonSyntax,
    validateRelativeImports
};
