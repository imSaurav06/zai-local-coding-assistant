const path = require("path");
const { buildSharedContracts, isMernStack } = require("./contractBuilder");
const { detectProfile } = require("./stackProfiles");

const validateJsonSyntax = (content) => {
    try {
        JSON.parse(content);
        return null;
    } catch (err) {
        return err.message;
    }
};

const validateRelativeImports = (files) => {
    const errors = [];
    const fileMap = new Map();
    files.forEach(f => fileMap.set(f.name.replace(/\\/g, "/"), f.content));

    for (const file of files) {
        const filePath = file.name.replace(/\\/g, "/");
        const dir = path.dirname(filePath);

        // Check relative imports for JS/JSX/TS/TSX
        if (filePath.endsWith(".js") || filePath.endsWith(".jsx") || filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
            // Match relative imports or requires e.g. import x from './y', import './styles.css' or require('../z')
            const importFromRegex = /(?:import|export)\s+[\s\S]*?\s+from\s+['"](\.\.?\/[^'"]+)['"]/g;
            const importDirectRegex = /import\s+['"](\.\.?\/[^'"]+)['"]/g;
            const requireRegex = /require\s*\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g;

            let match;
            const content = file.content;

            const checkImport = (relPath) => {
                // Skip asset imports — they don't need to be in the file map
                if (relPath.endsWith(".svg") || relPath.endsWith(".png") ||
                    relPath.endsWith(".jpg") || relPath.endsWith(".jpeg") || relPath.endsWith(".gif") ||
                    relPath.endsWith(".ico") || relPath.endsWith(".woff") || relPath.endsWith(".woff2")) {
                    return;
                }
                // Resolve relative path
                let resolved = path.join(dir, relPath).replace(/\\/g, "/");
                
                // Check if file exists under resolved name or with JS/JSX extensions
                const extensions = ["", ".js", ".jsx", ".ts", ".tsx", "/index.js", "/index.jsx"];
                const exists = extensions.some(ext => fileMap.has(resolved + ext));
                if (!exists) {
                    errors.push(`File '${filePath}' imports missing local module '${relPath}' (resolved as '${resolved}').`);
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
};

const validateExternalDependencies = (files, errors) => {
    // Find all package.json files (could be root, frontend/, backend/)
    const packageJsonFiles = files.filter(f =>
        f.name === "package.json" ||
        f.name === "frontend/package.json" ||
        f.name === "backend/package.json"
    );

    if (packageJsonFiles.length === 0) return;

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
            // Syntax error already handled elsewhere
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
        const filePath = file.name.replace(/\\/g, "/");
        if (filePath.endsWith(".js") || filePath.endsWith(".jsx") || filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
            const importFromRegex = /(?:import|export)\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g;
            const importDirectRegex = /import\s+['"]([^'"]+)['"]/g;
            const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

            let match;
            const content = file.content;

            const checkPkg = (impPath) => {
                if (impPath.startsWith(".") || impPath.startsWith("/")) {
                    return; // Local import
                }
                const basePkg = getBasePackageName(impPath);
                if (builtins.has(basePkg)) {
                    return; // Node built-in
                }
                if (!declaredDeps.has(basePkg)) {
                    errors.push(`File '${filePath}' imports undeclared external package '${basePkg}' (requested as '${impPath}').`);
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
};

const validateProjectFiles = (files, projectSpec) => {
    const errors = [];

    if (!files || files.length === 0) {
        errors.push("No files were generated in the codebase.");
        return errors;
    }

    // 1. Safe path validation (Global check)
    for (const file of files) {
        if (file.name.includes("..") || path.isAbsolute(file.name)) {
            errors.push(`Invalid file path detected: '${file.name}'`);
        }
    }

    // 2. Validate json syntax in all package.json files (Global check)
    files.forEach(f => {
        if (f.name.endsWith("package.json")) {
            const jsonErr = validateJsonSyntax(f.content);
            if (jsonErr) {
                errors.push(`Invalid JSON syntax in '${f.name}': ${jsonErr}`);
            }
        }
    });

    // 3. Delegate profile-specific validations
    const profile = detectProfile(projectSpec);
    if (profile && typeof profile.validate === "function") {
        const profileErrors = profile.validate(files, projectSpec);
        errors.push(...profileErrors);
    }

    // 4. Validate relative imports (Global check)
    // Run separate import validation for subfolders if it's MERN
    if (profile.name === "mern") {
        const frontendFiles = files.filter(f => f.name.startsWith("frontend/"));
        const backendFiles = files.filter(f => f.name.startsWith("backend/"));
        errors.push(...validateRelativeImports(frontendFiles));
        errors.push(...validateRelativeImports(backendFiles));
    } else {
        errors.push(...validateRelativeImports(files));
    }

    // 5. Validate external dependencies (Global check)
    validateExternalDependencies(files, errors);

    // 6. README check (Global check)
    const hasReadme = files.some(f => f.name.toLowerCase() === "readme.md");
    if (!hasReadme) {
        errors.push("Missing required file 'README.md'.");
    }

    return errors;
};

module.exports = {
    validateProjectFiles,
    validateJsonSyntax,
    validateRelativeImports
};
