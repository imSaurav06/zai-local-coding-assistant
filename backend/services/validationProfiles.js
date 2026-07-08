const path = require("path");
const { buildSharedContracts } = require("./contractBuilder");

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

/**
 * Detect common JSX syntax errors that esbuild will reject at build time.
 * Example: <{icon} /> is invalid — must use a capitalized variable: const Icon = icon; <Icon />
 */
const validateJsxSyntax = (files) => {
    const errors = [];
    for (const file of files) {
        const filePath = file.name.replace(/\\/g, "/");
        if (filePath.endsWith(".jsx") || filePath.endsWith(".tsx")) {
            // Detect <{expr pattern — invalid dynamic component shorthand
            if (/<\{/.test(file.content)) {
                errors.push(
                    `File '${filePath}' contains invalid JSX syntax '<{...}'. ` +
                    `Dynamic components must be assigned to a capitalized variable: ` +
                    `const DynComp = myProp; return <DynComp />;`
                );
            }
            // Detect invalid closing tags with extra text or attributes (e.g., </h1 testing>)
            const invalidClosingTagRegex = /<\/([a-zA-Z0-9]+)\s+[^>]+>/g;
            let match;
            while ((match = invalidClosingTagRegex.exec(file.content)) !== null) {
                errors.push(
                    `File '${filePath}' contains invalid JSX closing tag '${match[0]}'. Closing tags must not contain attributes or extra text.`
                );
            }
        }
    }
    return errors;
};

const validateExternalDependencies = (files, errors) => {
    const packageJsonFile = files.find(f => f.name === "package.json");
    if (!packageJsonFile) return;

    let declaredDeps = new Set();
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
        return;
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

    // 5. Validate external dependencies are declared in package.json
    validateExternalDependencies(files, errors);

    // 5b. Validate JSX syntax correctness (catch invalid dynamic component patterns)
    const jsxSyntaxErrors = validateJsxSyntax(files);
    errors.push(...jsxSyntaxErrors);

    // 6. Stack-aware React + Vite completeness validation
    const tech = (((projectSpec && projectSpec.frontend) || "") + " " + ((projectSpec && projectSpec.backend) || "") + " " + ((projectSpec && projectSpec.database) || "")).toLowerCase();
    const isReactVite = tech.includes("react") || tech.includes("vite") || files.some(f => f.name === "vite.config.js");

    if (isReactVite) {
        const reqFiles = [
            "package.json",
            "index.html",
            "vite.config.js",
            "src/main.jsx",
            "src/App.jsx",
            "src/index.css"
        ];

        // Ensure all specification contract folder structure files are generated
        if (projectSpec) {
            try {
                const contracts = buildSharedContracts(projectSpec);
                if (contracts && contracts.folderStructure) {
                    contracts.folderStructure.forEach(pathKey => {
                        const cleanPath = pathKey.replace(/\\/g, "/");
                        if (!reqFiles.includes(cleanPath)) {
                            reqFiles.push(cleanPath);
                        }
                    });
                }
            } catch (e) {
                console.error("Failed building contracts during validation:", e.message);
            }
        }
        
        reqFiles.forEach(rf => {
            const exists = files.some(f => f.name === rf);
            if (!exists) {
                errors.push(`Missing required file '${rf}'.`);
            }
        });

        // HTML Entry reference check
        const htmlFile = files.find(f => f.name === "index.html");
        if (htmlFile) {
            const hasEntryRef = /src\/main\.(jsx|js)/i.test(htmlFile.content);
            if (!hasEntryRef) {
                errors.push("index.html does not reference a valid entry path (expected src/main.jsx or src/main.js).");
            }
        }

        // Main Entry file check
        const mainFile = files.find(f => f.name === "src/main.jsx" || f.name === "src/main.js");
        if (mainFile) {
            const hasAppImport = /import\s+App\s+from/i.test(mainFile.content) || /require\(['"]\.\/App/i.test(mainFile.content);
            if (!hasAppImport) {
                errors.push("Entry module does not import the root application component 'App'.");
            }
        }

        // Tailwind CSS directive check
        const hasTailwind = tech.includes("tailwind") || (packageJsonFile && packageJsonFile.content.includes("tailwindcss"));
        if (hasTailwind) {
            const cssFile = files.find(f => f.name === "src/index.css" || f.name.endsWith(".css"));
            if (cssFile) {
                const hasTailwindDirectives = /@tailwind|@import\s+['"]tailwindcss['"]/i.test(cssFile.content);
                if (!hasTailwindDirectives) {
                    errors.push("Tailwind CSS configuration is present but Tailwind directives are not defined in any stylesheet.");
                }
            }
        }

        // Custom Prompt-specific UI check
        const appFile = files.find(f => f.name === "src/App.jsx");
        if (appFile) {
            // Check that App.jsx contains more than standard boilerplate
            const cleanContent = appFile.content.replace(/\s+/g, "");
            if (cleanContent.length < 90) {
                console.log(`[VALIDATION DEBUG] App.jsx content (length=${cleanContent.length}):\n${appFile.content}`);
                errors.push("src/App.jsx only contains boilerplate/placeholder code and lacks implementation of the requested project.");
            }
        }
    }

    return errors;
};

module.exports = { validateProjectFiles, validateJsonSyntax, validateRelativeImports };
