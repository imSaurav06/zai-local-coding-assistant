"use strict";

/**
 * Benchmark scoring module (Phase 13C).
 * Aggregates normalized metrics using deterministic weighting to produce an overall score (0-100).
 *
 * Weighting:
 * - Planning Quality: 10%
 * - Requirement Coverage: 10%
 * - TaskGraph Completeness: 10%
 * - Generation Completeness: 10%
 * - Verification Success Rate: 15%
 * - Repair Success Rate: 10%
 * - Audit Score: 15%
 * - Release Score: 10%
 * - Readiness Score: 5%
 * - Regression Pass Rate: 5%
 */

/**
 * Calculates a deterministic overall benchmark score from normalized metrics.
 * Pure function only.
 *
 * @param {Object} metrics Normalized metrics object
 * @returns {number} Score bounded between 0 and 100
 */
function calculateBenchmarkScore(metrics) {
    if (!metrics || typeof metrics !== "object") {
        return 0;
    }

    const {
        planningQuality = 0,
        requirementCoverage = 0,
        taskGraphCompleteness = 0,
        generationCompleteness = 0,
        verificationSuccessRate = 0,
        repairSuccessRate = 0,
        auditScore = 0,
        releaseScore = 0,
        readinessScore = 0,
        regressionPassRate = 0
    } = metrics;

    const total =
        (planningQuality * 0.10) +
        (requirementCoverage * 0.10) +
        (taskGraphCompleteness * 0.10) +
        (generationCompleteness * 0.10) +
        (verificationSuccessRate * 0.15) +
        (repairSuccessRate * 0.10) +
        (auditScore * 0.15) +
        (releaseScore * 0.10) +
        (readinessScore * 0.05) +
        (regressionPassRate * 0.05);

    return Math.max(0, Math.min(100, Math.round(total)));
}

module.exports = {
    calculateBenchmarkScore
};
