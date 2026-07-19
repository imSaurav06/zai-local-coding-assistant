"use strict";

const { deploymentQualificationErrorCodes } = require("./deploymentQualificationErrors");
const {
    checkArtifactCompleteness,
    checkPriorAuditResults,
    checkSpecDeploymentReadiness
} = require("./deploymentChecks");
const { calculateDeploymentScore } = require("./deploymentScore");
const { buildDeploymentQualificationReport, deepFreeze } = require("./deploymentQualificationReport");

function createError(message, code) {
    const err = new Error(message);
    err.code = code;
    return err;
}

/**
 * Public API to run a deterministic deployment qualification check.
 *
 * @param {Object} options
 * @param {Object}  options.projectSpec         Canonical ProjectSpec
 * @param {Array}   options.generatedFiles       Array of generated files ({ name, content })
 * @param {Object}  [options.verificationReport] Output from VerificationEngine
 * @param {Object}  [options.securityReport]     Output from SecurityAuditor (Phase 12B)
 * @param {Object}  [options.integrationReport]  Output from IntegrationAuditor (Phase 12C)
 * @param {Object}  [options.requirementReport]  Output from RequirementAuditor (Phase 12A)
 */
function qualifyDeployment(options) {
    // 1. Guard checks
    if (options === null || options === undefined || typeof options !== "object" || Array.isArray(options)) {
        throw createError(
            "Deployment qualification options must be a non-null object.",
            deploymentQualificationErrorCodes.DEPLOYMENT_QUALIFICATION_INVALID_INPUT
        );
    }

    const {
        projectSpec,
        generatedFiles,
        verificationReport,
        securityReport,
        integrationReport,
        requirementReport
    } = options;

    if (!projectSpec || typeof projectSpec !== "object") {
        throw createError(
            "Property 'projectSpec' is required and must be an object.",
            deploymentQualificationErrorCodes.DEPLOYMENT_QUALIFICATION_INVALID_INPUT
        );
    }

    if (!Array.isArray(generatedFiles)) {
        throw createError(
            "Property 'generatedFiles' is required and must be an array.",
            deploymentQualificationErrorCodes.DEPLOYMENT_QUALIFICATION_INVALID_INPUT
        );
    }

    const allBlockers = [];
    const allWarnings = [];

    // 2. Check project spec readiness
    try {
        const specResult = checkSpecDeploymentReadiness(projectSpec);
        allBlockers.push(...specResult.blockers);
        allWarnings.push(...specResult.warnings);
    } catch (err) {
        throw createError(
            `Spec readiness check failed: ${err.message}`,
            deploymentQualificationErrorCodes.DEPLOYMENT_QUALIFICATION_INTERNAL_ERROR
        );
    }

    // 3. Check artifact completeness
    try {
        const artifactResult = checkArtifactCompleteness(generatedFiles);
        allBlockers.push(...artifactResult.blockers);
        allWarnings.push(...artifactResult.warnings);
    } catch (err) {
        throw createError(
            `Artifact completeness check failed: ${err.message}`,
            deploymentQualificationErrorCodes.DEPLOYMENT_QUALIFICATION_INTERNAL_ERROR
        );
    }

    // 4. Check prior audit results
    try {
        const priorResult = checkPriorAuditResults(
            verificationReport,
            securityReport,
            integrationReport,
            requirementReport
        );
        allBlockers.push(...priorResult.blockers);
        allWarnings.push(...priorResult.warnings);
    } catch (err) {
        throw createError(
            `Prior audit gate check failed: ${err.message}`,
            deploymentQualificationErrorCodes.DEPLOYMENT_QUALIFICATION_INTERNAL_ERROR
        );
    }

    // 5. Calculate overall score and recommendation
    const scoreResult = calculateDeploymentScore(allBlockers, allWarnings);

    // 6. Build and freeze the report
    const report = buildDeploymentQualificationReport(
        scoreResult.passed,
        scoreResult.score,
        scoreResult.recommendation,
        allBlockers,
        allWarnings
    );

    const result = {
        passed: scoreResult.passed,
        score: scoreResult.score,
        blockers: allBlockers,
        warnings: allWarnings,
        recommendation: scoreResult.recommendation,
        report
    };

    return deepFreeze(result);
}

module.exports = {
    qualifyDeployment
};
