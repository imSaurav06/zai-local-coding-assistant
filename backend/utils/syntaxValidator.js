const parser = require("@babel/parser");

/**
 * Validates syntax of a JavaScript/JSX code block.
 * Returns null if valid, or an error object { filePath, errorType, reason } if invalid.
 */
function validateJsSyntax(content, filePath) {
    try {
        parser.parse(content, {
            sourceType: "unambiguous",
            plugins: [
                "jsx",
                "typescript",
                "classProperties",
                "objectRestSpread",
                "dynamicImport",
                "decorators-legacy",
                "exportDefaultFrom"
            ]
        });
        return null;
    } catch (err) {
        return {
            filePath,
            errorType: "SyntaxError",
            reason: `${err.message} (line ${err.loc?.line}, col ${err.loc?.column})`
        };
    }
}

/**
 * Scans a list of files and returns structured errors for any with syntax errors.
 */
function validateSyntax(files) {
    const errors = [];
    for (const file of files) {
        const lowerName = file.name.toLowerCase();
        if (lowerName.endsWith(".js") || lowerName.endsWith(".jsx") || lowerName.endsWith(".mjs") || lowerName.endsWith(".cjs")) {
            const err = validateJsSyntax(file.content || "", file.name);
            if (err) {
                errors.push(err);
            }
        }
    }
    return errors;
}

module.exports = {
    validateJsSyntax,
    validateSyntax
};
