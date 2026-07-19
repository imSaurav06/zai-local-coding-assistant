"use strict";

const RELEASE_FRAMEWORK_VERSION = "1.0.0";

/**
 * Deep freezes an object recursively to guarantee absolute immutability.
 *
 * @param {*} obj Object to freeze
 * @returns {*} Frozen object
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
 * Resolves qualification level based on mandatory criteria and score.
 *
 * Levels:
 * - RELEASE_CANDIDATE: Mandatory criteria pass AND score >= 85
 * - RELEASE_WITH_WARNINGS: Mandatory criteria pass AND score >= 70
 * - NOT_READY: Mandatory criteria fail OR score < 70
 *
 * @param {Object} criteria Criteria evaluation object
 * @param {number} score Score between 0 and 100
 * @returns {string} Qualification level string
 */
function resolveQualificationLevel(criteria, score) {
    if (!criteria || !criteria.mandatoryPassed || score < 70) {
        return "NOT_READY";
    }
    if (score >= 85) {
        return "RELEASE_CANDIDATE";
    }
    return "RELEASE_WITH_WARNINGS";
}

/**
 * Renders a human-readable release summary text.
 */
function renderReleaseSummaryText(level, score, criteria, generatedAt, version) {
    const lines = [];
    lines.push("==================================================");
    lines.push(`Antigravity Release Qualification Report v${version}`);
    lines.push(`Generated At: ${generatedAt}`);
    lines.push(`Qualification Level: ${level}`);
    lines.push(`Release Score: ${score}/100`);
    lines.push("==================================================");

    lines.push("\nRelease Criteria Breakdown:");
    lines.push(`  ${criteria.auditPassed ? "✓" : "✗"} Audit Gate`);
    lines.push(`  ${criteria.verificationPassed ? "✓" : "✗"} Verification Gate`);
    lines.push(`  ${criteria.repairPassed ? "✓" : "✗"} Repair Gate`);
    lines.push(`  ${criteria.regressionPassed ? "✓" : "✗"} Regression Gate`);
    lines.push(`  ${criteria.metadataComplete ? "✓" : "✗"} Metadata Completeness`);

    lines.push("\n==================================================");
    switch (level) {
        case "RELEASE_CANDIDATE":
            lines.push("STATUS: Qualified as RELEASE_CANDIDATE. Ready for production deployment.");
            break;
        case "RELEASE_WITH_WARNINGS":
            lines.push("STATUS: Qualified as RELEASE_WITH_WARNINGS. Mandatory criteria passed, but score is below 85. Review warnings before release.");
            break;
        default:
            lines.push("STATUS: NOT_READY for release. One or more mandatory criteria failed or score is below 70.");
    }
    lines.push("==================================================");

    return lines.join("\n");
}

/**
 * Builds and deeply freezes the release qualification report.
 *
 * @param {Object} options Report construction options
 * @param {Object} options.criteria Normalized criteria object
 * @param {number} options.score Release score (0-100)
 * @param {string} [options.version] Framework version
 * @param {string} [options.generatedAt] Timestamp
 * @returns {Object} Deeply frozen release report artifact
 */
function buildReleaseReport(options) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const criteria = safeOptions.criteria || {};
    const score = typeof safeOptions.score === "number" ? safeOptions.score : 0;
    const version = safeOptions.version || RELEASE_FRAMEWORK_VERSION;
    const generatedAt = safeOptions.generatedAt || new Date().toISOString();

    const level = resolveQualificationLevel(criteria, score);
    const qualified = level === "RELEASE_CANDIDATE" || level === "RELEASE_WITH_WARNINGS";
    const summaryText = renderReleaseSummaryText(level, score, criteria, generatedAt, version);

    const reportObj = {
        qualified,
        level,
        score,
        criteria,
        version,
        generatedAt,
        summaryText
    };

    return deepFreeze(reportObj);
}

module.exports = {
    buildReleaseReport,
    resolveQualificationLevel,
    deepFreeze
};
