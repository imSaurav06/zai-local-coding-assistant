"use strict";

/**
 * Aggregates the four individual audit results into a single, unified summary
 * that gives an at-a-glance view of every dimension.
 *
 * @param {Object} requirementResult   Frozen result from auditRequirements()
 * @param {Object} securityResult      Frozen result from auditSecurity()
 * @param {Object} integrationResult   Frozen result from auditIntegration()
 * @param {Object} deploymentResult    Frozen result from qualifyDeployment()
 * @returns {Object} Frozen aggregate summary
 */
function buildAuditSummary(requirementResult, securityResult, integrationResult, deploymentResult) {
    const stages = [
        {
            stage: "requirement",
            passed: requirementResult.passed,
            score: requirementResult.coverage != null ? Math.round(requirementResult.coverage) : null,
            label: "Requirement Compliance"
        },
        {
            stage: "security",
            passed: securityResult.passed,
            score: securityResult.score != null ? securityResult.score : null,
            label: "Security Audit"
        },
        {
            stage: "integration",
            passed: integrationResult.passed,
            score: integrationResult.score != null ? integrationResult.score : null,
            label: "Integration Audit"
        },
        {
            stage: "deployment",
            passed: deploymentResult.passed,
            score: deploymentResult.score != null ? deploymentResult.score : null,
            label: "Deployment Qualification"
        }
    ];

    const allPassed = stages.every(s => s.passed === true);

    const numericalScores = stages.filter(s => s.score != null).map(s => s.score);
    const overallScore = numericalScores.length > 0
        ? Math.round(numericalScores.reduce((sum, v) => sum + v, 0) / numericalScores.length)
        : 0;

    const failedStages = stages.filter(s => !s.passed).map(s => s.label);
    const passedStages = stages.filter(s => s.passed).map(s => s.label);

    return Object.freeze({
        allPassed,
        overallScore,
        stages: Object.freeze(stages.map(s => Object.freeze({ ...s }))),
        passedStages: Object.freeze(passedStages),
        failedStages: Object.freeze(failedStages),
        stageCount: stages.length,
        passedCount: passedStages.length,
        failedCount: failedStages.length
    });
}

module.exports = {
    buildAuditSummary
};
