const { planGeneration } = require("./generationPlanner");
const { generateScaffoldFiles } = require("./scaffoldRegistry");
const { buildSharedContracts, buildProjectManifest, isMernStack } = require("./contractBuilder");
const aiExecutor = require("./aiGenerationExecutor");
const { mergeFiles } = require("./generationMerger");
const { validateProjectFiles } = require("./validationProfiles");
const { repairAffectedFiles } = require("./targetedRepairService");
const { compileProjectSpec, validateProjectSpec } = require("../core/projectSpec");
const { deriveRequirementIdentities } = require("../core/requirements");

// Internal tracing hooks for unit testing only
const _testHooks = {
    compileProjectSpec,
    deriveRequirementIdentities
};

/**
 * Orchestrates compilation and identity derivation exactly once per run.
 */
function prepareCanonicalProjectSpec(legacyPayload) {
    // If input is already a deeply frozen canonical ProjectSpec, skip compilation to avoid double-compilation.
    if (legacyPayload && Object.isFrozen(legacyPayload) && legacyPayload.schemaVersion === "1.0") {
        const validation = validateProjectSpec(legacyPayload);
        if (validation.success) {
            const identityResult = _testHooks.deriveRequirementIdentities(legacyPayload);
            if (!identityResult.success) {
                const err = new Error("Requirement Identity derivation failed: " + (identityResult.errors || []).map(e => `${e.path || 'root'}: ${e.message}`).join("; "));
                err.code = "PROJECT_PREPARATION_IDENTITY_FAILED";
                err.errors = identityResult.errors;
                throw err;
            }
            return {
                projectSpec: legacyPayload,
                requirementIdentity: identityResult
            };
        }
    }

    const compilation = _testHooks.compileProjectSpec(legacyPayload);
    if (!compilation.success) {
        const err = new Error("ProjectSpec compilation failed: " + (compilation.errors || []).map(e => `${e.path || 'root'}: ${e.message}`).join("; "));
        err.code = "PROJECT_PREPARATION_COMPILE_FAILED";
        err.errors = compilation.errors;
        throw err;
    }

    const canonicalSpec = compilation.value;
    const identityResult = _testHooks.deriveRequirementIdentities(canonicalSpec);
    if (!identityResult.success) {
        const err = new Error("Requirement Identity derivation failed: " + (identityResult.errors || []).map(e => `${e.path || 'root'}: ${e.message}`).join("; "));
        err.code = "PROJECT_PREPARATION_IDENTITY_FAILED";
        err.errors = identityResult.errors;
        throw err;
    }

    return {
        projectSpec: canonicalSpec,
        requirementIdentity: identityResult
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT GUARD
// Detects and rejects placeholder / truncated AI output before it persists.
// Patterns caught:
//   - Lines that are purely "..." or "// ..." (ellipsis placeholders)
//   - The literal string "(content given)" from prompt echoing
//   - Files with effectively no content (< 30 non-whitespace characters)
//   - "same as above/before", "rest of code", "implementation omitted", etc.
//   - Markdown code fences persisted as raw source content
// Returns an array of { file, reason } objects for each offending file.
// ─────────────────────────────────────────────────────────────────────────────
const PLACEHOLDER_PATTERNS = [
    // Standalone ellipsis lines (with or without leading comment marker)
    // Matches: '...', '// ...', '  // ...', '# ...' on a line by itself (including indented)
    /^\s*(?:\/\/\s*|#\s*|\/\*\s*)?\.\.\.?\s*$/m,
    // Ellipsis followed by words like 'rest of component', 'content here', etc.
    /^\s*(?:\/\/\s*|#\s*|\/\*\s*)?\.\.\.[,\s]+(?:rest|of|content|component|implementation|code|here|the|continues|more|add|etc)/im,
    // "(content given)" echoed back from prompt
    /\(content given\)/i,
    // "{content}" or "{...}" template placeholders
    /\{content\}/i,
    /\{\.\.\.content\}/i,
    // TODO placeholder that clearly means "not implemented"
    /\/\/\s*TODO:\s*implement\s+content/i,
    // "Add your content here" and similar sentinels
    /add your content here/i,
    /insert content here/i,
    // Truncation sentinels from some models
    /\[\.\.\.truncated\]/i,
    /\[\s*content continues\s*\]/i,
    // "same as above" / "same as before" — means content was omitted by reference
    /same as (?:above|before|previous)/i,
    // "rest of code" / "remaining code" — typical omission phrase
    /(?:rest|remaining)\s+(?:of\s+)?(?:the\s+)?code/i,
    // "implementation omitted" / "code omitted"
    /(?:implementation|code)\s+omitted/i,
    // "existing code" / "existing content" used as a substitute for actual content
    /existing\s+(?:code|content)\s+(?:here|goes|remains)/i,
    // Markdown code fences that were persisted as raw source file content
    // (AI returned the fence wrapper instead of the actual code)
    // NOTE: This pattern is ONLY applied to source files, not to .md/.mdx files.
    // /^```(?:jsx?|tsx?|javascript|typescript|html|css|json|bash|sh)?\s*$/m,
    // (Applied conditionally below in applyContentGuard)
];

// Source-only pattern: markdown fence fences are only invalid in source code files, not in .md docs.
const MARKDOWN_FENCE_PATTERN = /^```(?:jsx?|tsx?|javascript|typescript|html|css|json|bash|sh)?\s*$/m;


const MIN_CONTENT_CHARS = 30; // Non-whitespace characters minimum

const sanitizeMongooseConnectOptions = (files) => {
    for (const file of files) {
        const filePath = file.name.replace(/\\/g, "/");
        if (filePath.endsWith(".js") || filePath.endsWith(".jsx") || filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
            let content = file.content || "";
            if (content.includes("useNewUrlParser") || content.includes("useUnifiedTopology")) {
                let cleaned = content;
                cleaned = cleaned.replace(/useNewUrlParser\s*:\s*(?:true|false)\s*,?/g, "");
                cleaned = cleaned.replace(/useUnifiedTopology\s*:\s*(?:true|false)\s*,?/g, "");
                cleaned = cleaned.replace(/\{\s*,\s*\}/g, "{}");
                cleaned = cleaned.replace(/\{\s*\}/g, "{}");
                cleaned = cleaned.replace(/,\s*\}/g, "}");
                cleaned = cleaned.replace(/\{\s*,/g, "{");
                file.content = cleaned;
                console.log(`[Sanitizer] Stripped obsolete Mongoose options from ${file.name}`);
            }
        }
    }
};

/**
 * Scans all generated files for placeholder or truncated content.
 * Returns validation-style error strings for any that fail.
 */
const applyContentGuard = (files) => {
    const errors = [];
    for (const file of files) {
        const content = file.content || "";

        // 1. Near-empty content guard (skip config-like files and documentation files that legitimately can be tiny)
        const nonWhitespace = content.replace(/\s/g, "");
        const isConfigFile = /\.(json|toml|yaml|yml|env|txt|gitignore|lock|md|mdx)$/.test(file.name) ||
                              file.name === ".env.example" ||
                              file.name === "backend/.env.example" ||
                              file.name === "frontend/.env.example" ||
                              file.name === "postcss.config.js" ||
                              file.name === "frontend/postcss.config.js" ||
                              file.name === "tailwind.config.js" ||
                              file.name === "frontend/tailwind.config.js" ||
                              file.name === "vite.config.js" ||
                              file.name === "frontend/vite.config.js";
        if (!isConfigFile && nonWhitespace.length < MIN_CONTENT_CHARS) {
            errors.push(
                `Content guard: File '${file.name}' has near-empty content (${nonWhitespace.length} non-whitespace chars). ` +
                `The file must be fully implemented, not empty or skeletal.`
            );
            continue; // Don't bother checking patterns on effectively empty files
        }

        // Documentation files (.md, .mdx) legitimately contain markdown code fences.
        // Skip placeholder pattern checks for them entirely.
        const isMarkdown = /\.(md|mdx)$/i.test(file.name);
        if (isMarkdown) continue;

        // 2. Placeholder pattern guard (source files only)
        for (const pattern of PLACEHOLDER_PATTERNS) {
            if (pattern.test(content)) {
                errors.push(
                    `Content guard: File '${file.name}' contains a placeholder or truncated content pattern ` +
                    `matching '${pattern.source.slice(0, 60)}'. The file must contain complete, runnable code.`
                );
                break; // One error per file
            }
        }

        // 3. Markdown fence guard (source files only — not .md/.mdx)
        if (MARKDOWN_FENCE_PATTERN.test(content)) {
            errors.push(
                `Content guard: File '${file.name}' contains a raw markdown code fence wrapper. ` +
                `The AI returned the fence (\`\`\`language...\`\`\`) instead of the actual file content.`
            );
        }
    }
    return errors;
};


// ─────────────────────────────────────────────────────────────────────────────
// RICH PLAN GENERATOR
// Produces a rich, spec-derived markdown document for the PLAN tab.
// This is entirely local — no AI call needed.
// ─────────────────────────────────────────────────────────────────────────────
const generateRichPlan = (projectSpec) => {
    const lines = [];

    // Header
    lines.push(`# ${projectSpec.projectName || "Project"} — Generation Plan`);
    lines.push("");
    lines.push(`**Type:** ${projectSpec.projectType || "Web Application"}`);
    lines.push("");

    // Tech Stack
    lines.push("## Tech Stack");
    lines.push("");
    const stack = [];
    if (projectSpec.frontend && projectSpec.frontend !== "None") stack.push(`**Frontend:** ${projectSpec.frontend}`);
    if (projectSpec.backend && projectSpec.backend !== "None") stack.push(`**Backend:** ${projectSpec.backend}`);
    if (projectSpec.database && projectSpec.database !== "None") stack.push(`**Database:** ${projectSpec.database}`);
    if (projectSpec.authentication && projectSpec.authentication !== "None") stack.push(`**Auth:** ${projectSpec.authentication}`);
    if (projectSpec.designRequirements && projectSpec.designRequirements !== "None") stack.push(`**Styling:** ${projectSpec.designRequirements}`);
    if (stack.length === 0) {
        lines.push("_No specific stack constraints detected._");
    } else {
        stack.forEach(s => lines.push(`- ${s}`));
    }

    // Frontend-only explicit notice
    const isFrontendOnly = (!projectSpec.backend || projectSpec.backend === "None") &&
                           (!projectSpec.database || projectSpec.database === "None") &&
                           (!projectSpec.authentication || projectSpec.authentication === "None");
    if (isFrontendOnly) {
        lines.push("- _Frontend-only: No backend, database, or authentication layer required._");
    }
    lines.push("");

    // Pages & Routes
    if (projectSpec.pagesAndRoutes && projectSpec.pagesAndRoutes.length > 0) {
        lines.push("## Pages & Routes");
        lines.push("");
        lines.push("| Route | Page | Purpose |");
        lines.push("|-------|------|---------|");
        projectSpec.pagesAndRoutes.forEach(p => {
            const path = p.path || "/";
            const name = p.name || "Page";
            const desc = (p.description || "").replace(/\|/g, "\\|");
            lines.push(`| \`${path}\` | ${name} | ${desc} |`);
        });
        lines.push("");
    }

    // Components
    if (projectSpec.components && projectSpec.components.length > 0) {
        lines.push("## UI Components");
        lines.push("");
        projectSpec.components.forEach(c => {
            lines.push(`- **${c.name}** — ${c.purpose || ""}`);
        });
        lines.push("");
    }

    // Backend APIs
    if (projectSpec.backendApis && projectSpec.backendApis.length > 0) {
        lines.push("## Backend API Endpoints");
        lines.push("");
        lines.push("| Method | Path | Purpose |");
        lines.push("|--------|------|---------|");
        projectSpec.backendApis.forEach(api => {
            const purpose = (api.purpose || "").replace(/\|/g, "\\|");
            lines.push(`| \`${api.method || "GET"}\` | \`${api.path || "/"}\` | ${purpose} |`);
        });
        lines.push("");
    }

    // Database Models
    if (projectSpec.databaseModels && projectSpec.databaseModels.length > 0) {
        lines.push("## Database Models");
        lines.push("");
        projectSpec.databaseModels.forEach(m => {
            lines.push(`### ${m.name}`);
            if (m.fields && m.fields.length > 0) {
                m.fields.forEach(f => lines.push(`- \`${f}\``));
            }
            lines.push("");
        });
    }

    // Dependencies
    if (projectSpec.importantDependencies && projectSpec.importantDependencies.length > 0) {
        lines.push("## Key Dependencies");
        lines.push("");
        projectSpec.importantDependencies.forEach(d => lines.push(`- \`${d}\``));
        lines.push("");
    }

    // Environment Variables
    if (projectSpec.environmentVariables && projectSpec.environmentVariables.length > 0) {
        lines.push("## Environment Variables Required");
        lines.push("");
        projectSpec.environmentVariables.forEach(v => lines.push(`- \`${v}\``));
        lines.push("");
    }

    // Architecture Constraints
    if (projectSpec.architectureConstraints && projectSpec.architectureConstraints.length > 0) {
        lines.push("## Architecture Constraints");
        lines.push("");
        projectSpec.architectureConstraints.forEach(a => lines.push(`- ${a}`));
        lines.push("");
    }

    // Assumptions
    if (projectSpec.assumptions && projectSpec.assumptions.length > 0) {
        lines.push("## Assumptions Made");
        lines.push("");
        projectSpec.assumptions.forEach(a => lines.push(`- ${a}`));
        lines.push("");
    }

    // Run Scripts
    if (projectSpec.runBuildRequirements) {
        lines.push("## Run & Build Commands");
        lines.push("");
        if (projectSpec.runBuildRequirements.runScript) {
            lines.push(`- **Dev/Run:** \`${projectSpec.runBuildRequirements.runScript}\``);
        }
        if (projectSpec.runBuildRequirements.buildScript) {
            lines.push(`- **Build:** \`${projectSpec.runBuildRequirements.buildScript}\``);
        }
        lines.push("- **Live Preview:** Start the dev server and use the Preview tab in Z.ai.");
        lines.push("");
    }

    return lines.join("\n");
};

// ─────────────────────────────────────────────────────────────────────────────
// RICH README GENERATOR
// Produces a complete, project-specific README.md file.
// This is entirely local — no AI call needed.
// ─────────────────────────────────────────────────────────────────────────────
const generateRichReadme = (projectSpec, files) => {
    const lines = [];
    const name = projectSpec.projectName || "Project";
    const type = projectSpec.projectType || "Web Application";

    // Badges row
    const badges = [];
    if (projectSpec.frontend && projectSpec.frontend !== "None") {
        const label = encodeURIComponent(projectSpec.frontend.split(" ")[0]);
        badges.push(`![Frontend](https://img.shields.io/badge/Frontend-${label}-61dafb?style=flat-square)`);
    }
    if (projectSpec.backend && projectSpec.backend !== "None") {
        const label = encodeURIComponent(projectSpec.backend.split(" ")[0]);
        badges.push(`![Backend](https://img.shields.io/badge/Backend-${label}-68a063?style=flat-square)`);
    }
    if (projectSpec.database && projectSpec.database !== "None") {
        const label = encodeURIComponent(projectSpec.database.split(" ")[0]);
        badges.push(`![Database](https://img.shields.io/badge/Database-${label}-47a248?style=flat-square)`);
    }

    lines.push(`# ${name}`);
    lines.push("");
    if (badges.length > 0) {
        lines.push(badges.join("  "));
        lines.push("");
    }
    lines.push(`A **${type}** generated by Z.ai.`);
    lines.push("");

    // Features
    const features = [];
    if (projectSpec.pagesAndRoutes && projectSpec.pagesAndRoutes.length > 0) {
        projectSpec.pagesAndRoutes.forEach(p => features.push(p.name + (p.description ? ` — ${p.description}` : "")));
    }
    if (projectSpec.components && projectSpec.components.length > 0) {
        projectSpec.components.forEach(c => features.push(c.name + (c.purpose ? ` (${c.purpose})` : "")));
    }
    if (features.length > 0) {
        lines.push("## ✨ Features");
        lines.push("");
        features.forEach(f => lines.push(`- ${f}`));
        lines.push("");
    }

    // Tech Stack
    lines.push("## 🛠 Tech Stack");
    lines.push("");
    if (projectSpec.frontend && projectSpec.frontend !== "None") lines.push(`- **Frontend:** ${projectSpec.frontend}`);
    if (projectSpec.backend && projectSpec.backend !== "None") lines.push(`- **Backend:** ${projectSpec.backend}`);
    if (projectSpec.database && projectSpec.database !== "None") lines.push(`- **Database:** ${projectSpec.database}`);
    if (projectSpec.authentication && projectSpec.authentication !== "None") lines.push(`- **Auth:** ${projectSpec.authentication}`);
    if (projectSpec.designRequirements && projectSpec.designRequirements !== "None") lines.push(`- **Styling:** ${projectSpec.designRequirements}`);

    // Frontend-only explicit notice
    const isFrontendOnly = (!projectSpec.backend || projectSpec.backend === "None") &&
                           (!projectSpec.database || projectSpec.database === "None") &&
                           (!projectSpec.authentication || projectSpec.authentication === "None");
    if (isFrontendOnly) {
        lines.push("- **Architecture:** Frontend-only (no backend, no database, no authentication required)");
    }
    lines.push("");

    // Prerequisites
    const prerequisites = [];
    const hasNodeFiles = files && files.some(f => f.name === "package.json");
    const hasPythonFiles = files && files.some(f => f.name === "requirements.txt" || f.name === "pyproject.toml");
    if (hasNodeFiles) prerequisites.push("Node.js v18+");
    if (hasPythonFiles) prerequisites.push("Python 3.9+");
    if (projectSpec.database) {
        if (projectSpec.database.toLowerCase().includes("mongo")) prerequisites.push("MongoDB (local or Atlas)");
        else if (projectSpec.database.toLowerCase().includes("postgre")) prerequisites.push("PostgreSQL server");
        else if (projectSpec.database.toLowerCase().includes("redis")) prerequisites.push("Redis server");
    }

    lines.push("## 📋 Prerequisites");
    lines.push("");
    if (prerequisites.length > 0) {
        prerequisites.forEach(p => lines.push(`- ${p}`));
    } else {
        lines.push("- A modern web browser");
    }
    lines.push("");

    // Getting Started
    lines.push("## 🚀 Getting Started");
    lines.push("");

    const mern = isMernStack(projectSpec);
    const hasBackendPkg = files && files.some(f => f.name === "backend/package.json");
    const hasFrontendPkg = files && files.some(f => f.name === "frontend/package.json");

    if (mern || (hasBackendPkg && hasFrontendPkg)) {
        lines.push("### Backend Setup");
        lines.push("");
        lines.push("```bash");
        lines.push("cd backend");
        lines.push("npm install");
        lines.push("cp .env.example .env   # then fill in your values");
        lines.push("npm run dev            # starts on http://localhost:5000");
        lines.push("```");
        lines.push("");
        lines.push("### Frontend Setup");
        lines.push("");
        lines.push("```bash");
        lines.push("cd frontend");
        lines.push("npm install");
        lines.push("npm run dev            # starts on http://localhost:5173");
        lines.push("```");
        lines.push("");
        lines.push("> **Note:** Start the backend server first, then the frontend.");
    } else if (hasNodeFiles) {
        lines.push("```bash");
        lines.push("# 1. Clone or extract the project");
        lines.push("");
        lines.push("# 2. Install dependencies");
        lines.push("npm install");
        lines.push("");
        const hasVite = files && files.some(f => f.name === "vite.config.js");
        if (hasVite) {
            lines.push("# 3. Start the development server");
            lines.push("npm run dev");
            lines.push("");
            lines.push("# 4. Build for production");
            lines.push("npm run build");
            lines.push("");
            lines.push("# 5. Open http://localhost:5173 in your browser");
        } else {
            lines.push("# 3. Start the server");
            lines.push("npm run dev   # or: npm start");
        }
        lines.push("```");
    } else if (hasPythonFiles) {
        lines.push("```bash");
        lines.push("# 1. Clone or extract the project");
        lines.push("");
        lines.push("# 2. Create and activate virtual environment");
        lines.push("python -m venv venv");
        lines.push("# Windows: venv\\Scripts\\activate");
        lines.push("# macOS/Linux: source venv/bin/activate");
        lines.push("");
        lines.push("# 3. Install dependencies");
        lines.push("pip install -r requirements.txt");
        lines.push("");
        const isFastapi = projectSpec.backend && projectSpec.backend.toLowerCase().includes("fastapi");
        lines.push("# 4. Run the application");
        lines.push(isFastapi ? "uvicorn main:app --reload" : "python manage.py runserver");
        lines.push("```");
    }
    lines.push("");

    // Environment Variables
    if (mern) {
        lines.push("## 🔐 Environment Variables");
        lines.push("");
        lines.push("### Backend (`backend/.env`)");
        lines.push("");
        lines.push("```bash");
        lines.push("cp backend/.env.example backend/.env");
        lines.push("```");
        lines.push("");
        lines.push("| Variable | Description |");
        lines.push("|----------|-------------|");
        lines.push("| `PORT` | Backend server port (default: 5000) |");
        lines.push("| `MONGO_URI` | MongoDB connection string |");
        lines.push("| `JWT_SECRET` | Secret key for JWT token signing |");
        if (projectSpec.environmentVariables) {
            projectSpec.environmentVariables.forEach(v => {
                if (!['PORT', 'MONGO_URI', 'JWT_SECRET'].includes(v)) {
                    lines.push(`| \`${v}\` | Required — see \`backend/.env.example\` |`);
                }
            });
        }
        lines.push("");
        lines.push("### Frontend (`frontend/.env`)");
        lines.push("");
        lines.push("```bash");
        lines.push("cp frontend/.env.example frontend/.env");
        lines.push("```");
        lines.push("");
        lines.push("| Variable | Description |");
        lines.push("|----------|-------------|");
        lines.push("| `VITE_API_URL` | Backend API base URL (default: http://localhost:5000/api) |");
        lines.push("");
    } else if (projectSpec.environmentVariables && projectSpec.environmentVariables.length > 0) {
        lines.push("## 🔐 Environment Variables");
        lines.push("");
        lines.push("Copy `.env.example` to `.env` and fill in the values:");
        lines.push("");
        lines.push("```bash");
        lines.push("cp .env.example .env");
        lines.push("```");
        lines.push("");
        lines.push("| Variable | Description |");
        lines.push("|----------|-------------|");
        projectSpec.environmentVariables.forEach(v => {
            lines.push(`| \`${v}\` | Required — see \`.env.example\` for details |`);
        });
        lines.push("");
    } else if (!isFrontendOnly && !mern) {
        lines.push("## 🔐 Environment Variables");
        lines.push("");
        lines.push("No environment variables are required for this project.");
        lines.push("");
    }

    // API Endpoints
    if (projectSpec.backendApis && projectSpec.backendApis.length > 0) {
        lines.push("## 📡 API Endpoints");
        lines.push("");
        lines.push("| Method | Endpoint | Description |");
        lines.push("|--------|----------|-------------|");
        projectSpec.backendApis.forEach(api => {
            const purpose = (api.purpose || "").replace(/\|/g, "\\|");
            lines.push(`| \`${api.method || "GET"}\` | \`${api.path || "/"}\` | ${purpose} |`);
        });
        lines.push("");
    }

    // Database Models
    if (projectSpec.databaseModels && projectSpec.databaseModels.length > 0) {
        lines.push("## 🗄 Data Models");
        lines.push("");
        projectSpec.databaseModels.forEach(m => {
            lines.push(`### ${m.name}`);
            if (m.fields && m.fields.length > 0) {
                lines.push("| Field | Type |");
                lines.push("|-------|------|");
                m.fields.forEach(f => {
                    const parts = f.split(/\s*\(|\s*:/);
                    lines.push(`| \`${parts[0].trim()}\` | ${parts[1] ? parts[1].replace(")", "").trim() : "String"} |`);
                });
            }
            lines.push("");
        });
    }

    // Project structure (derived from generated files) — hierarchical tree
    if (files && files.length > 0) {
        lines.push("## 📁 Project Structure");
        lines.push("");
        lines.push("```");

        const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name));

        // Collect all unique directory paths
        const allDirs = new Set();
        sortedFiles.forEach(f => {
            const parts = f.name.split("/");
            for (let i = 1; i < parts.length; i++) {
                allDirs.add(parts.slice(0, i).join("/"));
            }
        });
        const sortedDirs = Array.from(allDirs).sort();

        // Group files by immediate parent directory
        const filesByDir = new Map();
        filesByDir.set("", []);
        sortedDirs.forEach(d => filesByDir.set(d, []));
        sortedFiles.forEach(f => {
            const lastSlash = f.name.lastIndexOf("/");
            const parentDir = lastSlash === -1 ? "" : f.name.slice(0, lastSlash);
            if (!filesByDir.has(parentDir)) filesByDir.set(parentDir, []);
            filesByDir.get(parentDir).push(f.name.split("/").pop());
        });

        const treeLines = [];
        const seenTreeDirs = new Set();

        const addTreeDir = (dirPath, depth) => {
            if (seenTreeDirs.has(dirPath)) return;
            seenTreeDirs.add(dirPath);
            const indent = "  ".repeat(depth);
            const label = dirPath.split("/").pop();
            treeLines.push(`${indent}${label}/`);
            // Files in this dir
            (filesByDir.get(dirPath) || []).sort().forEach(fn => treeLines.push(`${indent}  ${fn}`));
            // Sub-directories
            sortedDirs
                .filter(d => {
                    const dParts = d.split("/");
                    const pParts = dirPath.split("/");
                    return dParts.length === pParts.length + 1 && d.startsWith(dirPath + "/");
                })
                .forEach(subDir => addTreeDir(subDir, depth + 1));
        };

        // Root-level files first
        (filesByDir.get("") || []).sort().forEach(fn => treeLines.push(fn));
        // Top-level directories
        sortedDirs.filter(d => !d.includes("/")).forEach(d => addTreeDir(d, 0));

        treeLines.forEach(t => lines.push(t));
        lines.push("```");
        lines.push("");
    }

    // Downloaded ZIP usage
    lines.push("## 📦 Downloaded ZIP Usage");
    lines.push("");
    lines.push("```bash");
    lines.push("# Extract the downloaded ZIP file, then:");
    if (hasNodeFiles) {
        lines.push("npm install");
        lines.push("npm run dev      # development");
        lines.push("npm run build    # production build");
    }
    lines.push("```");
    lines.push("");

    // License
    lines.push("## 📝 License");
    lines.push("");
    lines.push("This project was scaffolded by [Z.ai](https://github.com/imSaurav06/zai-local-coding-assistant). MIT License.");
    lines.push("");

    return lines.join("\n");
};

// ─────────────────────────────────────────────────────────────────────────────
// RUN INSTRUCTIONS GENERATOR (shared)
// ─────────────────────────────────────────────────────────────────────────────
const generateRunInstructions = (projectSpec, files) => {
    const prerequisites = [];
    const steps = ["Download and extract the ZIP file."];
    let frontendUrl = "";
    let backendUrl = "";

    const hasMernFiles = files && (files.some(f => f.name === "backend/package.json") ||
                          files.some(f => f.name.startsWith("backend/")));
    const hasNode = files && files.some(f => f.name === "package.json");
    const hasPython = files && files.some(f => f.name === "requirements.txt" || f.name === "pyproject.toml");

    if (hasNode) prerequisites.push("Node.js (v18+)");
    if (hasPython) prerequisites.push("Python (3.9+)");
    if (isMernStack(projectSpec) || hasMernFiles) {
        if (!prerequisites.includes("MongoDB (local or Atlas)")) {
            prerequisites.push("MongoDB (local or Atlas)");
        }
    } else if (projectSpec.database) {
        if (projectSpec.database.toLowerCase().includes("mongo")) prerequisites.push("MongoDB (local or Atlas)");
        else if (projectSpec.database.toLowerCase().includes("postgre")) prerequisites.push("PostgreSQL server");
        else if (projectSpec.database.toLowerCase().includes("redis")) prerequisites.push("Redis server");
    }


    if (isMernStack(projectSpec) || hasMernFiles) {
        frontendUrl = "http://localhost:5173";
        backendUrl = "http://localhost:5000";
        steps.push(
            "Navigate to backend directory, run `npm install` and create `.env` using `.env.example`.",
            "Start the backend server by running `npm run dev` or `npm start`.",
            "Navigate to frontend directory, run `npm install` to install client libraries.",
            "Start the frontend dashboard by running `npm run dev`.",
            `Open browser at ${frontendUrl} to view.`
        );
    } else if (hasNode) {
        frontendUrl = "http://localhost:3000";
        let startCmd = "npm run dev";
        const packageJsonFile = files.find(f => f.name === "package.json");
        if (packageJsonFile) {
            try {
                const pj = JSON.parse(packageJsonFile.content);
                if (pj.scripts && pj.scripts.start && !pj.scripts.dev) {
                    startCmd = "npm start";
                }
                // Detect Vite — default port is 5173
                if (pj.devDependencies && pj.devDependencies.vite) {
                    frontendUrl = "http://localhost:5173";
                }
            } catch (e) {}
        }
        steps.push(
            "Open directory in terminal.",
            "Run `npm install` to fetch dependencies.",
            `Start local server by running \`${startCmd}\`.`,
            `Open browser at ${frontendUrl} to view.`
        );
    } else if (hasPython) {
        backendUrl = "http://localhost:8000";
        const isFastapi = projectSpec.backend?.toLowerCase().includes("fastapi");
        const runCmd = isFastapi ? "uvicorn main:app --reload" : "python manage.py runserver";
        steps.push(
            "Create a python virtual environment: `python -m venv venv`.",
            "Activate virtual environment: `source venv/bin/activate` (Linux/macOS) or `venv\\Scripts\\activate` (Windows).",
            "Install python packages: `pip install -r requirements.txt`.",
            `Run local development app: \`${runCmd}\`.`
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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────
const orchestrateGeneration = async ({ originalPrompt, projectSpec }, progressEmitter, checkCancellation, options = {}) => {
    // Compile and validate ProjectSpec and derive Requirement Identities once
    const preparation = prepareCanonicalProjectSpec(projectSpec);
    projectSpec = preparation.projectSpec;
    const requirementIdentity = preparation.requirementIdentity;

    const startTime = Date.now();
    let scaffoldMs = 0;
    let validationMs = 0;
    let repairCalls = 0;
    let repairMs = 0;

    const callMetricsCollector = [];

    // Safe cancellation checking helper
    const verifyCancellation = () => {
        if (checkCancellation) {
            checkCancellation();
        }
    };

    verifyCancellation();
    progressEmitter.emit("Analyzing Request", "Analyzing user prompts and specs...");

    // 1. Local Task Analysis / Planning
    progressEmitter.emit("Planning Generation", "Formulating optimal generation strategy...");
    const plan = planGeneration(projectSpec);
    const contracts = buildSharedContracts(projectSpec);
    const manifest = buildProjectManifest(originalPrompt, projectSpec);

    const planningMs = Date.now() - startTime;
    verifyCancellation();

    let finalFiles = [];

    // 2. Adaptive Generation Execution
    let callIndex = 1;
    if (plan.strategy === "DIRECT") {
        progressEmitter.emit("Preparing Project", "Running direct generation call...");
        const systemPrompt = `You are a principal software engineer. Generate a complete, minimal, runnable codebase.
No markdown guides or explanations outside files blocks. Return the files block inside:
--- START_FILES ---

For each file, use this exact separator structure (including the dashes):
--- FILE: path/to/filename ---
\`\`\`language
// Complete file content here
\`\`\`
--- END_FILE ---

--- END_FILES ---`;

        const userPrompt = `ORIGINAL REQUEST: "${originalPrompt}"
PROJECT SPECIFICATION:
${JSON.stringify(projectSpec, null, 2)}`;

        verifyCancellation();
        const rawOutput = await aiExecutor.executeAiRequest(systemPrompt, userPrompt, {
            cancelSignal: options.cancelSignal,
            callMetricsCollector,
            callIndex: callIndex++,
            strategy: plan.strategy,
            tokenBudget: plan.tokenBudget
        });
        verifyCancellation();

        finalFiles = aiExecutor.parseGeneratedFiles(rawOutput);

    } else {
        // Scaffold + AI / Parallel / Chunked strategy
        progressEmitter.emit("Preparing Project", "Generating deterministic configurations locally...");
        const scafStart = Date.now();
        const scaffoldFiles = generateScaffoldFiles(plan.scaffoldAdapter, projectSpec);
        scaffoldMs += (Date.now() - scafStart);

        const aiGeneratedFiles = [];
        const units = plan.generationUnits;
        const totalUnits = units.length;
        let completedUnits = 0;

        // Process parallel groups
        for (const group of plan.parallelGroups) {
            verifyCancellation();

            progressEmitter.emit("Generating Modules", `Generating modules group (${completedUnits}/${totalUnits})...`);

            // Conservatively process concurrent requests up to limit of 3
            const limit = 3;
            for (let i = 0; i < group.length; i += limit) {
                verifyCancellation();
                const chunk = group.slice(i, i + limit);

                const promises = chunk.map(async (unit) => {
                    let lastErr = null;
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            const rawOutput = await aiExecutor.generateUnitCode(unit, projectSpec, contracts, {
                                cancelSignal: options.cancelSignal,
                                callMetricsCollector,
                                callIndex: callIndex++,
                                strategy: plan.strategy
                            });
                            return aiExecutor.parseGeneratedFiles(rawOutput);
                        } catch (err) {
                            lastErr = err;
                            console.warn(`[orchestrateGeneration] Unit '${unit.id}' generation attempt ${attempt}/3 failed: ${err.message}. Retrying in ${2000 * attempt}ms...`);
                            await new Promise(r => setTimeout(r, 2000 * attempt));
                        }
                    }
                    throw lastErr || new Error(`Generation unit '${unit.id}' failed after 3 attempts.`);
                });

                const results = await Promise.allSettled(promises);

                for (let idx = 0; idx < results.length; idx++) {
                    const res = results[idx];
                    const unit = chunk[idx];

                    if (res.status === "fulfilled") {
                        aiGeneratedFiles.push(...res.value);
                    } else {
                        verifyCancellation();
                        console.error(`UNIT GENERATION FAILED FOR ${unit.id}: ${res.reason ? res.reason.message : "unknown error"}.`);
                        throw res.reason || new Error(`Generation unit '${unit.id}' failed to execute.`);
                    }
                }
                completedUnits += chunk.length;
                progressEmitter.emit("Generating Modules", `Generating modules group (${completedUnits}/${totalUnits})...`);
            }
        }

        // Merge files
        verifyCancellation();
        progressEmitter.emit("Merging Project", "Combining configuration and AI code modules...");
        finalFiles = mergeFiles(scaffoldFiles, aiGeneratedFiles);
    }

    // ── CONTENT GUARD (pass 1, after initial generation) ──────────────────────
    verifyCancellation();
    {
        const guardErrors = applyContentGuard(finalFiles);
        if (guardErrors.length > 0) {
            console.warn(`[Content Guard] Detected ${guardErrors.length} placeholder/truncated file(s) in initial generation:`);
            guardErrors.forEach(e => console.warn(`  - ${e}`));
        }
        // Inject guard errors into validation errors so repair targets them
        // They are treated the same as missing/broken files in the repair loop below.
        if (guardErrors.length > 0) {
            // Attach to a pre-validation set so the repair loop picks them up
            finalFiles._guardErrors = guardErrors;
        }
    }

    // Sanitize any deprecated Mongoose options before validating code integrity
    sanitizeMongooseConnectOptions(finalFiles);

    // Ensure README exists before validation
    verifyCancellation();
    const hasReadme = finalFiles.some(f => f.name.toLowerCase() === "readme.md");
    if (!hasReadme) {
        finalFiles.push({
            name: "README.md",
            content: generateRichReadme(projectSpec, finalFiles)
        });
    }

    // 3. Post-Merge / Project-Level Validation
    verifyCancellation();
    const valStart = Date.now();
    progressEmitter.emit("Validating Modules", "Validating merged codebase integrity and schemas...");

    // Combine structural validation errors with content guard and syntax validation errors
    const { validateSyntax } = require("../utils/syntaxValidator");
    const syntaxErrors = validateSyntax(finalFiles);
    const syntaxErrorStrings = syntaxErrors.map(e => `SyntaxError in '${e.filePath}': ${e.reason}`);

    let validationErrors = [
        ...validateProjectFiles(finalFiles, projectSpec),
        ...syntaxErrorStrings
    ];
    if (Array.isArray(finalFiles._guardErrors)) {
        validationErrors = [...validationErrors, ...finalFiles._guardErrors];
        delete finalFiles._guardErrors;
    }

    validationMs += (Date.now() - valStart);

    // 4. Bounded Targeted Repair Loop
    let attempt = 0;
    while (validationErrors.length > 0 && attempt < plan.repairPolicy.maxAttempts) {
        verifyCancellation();
        attempt++;
        repairCalls++;
        progressEmitter.emit("Repairing Code", `Running targeted validation repairs (Attempt ${attempt}/${plan.repairPolicy.maxAttempts})...`);
        const repStart = Date.now();
        try {
            finalFiles = await repairAffectedFiles(validationErrors, finalFiles, projectSpec, contracts, {
                cancelSignal: options.cancelSignal,
                callMetricsCollector,
                callIndex: callIndex++,
                strategy: plan.strategy
            });

            // ── CONTENT GUARD (pass 2+, after each repair) ────────────────────
            const repairGuardErrors = applyContentGuard(finalFiles);
            if (repairGuardErrors.length > 0) {
                console.warn(`[Content Guard] Detected ${repairGuardErrors.length} placeholder(s) after repair attempt ${attempt}:`);
                repairGuardErrors.forEach(e => console.warn(`  - ${e}`));
            }

            const repairSyntaxErrors = validateSyntax(finalFiles);
            const repairSyntaxErrorStrings = repairSyntaxErrors.map(e => `SyntaxError in '${e.filePath}': ${e.reason}`);

            validationErrors = [
                ...validateProjectFiles(finalFiles, projectSpec),
                ...repairGuardErrors,
                ...repairSyntaxErrorStrings
            ];
        } catch (repairErr) {
            console.error("TARGETED REPAIR FAILED:", repairErr.message);
            if (repairErr.status === 429 || repairErr.message.includes("Rate limit")) {
                throw new Error("Rate limit (HTTP 429) exceeded during targeted repair phase.");
            }
        }
        repairMs += (Date.now() - repStart);
    }

    verifyCancellation();
    if (validationErrors.length > 0) {
        throw new Error("Project generation validation/repair failed: " + validationErrors.join("; "));
    }

    // Update README.md with final file list (now that all files are confirmed)
    const finalReadmeIdx = finalFiles.findIndex(f => f.name.toLowerCase() === "readme.md");
    if (finalReadmeIdx !== -1) {
        finalFiles[finalReadmeIdx] = {
            name: "README.md",
            content: generateRichReadme(projectSpec, finalFiles)
        };
    }

    // Sanitize connect options again to cover any repaired or merged files
    sanitizeMongooseConnectOptions(finalFiles);

    const runInstructions = generateRunInstructions(projectSpec, finalFiles);

    // Generate rich plan for the PLAN tab
    const richPlan = generateRichPlan(projectSpec);

    // Aggregate metrics from all calls
    let totalAiGenerationMs = 0;
    let totalRetries = 0;
    let totalRetryWaitMs = 0;
    let totalTimeouts = 0;
    let totalNetworkErrors = 0;

    callMetricsCollector.forEach(c => {
        totalAiGenerationMs += c.callDuration;
        totalRetries += c.retries;
        totalRetryWaitMs += c.retryWaitMs;
        totalTimeouts += c.timeoutCount;
        totalNetworkErrors += c.networkErrorCount;
    });

    const totalMs = Date.now() - startTime;

    // Log final orchestrator timing summary
    console.log(`
--- GENERATION SUMMARY METRICS ---
strategy=${plan.strategy}
planningMs=${planningMs}
scaffoldMs=${scaffoldMs}
primaryAiCalls=${callMetricsCollector.filter(c => c.unitId === "all_source_files" || c.unitId === "core_entry").length}
parallelAiCalls=${callMetricsCollector.filter(c => c.unitId !== "all_source_files" && c.unitId !== "core_entry" && c.success).length}
aiGenerationMs=${totalAiGenerationMs}
retries=${totalRetries}
retryWaitMs=${totalRetryWaitMs}
timeouts=${totalTimeouts}
networkErrors=${totalNetworkErrors}
validationMs=${validationMs}
repairCalls=${repairCalls}
repairMs=${repairMs}
databaseSaveMs=0
totalMs=${totalMs}
----------------------------------
`);

    return {
        files: finalFiles,
        runInstructions,
        summary: richPlan,   // Rich plan document → displayed in PLAN tab
        model: process.env.ZAI_MODEL,
        projectSpec,         // Canonical ProjectSpec (frozen)
        requirementIdentity  // Sidecar metadata
    };
};

module.exports = {
    orchestrateGeneration,
    prepareCanonicalProjectSpec,
    applyContentGuard,
    generateRichPlan,
    generateRichReadme,
    sanitizeMongooseConnectOptions,
    _testHooks
};
