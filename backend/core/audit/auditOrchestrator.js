"use strict";

const { auditOrchestratorErrorCodes } = require("./auditOrchestratorErrors");

// Reuse existing sub-auditors — no new logic is duplicated here
const { auditRequirements } = require("./requirementAuditor");
const { auditSecurity } = require("./securityAuditor");
const { auditIntegration } = require("./integrationAuditor");
const { qualifyDeployment } = require("./deploymentQualifier");

// Phase 12E: aggregation & certification modules
const { buildAuditSummary } = require("./auditSummary");
const { buildAuditCertification, deepFreeze } = require("./auditCertification");

function createError(message, code) {
    const err = new Error(message);
    err.code = code;
    return err;
}

/**
 * Public API — runs all four sub-audits in sequence, aggregates their results,
 * and returns a single, deterministic, deeply-frozen certification report.
 *
 * Sub-audit execution order (data flows forward):
 *   12A → auditRequirements
 *   12B → auditSecurity
 *   12C → auditIntegration (consumes verificationReport)
 *   12D → qualifyDeployment (consumes 12A + 12B + 12C results)
 *
 * @param {Object} options
 * @param {Object}  options.projectSpec           Canonical ProjectSpec
 * @param {Array}   options.generatedFiles        Generated project files [{ name, content }]
 * @param {Object}  [options.contracts]           Interface contracts
 * @param {Object}  [options.verificationReport]  Output from VerificationEngine
 * @param {Array}   [options.repairHistory]       Repair pass history
 * @param {Object}  [options.packageManifest]     Dependency manifest
 * @param {Array}   [options.environmentFiles]    Environment files
 * @param {Object}  [options.buildMetadata]       Build configuration metadata
 * @param {Object}  [options.executionMetadata]   Pipeline execution metadata
 *
 * @returns {{ passed, certification, summary, audits, report }}
 */
function runFullAudit(options) {
    // ── 1. Guard input ────────────────────────────────────────────────────────
    if (options === null || options === undefined || typeof options !== "object" || Array.isArray(options)) {
        throw createError(
            "runFullAudit options must be a non-null object.",
            auditOrchestratorErrorCodes.AUDIT_ORCHESTRATOR_INVALID_INPUT
        );
    }

    const {
        projectSpec,
        generatedFiles,
        contracts,
        verificationReport,
        repairHistory,
        packageManifest,
        environmentFiles,
        buildMetadata,
        executionMetadata
    } = options;

    if (!projectSpec || typeof projectSpec !== "object") {
        throw createError(
            "Property 'projectSpec' is required and must be an object.",
            auditOrchestratorErrorCodes.AUDIT_ORCHESTRATOR_INVALID_INPUT
        );
    }

    if (!Array.isArray(generatedFiles)) {
        throw createError(
            "Property 'generatedFiles' is required and must be an array.",
            auditOrchestratorErrorCodes.AUDIT_ORCHESTRATOR_INVALID_INPUT
        );
    }

    // ── 2. Phase 12A — Requirement Compliance ────────────────────────────────
    let requirementResult;
    try {
        requirementResult = auditRequirements({
            projectSpec,
            generatedFiles,
            contracts: contracts || {},
            verificationReport: verificationReport || null,
            repairHistory: repairHistory || []
        });
    } catch (err) {
        throw createError(
            `Requirement audit (12A) failed: ${err.message}`,
            auditOrchestratorErrorCodes.AUDIT_ORCHESTRATOR_STAGE_FAILURE
        );
    }

    // ── 3. Phase 12B — Security Audit ─────────────────────────────────────────
    let securityResult;
    try {
        securityResult = auditSecurity({
            projectFiles: generatedFiles,
            packageManifest: packageManifest || null,
            environmentFiles: environmentFiles || [],
            buildMetadata: buildMetadata || null
        });
    } catch (err) {
        throw createError(
            `Security audit (12B) failed: ${err.message}`,
            auditOrchestratorErrorCodes.AUDIT_ORCHESTRATOR_STAGE_FAILURE
        );
    }

    // ── 4. Phase 12C — Integration Audit ─────────────────────────────────────
    let integrationResult;
    try {
        integrationResult = auditIntegration({
            projectSpec,
            executionMetadata: executionMetadata || null,
            contracts: contracts || {},
            generatedFiles,
            verificationReport: verificationReport || null
        });
    } catch (err) {
        throw createError(
            `Integration audit (12C) failed: ${err.message}`,
            auditOrchestratorErrorCodes.AUDIT_ORCHESTRATOR_STAGE_FAILURE
        );
    }

    // ── 5. Phase 12D — Deployment Qualification ───────────────────────────────
    // Feeds the live outputs from 12A, 12B, and 12C in as gate inputs.
    let deploymentResult;
    try {
        deploymentResult = qualifyDeployment({
            projectSpec,
            generatedFiles,
            verificationReport: verificationReport || null,
            securityReport: securityResult,
            integrationReport: integrationResult,
            requirementReport: requirementResult
        });
    } catch (err) {
        throw createError(
            `Deployment qualification (12D) failed: ${err.message}`,
            auditOrchestratorErrorCodes.AUDIT_ORCHESTRATOR_STAGE_FAILURE
        );
    }

    // ── 6. Phase 12E — Aggregate summary ──────────────────────────────────────
    const summary = buildAuditSummary(
        requirementResult,
        securityResult,
        integrationResult,
        deploymentResult
    );

    // ── 7. Phase 12E — Final certification ────────────────────────────────────
    const certification = buildAuditCertification(summary);

    // ── 8. Build combined text report ─────────────────────────────────────────
    const reportLines = [
        "══════════════════════════════════════════════════════",
        "Z.AI FULL AUDIT REPORT",
        `Generated: ${new Date().toISOString()}`,
        "══════════════════════════════════════════════════════",
        "",
        certification.text
    ];

    const report = reportLines.join("\n");

    // ── 9. Assemble and deep-freeze the final result ───────────────────────────
    const result = {
        passed: certification.passed,
        certification,
        summary,
        audits: {
            requirement: requirementResult,
            security: securityResult,
            integration: integrationResult,
            deployment: deploymentResult
        },
        report
    };

    return deepFreeze(result);
}

module.exports = {
    runFullAudit
};
