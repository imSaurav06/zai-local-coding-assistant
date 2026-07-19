"use strict";

const READINESS_REPORT_VERSION = "1.0.0";

/**
 * Deep freezes an object recursively to guarantee absolute immutability.
 *
 * @param {*} obj Object to freeze
 * @returns {*} Frozen object
 */
function deepFreeze(obj) {
    if (obj === null || typeof obj !== "object") return obj;
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

/**
 * Renders a human-readable text report of the readiness status.
 */
function renderReadinessText(ready, score, checks, warnings, generatedAt, version) {
    const lines = [];
    lines.push("==================================================");
    lines.push(`Production Readiness Report v${version}`);
    lines.push(`Generated At: ${generatedAt}`);
    lines.push(`Readiness Status: ${ready ? "READY FOR PRODUCTION" : "NOT READY"}`);
    lines.push(`Readiness Score: ${score}/100`);
    lines.push("==================================================");

    lines.push("\nCategory Checks:");
    lines.push(`  ${checks.environment ? "✓" : "✗"} Environment Metadata`);
    lines.push(`  ${checks.providers ? "✓" : "✗"} Provider Metadata`);
    lines.push(`  ${checks.configuration ? "✓" : "✗"} Configuration Metadata`);
    lines.push(`  ${checks.build ? "✓" : "✗"} Build Metadata`);

    if (warnings.length > 0) {
        lines.push(`\nReadiness Warnings (${warnings.length}):`);
        for (const warning of warnings) {
            lines.push(`  ! ${warning}`);
        }
    } else {
        lines.push("\nReadiness Warnings: NONE");
    }

    lines.push("\n==================================================");
    lines.push(ready
        ? "VERDICT: All mandatory production readiness checks PASSED."
        : "VERDICT: Production readiness checks FAILED. Resolve blocking errors before deploying."
    );
    lines.push("==================================================");

    return lines.join("\n");
}

/**
 * Builds and deeply freezes the production readiness report artifact.
 *
 * @param {Object} options Report options
 * @param {boolean} options.ready Readiness status
 * @param {number} options.score Readiness score (0-100)
 * @param {Array} options.warnings Aggregated warnings array
 * @param {Object} options.checks Summary of category check boolean flags
 * @param {string} [options.version] Framework version
 * @param {string} [options.generatedAt] Timestamp string
 * @returns {Object} Deeply frozen readiness report artifact
 */
function buildReadinessReport(options) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const ready = Boolean(safeOptions.ready);
    const score = typeof safeOptions.score === "number" ? safeOptions.score : 0;
    const warnings = Array.isArray(safeOptions.warnings) ? safeOptions.warnings : [];
    const checks = safeOptions.checks && typeof safeOptions.checks === "object" ? safeOptions.checks : {
        environment: false,
        providers: false,
        configuration: false,
        build: false
    };
    const version = safeOptions.version || READINESS_REPORT_VERSION;
    const generatedAt = safeOptions.generatedAt || new Date().toISOString();

    const text = renderReadinessText(ready, score, checks, warnings, generatedAt, version);

    const reportObj = {
        ready,
        score,
        warnings,
        checks,
        version,
        generatedAt,
        text
    };

    return deepFreeze(reportObj);
}

module.exports = {
    buildReadinessReport,
    deepFreeze
};
