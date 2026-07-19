"use strict";

/**
 * Benchmark metrics calculator module (Phase 13C).
 * Computes normalized metrics (0-100) purely derived from supplied evidence artifacts.
 * Strictly pure: no AI, no I/O, no runtime execution, no database calls.
 */

/**
 * Normalizes a numeric value strictly between 0 and 100.
 *
 * @param {number} val Input value
 * @returns {number} Normalized integer (0-100)
 */
function normalizeScore(val) {
    if (typeof val !== "number" || isNaN(val)) return 0;
    return Math.max(0, Math.min(100, Math.round(val)));
}

/**
 * Calculates deterministic benchmark metrics from supplied evidence input bundle.
 * Pure function only.
 *
 * @param {Object} input Input evidence bundle
 * @param {Object} [input.projectSpec] ProjectSpec object
 * @param {Object} [input.execution] Execution Metadata
 * @param {Object} [input.verification] Verification Engine report
 * @param {Object|Array} [input.repair] Repair Engine history / report
 * @param {Object} [input.audit] Audit Report or output from runFullAudit()
 * @param {Object} [input.release] Release Qualification report
 * @param {Object} [input.readiness] Production Readiness report
 * @param {Object} [input.regression] Regression Test Metadata
 * @returns {Object} Deeply frozen metrics object
 */
function calculateBenchmarkMetrics(input) {
    const safeInput = input && typeof input === "object" ? input : {};

    // 1. Planning Quality (0-100)
    let planningQuality = 0;
    if (safeInput.projectSpec && typeof safeInput.projectSpec === "object") {
        let points = 0;
        if (safeInput.projectSpec.schemaVersion) points += 15;
        if (safeInput.projectSpec.projectName) points += 15;
        if (safeInput.projectSpec.projectType) points += 15;
        if (safeInput.projectSpec.frontend) points += 15;
        if (Array.isArray(safeInput.projectSpec.pagesAndRoutes) && safeInput.projectSpec.pagesAndRoutes.length > 0) points += 15;
        if (Array.isArray(safeInput.projectSpec.components)) points += 10;
        if (Array.isArray(safeInput.projectSpec.architectureConstraints)) points += 15;
        planningQuality = Math.min(100, points);
    }

    // 2. Requirement Coverage (0-100)
    let requirementCoverage = 0;
    if (safeInput.audit && typeof safeInput.audit === "object") {
        if (typeof safeInput.audit.coverage === "number") {
            requirementCoverage = safeInput.audit.coverage;
        } else if (safeInput.audit.summary && typeof safeInput.audit.summary.coverage === "number") {
            requirementCoverage = safeInput.audit.summary.coverage;
        } else if (safeInput.audit.passed === true) {
            requirementCoverage = 100;
        }
    }

    // 3. TaskGraph Completeness (0-100)
    let taskGraphCompleteness = 0;
    if (safeInput.execution && typeof safeInput.execution === "object") {
        if (safeInput.execution.completedTasksCount && safeInput.execution.totalTasksCount) {
            taskGraphCompleteness = (safeInput.execution.completedTasksCount / safeInput.execution.totalTasksCount) * 100;
        } else if (safeInput.execution.status === "COMPLETED" || safeInput.execution.status === "SUCCESS") {
            taskGraphCompleteness = 100;
        }
    }

    // 4. Generation Completeness (0-100)
    let generationCompleteness = 0;
    if (safeInput.execution && typeof safeInput.execution === "object") {
        if (safeInput.execution.status === "COMPLETED" || safeInput.execution.status === "SUCCESS" || safeInput.execution.filesCount > 0) {
            generationCompleteness = 100;
        }
    }

    // 5. Verification Success Rate (0-100)
    let verificationSuccessRate = 0;
    if (safeInput.verification && typeof safeInput.verification === "object") {
        if (safeInput.verification.success === true || safeInput.verification.passed === true) {
            verificationSuccessRate = 100;
        } else if (Array.isArray(safeInput.verification.errors)) {
            verificationSuccessRate = Math.max(0, 100 - (safeInput.verification.errors.length * 20));
        }
    }

    // 6. Repair Success Rate (0-100)
    let repairSuccessRate = 100;
    if (safeInput.repair) {
        if (Array.isArray(safeInput.repair)) {
            const failedCount = safeInput.repair.filter(r => r && r.success === false).length;
            repairSuccessRate = Math.max(0, 100 - (failedCount * 25));
        } else if (typeof safeInput.repair === "object") {
            if (safeInput.repair.passed === false || safeInput.repair.success === false) {
                const failedCount = safeInput.repair.failedRepairs || 1;
                repairSuccessRate = Math.max(0, 100 - (failedCount * 25));
            }
        }
    }

    // 7. Audit Score (0-100)
    let auditScore = 0;
    if (safeInput.audit && typeof safeInput.audit === "object") {
        if (typeof safeInput.audit.score === "number") {
            auditScore = safeInput.audit.score;
        } else if (safeInput.audit.certification && typeof safeInput.audit.certification.overallScore === "number") {
            auditScore = safeInput.audit.certification.overallScore;
        } else if (safeInput.audit.summary && typeof safeInput.audit.summary.overallScore === "number") {
            auditScore = safeInput.audit.summary.overallScore;
        } else if (safeInput.audit.passed === true) {
            auditScore = 100;
        }
    }

    // 8. Release Score (0-100)
    let releaseScore = 0;
    if (safeInput.release && typeof safeInput.release === "object") {
        if (typeof safeInput.release.score === "number") {
            releaseScore = safeInput.release.score;
        } else if (safeInput.release.report && typeof safeInput.release.report.score === "number") {
            releaseScore = safeInput.release.report.score;
        } else if (safeInput.release.qualified === true) {
            releaseScore = 100;
        }
    }

    // 9. Readiness Score (0-100)
    let readinessScore = 0;
    if (safeInput.readiness && typeof safeInput.readiness === "object") {
        if (typeof safeInput.readiness.score === "number") {
            readinessScore = safeInput.readiness.score;
        } else if (safeInput.readiness.report && typeof safeInput.readiness.report.score === "number") {
            readinessScore = safeInput.readiness.report.score;
        } else if (safeInput.readiness.ready === true) {
            readinessScore = 100;
        }
    }

    // 10. Regression Pass Rate (0-100)
    let regressionPassRate = 0;
    if (safeInput.regression && typeof safeInput.regression === "object") {
        if (typeof safeInput.regression.passed === "number" && typeof safeInput.regression.total === "number" && safeInput.regression.total > 0) {
            regressionPassRate = (safeInput.regression.passed / safeInput.regression.total) * 100;
        } else if (safeInput.regression.passed === true) {
            regressionPassRate = 100;
        }
    }

    return Object.freeze({
        planningQuality: normalizeScore(planningQuality),
        requirementCoverage: normalizeScore(requirementCoverage),
        taskGraphCompleteness: normalizeScore(taskGraphCompleteness),
        generationCompleteness: normalizeScore(generationCompleteness),
        verificationSuccessRate: normalizeScore(verificationSuccessRate),
        repairSuccessRate: normalizeScore(repairSuccessRate),
        auditScore: normalizeScore(auditScore),
        releaseScore: normalizeScore(releaseScore),
        readinessScore: normalizeScore(readinessScore),
        regressionPassRate: normalizeScore(regressionPassRate)
    });
}

module.exports = {
    calculateBenchmarkMetrics
};
