"use strict";

const { verificationErrors, verificationSeverity, verificationCategory } = require("./verificationErrors");

/**
 * Validates JSON syntax across package.json files.
 * 
 * @param {Array} files Generated files list
 */
function checkSyntax(files) {
    const errors = [];
    if (!Array.isArray(files)) return errors;

    files.forEach(file => {
        if (typeof file !== "object" || file === null) return;
        const name = file.name || file.path || "";
        if (name.endsWith("package.json")) {
            try {
                JSON.parse(file.content);
            } catch (err) {
                errors.push({
                    code: verificationErrors.VERIFICATION_SYNTAX_ERROR,
                    severity: verificationSeverity.ERROR,
                    category: verificationCategory.SYNTAX,
                    path: name,
                    message: `Invalid JSON syntax in '${name}': ${err.message}`
                });
            }
        }
    });

    return errors;
}

module.exports = {
    checkSyntax
};
