"use strict";

/**
 * Release score calculation module (Phase 13A).
 * Consumes normalized criteria and produces a deterministic score (0-100).
 */

/**
 * Calculates a deterministic release score based on release criteria.
 * Pure function only.
 *
 * @param {Object} criteria Normalized release criteria object
 * @returns {number} Score bounded between 0 and 100
 */
function calculateReleaseScore(criteria) {
    if (!criteria || typeof criteria !== "object") {
        return 0;
    }

    let score = 100;

    // 1. Audit Deduction
    if (!criteria.auditPassed) {
        score -= 30;
    } else if (criteria.details && typeof criteria.details.auditScore === "number" && criteria.details.auditScore < 100) {
        const auditDeduction = Math.min(25, Math.max(0, 100 - criteria.details.auditScore));
        score -= auditDeduction;
    }

    // 2. Verification Deduction
    if (!criteria.verificationPassed) {
        score -= 25;
    } else if (criteria.details && criteria.details.verificationErrorsCount > 0) {
        score -= Math.min(20, criteria.details.verificationErrorsCount * 5);
    }

    // 3. Repair Deduction
    if (!criteria.repairPassed) {
        score -= 20;
    } else if (criteria.details && criteria.details.repairFailuresCount > 0) {
        score -= Math.min(15, criteria.details.repairFailuresCount * 5);
    }

    // 4. Regression Deduction
    if (!criteria.regressionPassed) {
        score -= 30;
    } else if (criteria.details && criteria.details.regressionFailedCount > 0) {
        score -= Math.min(25, criteria.details.regressionFailedCount * 10);
    }

    // 5. Metadata Completeness Deduction
    if (!criteria.metadataComplete) {
        if (criteria.details) {
            if (!criteria.details.executionMetaPresent) score -= 5;
            if (!criteria.details.buildMetaPresent) score -= 5;
        } else {
            score -= 10;
        }
    }

    return Math.max(0, Math.min(100, Math.round(score)));
}

module.exports = {
    calculateReleaseScore
};
