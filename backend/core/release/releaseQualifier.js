"use strict";

const { releaseErrorCodes } = require("./releaseErrors");
const { evaluateReleaseCriteria } = require("./releaseCriteria");
const { calculateReleaseScore } = require("./releaseScore");
const { buildReleaseReport, deepFreeze } = require("./releaseReport");

function createError(message, code) {
    const err = new Error(message);
    err.code = code;
    return err;
}

/**
 * Public API to run release qualification on evidence artifacts.
 *
 * @param {Object} input Input evidence bundle
 * @param {Object} [input.audit] Audit Report or output from runFullAudit()
 * @param {Object} [input.verification] Verification Engine report
 * @param {Object|Array} [input.repair] Repair Engine history / report
 * @param {Object} [input.execution] Execution Metadata
 * @param {Object} [input.build] Build Metadata
 * @param {Object} [input.regression] Regression Test Metadata
 * @returns {Object} Deeply frozen release qualification result ({ qualified, level, score, criteria, report })
 */
function qualifyRelease(input) {
    // 1. Guard checks
    if (input === null || input === undefined || typeof input !== "object" || Array.isArray(input)) {
        throw createError(
            "Release qualification input must be a non-null object.",
            releaseErrorCodes.INVALID_INPUT
        );
    }

    // 2. Coordinate criteria evaluation
    let criteria;
    try {
        criteria = evaluateReleaseCriteria(input);
    } catch (err) {
        throw createError(
            `Criteria evaluation failed: ${err.message}`,
            releaseErrorCodes.INVALID_METADATA
        );
    }

    // 3. Coordinate scoring
    let score;
    try {
        score = calculateReleaseScore(criteria);
    } catch (err) {
        throw createError(
            `Score calculation failed: ${err.message}`,
            releaseErrorCodes.INVALID_SCORE
        );
    }

    // 4. Coordinate report building
    let report;
    try {
        report = buildReleaseReport({ criteria, score });
    } catch (err) {
        throw createError(
            `Release report generation failed: ${err.message}`,
            releaseErrorCodes.REPORT_BUILD_FAILED
        );
    }

    // 5. Assemble and deep-freeze output contract
    const result = {
        qualified: report.qualified,
        level: report.level,
        score: report.score,
        criteria: report.criteria,
        report
    };

    return deepFreeze(result);
}

module.exports = {
    qualifyRelease
};
