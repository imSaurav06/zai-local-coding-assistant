"use strict";

const CERTIFICATION_VERSION = "1.0.0";

/**
 * Deep freezes an object recursively to guarantee absolute immutability.
 *
 * @param {*} obj Object to freeze
 * @returns {*} Frozen object
 */
function deepFreeze(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach(prop => {
        if (
            obj.hasOwnProperty(prop) &&
            obj[prop] !== null &&
            (typeof obj[prop] === "object" || typeof obj[prop] === "function") &&
            !Object.isFrozen(obj[prop])
        ) {
            deepFreeze(obj[prop]);
        }
    });
    return obj;
}

/**
 * Renders human-readable certification text banner.
 */
function renderCertificationText(certified, engineeringScore, grade, overallPassed, subsystems, generatedAt, version) {
    const lines = [];
    lines.push("==================================================");
    lines.push(`Final Engineering Certification Report v${version}`);
    lines.push(`Generated At: ${generatedAt}`);
    lines.push(`Certification Status: ${certified ? "PLATFORM CERTIFIED (v1.0.0 Release Candidate)" : "CERTIFICATION FAILED"}`);
    lines.push(`Engineering Score: ${engineeringScore}/100 [Grade: ${grade}]`);
    lines.push("==================================================");

    lines.push("\nSubsystem Verification Summary:");
    lines.push(`  ${subsystems.audit?.passed ? "✓" : "✗"} Audit Framework             [Score: ${subsystems.audit?.score || 0}/100]`);
    lines.push(`  ${subsystems.release?.qualified ? "✓" : "✗"} Release Qualification       [Score: ${subsystems.release?.score || 0}/100, Level: ${subsystems.release?.level || "N/A"}]`);
    lines.push(`  ${subsystems.readiness?.ready ? "✓" : "✗"} Production Readiness      [Score: ${subsystems.readiness?.score || 0}/100]`);
    lines.push(`  ${subsystems.benchmark?.passed ? "✓" : "✗"} Benchmark Framework         [Score: ${subsystems.benchmark?.score || 0}/100, Grade: ${subsystems.benchmark?.grade || "N/A"}]`);

    lines.push("\n==================================================");
    if (certified) {
        lines.push("FINAL VERDICT: Platform satisfies all engineering, quality, readiness, and benchmark requirements.");
        lines.push("Antigravity is CERTIFIED as a v1.0.0 Production Release Candidate.");
    } else {
        lines.push("FINAL VERDICT: Platform FAILED engineering certification. One or more subsystems failed or score < 70.");
    }
    lines.push("==================================================");

    return lines.join("\n");
}

/**
 * Builds and deeply freezes the final engineering certification report artifact.
 *
 * @param {Object} options Options object
 * @param {boolean} options.certified Certification status
 * @param {number} options.engineeringScore Overall score (0-100)
 * @param {string} options.grade Grade letter
 * @param {boolean} options.overallPassed Subsystems overall pass status
 * @param {Object} options.subsystems Subsystems map
 * @param {string} [options.version] Version string
 * @param {string} [options.generatedAt] Timestamp string
 * @returns {Object} Deeply frozen certification report artifact
 */
function buildCertificationReport(options) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const certified = Boolean(safeOptions.certified);
    const engineeringScore = typeof safeOptions.engineeringScore === "number" ? safeOptions.engineeringScore : 0;
    const grade = safeOptions.grade || "F";
    const overallPassed = Boolean(safeOptions.overallPassed);
    const subsystems = safeOptions.subsystems && typeof safeOptions.subsystems === "object" ? safeOptions.subsystems : {};
    const version = safeOptions.version || CERTIFICATION_VERSION;
    const generatedAt = safeOptions.generatedAt || new Date().toISOString();

    const summary = {
        certified,
        engineeringScore,
        grade,
        overallPassed,
        evaluatedSubsystemsCount: Object.keys(subsystems).length,
        timestamp: generatedAt
    };

    const text = renderCertificationText(certified, engineeringScore, grade, overallPassed, subsystems, generatedAt, version);

    const reportObj = {
        certified,
        version,
        engineeringScore,
        grade,
        overallPassed,
        subsystems,
        summary,
        generatedAt,
        text
    };

    return deepFreeze(reportObj);
}

module.exports = {
    buildCertificationReport,
    deepFreeze
};
