const path = require("path");

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

const validateProjectFiles = (files, projectSpec) => {
    const errors = [];

    if (!files || files.length === 0) {
        errors.push("No files were generated in the codebase.");
        return errors;
    }

    // 1. Safe path validation
    for (const file of files) {
        if (file.name.includes("..") || path.isAbsolute(file.name)) {
            errors.push(`Invalid file path detected: '${file.name}'`);
        }
    }

    // 2. Syntax validation for configuration files
    const packageJsonFile = files.find(f => f.name === "package.json");
    if (packageJsonFile) {
        const jsonErr = validateJsonSyntax(packageJsonFile.content);
        if (jsonErr) {
            errors.push(`Invalid JSON syntax in 'package.json': ${jsonErr}`);
        }
    }

    // 3. Dependency validation (Check README exists)
    const hasReadme = files.some(f => f.name.toLowerCase() === "readme.md");
    if (!hasReadme) {
        errors.push("Missing required file 'README.md'.");
    }

    // 4. Validate relative local imports safely
    const importErrors = validateRelativeImports(files);
    errors.push(...importErrors);

    return errors;
};

module.exports = { validateProjectFiles, validateJsonSyntax, validateRelativeImports };
