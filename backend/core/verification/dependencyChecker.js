"use strict";

const { verificationErrors, verificationSeverity, verificationCategory } = require("./verificationErrors");

/**
 * Validates external package imports against package.json declarations.
 * 
 * @param {Array} files Generated files list
 */
function checkDependencies(files) {
    const errors = [];
    if (!Array.isArray(files)) return errors;

    const packageJsonFiles = files.filter(f => {
        if (typeof f !== "object" || f === null) return false;
        const name = f.name || f.path || "";
        return name === "package.json" ||
               name === "frontend/package.json" ||
               name === "backend/package.json";
    });

    if (packageJsonFiles.length === 0) return errors;

    let declaredDeps = new Set();
    for (const packageJsonFile of packageJsonFiles) {
        try {
            const pj = JSON.parse(packageJsonFile.content);
            if (pj.dependencies) {
                Object.keys(pj.dependencies).forEach(k => declaredDeps.add(k));
            }
            if (pj.devDependencies) {
                Object.keys(pj.devDependencies).forEach(k => declaredDeps.add(k));
            }
        } catch (e) {
            // Syntax error already handled by syntaxChecker
        }
    }

    const builtins = new Set([
        "path", "fs", "child_process", "net", "http", "https", "os", "crypto", 
        "util", "events", "stream", "url", "querystring", "zlib", "assert", 
        "buffer", "dns", "readline", "vm"
    ]);

    const getBasePackageName = (importPath) => {
        if (importPath.startsWith("@")) {
            const parts = importPath.split("/");
            return parts.slice(0, 2).join("/");
        } else {
            return importPath.split("/")[0];
        }
    };

    files.forEach(file => {
        if (typeof file !== "object" || file === null) return;
        const filePath = (file.name || file.path || "").replace(/\\/g, "/");
        if (filePath.endsWith(".js") || filePath.endsWith(".jsx") || filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
            const importFromRegex = /(?:import|export)\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g;
            const importDirectRegex = /import\s+['"]([^'"]+)['"]/g;
            const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

            let match;
            const content = file.content;
            if (typeof content !== "string") return;

            const checkPkg = (impPath) => {
                if (impPath.startsWith(".") || impPath.startsWith("/")) {
                    return; // Local import
                }
                const basePkg = getBasePackageName(impPath);
                if (builtins.has(basePkg)) {
                    return; // Node built-in
                }
                if (!declaredDeps.has(basePkg)) {
                    errors.push({
                        code: verificationErrors.VERIFICATION_DEPENDENCY_ERROR,
                        severity: verificationSeverity.ERROR,
                        category: verificationCategory.DEPENDENCY,
                        path: filePath,
                        message: `File '${filePath}' imports undeclared external package '${basePkg}' (requested as '${impPath}').`
                    });
                }
            };

            while ((match = importFromRegex.exec(content)) !== null) {
                checkPkg(match[1]);
            }
            while ((match = importDirectRegex.exec(content)) !== null) {
                checkPkg(match[1]);
            }
            while ((match = requireRegex.exec(content)) !== null) {
                checkPkg(match[1]);
            }
        }
    });

    return errors;
}

module.exports = {
    checkDependencies
};
