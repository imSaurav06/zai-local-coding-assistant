"use strict";

/**
 * Production readiness score calculator module (Phase 13B).
 * Calculates a deterministic score (0-100) based on category validation results.
 * Weighting: Environment (25), Providers (25), Configuration (25), Build (25).
 */

/**
 * Calculates deterministic readiness score based on category validation results.
 * Pure function only.
 *
 * @param {Object} results Validation results map { environment, providers, configuration, build }
 * @returns {number} Deterministic score bounded between 0 and 100
 */
function calculateReadinessScore(results) {
    if (!results || typeof results !== "object") {
        return 0;
    }

    let totalScore = 0;

    // Helper to score a category (max 25 pts)
    function scoreCategory(categoryResult) {
        if (!categoryResult || typeof categoryResult !== "object") {
            return 0;
        }

        if (categoryResult.valid === false) {
            return 0;
        }

        let categoryScore = 25;
        if (Array.isArray(categoryResult.warnings) && categoryResult.warnings.length > 0) {
            const deduction = categoryResult.warnings.length * 5;
            categoryScore = Math.max(10, 25 - deduction);
        }

        return categoryScore;
    }

    totalScore += scoreCategory(results.environment);
    totalScore += scoreCategory(results.providers);
    totalScore += scoreCategory(results.configuration);
    totalScore += scoreCategory(results.build);

    return Math.max(0, Math.min(100, Math.round(totalScore)));
}

module.exports = {
    calculateReadinessScore
};
