const axios = require("axios");
const path = require("path");

/**
 * Stage 1: Requirement Analysis using Z.ai
 * Takes prompt and user preferences, and returns a structured specification JSON.
 */
const analyzeRequirements = async ({ prompt }) => {
    try {
        const systemPrompt = `You are a professional software architect. Analyze the user's natural language project description and dynamically determine the requirements to build a complete minimum runnable project.
You must treat the user's prompt as the single source of project requirements. Explicit user requirements MUST override any AI assumptions or default choices. Do not replace explicit user requirements with defaults, and never silently force a fixed tech stack (e.g. React/Express/MongoDB/JWT) unless requested or suitable for the prompt.

You MUST return a strict JSON object that conforms EXACTLY to the following structure. Do not return any other text, markdown formatting (outside of markdown codeblocks), or explanations.

JSON SCHEMA:
{
  "projectName": "Alphanumeric project name (e.g. FitTracker, Portfolio, RestAPI). Use a name inferred from prompt.",
  "projectType": "Descriptive type (e.g. MERN Application, Next.js Portfolio, Python FastAPI REST API, React Landing Page)",
  "frontend": "Frontend runtime/framework/library and version if specified (e.g. 'React (Vite) 18.2', 'Next.js 14', 'HTML/JS', 'None')",
  "backend": "Backend runtime/framework/library and version if specified (e.g. 'Express.js (Node)', 'FastAPI (Python) 0.100', 'None')",
  "database": "Database and ORM if specified (e.g. 'MongoDB with Mongoose', 'PostgreSQL with Prisma', 'None')",
  "authentication": "Authentication and authorization mechanism (e.g. 'JWT Authentication', 'Cookie Auth', 'None')",
  "designRequirements": "Design/UI styling library or description (e.g. 'Tailwind CSS', 'Vanilla CSS', 'Bootstrap', 'None')",
  "pagesAndRoutes": [
    { "path": "/path", "name": "Page Name", "description": "Short explanation of purpose" }
  ],
  "components": [
    { "name": "ComponentName", "purpose": "Short explanation of purpose" }
  ],
  "backendApis": [
    { "method": "GET/POST/etc", "path": "/api/path", "purpose": "Description of behavior" }
  ],
  "databaseModels": [
    { "name": "ModelName", "fields": ["field1 (Type)", "field2 (Type)"] }
  ],
  "integrations": [
    "External services, libraries, or integrations (e.g. Stripe, SendGrid, none)"
  ],
  "importantDependencies": [
    "List of libraries or packages required (e.g. 'react-router-dom', 'jsonwebtoken', 'fastapi', 'pg', 'bcryptjs')"
  ],
  "environmentVariables": [
    "Required environment variable names, e.g. ['PORT', 'DATABASE_URL', 'JWT_SECRET']. Do not include values."
  ],
  "architectureConstraints": [
    "Architectural guidelines or folder layout structures"
  ],
  "runBuildRequirements": {
    "runScript": "Command to run dev/start server",
    "buildScript": "Command to build production bundle, if applicable"
  },
  "deploymentRequirements": "Deployment requirements or hosting targets if specified (e.g. 'Vercel', 'Render', 'none')",
  "assumptions": [
    "Logical assumptions/decisions made to fill unspecified gaps in the prompt"
  ]
}

Ensure the technology selection represents the BEST fit for the request. Choose mutually compatible technologies and dependencies. Avoid unnecessary packages and overengineering. Make minimal reasonable assumptions where requirements are missing and record them in the 'assumptions' array.`;

        const userPrompt = `USER REQUEST:
"${prompt}"`;

        console.log("PROJECT SERVICE: Analyzing requirements with Z.ai...");

        const response = await axios.post(
            `${process.env.ZAI_BASE_URL}/chat/completions`,
            {
                model: process.env.ZAI_MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                stream: false
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.ZAI_API_KEY}`,
                    "Content-Type": "application/json",
                },
                timeout: 60000
            }
        );

        let content = response.data.choices[0].message.content.trim();
        console.log("PROJECT SERVICE: Received Z.ai analysis response");

        // Clean up markdown block wraps if present
        content = content.replace(/^```json\r?\n/i, "").replace(/^```\r?\n/i, "").replace(/\r?\n```$/, "").trim();

        let spec;
        try {
            spec = JSON.parse(content);
        } catch (parseErr) {
            console.error("FAILED TO PARSE Z.AI REQUIREMENTS RESPONSE JSON:\n", content);
            throw new Error("Returned AI requirements specification was not valid JSON: " + parseErr.message);
        }

        // Validate structure and fill defaults
        return {
            projectName: spec.projectName || "MyProject",
            projectType: spec.projectType || "Web Application",
            frontend: spec.frontend || "None",
            backend: spec.backend || "None",
            database: spec.database || "None",
            authentication: spec.authentication || "None",
            designRequirements: spec.designRequirements || "None",
            pagesAndRoutes: Array.isArray(spec.pagesAndRoutes) ? spec.pagesAndRoutes : [],
            components: Array.isArray(spec.components) ? spec.components : [],
            backendApis: Array.isArray(spec.backendApis) ? spec.backendApis : [],
            databaseModels: Array.isArray(spec.databaseModels) ? spec.databaseModels : [],
            integrations: Array.isArray(spec.integrations) ? spec.integrations : [],
            importantDependencies: Array.isArray(spec.importantDependencies) ? spec.importantDependencies : [],
            environmentVariables: Array.isArray(spec.environmentVariables) ? spec.environmentVariables : [],
            architectureConstraints: Array.isArray(spec.architectureConstraints) ? spec.architectureConstraints : [],
            runBuildRequirements: spec.runBuildRequirements || { runScript: "npm run dev", buildScript: "" },
            deploymentRequirements: spec.deploymentRequirements || "None",
            assumptions: Array.isArray(spec.assumptions) ? spec.assumptions : []
        };

    } catch (error) {
        console.error("PROJECT SERVICE REQUIREMENTS ANALYSIS ERROR:", error.message);
        throw new Error("Failed to analyze requirements: " + (error.response?.data?.error || error.message));
    }
};

/**
 * Resolves a relative path (e.g. ./components/Button) relative to currentFilePath
 */
const resolveRelativePath = (currentFilePath, relativeImportPath) => {
    const currentDir = path.dirname(currentFilePath);
    const joined = path.posix.join(currentDir, relativeImportPath);
    return joined.replace(/^\.\//, ""); // Strip leading ./
};

/**
 * Parses Python dot module imports into relative slash paths
 */
const parsePythonImport = (importString) => {
    const match = /^\.+/.exec(importString);
    if (!match) return null;
    const dots = match[0];
    const modulePath = importString.substring(dots.length).replace(/\./g, '/');
    const parentCount = dots.length - 1;
    let prefix = './';
    if (parentCount > 0) {
        prefix = '../'.repeat(parentCount);
    }
    return prefix + modulePath;
};

/**
 * Validates file path for safety (no parent directory traversals or absolute path components)
 */
const isValidFilePath = (filePath) => {
    if (typeof filePath !== "string") return false;
    if (filePath.startsWith("/") || filePath.startsWith("\\")) return false;
    if (filePath.includes("..")) return false;
    if (/[a-zA-Z]:/i.test(filePath)) return false; // C:\ absolute paths
    return true;
};

/**
 * Validates the generated project files list against specification rules
 */
const validateProjectFiles = (files, projectSpec) => {
    const errors = [];

    if (!files || files.length === 0) {
        errors.push("No files were generated in the codebase.");
        return errors;
    }

    // 1. Safe Path Validation
    files.forEach(file => {
        if (!isValidFilePath(file.name)) {
            errors.push(`Unsafe file path detected: '${file.name}'`);
        }
    });

    const isNodeProject = projectSpec.backend?.toLowerCase().includes("express") || 
                          projectSpec.backend?.toLowerCase().includes("node") || 
                          projectSpec.frontend?.toLowerCase().includes("react") || 
                          projectSpec.frontend?.toLowerCase().includes("vue") || 
                          projectSpec.frontend?.toLowerCase().includes("next") ||
                          files.some(f => f.name === "package.json");

    const isPythonProject = projectSpec.backend?.toLowerCase().includes("fastapi") || 
                            projectSpec.backend?.toLowerCase().includes("python") || 
                            projectSpec.backend?.toLowerCase().includes("django") || 
                            projectSpec.backend?.toLowerCase().includes("flask") ||
                            files.some(f => f.name === "requirements.txt" || f.name === "pyproject.toml");

    // 2. Tech Configuration Checks
    if (isNodeProject) {
        const packageJsonFile = files.find(f => f.name === "package.json");
        if (!packageJsonFile) {
            errors.push("Missing required configuration file 'package.json' for Node.js stack.");
        } else {
            // 3. package.json Syntax Checks
            let packageJson;
            try {
                packageJson = JSON.parse(packageJsonFile.content);
            } catch (e) {
                errors.push(`Invalid JSON syntax in 'package.json': ${e.message}`);
            }

            if (packageJson) {
                // 4. Run Scripts Check according to project type
                const hasVite = files.some(f => f.name.includes("vite.config")) || 
                                (packageJson.dependencies && (packageJson.dependencies.vite || packageJson.devDependencies?.vite));
                const hasNext = files.some(f => f.name.includes("next.config")) || 
                                (packageJson.dependencies && packageJson.dependencies.next);
                
                const isFrontendFramework = (projectSpec.frontend && !projectSpec.frontend.toLowerCase().includes("none")) && (hasVite || hasNext);

                if (isFrontendFramework) {
                    if (!packageJson.scripts || (!packageJson.scripts.build || (!packageJson.scripts.dev && !packageJson.scripts.start))) {
                        errors.push("package.json is missing required 'dev'/'start' and 'build' scripts for frontend framework project.");
                    }
                } else {
                    // Backend-only project
                    if (!packageJson.scripts || (!packageJson.scripts.start && !packageJson.scripts.dev)) {
                        errors.push("package.json is missing 'start' or 'dev' scripts for backend services.");
                    }
                }
            }
        }
    }

    if (isPythonProject) {
        const hasReq = files.some(f => f.name === "requirements.txt" || f.name === "pyproject.toml");
        if (!hasReq) {
            errors.push("Missing dependency configuration file ('requirements.txt' or 'pyproject.toml') for Python stack.");
        }
    }

    // 5. Environment check
    if (projectSpec.environmentVariables && projectSpec.environmentVariables.length > 0) {
        const hasEnvExample = files.some(f => f.name === ".env.example");
        if (!hasEnvExample) {
            errors.push(`Missing required '.env.example' for environment variables: ${projectSpec.environmentVariables.join(", ")}`);
        } else {
            // Never generate real secrets validation
            const envFile = files.find(f => f.name === ".env.example");
            const lines = envFile.content.split("\n");
            lines.forEach(line => {
                const parts = line.split("=");
                if (parts.length > 1) {
                    const val = parts[1].trim();
                    // Basic sanity checks for real API keys / credentials
                    if (val && !val.includes("your") && !val.includes("placeholder") && !val.includes("my_") && !val.includes("change_") && !val.includes("db_") && !val.includes("secret") && !val.includes("example") && !val.includes("local") && val.length > 24 && /^[a-zA-Z0-9_-]+$/.test(val)) {
                        errors.push(`Potential real secret generated in .env.example: Key ${parts[0]}`);
                    }
                }
            });
        }
    }

    // 6. README.md existence
    const hasReadme = files.some(f => f.name.toLowerCase() === "readme.md");
    if (!hasReadme) {
        errors.push("Missing required file 'README.md'.");
    }

    // 7. Relative Local Imports Validation (Safe check)
    files.forEach(file => {
        const ext = path.extname(file.name);
        const isJS = [".js", ".jsx", ".ts", ".tsx"].includes(ext);
        const isPy = ext === ".py";

        if (isJS) {
            // Match all require, import, import(), and export relative statements
            const jsImportRegex = /(?:import\s+(?:[^"';]+)\s+from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)|import\(['"]([^'"]+)['"]\))/g;
            let match;
            while ((match = jsImportRegex.exec(file.content)) !== null) {
                const importPath = match[1] || match[2] || match[3] || match[4];
                if (importPath && (importPath.startsWith("./") || importPath.startsWith("../"))) {
                    const resolved = resolveRelativePath(file.name, importPath);
                    const fileExists = files.some(f => {
                        const base = f.name;
                        return base === resolved || 
                               base === resolved + ".js" || 
                               base === resolved + ".jsx" || 
                               base === resolved + ".ts" || 
                               base === resolved + ".tsx" || 
                               base === resolved + ".json" ||
                               base === resolved + "/index.js" ||
                               base === resolved + "/index.jsx" ||
                               base === resolved + "/index.ts" ||
                               base === resolved + "/index.tsx";
                    });
                    if (!fileExists) {
                        errors.push(`Unresolved relative local import: '${importPath}' in file '${file.name}'`);
                    }
                }
            }
        } else if (isPy) {
            // Python relative dot imports
            const pyImportRegex = /from\s+(\.[^\s]*)\s+import/g;
            let match;
            while ((match = pyImportRegex.exec(file.content)) !== null) {
                const importPath = match[1];
                if (importPath) {
                    const relSlashPath = parsePythonImport(importPath);
                    if (relSlashPath) {
                        const resolved = resolveRelativePath(file.name, relSlashPath);
                        const fileExists = files.some(f => {
                            const base = f.name;
                            return base === resolved + ".py" || 
                                   base === resolved + "/__init__.py" ||
                                   base === resolved;
                        });
                        if (!fileExists) {
                            errors.push(`Unresolved relative local import: '${importPath}' in python file '${file.name}'`);
                        }
                    }
                }
            }
        }
    });

    return errors;
};

/**
 * Parses files content from Z.ai response matching the file blocks
 */
const parseGeneratedFiles = (resultContent) => {
    const files = [];
    const fileRegex = /--- FILE:\s*([^\s]+)\s*---[\s]+([\s\S]*?)[\s]*--- END_FILE ---/g;
    let fileMatch;
    while ((fileMatch = fileRegex.exec(resultContent)) !== null) {
        const filePath = fileMatch[1].trim();
        let content = fileMatch[2];
        content = content.replace(/^```\w*\r?\n/, "").replace(/\r?\n```$/, "");
        files.push({ name: filePath, content });
    }
    return files;
};

/**
 * Generate Run Instructions (Steps & local URLs) dynamically from specification and generated files
 */
const extractRunInstructions = (projectSpec, files) => {
    const prerequisites = [];
    const steps = ["Download and extract the ZIP file."];
    let frontendUrl = "";
    let backendUrl = "";

    const hasMern = projectSpec.projectType?.toLowerCase().includes("mern") || 
                    projectSpec.backend?.toLowerCase().includes("express") || 
                    files.some(f => f.name.includes("server.js") || f.name.includes("backend/"));
    
    const hasNode = files.some(f => f.name === "package.json");
    const hasPython = files.some(f => f.name === "requirements.txt" || f.name === "pyproject.toml");

    if (hasNode) {
        prerequisites.push("Node.js (v18+)");
    }
    if (hasPython) {
        prerequisites.push("Python (3.9+)");
    }
    if (projectSpec.database?.toLowerCase().includes("mongo") || hasMern) {
        prerequisites.push("MongoDB (Local or Atlas)");
    } else if (projectSpec.database?.toLowerCase().includes("postgre")) {
        prerequisites.push("PostgreSQL Server");
    } else if (projectSpec.database?.toLowerCase().includes("redis")) {
        prerequisites.push("Redis Server");
    }

    if (hasMern) {
        frontendUrl = "http://localhost:5173";
        backendUrl = "http://localhost:5000";
        steps.push(
            "Navigate to backend directory, run 'npm install' and create '.env' using '.env.example'.",
            "Start the backend server by running 'npm run dev' or 'npm start'.",
            "Navigate to frontend directory, run 'npm install' to install client libraries.",
            "Start the frontend dashboard by running 'npm run dev'.",
            `Open browser at ${frontendUrl} to view application.`
        );
    } else if (hasNode) {
        frontendUrl = "http://localhost:3000";
        const packageJsonFile = files.find(f => f.name === "package.json");
        let startCmd = "npm run dev";
        if (packageJsonFile) {
            try {
                const pj = JSON.parse(packageJsonFile.content);
                if (pj.scripts && pj.scripts.start && !pj.scripts.dev) {
                    startCmd = "npm start";
                }
            } catch (e) {}
        }
        steps.push(
            "Open directory in terminal.",
            "Run 'npm install' to fetch dependencies.",
            `Start local server by running '${startCmd}'.`,
            `Open browser at ${frontendUrl} to view.`
        );
    } else if (hasPython) {
        backendUrl = "http://localhost:8000";
        const isFastapi = projectSpec.backend?.toLowerCase().includes("fastapi");
        const runCmd = isFastapi ? "uvicorn main:app --reload" : "python manage.py runserver";
        steps.push(
            "Create a python virtual environment: 'python -m venv venv'.",
            "Activate virtual environment: 'source venv/bin/activate' (Linux/macOS) or 'venv\\Scripts\\activate' (Windows).",
            "Install python packages: 'pip install -r requirements.txt'.",
            `Run local development app: '${runCmd}'.`
        );
    } else {
        steps.push(
            "Open the project directory.",
            "Double-click index.html to launch visual components in the browser."
        );
    }

    return {
        prerequisites,
        steps,
        frontendUrl: frontendUrl || undefined,
        backendUrl: backendUrl || undefined
    };
};

/**
 * Stage 2: Scaffold files and run Validation & Repair loops
 */
const generateProject = async ({ originalPrompt, projectSpec }) => {
    try {
        const { orchestrateGeneration } = require("./generationOrchestrator");
        const mockEmitter = {
            emit: (stage, text) => console.log(`[Progress] ${stage}: ${text}`),
            end: () => {}
        };
        const data = await orchestrateGeneration(
            { originalPrompt, projectSpec },
            mockEmitter,
            () => {}
        );
        return {
            success: true,
            result: data.summary,
            files: data.files,
            runInstructions: data.runInstructions,
            summary: data.summary,
            model: data.model
        };
    } catch (error) {
        console.error("PROJECT GENERATION SERVICE EXCEPTION:", error.message);
        throw error;
    }
};

module.exports = {
    analyzeRequirements,
    generateProject,
    validateProjectFiles,
    isValidFilePath
};
