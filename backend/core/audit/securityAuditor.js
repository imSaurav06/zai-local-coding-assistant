"use strict";

const { securityAuditErrorCodes } = require("./securityAuditErrors");
const { scanSecrets } = require("./secretScanner");
const { auditDependencies } = require("./dependencyAudit");
const { buildSecurityAuditReport, deepFreeze } = require("./securityAuditReport");

function createError(message, code) {
    const err = new Error(message);
    err.code = code;
    return err;
}

/**
 * Public API to run a deterministic security audit on the generated repository.
 *
 * @param {Object} options Options containing files and manifests
 * @param {Array} options.projectFiles Array of generated codebase files ({ name, content })
 * @param {Object|String} [options.packageManifest] Dependency manifest (package.json or requirements.txt)
 * @param {Array} [options.environmentFiles] Environment files ({ name, content })
 * @param {Object} [options.buildMetadata] Optional metadata from the build configuration
 */
function auditSecurity(options) {
    // 1. Guard checks
    if (options === null || options === undefined || typeof options !== "object" || Array.isArray(options)) {
        throw createError("Security audit options must be a non-null object.", securityAuditErrorCodes.SECURITY_AUDIT_INVALID_INPUT);
    }

    const { projectFiles, packageManifest, environmentFiles, buildMetadata } = options;

    if (!Array.isArray(projectFiles)) {
        throw createError("Property 'projectFiles' is required and must be an array.", securityAuditErrorCodes.SECURITY_AUDIT_INVALID_INPUT);
    }

    const warnings = [];

    // 2. Add configuration warnings
    if (!packageManifest) {
        warnings.push("No package manifest (package.json or requirements.txt) was provided for dependency auditing.");
    }
    if (!environmentFiles || environmentFiles.length === 0) {
        warnings.push("No environment configuration files (.env) were provided for secrets scanning.");
    }

    // 3. Scan secrets
    let secrets = [];
    try {
        secrets = scanSecrets(projectFiles, environmentFiles || []);
    } catch (err) {
        throw createError(`Secrets scanner encountered an error: ${err.message}`, securityAuditErrorCodes.SECURITY_AUDIT_INTERNAL_ERROR);
    }

    // 4. Scan dependency vulnerabilities
    let vulnerabilities = [];
    try {
        vulnerabilities = auditDependencies(packageManifest);
    } catch (err) {
        throw createError(`Dependency auditor encountered an error: ${err.message}`, securityAuditErrorCodes.SECURITY_AUDIT_INTERNAL_ERROR);
    }

    // 5. Assemble frozen report
    const report = buildSecurityAuditReport(vulnerabilities, secrets, warnings);

    const result = {
        passed: report.passed,
        score: report.score,
        vulnerabilities: report.vulnerabilities,
        secrets: report.secrets,
        warnings: report.warnings,
        report
    };

    return deepFreeze(result);
}

module.exports = {
    auditSecurity
};
