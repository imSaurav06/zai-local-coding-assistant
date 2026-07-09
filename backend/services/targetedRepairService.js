const aiExecutor = require("./aiGenerationExecutor");

const mapErrorsToFiles = (errors, files) => {
    const affected = new Set();
    errors.forEach(err => {
        // Detect explicitly missing files in validation messages
        const missingMatch = /missing required file '([^']+)'/i.exec(err) || 
                             /file '([^']+)' is missing/i.exec(err) ||
                             /missing file '([^']+)'/i.exec(err) ||
                             /required file '([^']+)' is missing/i.exec(err);
        if (missingMatch) {
            const cleanPath = missingMatch[1].trim();
            if (cleanPath.toLowerCase() !== "path/to/filename" && !cleanPath.includes("path/to/filename")) {
                affected.add(cleanPath);
            }
        }

        files.forEach(f => {
            if (err.includes(f.name)) {
                affected.add(f.name);
            }
        });
    });
    // Fallback: if no specific file matches, treat all as affected
    if (affected.size === 0) {
        files.forEach(f => affected.add(f.name));
    }
    return Array.from(affected);
};

const MAX_FILES_PER_REPAIR_BATCH = 3;

/**
 * Run a single repair call for a specific batch of affected files.
 */
const repairBatch = async (errors, batchNames, files, projectSpec, contracts, options) => {
    const existingAffected = files.filter(f => batchNames.includes(f.name));
    const missingAffectedNames = batchNames.filter(name => !files.some(f => f.name === name));

    const systemPrompt = `You are a principal software engineer. You must repair local codebase generation errors.
Rules:
1. Fix all validation errors listed below.
2. Return only the complete corrected content of the affected files (including any missing files that must be created). Do not output or modify unaffected files.
3. You must strictly only import relative/local modules that correspond to paths in the ALLOWED FILE MANIFEST. Never introduce new relative imports that are not declared in the manifest.
4. The corrected files block must be enclosed exactly within:
--- START_FILES ---

For each file, use this exact separator structure (including the dashes):
--- FILE: path/to/filename ---
\`\`\`language
// Complete file content here
\`\`\`
--- END_FILE ---

5. Strictly only use icons from 'lucide-react' (such as import { Heart, Activity } from 'lucide-react') for any UI icons. Do not import or use other icon libraries like @heroicons/react, react-icons, etc. to prevent compilation issues.
6. NEVER use '<{variable}' JSX syntax. Dynamic components MUST be assigned to a PascalCase variable first: const Icon = props.icon; return <Icon />; — using <{props.icon} /> is a fatal build error.
--- END_FILES ---`;

    const userPrompt = `PROJECT: ${projectSpec.projectName}
ALLOWED FILE MANIFEST (EXACT ALLOWED LOCAL MODULE PATHS):
${JSON.stringify(contracts.folderStructure || [], null, 2)}

SHARED CONTRACTS:
${JSON.stringify(contracts, null, 2)}

VALIDATION ERRORS FOUND:
${errors.map(e => `- ${e}`).join("\n")}

AFFECTED FILES THAT EXIST AND MUST BE EDITED:
${existingAffected.map(f => `--- FILE: ${f.name} ---\n${f.content}\n--- END_FILE ---`).join("\n")}

MISSING FILES THAT MUST BE CREATED FROM SCRATCH:
${missingAffectedNames.length > 0 ? missingAffectedNames.map(name => `- ${name}`).join("\n") : "None"}

Please output the corrected version of the edited files and the newly created files. Ensure that local paths match the contracts folder structure.`;

    console.warn(`REPAIR SERVICE: Repairing ${batchNames.length} affected files: ${batchNames.join(", ")}`);

    // Allocate tokens: 1200 base + 900 per file, capped at 4000 to stay within free-tier limits
    const repairTokenBudget = Math.min(1200 + (batchNames.length * 900), 4000);

    const rawOutput = await aiExecutor.executeAiRequest(systemPrompt, userPrompt, {
        ...options,
        tokenBudget: repairTokenBudget
    });
    console.log(`[REPAIR DEBUG] Raw AI response:\n${rawOutput}`);
    return aiExecutor.parseGeneratedFiles(rawOutput);
};

const repairAffectedFiles = async (errors, files, projectSpec, contracts, options = {}) => {
    const affectedNames = mapErrorsToFiles(errors, files);

    // Batch into groups of MAX_FILES_PER_REPAIR_BATCH to avoid token-limit truncation
    const batches = [];
    for (let i = 0; i < affectedNames.length; i += MAX_FILES_PER_REPAIR_BATCH) {
        batches.push(affectedNames.slice(i, i + MAX_FILES_PER_REPAIR_BATCH));
    }

    // Start with current file map
    const fileMap = new Map(files.map(f => [f.name, f.content]));

    for (const batch of batches) {
        // Build the current file list (including any files already repaired in previous batches)
        const currentFiles = Array.from(fileMap.entries()).map(([name, content]) => ({ name, content }));

        const repairedFiles = await repairBatch(errors, batch, currentFiles, projectSpec, contracts, options);

        // Merge repaired files back into the map
        const { validateJsSyntax } = require("../utils/syntaxValidator");
        const path = require("path");
        repairedFiles.forEach(rf => {
            const oldContent = fileMap.get(rf.name);
            if (oldContent !== undefined) {
                const ext = path.extname(rf.name).toLowerCase();
                if ([".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
                    const oldHasError = !!validateJsSyntax(oldContent, rf.name);
                    const newHasError = !!validateJsSyntax(rf.content, rf.name);
                    if (!oldHasError && newHasError) {
                        console.warn(`[Repair Guard] Rejecting syntax-invalid repair for file '${rf.name}' (was valid before).`);
                        return; // Do not replace valid file with syntax-invalid repair output
                    }
                }
            }
            fileMap.set(rf.name, rf.content);
        });
    }

    return Array.from(fileMap.entries()).map(([name, content]) => ({
        name,
        content
    }));
};

module.exports = { repairAffectedFiles, mapErrorsToFiles };

