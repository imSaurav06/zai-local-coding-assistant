"use strict";

/**
 * Calculates the aggregate deployment readiness score.
 *
 * Scoring:
 *   - Starts at 100.
 *   - Each blocker deducts 25 points.
 *   - Each warning deducts 5 points.
 *   - Score floor is 0.
 *
 * Recommendation tier:
 *   APPROVED_FOR_DEPLOYMENT  >= 80, no blockers
 *   CONDITIONAL_DEPLOYMENT   >= 60, no blockers but warnings present
 *   DEPLOYMENT_BLOCKED       any blockers
 */
function calculateDeploymentScore(allBlockers, allWarnings) {
    let score = 100;

    score -= allBlockers.length * 25;
    score -= allWarnings.length * 5;

    if (score < 0) score = 0;

    let recommendation;
    if (allBlockers.length > 0) {
        recommendation = "DEPLOYMENT_BLOCKED";
    } else if (score >= 80) {
        recommendation = "APPROVED_FOR_DEPLOYMENT";
    } else {
        recommendation = "CONDITIONAL_DEPLOYMENT";
    }

    const passed = allBlockers.length === 0 && score >= 60;

    return {
        score,
        passed,
        recommendation
    };
}

module.exports = {
    calculateDeploymentScore
};
