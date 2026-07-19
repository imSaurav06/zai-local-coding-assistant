"use strict";

const { auditRequirements } = require("./requirementAuditor");
const { auditErrorCodes } = require("./requirementAuditErrors");
const { collectEvidence } = require("./requirementEvidence");
const { calculateCoverage } = require("./requirementCoverage");
const { buildAuditReport } = require("./requirementAuditReport");

const { auditSecurity } = require("./securityAuditor");
const { securityAuditErrorCodes } = require("./securityAuditErrors");
const { scanSecrets } = require("./secretScanner");
const { auditDependencies } = require("./dependencyAudit");
const { buildSecurityAuditReport } = require("./securityAuditReport");

const { auditIntegration } = require("./integrationAuditor");
const { integrationAuditErrorCodes } = require("./integrationAuditErrors");
const { validatePipeline } = require("./pipelineAudit");
const { validateContracts } = require("./contractAudit");
const { buildIntegrationAuditReport } = require("./integrationAuditReport");

module.exports = {
    // 12A Requirement Compliance Audit
    auditRequirements,
    collectEvidence,
    calculateCoverage,
    buildAuditReport,
    auditErrorCodes,

    // 12B Security Audit
    auditSecurity,
    scanSecrets,
    auditDependencies,
    buildSecurityAuditReport,
    securityAuditErrorCodes,

    // 12C Integration Audit
    auditIntegration,
    validatePipeline,
    validateContracts,
    buildIntegrationAuditReport,
    integrationAuditErrorCodes
};
