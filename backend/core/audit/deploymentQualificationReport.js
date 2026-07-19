"use strict";

const DEPLOYMENT_REPORT_VERSION = "1.0";

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
 * Renders a human-readable text report of the deployment qualification results.
 */
function renderReportText(passed, score, recommendation, blockers, warnings) {
    const lines = [];
    lines.push("==================================================");
    lines.push(`Deployment Qualification Report v${DEPLOYMENT_REPORT_VERSION}`);
    lines.push(`Timestamp: ${new Date().toISOString()}`);
    lines.push(`Qualification Status: ${passed ? "QUALIFIED" : "DISQUALIFIED"}`);
    lines.push(`Recommendation: ${recommendation}`);
    lines.push(`Readiness Score: ${score}/100`);
    lines.push("==================================================");

    if (blockers.length > 0) {
        lines.push(`\n1. Deployment Blockers [${blockers.length}]:`);
        for (const blocker of blockers) {
            lines.push(`  ✗ ${blocker}`);
        }
    } else {
        lines.push(`\n1. Deployment Blockers: NONE`);
    }

    if (warnings.length > 0) {
        lines.push(`\n2. Deployment Warnings [${warnings.length}]:`);
        for (const warning of warnings) {
            lines.push(`  ! ${warning}`);
        }
    } else {
        lines.push(`\n2. Deployment Warnings: NONE`);
    }

    lines.push("\n==================================================");
    lines.push(passed
        ? `QUALIFICATION RESULT: This project is ${recommendation}.`
        : `QUALIFICATION RESULT: Deployment is blocked. Resolve all blockers before proceeding.`
    );
    lines.push("==================================================");
    return lines.join("\n");
}

/**
 * Assembles and deeply freezes the deployment qualification report.
 */
function buildDeploymentQualificationReport(passed, score, recommendation, blockers, warnings) {
    const text = renderReportText(passed, score, recommendation, blockers, warnings);

    const reportObj = {
        reportVersion: DEPLOYMENT_REPORT_VERSION,
        createdAt: new Date().toISOString(),
        passed,
        score,
        recommendation,
        blockers,
        warnings,
        text
    };

    return deepFreeze(reportObj);
}

module.exports = {
    buildDeploymentQualificationReport,
    deepFreeze
};
