"use strict";

const CERTIFICATION_REPORT_VERSION = "1.0";

/**
 * Deep freezes an object recursively to guarantee absolute immutability.
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
 * Determines the final certification tier from the aggregated summary.
 *
 * Tiers:
 *   CERTIFIED           — all stages passed, score >= 80
 *   CONDITIONALLY_CERTIFIED — all stages passed, score >= 60
 *   NOT_CERTIFIED       — any stage failed
 */
function resolveCertificationTier(summary) {
    if (!summary.allPassed) return "NOT_CERTIFIED";
    if (summary.overallScore >= 80) return "CERTIFIED";
    return "CONDITIONALLY_CERTIFIED";
}

/**
 * Renders a human-readable certification banner.
 */
function renderCertificationText(tier, summary, createdAt) {
    const lines = [];
    lines.push("==================================================");
    lines.push(`Full Audit Certification Report v${CERTIFICATION_REPORT_VERSION}`);
    lines.push(`Timestamp: ${createdAt}`);
    lines.push(`Certification Tier: ${tier}`);
    lines.push(`Overall Score: ${summary.overallScore}/100`);
    lines.push(`Stages: ${summary.passedCount}/${summary.stageCount} passed`);
    lines.push("==================================================");

    lines.push("\nStage Results:");
    for (const stage of summary.stages) {
        const status = stage.passed ? "✓ PASS" : "✗ FAIL";
        const scoreStr = stage.score != null ? ` [${stage.score}/100]` : "";
        lines.push(`  ${status} — ${stage.label}${scoreStr}`);
    }

    if (summary.failedStages.length > 0) {
        lines.push(`\nFailed Stages: ${summary.failedStages.join(", ")}`);
    }

    lines.push("\n==================================================");
    switch (tier) {
        case "CERTIFIED":
            lines.push("CERTIFICATION: This project has passed all audit stages and is CERTIFIED for production.");
            break;
        case "CONDITIONALLY_CERTIFIED":
            lines.push("CERTIFICATION: All stages passed but some warnings were detected. Review before deploying.");
            break;
        default:
            lines.push("CERTIFICATION: One or more audit stages FAILED. This project is NOT CERTIFIED for production.");
    }
    lines.push("==================================================");
    return lines.join("\n");
}

/**
 * Builds and deep-freezes the final certification artifact.
 *
 * @param {Object} summary   Output from buildAuditSummary()
 * @returns {Object} Deeply frozen certification object
 */
function buildAuditCertification(summary) {
    const createdAt = new Date().toISOString();
    const tier = resolveCertificationTier(summary);
    const passed = tier !== "NOT_CERTIFIED";
    const text = renderCertificationText(tier, summary, createdAt);

    return deepFreeze({
        certificationVersion: CERTIFICATION_REPORT_VERSION,
        createdAt,
        tier,
        passed,
        overallScore: summary.overallScore,
        passedStages: summary.passedStages,
        failedStages: summary.failedStages,
        text
    });
}

module.exports = {
    buildAuditCertification,
    resolveCertificationTier,
    deepFreeze
};
