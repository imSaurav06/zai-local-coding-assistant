"use strict";

/**
 * Engineering certification score calculator module (Phase 13E).
 * Calculates final engineering score and grade based on subsystem scores.
 *
 * Weights:
 * - Audit Subsystem: 30%
 * - Release Qualification Subsystem: 25%
 * - Production Readiness Subsystem: 20%
 * - Benchmark Subsystem: 25%
 */

const GRADE_THRESHOLDS = Object.freeze([
    { min: 97, grade: "A+" },
    { min: 93, grade: "A" },
    { min: 85, grade: "B" },
    { min: 75, grade: "C" },
    { min: 70, grade: "D" },
    { min: 0, grade: "F" }
]);

/**
 * Resolves letter grade from numerical score.
 *
 * @param {number} score Engineering score (0-100)
 * @returns {string} Grade letter ("A+", "A", "B", "C", "D", "F")
 */
function resolveGrade(score) {
    for (const threshold of GRADE_THRESHOLDS) {
        if (score >= threshold.min) {
            return threshold.grade;
        }
    }
    return "F";
}

/**
 * Calculates final engineering score and letter grade from aggregated subsystem state.
 * Pure function only.
 *
 * @param {Object} subsystems Aggregated subsystems object ({ audit, release, readiness, benchmark })
 * @returns {Object} Result object ({ engineeringScore: number, grade: string })
 */
function calculateEngineeringScore(subsystems) {
    if (!subsystems || typeof subsystems !== "object") {
        return Object.freeze({ engineeringScore: 0, grade: "F" });
    }

    const auditScore = subsystems.audit && typeof subsystems.audit.score === "number" ? subsystems.audit.score : 0;
    const releaseScore = subsystems.release && typeof subsystems.release.score === "number" ? subsystems.release.score : 0;
    const readinessScore = subsystems.readiness && typeof subsystems.readiness.score === "number" ? subsystems.readiness.score : 0;
    const benchmarkScore = subsystems.benchmark && typeof subsystems.benchmark.score === "number" ? subsystems.benchmark.score : 0;

    const weightedScore =
        (auditScore * 0.30) +
        (releaseScore * 0.25) +
        (readinessScore * 0.20) +
        (benchmarkScore * 0.25);

    const engineeringScore = Math.max(0, Math.min(100, Math.round(weightedScore)));
    const grade = resolveGrade(engineeringScore);

    return Object.freeze({
        engineeringScore,
        grade
    });
}

module.exports = {
    calculateEngineeringScore,
    resolveGrade,
    GRADE_THRESHOLDS
};
