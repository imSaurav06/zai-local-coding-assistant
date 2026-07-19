"use strict";

const AUDIT_REPORT_VERSION = "1.0";

/**
 * Deep freezes an object recursively to guarantee absolute immutability.
 */
function deepFreeze(obj) {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }
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
 * Renders a human-readable text report of the audit findings.
 */
function renderReportText(summary, evidenceMap) {
    const lines = [];
    lines.push("==================================================");
    lines.push(`Requirement Compliance Audit Report v${AUDIT_REPORT_VERSION}`);
    lines.push(`Timestamp: ${new Date().toISOString()}`);
    lines.push(`Overall Status: ${summary.passed ? "PASSED" : "FAILED"}`);
    lines.push(`Total Coverage: ${summary.coverage}%`);
    lines.push("==================================================");
    
    lines.push("\n1. Statistics:");
    lines.push(`  - Total Requirements: ${summary.statistics.totalRequirements}`);
    lines.push(`  - Satisfied: ${summary.statistics.satisfiedRequirements}`);
    lines.push(`  - Failed: ${summary.statistics.failedRequirements}`);
    
    lines.push("\n2. Breakdown by Kind:");
    for (const kind of Object.keys(summary.statistics.byKind)) {
        const s = summary.statistics.byKind[kind];
        lines.push(`  - ${kind}: ${s.satisfied}/${s.total} (${s.percentage}%)`);
    }

    lines.push("\n3. Detailed Checklist:");
    for (const id of Object.keys(evidenceMap)) {
        const ev = evidenceMap[id];
        lines.push(`  [${ev.satisfied ? "X" : " "}] ${ev.displayId} (${ev.kind}): ${ev.semanticKey}`);
        if (ev.files.length > 0) {
            lines.push(`      Files: ${ev.files.map(f => f.path).join(", ")}`);
        }
        if (ev.verificationIssues.length > 0) {
            lines.push(`      Issues: ${ev.verificationIssues.map(i => i.message).join("; ")}`);
        }
    }

    if (summary.missingRequirements.length > 0) {
        lines.push("\n4. Missing/Unsatisfied Requirements:");
        for (const req of summary.missingRequirements) {
            lines.push(`  - ${req.displayId} (${req.kind}): ${req.semanticKey} [Source: ${req.sourcePath}]`);
        }
    }

    if (summary.orphanArtifacts.length > 0) {
        lines.push("\n5. Orphan Artifacts (Unmapped Files):");
        for (const file of summary.orphanArtifacts) {
            lines.push(`  - ${file.path} (${file.size} bytes)`);
        }
    }

    lines.push("\n==================================================");
    return lines.join("\n");
}

/**
 * Builds the immutable structured audit report.
 */
function buildAuditReport(summary, evidenceMap) {
    const reportText = renderReportText(summary, evidenceMap);

    const report = {
        reportVersion: AUDIT_REPORT_VERSION,
        createdAt: new Date().toISOString(),
        passed: summary.passed,
        coverage: summary.coverage,
        statistics: summary.statistics,
        missingRequirementsCount: summary.missingRequirements.length,
        orphanArtifactsCount: summary.orphanArtifacts.length,
        text: reportText
    };

    return deepFreeze(report);
}

module.exports = {
    buildAuditReport,
    deepFreeze
};
