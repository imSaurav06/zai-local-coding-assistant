"use strict";

const path = require("path");
const { verificationErrors } = require("./verificationErrors");

/**
 * Validates local relative imports for JS/JSX/TS/TSX files.
 * 
 * @param {Array} files Generated files list
 */
function checkImports(files) {
    const errors = [];
    if (!Array.isArray(files)) return errors;

    const fileMap = new Map();
    files.forEach(f => {
        if (typeof f === "object" && f !== null) {
            const name = f.name || f.path || "";
            fileMap.set(name.replace(/\\/g, "/"), f.content);
        }
    });

    for (const file of files) {
        if (typeof file !== "object" || file === null) continue;
        const filePath = (file.name || file.path || "").replace(/\\/g, "/");
        const dir = path.dirname(filePath);

        if (filePath.endsWith(".js") || filePath.endsWith(".jsx") || filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
            const importFromRegex = /(?:import|export)\s+[\s\S]*?\s+from\s+['"](\.\.?\/[^'"]+)['"]/g;
            const importDirectRegex = /import\s+['"](\.\.?\/[^'"]+)['"]/g;
            const requireRegex = /require\s*\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g;

            let match;
            const content = file.content;
            if (typeof content !== "string") continue;

            const checkImport = (relPath) => {
                if (relPath.endsWith(".svg") || relPath.endsWith(".png") ||
                    relPath.endsWith(".jpg") || relPath.endsWith(".jpeg") || relPath.endsWith(".gif") ||
                    relPath.endsWith(".ico") || relPath.endsWith(".woff") || relPath.endsWith(".woff2")) {
                    return;
                }
                const resolved = path.join(dir, relPath).replace(/\\/g, "/");
                const extensions = ["", ".js", ".jsx", ".ts", ".tsx", "/index.js", "/index.jsx"];
                const exists = extensions.some(ext => fileMap.has(resolved + ext));
                if (!exists) {
                    errors.push({
                        code: verificationErrors.VERIFICATION_IMPORT_ERROR,
                        path: filePath,
                        message: `File '${filePath}' imports missing local module '${relPath}' (resolved as '${resolved}').`
                    });
                }
            };

            while ((match = importFromRegex.exec(content)) !== null) {
                checkImport(match[1]);
            }
            while ((match = importDirectRegex.exec(content)) !== null) {
                checkImport(match[1]);
            }
            while ((match = requireRegex.exec(content)) !== null) {
                checkImport(match[1]);
            }
        }
    }

    return errors;
}

module.exports = {
    checkImports
};
