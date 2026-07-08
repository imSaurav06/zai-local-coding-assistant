const { executeAiRequest, parseGeneratedFiles } = require("./aiGenerationExecutor");

const mapErrorsToFiles = (errors, files) => {
    const affected = new Set();
    errors.forEach(err => {
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

const repairAffectedFiles = async (errors, files, projectSpec, contracts, options = {}) => {
    const affectedNames = mapErrorsToFiles(errors, files);
    const affectedFiles = files.filter(f => affectedNames.includes(f.name));

    const systemPrompt = `You are a principal software engineer. You must repair local codebase generation errors.
Rules:
1. Fix all validation errors listed below.
2. Return only the complete corrected content of the affected files. Do not modify unaffected files.
3. You must strictly only import relative/local modules that correspond to paths in the ALLOWED FILE MANIFEST. Never introduce new relative imports that are not declared in the manifest.
4. The corrected files block must be enclosed exactly within:
--- START_FILES ---

For each file, use this exact separator structure (including the dashes):
--- FILE: path/to/filename ---
\`\`\`language
// Complete file content here
\`\`\`
--- END_FILE ---

--- END_FILES ---`;

    const userPrompt = `PROJECT: ${projectSpec.projectName}
ALLOWED FILE MANIFEST (EXACT ALLOWED LOCAL MODULE PATHS):
${JSON.stringify(contracts.folderStructure || [], null, 2)}

SHARED CONTRACTS:
${JSON.stringify(contracts, null, 2)}

VALIDATION ERRORS FOUND:
${errors.map(e => `- ${e}`).join("\n")}

AFFECTED FILES BEING REPAIRED:
${affectedFiles.map(f => `--- FILE: ${f.name} ---\n${f.content}\n--- END_FILE ---`).join("\n")}

Please output the corrected version of these affected files. Ensure that local paths match the contracts folder structure.`;

    console.warn(`REPAIR SERVICE: Repairing ${affectedNames.length} affected files: ${affectedNames.join(", ")}`);
    const rawOutput = await executeAiRequest(systemPrompt, userPrompt, options);
    const repairedFiles = parseGeneratedFiles(rawOutput);

    // Merge repaired files back into the original file array
    const fileMap = new Map(files.map(f => [f.name, f.content]));
    repairedFiles.forEach(rf => {
        fileMap.set(rf.name, rf.content);
    });

    return Array.from(fileMap.entries()).map(([name, content]) => ({
        name,
        content
    }));
};

module.exports = { repairAffectedFiles, mapErrorsToFiles };
