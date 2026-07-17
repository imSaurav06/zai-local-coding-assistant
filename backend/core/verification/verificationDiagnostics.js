"use strict";

const { runVerification } = require("./verificationEngine");

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION DIAGNOSTICS
// Pure, stateless, side-effect-free computation.
// Does not modify input. Returns frozen outputs.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a diagnostic summary from a VerificationResult.
 *
 * @param {Object} verificationResult - A (possibly frozen) VerificationResult
 * @returns {Object} Frozen diagnostics summary
 */
function computeDiagnostics(verificationResult) {
    if (!verificationResult || typeof verificationResult !== "object") {
        throw new TypeError("computeDiagnostics: verificationResult must be a non-null object.");
    }
    if (!Array.isArray(verificationResult.errors)) {
        throw new TypeError("computeDiagnostics: verificationResult.errors must be an array.");
    }

    const errors = verificationResult.errors;
    const warnings = Array.isArray(verificationResult.warnings) ? verificationResult.warnings : [];

    const bySeverity = { ERROR: 0, WARNING: 0, INFO: 0 };
    const byCategory = { SYNTAX: 0, STRUCTURE: 0, IMPORT: 0, DEPENDENCY: 0, PROFILE: 0, INTERNAL: 0 };

    for (const item of errors) {
        const sev = (item && item.severity) || "ERROR";
        const cat = (item && item.category) || "INTERNAL";
        if (sev in bySeverity) bySeverity[sev]++;
        if (cat in byCategory) byCategory[cat]++;
    }
    for (const item of warnings) {
        const sev = (item && item.severity) || "WARNING";
        const cat = (item && item.category) || "INTERNAL";
        if (sev in bySeverity) bySeverity[sev]++;
        if (cat in byCategory) byCategory[cat]++;
    }

    const diagnostics = {
        totalErrors: errors.length,
        totalWarnings: warnings.length,
        bySeverity: Object.freeze({ ...bySeverity }),
        byCategory: Object.freeze({ ...byCategory }),
        hasErrors: errors.length > 0,
        hasWarnings: warnings.length > 0
    };

    return Object.freeze(diagnostics);
}

/**
 * Runs verification and returns the result together with wall-clock duration.
 * Timing is kept outside VerificationResult to preserve deterministic equality.
 *
 * @param {Array}  files   - Generated file list
 * @param {Object} options - Options passed through to runVerification
 * @returns {{ result: Object, durationMs: number }} Frozen measurement object
 */
function measureVerification(files, options) {
    const startTime = Date.now();
    const result = runVerification(files, options);
    const durationMs = Date.now() - startTime;
    return Object.freeze({ result, durationMs });
}

module.exports = {
    computeDiagnostics,
    measureVerification
};
