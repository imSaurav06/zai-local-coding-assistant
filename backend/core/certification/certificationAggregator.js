"use strict";

/**
 * Certification aggregator module (Phase 13E).
 * Aggregates outputs produced by previously implemented certification subsystems.
 * Pure function only.
 */

/**
 * Aggregates subsystem results into a unified certification state.
 *
 * @param {Object} input Input bundle containing subsystem output objects
 * @param {Object} input.audit Output from runFullAudit()
 * @param {Object} input.release Output from qualifyRelease()
 * @param {Object} input.readiness Output from validateProductionReadiness()
 * @param {Object} input.benchmark Output from runBenchmarkSuite() or runBenchmark()
 * @returns {Object} Deeply frozen aggregated subsystem state
 */
function aggregateCertification(input) {
    const safeInput = input && typeof input === "object" ? input : {};
    const audit = safeInput.audit && typeof safeInput.audit === "object" ? safeInput.audit : {};
    const release = safeInput.release && typeof safeInput.release === "object" ? safeInput.release : {};
    const readiness = safeInput.readiness && typeof safeInput.readiness === "object" ? safeInput.readiness : {};
    const benchmark = safeInput.benchmark && typeof safeInput.benchmark === "object" ? safeInput.benchmark : {};

    // 1. Audit Subsystem Evaluation
    const auditPassed = Boolean(audit.passed === true || (audit.certification && audit.certification.passed === true));
    const auditScore = typeof audit.score === "number" ? audit.score :
        (audit.certification && typeof audit.certification.overallScore === "number" ? audit.certification.overallScore : 0);

    // 2. Release Qualification Subsystem Evaluation
    const releaseQualified = Boolean(release.qualified === true || release.level === "RELEASE_CANDIDATE" || release.level === "RELEASE_WITH_WARNINGS");
    const releaseScore = typeof release.score === "number" ? release.score : 0;
    const releaseLevel = release.level || (releaseQualified ? "RELEASE_CANDIDATE" : "NOT_READY");

    // 3. Production Readiness Subsystem Evaluation
    const readinessReady = Boolean(readiness.ready === true);
    const readinessScore = typeof readiness.score === "number" ? readiness.score : 0;

    // 4. Benchmark Subsystem Evaluation
    const benchmarkPassed = Boolean(benchmark.suitePassed === true || benchmark.passed === true);
    const benchmarkScore = typeof benchmark.averageScore === "number" ? benchmark.averageScore :
        (typeof benchmark.score === "number" ? benchmark.score : 0);
    const benchmarkGrade = benchmark.grade || (benchmarkPassed ? "A" : "F");

    // 5. Overall Pass Determination
    const overallPassed = auditPassed && releaseQualified && readinessReady && benchmarkPassed;

    const subsystems = {
        audit: { passed: auditPassed, score: auditScore },
        release: { qualified: releaseQualified, score: releaseScore, level: releaseLevel },
        readiness: { ready: readinessReady, score: readinessScore },
        benchmark: { passed: benchmarkPassed, score: benchmarkScore, grade: benchmarkGrade }
    };

    return Object.freeze({
        overallPassed,
        subsystems: Object.freeze(subsystems)
    });
}

module.exports = {
    aggregateCertification
};
