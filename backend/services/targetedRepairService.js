"use strict";

/**
 * targetedRepairService.js — Phase 9A: Bounded Targeted Repair
 *
 * Architecture contract (ADR-010):
 *   One repair request → one target file → one isolated repair execution → repaired file only.
 *
 * STRICT RULES:
 *   - Exactly one file is processed per repair invocation.
 *   - No neighbouring files are modified.
 *   - No recursive repairs.
 *   - No chained repairs.
 *   - No automatic retries.
 *   - No hidden regeneration.
 *   - Deterministic output.
 *   - Pure execution (no filesystem writes, no persistence, no repository mutation).
 *
 * Failure contract:
 *   If a repair fails, return a structured repairResult with success=false.
 *   Do NOT retry, invoke another repair, or modify unrelated files.
 *
 * Backward compatibility:
 *   The legacy `repairAffectedFiles` export is preserved and adapts internally
 *   to call `repairSingleFile` per identified affected file.
 *   `mapErrorsToFiles` is preserved unchanged.
 */

const path = require("path");
const aiExecutor = require("./aiGenerationExecutor");
const { repairErrorCodes } = require("../core/repair/repairErrors");

// ─── Error Codes (re-exported for callers) ───────────────────────────────────

/**
 * Immutable repair error codes. Consumers import from here for repair-specific
 * structured error discrimination.
 */
module.exports.repairErrorCodes = repairErrorCodes;

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Build a frozen, structured repair failure object.
 *
 * @param {string} code   - repairErrorCodes value
 * @param {string} message - Human-readable failure reason
 * @returns {Object} frozen repair failure descriptor
 */
function _buildRepairFailure(code, message) {
    return Object.freeze({
        success: false,
        code,
        message,
        repairedFile: null,
        metadata: Object.freeze({
            timestamp: new Date().toISOString(),
            deterministic: true
        })
    });
}

/**
 * Build a frozen, structured repair success object.
 *
 * @param {Object} repairedFile - { name, content } of the repaired file
 * @param {Object} metadata     - optional metadata
 * @returns {Object} frozen repair success descriptor
 */
function _buildRepairSuccess(repairedFile, metadata) {
    return Object.freeze({
        success: true,
        code: null,
        message: null,
        repairedFile: Object.freeze({ name: repairedFile.name, content: repairedFile.content }),
        metadata: Object.freeze(Object.assign({
            timestamp: new Date().toISOString(),
            deterministic: true
        }, metadata || {}))
    });
}

// ─── Input Validation ────────────────────────────────────────────────────────

/**
 * Validate all inputs to repairSingleFile.
 * Returns a repairFailure or null if all inputs are valid.
 */
function _validateRepairInputs(targetFileName, errors, files, projectSpec, contracts) {
    if (typeof targetFileName !== "string" || targetFileName.trim() === "") {
        return _buildRepairFailure(
            repairErrorCodes.REPAIR_INVALID_TARGET_FILE,
            "targetFileName must be a non-empty string."
        );
    }
    if (!Array.isArray(errors) || errors.length === 0) {
        return _buildRepairFailure(
            repairErrorCodes.REPAIR_INVALID_ERRORS,
            "errors must be a non-empty array of diagnostic strings or objects."
        );
    }
    if (!Array.isArray(files)) {
        return _buildRepairFailure(
            repairErrorCodes.REPAIR_INVALID_FILES,
            "files must be an array of { name, content } objects."
        );
    }
    if (typeof projectSpec !== "object" || projectSpec === null) {
        return _buildRepairFailure(
            repairErrorCodes.REPAIR_INVALID_PROJECT_SPEC,
            "projectSpec must be a non-null object."
        );
    }
    if (typeof contracts !== "object" || contracts === null) {
        return _buildRepairFailure(
            repairErrorCodes.REPAIR_INVALID_CONTRACTS,
            "contracts must be a non-null object."
        );
    }
    return null; // All valid
}

// ─── Prompt Construction ─────────────────────────────────────────────────────

/**
 * Build the system + user repair prompt for a single target file.
 *
 * @param {string}   targetFileName  - Name of the single file to repair
 * @param {string[]} errorMessages   - List of error message strings
 * @param {Object}   targetFile      - { name, content } of the existing file (may be null for missing)
 * @param {Array}    allFiles        - Full list of { name, content } files (for context)
 * @param {Object}   projectSpec     - Canonical project spec
 * @param {Object}   contracts       - Shared contracts
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function _buildRepairPrompts(targetFileName, errorMessages, targetFile, allFiles, projectSpec, contracts) {
    const systemPrompt =
        `You are a principal software engineer. You must repair a single file in a local codebase generation.
Rules:
1. Fix all validation errors listed below for the ONE specified target file only.
2. Return only the complete corrected content of that ONE file. Do not output or modify any other files.
3. You must strictly only import relative/local modules that correspond to paths in the ALLOWED FILE MANIFEST. Never introduce new relative imports that are not declared in the manifest.
4. The corrected file block must be enclosed exactly within:
--- START_FILES ---

For the file, use this exact separator structure (including the dashes):
--- FILE: path/to/filename ---
\`\`\`language
// Complete file content here
\`\`\`
--- END_FILE ---

5. Strictly only use icons from 'lucide-react' (such as import { Heart, Activity } from 'lucide-react') for any UI icons. Do not import or use other icon libraries like @heroicons/react, react-icons, etc. to prevent compilation issues.
6. NEVER use '<{variable}' JSX syntax. Dynamic components MUST be assigned to a PascalCase variable first: const Icon = props.icon; return <Icon />; — using <{props.icon} /> is a fatal build error.
--- END_FILES ---`;

    const isMissing = targetFile === null;
    const fileSection = isMissing
        ? `MISSING FILE THAT MUST BE CREATED FROM SCRATCH:\n- ${targetFileName}`
        : `TARGET FILE TO REPAIR:\n--- FILE: ${targetFile.name} ---\n${targetFile.content}\n--- END_FILE ---`;

    const userPrompt =
        `PROJECT: ${projectSpec.projectName || "unknown"}
ALLOWED FILE MANIFEST (EXACT ALLOWED LOCAL MODULE PATHS):
${JSON.stringify(contracts.folderStructure || [], null, 2)}

SHARED CONTRACTS:
${JSON.stringify(contracts, null, 2)}

VALIDATION ERRORS FOUND (for target file only):
${errorMessages.map(e => `- ${e}`).join("\n")}

TARGET FILE NAME: ${targetFileName}

${fileSection}

Please output ONLY the corrected version of the single target file. Do not output any other files.`;

    return { systemPrompt, userPrompt };
}

// ─── Single-File Repair Core ─────────────────────────────────────────────────

/**
 * repairSingleFile — Phase 9A public API.
 *
 * Repair contract:
 *   Input:  targetFileName, errors, [diagnostics], allFiles, projectSpec, contracts, [options]
 *   Output: { success, code, message, repairedFile, metadata, verificationStatus }
 *
 * Exactly one file is processed per call.
 * No neighbouring files are modified.
 * No retries.
 * No recursion.
 * Pure execution — no filesystem writes or persistence.
 *
 * @param {string}   targetFileName  - The path/name of the SINGLE file to repair
 * @param {Array}    errors          - List of error message strings or error objects relevant to this file
 * @param {Object}   diagnostics     - Optional diagnostics object (e.g. from verificationDiagnostics)
 * @param {Array}    allFiles        - Full list of { name, content } files in the project (read-only context)
 * @param {Object}   projectSpec     - Canonical project spec
 * @param {Object}   contracts       - Shared contracts
 * @param {Object}   [options={}]    - Optional AI executor options (tokenBudget, etc.)
 * @returns {Promise<Object>}        - Frozen repair result { success, code, message, repairedFile, metadata, verificationStatus }
 */
async function repairSingleFile(targetFileName, errors, diagnostics, allFiles, projectSpec, contracts, options = {}) {
    // ── 1. Validate inputs ───────────────────────────────────────────────────
    const inputFailure = _validateRepairInputs(targetFileName, errors, allFiles, projectSpec, contracts);
    if (inputFailure !== null) {
        return inputFailure;
    }

    // ── 2. Normalize errors to message strings ────────────────────────────────
    // Errors may arrive as strings (legacy) or structured objects (Phase 8).
    const errorMessages = errors.map(e => {
        if (typeof e === "string") return e;
        if (typeof e === "object" && e !== null && typeof e.message === "string") return e.message;
        return String(e);
    });

    // ── 3. Locate the target file in the repository (read-only copy) ─────────
    // The allFiles array is treated as immutable input — we never mutate it.
    const targetFile = allFiles.find(f => f && f.name === targetFileName) || null;

    // ── 4. Build prompts ──────────────────────────────────────────────────────
    const { systemPrompt, userPrompt } = _buildRepairPrompts(
        targetFileName,
        errorMessages,
        targetFile,
        allFiles,
        projectSpec,
        contracts
    );

    // ── 5. Token budget: 1200 base + 900 per file (single file) capped at 2100 ──
    const repairTokenBudget = Math.min(1200 + 900, 2100);

    // ── 6. Execute AI repair call ─────────────────────────────────────────────
    let rawOutput;
    try {
        console.warn(`REPAIR SERVICE [9A]: Repairing single file: ${targetFileName}`);
        rawOutput = await aiExecutor.executeAiRequest(systemPrompt, userPrompt, {
            ...options,
            tokenBudget: repairTokenBudget
        });
        console.log(`[REPAIR DEBUG 9A] Raw AI response for '${targetFileName}':\n${rawOutput}`);
    } catch (aiError) {
        return _buildRepairFailure(
            repairErrorCodes.REPAIR_AI_CALL_FAILED,
            `AI call failed for file '${targetFileName}': ${aiError.message}`
        );
    }

    // ── 7. Parse AI output ────────────────────────────────────────────────────
    let parsedFiles;
    try {
        parsedFiles = aiExecutor.parseGeneratedFiles(rawOutput);
    } catch (parseError) {
        return _buildRepairFailure(
            repairErrorCodes.REPAIR_PARSE_FAILED,
            `Failed to parse AI output for file '${targetFileName}': ${parseError.message}`
        );
    }

    if (!Array.isArray(parsedFiles) || parsedFiles.length === 0) {
        return _buildRepairFailure(
            repairErrorCodes.REPAIR_PARSE_FAILED,
            `AI returned no parseable file output for '${targetFileName}'.`
        );
    }

    // ── 8. Extract only the target file from parsed output ───────────────────
    // We ONLY accept the target file — any other file in the AI output is silently ignored.
    // This enforces the single-file isolation contract.
    const repaired = parsedFiles.find(f => f && f.name === targetFileName);

    if (!repaired) {
        return _buildRepairFailure(
            repairErrorCodes.REPAIR_TARGET_NOT_IN_OUTPUT,
            `AI output did not contain the target file '${targetFileName}'. Repair rejected.`
        );
    }

    // ── 9. Syntax regression guard ────────────────────────────────────────────
    // For JS/JSX files: if the original file was syntax-valid, reject a repair that
    // introduces a new syntax error. This is a hard guard — we do not retry.
    const { validateJsSyntax } = require("../utils/syntaxValidator");
    const ext = path.extname(targetFileName).toLowerCase();

    if ([".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
        if (targetFile !== null) {
            const oldHasError = !!validateJsSyntax(targetFile.content, targetFileName);
            const newHasError = !!validateJsSyntax(repaired.content, targetFileName);
            if (!oldHasError && newHasError) {
                console.warn(`[Repair Guard 9A] Rejecting syntax-invalid repair for '${targetFileName}' (was valid before).`);
                return _buildRepairFailure(
                    repairErrorCodes.REPAIR_SYNTAX_REGRESSION,
                    `Repair for '${targetFileName}' introduced a new syntax error. Repair rejected without retry.`
                );
            }
        }
    }

    // ── 10. Return frozen repair result ───────────────────────────────────────
    const verificationStatus = (() => {
        const ext2 = path.extname(targetFileName).toLowerCase();
        if ([".js", ".jsx", ".mjs", ".cjs"].includes(ext2)) {
            const syntaxError = validateJsSyntax(repaired.content, targetFileName);
            return syntaxError ? "SYNTAX_ERROR" : "SYNTAX_OK";
        }
        return "NOT_CHECKED";
    })();

    return Object.freeze({
        success: true,
        code: null,
        message: null,
        repairedFile: Object.freeze({ name: repaired.name, content: repaired.content }),
        metadata: Object.freeze({
            targetFileName,
            timestamp: new Date().toISOString(),
            deterministic: true
        }),
        verificationStatus
    });
}

// ─── Legacy File-to-Error Mapping (unchanged) ─────────────────────────────────

/**
 * Map validation errors to the affected file names they reference.
 * Preserved for backward compatibility.
 *
 * @param {string[]} errors - List of validation error messages
 * @param {Array}    files  - List of { name, content } file objects
 * @returns {string[]} List of affected file names
 */
const mapErrorsToFiles = (errors, files) => {
    const affected = new Set();
    errors.forEach(err => {
        const errStr = typeof err === "object" && err !== null && typeof err.message === "string"
            ? err.message : String(err);

        // Detect explicitly missing files in validation messages
        const missingMatch = /missing required file '([^']+)'/i.exec(errStr) ||
                             /file '([^']+)' is missing/i.exec(errStr) ||
                             /missing file '([^']+)'/i.exec(errStr) ||
                             /required file '([^']+)' is missing/i.exec(errStr);
        if (missingMatch) {
            const cleanPath = missingMatch[1].trim();
            if (cleanPath.toLowerCase() !== "path/to/filename" && !cleanPath.includes("path/to/filename")) {
                affected.add(cleanPath);
            }
        }

        files.forEach(f => {
            if (f && errStr.includes(f.name)) {
                affected.add(f.name);
            }
        });
    });
    // Fallback: if no specific file matches, treat all as affected
    if (affected.size === 0) {
        files.forEach(f => { if (f) affected.add(f.name); });
    }
    return Array.from(affected);
};

// ─── Backward-Compatible Legacy API ──────────────────────────────────────────

/**
 * repairAffectedFiles — backward-compatible legacy API.
 *
 * This adapter wraps `repairSingleFile` to maintain full backward compatibility
 * with existing callers. It identifies affected files via `mapErrorsToFiles`,
 * then invokes `repairSingleFile` for EACH affected file sequentially (not in
 * batch). This replaces the old batch-3-files approach.
 *
 * Repair rules (Phase 9A):
 *   - Exactly one file per repair invocation (repairSingleFile)
 *   - No chained repairs across files — each file repair is independent
 *   - On per-file repair failure, the original file is preserved (no modification)
 *   - No automatic retry on failure
 *   - Returns updated file list with repaired contents merged in
 *
 * @param {string[]} errors      - Validation error messages
 * @param {Array}    files       - { name, content } file objects
 * @param {Object}   projectSpec - Project specification
 * @param {Object}   contracts   - Shared contracts
 * @param {Object}   [options]   - Optional AI executor options
 * @returns {Promise<Array>}     - Updated { name, content } file array
 */
const repairAffectedFiles = async (errors, files, projectSpec, contracts, options = {}) => {
    const affectedNames = mapErrorsToFiles(errors, files);

    // Build a mutable file map from the CALLER'S files (we never mutate the input array)
    const fileMap = new Map(files.map(f => [f.name, f.content]));

    for (const targetFileName of affectedNames) {
        // Provide the CURRENT state of all files as context (read-only).
        const currentFiles = Array.from(fileMap.entries()).map(([name, content]) => ({ name, content }));

        // Invoke the bounded single-file repair.
        const result = await repairSingleFile(
            targetFileName,
            errors,
            null,            // diagnostics not available in legacy path
            currentFiles,
            projectSpec,
            contracts,
            options
        );

        if (result.success) {
            // Merge only the repaired single file back into the map.
            fileMap.set(result.repairedFile.name, result.repairedFile.content);
        } else {
            // Failure: preserve the original file content. No retry. No modification.
            console.warn(
                `[Repair Guard 9A] Single-file repair failed for '${targetFileName}': ` +
                `[${result.code}] ${result.message}. Preserving original.`
            );
        }
    }

    return Array.from(fileMap.entries()).map(([name, content]) => ({ name, content }));
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    repairSingleFile,
    repairAffectedFiles,
    mapErrorsToFiles,
    repairErrorCodes
};
