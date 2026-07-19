"use strict";

/**
 * Benchmark suite result aggregator module (Phase 13D).
 * Aggregates scenario execution results into suite-level metrics.
 * Pure function only.
 */

/**
 * Aggregates benchmark scenario results into suite metrics.
 *
 * @param {Array} results Array of benchmark execution results
 * @returns {Object} Deeply frozen summary object
 */
function aggregateBenchmarkResults(results) {
    const safeResults = Array.isArray(results) ? results : [];
    const benchmarkCount = safeResults.length;

    if (benchmarkCount === 0) {
        return Object.freeze({
            benchmarkCount: 0,
            averageScore: 0,
            highestScore: 0,
            lowestScore: 0,
            passedCount: 0,
            failedCount: 0,
            suitePassed: false,
            gradeDistribution: Object.freeze({ A: 0, B: 0, C: 0, D: 0, F: 0 })
        });
    }

    let sum = 0;
    let highestScore = -Infinity;
    let lowestScore = Infinity;
    let passedCount = 0;
    let failedCount = 0;

    const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };

    for (const item of safeResults) {
        const score = typeof item.score === "number" ? item.score : 0;
        const passed = Boolean(item.passed);
        const grade = item.grade && gradeDistribution.hasOwnProperty(item.grade) ? item.grade : "F";

        sum += score;
        if (score > highestScore) highestScore = score;
        if (score < lowestScore) lowestScore = score;

        if (passed) {
            passedCount++;
        } else {
            failedCount++;
        }

        gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
    }

    const averageScore = Math.round(sum / benchmarkCount);
    const suitePassed = passedCount === benchmarkCount && benchmarkCount > 0;

    return Object.freeze({
        benchmarkCount,
        averageScore,
        highestScore: highestScore === -Infinity ? 0 : highestScore,
        lowestScore: lowestScore === Infinity ? 0 : lowestScore,
        passedCount,
        failedCount,
        suitePassed,
        gradeDistribution: Object.freeze(gradeDistribution)
    });
}

module.exports = {
    aggregateBenchmarkResults
};
