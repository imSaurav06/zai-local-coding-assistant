"use strict";

const { auditErrorCodes } = require("./requirementAuditErrors");
const { deriveRequirementIdentities } = require("../requirements");
const { collectEvidence } = require("./requirementEvidence");
const { calculateCoverage } = require("./requirementCoverage");
const { buildAuditReport, deepFreeze } = require("./requirementAuditReport");

function createError(message, code) {
    const err = new Error(message);
    err.code = code;
    return err;
}

/**
 * Public API to audit requirements compliance.
 *
 * @param {Object} options Options containing projectSpec, generatedFiles, etc.
 * @param {Object} options.projectSpec Canonical ProjectSpec
 * @param {Array} options.generatedFiles Array of generated file objects ({ name, content })
 * @param {Object} [options.contracts] Structural contracts (folderStructure, apiEndpoints, databaseSchemas)
 * @param {Object} [options.verificationReport] Incremental verification diagnostics
 * @param {Array} [options.repairHistory] History of repair passes
 */
function auditRequirements(options) {
    // 1. Guard input checks
    if (options === null || options === undefined || typeof options !== "object" || Array.isArray(options)) {
        throw createError("Audit options must be a non-null object.", auditErrorCodes.AUDIT_INVALID_INPUT);
    }

    const { projectSpec, generatedFiles, contracts, verificationReport, repairHistory } = options;

    if (!projectSpec || typeof projectSpec !== "object") {
        throw createError("Property 'projectSpec' is required and must be an object.", auditErrorCodes.AUDIT_INVALID_INPUT);
    }

    if (!Array.isArray(generatedFiles)) {
        throw createError("Property 'generatedFiles' is required and must be an array.", auditErrorCodes.AUDIT_INVALID_INPUT);
    }

    // 2. Derive requirements list
    const derivation = deriveRequirementIdentities(projectSpec);
    if (!derivation.success) {
        throw createError(`Failed to process projectSpec: ${derivation.errors[0].message}`, auditErrorCodes.AUDIT_INVALID_PROJECT_SPEC);
    }

    const requirements = derivation.requirements;

    // 3. Collect evidence
    const evidence = collectEvidence(
        requirements,
        generatedFiles,
        contracts || {},
        verificationReport || {},
        repairHistory || []
    );

    // 4. Calculate coverage and orphans
    const coverageRes = calculateCoverage(evidence, requirements, generatedFiles);

    // 5. Overall passed status (Passed only if all requirements satisfied, e.g., 100% coverage, and verification is successful)
    const hasVerificationFailures = verificationReport && verificationReport.success === false;
    const passed = coverageRes.statistics.failedRequirements === 0 && !hasVerificationFailures;

    const summary = {
        passed,
        coverage: coverageRes.coverage,
        statistics: coverageRes.statistics,
        missingRequirements: coverageRes.missingRequirements,
        orphanArtifacts: coverageRes.orphanArtifacts
    };

    // 6. Build immutable report
    const report = buildAuditReport(summary, evidence);

    const result = {
        passed: summary.passed,
        coverage: summary.coverage,
        statistics: summary.statistics,
        missingRequirements: summary.missingRequirements,
        orphanArtifacts: summary.orphanArtifacts,
        evidence,
        report
    };

    return deepFreeze(result);
}

module.exports = {
    auditRequirements
};
