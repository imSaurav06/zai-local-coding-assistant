"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION REPORT BUILDER
// Pure, stateless, side-effect-free text generation.
// Accepts a VerificationResult and an optional durationMs from measureVerification.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a human-readable verification report string from a VerificationResult.
 *
 * @param {Object}  verificationResult - A (possibly frozen) VerificationResult
 * @param {number}  [durationMs]       - Optional wall-clock duration in ms (from measureVerification)
 * @returns {string} Human-readable report
 */
function buildReport(verificationResult, durationMs) {
    if (!verificationResult || typeof verificationResult !== "object") {
        throw new TypeError("buildReport: verificationResult must be a non-null object.");
    }

    const SEP = "=".repeat(50);
    const SECTION_SEP = "\u2500".repeat(50);
    const lines = [];

    lines.push("Verification Report");
    lines.push(SEP);

    lines.push(`Status:   ${verificationResult.success ? "PASS \u2713" : "FAIL \u2717"}`);

    if (typeof durationMs === "number") {
        lines.push(`Duration: ${durationMs}ms`);
    }

    const meta = verificationResult.metadata;
    if (meta && meta.profileName) {
        lines.push(`Profile:  ${meta.profileName}`);
    }

    const errors  = Array.isArray(verificationResult.errors)   ? verificationResult.errors   : [];
    const warnings = Array.isArray(verificationResult.warnings) ? verificationResult.warnings : [];

    lines.push(`Errors:   ${errors.length}`);
    lines.push(`Warnings: ${warnings.length}`);

    if (errors.length > 0) {
        lines.push("");
        lines.push(`\u2500\u2500\u2500 Errors ${SECTION_SEP.slice(7)}`);
        errors.forEach((err, i) => {
            const sev = (err && err.severity) || "ERROR";
            const cat = (err && err.category) || "INTERNAL";
            const loc = (err && err.path)     ? ` [${err.path}]` : "";
            const msg = (err && err.message)  || "(no message)";
            lines.push(`  ${i + 1}. [${sev}][${cat}]${loc} ${msg}`);
        });
    }

    if (warnings.length > 0) {
        lines.push("");
        lines.push(`\u2500\u2500\u2500 Warnings ${SECTION_SEP.slice(9)}`);
        warnings.forEach((warn, i) => {
            const sev = (warn && warn.severity) || "WARNING";
            const cat = (warn && warn.category) || "INTERNAL";
            const loc = (warn && warn.path)     ? ` [${warn.path}]` : "";
            const msg = (warn && warn.message)  || "(no message)";
            lines.push(`  ${i + 1}. [${sev}][${cat}]${loc} ${msg}`);
        });
    }

    lines.push(SEP);
    return lines.join("\n");
}

function buildVerificationReport(verificationResult, durationMs, files = []) {
    if (!verificationResult || typeof verificationResult !== "object") {
        const err = new Error("Invalid verificationResult: must be a non-null object.");
        err.code = "VERIFICATION_REPORT_INVALID";
        throw err;
    }

    const errors = Array.isArray(verificationResult.errors) ? verificationResult.errors : [];
    const warnings = Array.isArray(verificationResult.warnings) ? verificationResult.warnings : [];

    const report = {
        status: verificationResult.success ? "PASSED" : "FAILED",
        errors,
        warnings,
        statistics: {
            totalErrors: errors.length,
            totalWarnings: warnings.length
        },
        duration: typeof durationMs === "number" ? durationMs : 0,
        verifiedFiles: files.map(f => f.path || f.name || "")
    };

    function deepFreeze(obj) {
        if (obj === null || typeof obj !== "object") {
            return obj;
        }
        Object.freeze(obj);
        Object.getOwnPropertyNames(obj).forEach(prop => {
            if (
                obj.hasOwnProperty(prop) &&
                obj[prop] !== null &&
                (typeof obj[prop] === "object" || typeof obj[prop] === "function") &&
                !Object.isFrozen(obj[prop])
            ) {
                deepFreeze(obj[prop]);
            }
        });
        return obj;
    }

    return deepFreeze(report);
}

module.exports = {
    buildReport,
    buildVerificationReport
};
