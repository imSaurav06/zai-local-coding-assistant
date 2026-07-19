"use strict";

const INTEGRATION_REPORT_VERSION = "1.0";

/**
 * Deep freezes an object recursively to guarantee absolute immutability.
 */
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

/**
 * Renders a human-readable text report of the integration findings.
 */
function renderReportText(passed, score, pipelineResult, contractResult, warnings, errors) {
    const lines = [];
    lines.push("==================================================");
    lines.push(`Integration Audit Report v${INTEGRATION_REPORT_VERSION}`);
    lines.push(`Timestamp: ${new Date().toISOString()}`);
    lines.push(`Overall Status: ${passed ? "PASSED" : "FAILED"}`);
    lines.push(`Integration Score: ${score}/100`);
    lines.push("==================================================");

    lines.push(`\n1. Pipeline Integration Summary:`);
    lines.push(`  - Pipeline Valid: ${pipelineResult.success ? "YES" : "NO"}`);
    lines.push(`  - Errors: ${pipelineResult.errors.length}`);
    lines.push(`  - Warnings: ${pipelineResult.warnings.length}`);

    lines.push(`\n2. Interface Contract Compliance Summary:`);
    lines.push(`  - Contracts Compliant: ${contractResult.success ? "YES" : "NO"}`);
    lines.push(`  - Errors: ${contractResult.errors.length}`);
    lines.push(`  - Warnings: ${contractResult.warnings.length}`);

    if (errors.length > 0) {
        lines.push(`\n3. Audit Errors List:`);
        for (const err of errors) {
            lines.push(`  - [ERROR] ${err}`);
        }
    }

    if (warnings.length > 0) {
        lines.push(`\n4. Audit Warnings List:`);
        for (const warn of warnings) {
            lines.push(`  - [WARNING] ${warn}`);
        }
    }

    lines.push("\n==================================================");
    return lines.join("\n");
}

/**
 * Assembles and freezes the structured report.
 */
function buildIntegrationAuditReport(pipelineResult, contractResult) {
    const errors = [...pipelineResult.errors, ...contractResult.errors];
    const warnings = [...pipelineResult.warnings, ...contractResult.warnings];

    // Score calculation
    let score = 100;
    score -= pipelineResult.errors.length * 15;
    score -= contractResult.errors.length * 15;
    score -= pipelineResult.warnings.length * 5;
    score -= contractResult.warnings.length * 5;

    if (score < 0) score = 0;

    const passed = score >= 80 && errors.length === 0;

    const text = renderReportText(passed, score, pipelineResult, contractResult, warnings, errors);

    const reportObj = {
        reportVersion: INTEGRATION_REPORT_VERSION,
        createdAt: new Date().toISOString(),
        passed,
        score,
        pipeline: {
            success: pipelineResult.success,
            errors: pipelineResult.errors,
            warnings: pipelineResult.warnings
        },
        contracts: {
            success: contractResult.success,
            errors: contractResult.errors,
            warnings: contractResult.warnings
        },
        warnings,
        errors,
        text
    };

    return deepFreeze(reportObj);
}

module.exports = {
    buildIntegrationAuditReport,
    deepFreeze
};
