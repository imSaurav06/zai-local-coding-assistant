"use strict";

/**
 * Release criteria evaluation layer (Phase 13A).
 * Evaluates release readiness using existing evidence without performing any scoring.
 */

/**
 * Evaluates release readiness criteria from provided evidence artifacts.
 * Pure function only.
 *
 * @param {Object} input Input evidence bundle
 * @param {Object} [input.audit] Audit Report or output from runFullAudit() / sub-audits
 * @param {Object} [input.verification] Verification Engine report
 * @param {Object|Array} [input.repair] Repair Engine history / report
 * @param {Object} [input.execution] Execution Metadata
 * @param {Object} [input.build] Build Metadata
 * @param {Object} [input.regression] Regression Test Metadata
 * @returns {Object} Normalized criteria evaluation result
 */
function evaluateReleaseCriteria(input) {
    const safeInput = input && typeof input === "object" ? input : {};

    // 1. Audit Evaluation
    let auditPassed = false;
    let auditScore = null;

    if (safeInput.audit && typeof safeInput.audit === "object") {
        if (typeof safeInput.audit.passed === "boolean") {
            auditPassed = safeInput.audit.passed;
        } else if (safeInput.audit.certification && typeof safeInput.audit.certification.passed === "boolean") {
            auditPassed = safeInput.audit.certification.passed;
        } else if (safeInput.audit.recommendation === "APPROVED_FOR_DEPLOYMENT") {
            auditPassed = true;
        }

        if (typeof safeInput.audit.score === "number") {
            auditScore = safeInput.audit.score;
        } else if (safeInput.audit.certification && typeof safeInput.audit.certification.overallScore === "number") {
            auditScore = safeInput.audit.certification.overallScore;
        } else if (safeInput.audit.summary && typeof safeInput.audit.summary.overallScore === "number") {
            auditScore = safeInput.audit.summary.overallScore;
        }
    }

    // 2. Verification Evaluation
    let verificationPassed = false;
    let verificationErrorsCount = 0;

    if (safeInput.verification && typeof safeInput.verification === "object") {
        if (Array.isArray(safeInput.verification.errors)) {
            verificationErrorsCount = safeInput.verification.errors.length;
        }

        if (typeof safeInput.verification.success === "boolean") {
            verificationPassed = safeInput.verification.success;
        } else if (typeof safeInput.verification.passed === "boolean") {
            verificationPassed = safeInput.verification.passed;
        } else {
            verificationPassed = verificationErrorsCount === 0;
        }
    }

    // 3. Repair Evaluation
    let repairPassed = true;
    let repairFailuresCount = 0;

    if (safeInput.repair) {
        if (Array.isArray(safeInput.repair)) {
            const failedCount = safeInput.repair.filter(r => r && r.success === false).length;
            repairFailuresCount = failedCount;
            repairPassed = failedCount === 0;
        } else if (typeof safeInput.repair === "object") {
            if (typeof safeInput.repair.failedRepairs === "number") {
                repairFailuresCount = safeInput.repair.failedRepairs;
            } else if (Array.isArray(safeInput.repair.failed)) {
                repairFailuresCount = safeInput.repair.failed.length;
            }

            if (typeof safeInput.repair.passed === "boolean") {
                repairPassed = safeInput.repair.passed;
            } else if (typeof safeInput.repair.success === "boolean") {
                repairPassed = safeInput.repair.success;
            } else {
                repairPassed = repairFailuresCount === 0;
            }
        }
    }

    // 4. Regression Evaluation
    let regressionPassed = false;
    let regressionPassedCount = 0;
    let regressionFailedCount = 0;

    if (safeInput.regression && typeof safeInput.regression === "object") {
        if (typeof safeInput.regression.passed === "number") {
            regressionPassedCount = safeInput.regression.passed;
        } else if (typeof safeInput.regression.passedCount === "number") {
            regressionPassedCount = safeInput.regression.passedCount;
        }

        if (typeof safeInput.regression.failed === "number") {
            regressionFailedCount = safeInput.regression.failed;
        } else if (typeof safeInput.regression.failedCount === "number") {
            regressionFailedCount = safeInput.regression.failedCount;
        }

        if (typeof safeInput.regression.passed === "boolean") {
            regressionPassed = safeInput.regression.passed;
        } else {
            regressionPassed = regressionFailedCount === 0 && (regressionPassedCount > 0 || safeInput.regression.total > 0);
        }
    }

    // 5. Metadata Evaluation
    const executionMetaPresent = Boolean(safeInput.execution && typeof safeInput.execution === "object" && !Array.isArray(safeInput.execution));
    const buildMetaPresent = Boolean(safeInput.build && typeof safeInput.build === "object" && !Array.isArray(safeInput.build));
    const metadataComplete = executionMetaPresent && buildMetaPresent;

    // Mandatory Criteria Resolution
    const mandatoryPassed = auditPassed && verificationPassed && repairPassed && regressionPassed;

    return Object.freeze({
        auditPassed,
        verificationPassed,
        repairPassed,
        regressionPassed,
        metadataComplete,
        mandatoryPassed,
        details: Object.freeze({
            auditScore,
            verificationErrorsCount,
            repairFailuresCount,
            regressionPassedCount,
            regressionFailedCount,
            executionMetaPresent,
            buildMetaPresent
        })
    });
}

module.exports = {
    evaluateReleaseCriteria
};
