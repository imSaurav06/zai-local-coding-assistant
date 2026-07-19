"use strict";

const { integrationAuditErrorCodes } = require("./integrationAuditErrors");
const { validatePipeline } = require("./pipelineAudit");
const { validateContracts } = require("./contractAudit");
const { buildIntegrationAuditReport, deepFreeze } = require("./integrationAuditReport");

function createError(message, code) {
    const err = new Error(message);
    err.code = code;
    return err;
}

/**
 * Public API to run a deterministic integration audit across pipeline runs, verification outputs, and contracts.
 *
 * @param {Object} options Options containing spec, metadata, and files
 * @param {Object} options.projectSpec Canonical ProjectSpec
 * @param {Object} options.executionMetadata Compilation pipeline execution metadata
 * @param {Object} options.contracts Authorized interface contracts
 * @param {Array} options.generatedFiles Array of generated codebase files ({ name, content })
 * @param {Object} [options.verificationReport] Optional diagnostics output from VerificationEngine
 */
function auditIntegration(options) {
    // 1. Guard check options
    if (options === null || options === undefined || typeof options !== "object" || Array.isArray(options)) {
        throw createError("Integration audit options must be a non-null object.", integrationAuditErrorCodes.INTEGRATION_AUDIT_INVALID_INPUT);
    }

    const { projectSpec, executionMetadata, contracts, generatedFiles, verificationReport } = options;

    if (!projectSpec || typeof projectSpec !== "object") {
        throw createError("Property 'projectSpec' is required and must be an object.", integrationAuditErrorCodes.INTEGRATION_AUDIT_INVALID_INPUT);
    }

    if (!Array.isArray(generatedFiles)) {
        throw createError("Property 'generatedFiles' is required and must be an array.", integrationAuditErrorCodes.INTEGRATION_AUDIT_INVALID_INPUT);
    }

    // 2. Validate pipeline execution
    let pipelineResult;
    try {
        pipelineResult = validatePipeline(executionMetadata || {});
    } catch (err) {
        throw createError(`Pipeline validation failed with internal error: ${err.message}`, integrationAuditErrorCodes.INTEGRATION_AUDIT_INTERNAL_ERROR);
    }

    // 3. Validate contracts implementation
    let contractResult;
    try {
        contractResult = validateContracts(contracts || {}, generatedFiles);
    } catch (err) {
        throw createError(`Contracts validation failed with internal error: ${err.message}`, integrationAuditErrorCodes.INTEGRATION_AUDIT_INTERNAL_ERROR);
    }

    // 4. Inject verification report failures into results if verification failed
    if (verificationReport && verificationReport.success === false) {
        const errorMsgs = (verificationReport.errors || []).map(e => `Verification diagnostic error: ${e.message || e}`);
        for (const msg of errorMsgs) {
            contractResult.errors.push(msg);
        }
        if (errorMsgs.length === 0) {
            contractResult.errors.push("Verification step failed with generic diagnostics error.");
        }
        contractResult.success = false;
    }

    // 5. Generate and deep-freeze output report
    const report = buildIntegrationAuditReport(pipelineResult, contractResult);

    const result = {
        passed: report.passed,
        score: report.score,
        pipeline: report.pipeline,
        contracts: report.contracts,
        warnings: report.warnings,
        errors: report.errors,
        report
    };

    return deepFreeze(result);
}

module.exports = {
    auditIntegration
};
