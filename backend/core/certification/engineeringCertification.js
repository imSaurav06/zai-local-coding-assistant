"use strict";

const { certificationErrorCodes } = require("./certificationErrors");
const { aggregateCertification } = require("./certificationAggregator");
const { calculateEngineeringScore } = require("./certificationScore");
const { buildCertificationReport, deepFreeze } = require("./certificationReport");

function createError(message, code) {
    const err = new Error(message);
    err.code = code;
    return err;
}

/**
 * Public API for the Final Engineering Certification Framework.
 * Orchestrates and certifies platform readiness from previously computed subsystem evidence outputs.
 *
 * @param {Object} input Input bundle containing outputs from existing public APIs
 * @param {Object} input.audit Output from runFullAudit()
 * @param {Object} input.release Output from qualifyRelease()
 * @param {Object} input.readiness Output from validateProductionReadiness()
 * @param {Object} input.benchmark Output from runBenchmarkSuite() or runBenchmark()
 * @returns {Object} Deeply frozen engineering certification artifact
 */
function certifyEngineering(input) {
    // 1. Guard check input
    if (input === null || input === undefined || typeof input !== "object" || Array.isArray(input)) {
        throw createError(
            "certifyEngineering input must be a non-null object.",
            certificationErrorCodes.INVALID_INPUT
        );
    }

    const { audit, release, readiness, benchmark } = input;

    // 2. Validate mandatory subsystem evidence outputs
    if (!audit || typeof audit !== "object" || Array.isArray(audit)) {
        throw createError(
            "Property 'audit' is required and must be a valid audit output object.",
            certificationErrorCodes.INVALID_AUDIT_RESULT
        );
    }

    if (!release || typeof release !== "object" || Array.isArray(release)) {
        throw createError(
            "Property 'release' is required and must be a valid release qualification object.",
            certificationErrorCodes.INVALID_RELEASE_RESULT
        );
    }

    if (!readiness || typeof readiness !== "object" || Array.isArray(readiness)) {
        throw createError(
            "Property 'readiness' is required and must be a valid production readiness object.",
            certificationErrorCodes.INVALID_READINESS_RESULT
        );
    }

    if (!benchmark || typeof benchmark !== "object" || Array.isArray(benchmark)) {
        throw createError(
            "Property 'benchmark' is required and must be a valid benchmark output object.",
            certificationErrorCodes.INVALID_BENCHMARK_RESULT
        );
    }

    // 3. Coordinate aggregation
    let aggregated;
    try {
        aggregated = aggregateCertification({ audit, release, readiness, benchmark });
    } catch (err) {
        throw createError(
            `Subsystem aggregation failed: ${err.message}`,
            certificationErrorCodes.INTERNAL_ERROR
        );
    }

    // 4. Coordinate engineering score calculation
    let scoreResult;
    try {
        scoreResult = calculateEngineeringScore(aggregated.subsystems);
    } catch (err) {
        throw createError(
            `Engineering score calculation failed: ${err.message}`,
            certificationErrorCodes.INVALID_CERTIFICATION_SCORE
        );
    }

    // 5. Certification determination (All subsystems pass AND engineeringScore >= 70)
    const certified = aggregated.overallPassed && scoreResult.engineeringScore >= 70;

    // 6. Coordinate report building
    let report;
    try {
        report = buildCertificationReport({
            certified,
            engineeringScore: scoreResult.engineeringScore,
            grade: scoreResult.grade,
            overallPassed: aggregated.overallPassed,
            subsystems: aggregated.subsystems
        });
    } catch (err) {
        throw createError(
            `Certification report building failed: ${err.message}`,
            certificationErrorCodes.REPORT_BUILD_FAILED
        );
    }

    // 7. Assemble and deep-freeze output artifact
    const result = {
        certified,
        engineeringScore: scoreResult.engineeringScore,
        grade: scoreResult.grade,
        overallPassed: aggregated.overallPassed,
        subsystems: aggregated.subsystems,
        summary: report.summary,
        report
    };

    return deepFreeze(result);
}

module.exports = {
    certifyEngineering
};
