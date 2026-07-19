"use strict";

const SECURITY_AUDIT_REPORT_VERSION = "1.0";

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
 * Renders a human-readable text report of the security findings.
 */
function renderReportText(passed, score, vulnerabilities, secrets, warnings) {
    const lines = [];
    lines.push("==================================================");
    lines.push(`Security Audit Report v${SECURITY_AUDIT_REPORT_VERSION}`);
    lines.push(`Timestamp: ${new Date().toISOString()}`);
    lines.push(`Overall Status: ${passed ? "PASSED" : "FAILED"}`);
    lines.push(`Security Score: ${score}/100`);
    lines.push("==================================================");
    
    lines.push(`\n1. Summary:`);
    lines.push(`  - Dependency Vulnerabilities: ${vulnerabilities.length}`);
    lines.push(`  - Credentials / Secrets Found: ${secrets.length}`);
    lines.push(`  - Audit Warnings: ${warnings.length}`);

    if (secrets.length > 0) {
        lines.push(`\n2. Secrets / Credentials Findings:`);
        for (const sec of secrets) {
            lines.push(`  - [${sec.severity}] Found '${sec.type}' in ${sec.file}:${sec.line}`);
            lines.push(`      Value Preview: ${sec.preview}`);
        }
    }

    if (vulnerabilities.length > 0) {
        lines.push(`\n3. Dependency Vulnerability Findings:`);
        for (const vuln of vulnerabilities) {
            lines.push(`  - [${vuln.severity}] Package: ${vuln.package} (${vuln.type})`);
            lines.push(`      Installed: ${vuln.version} | Safe Version: >= ${vuln.safeVersion}`);
            lines.push(`      Detail: ${vuln.vulnerability}`);
        }
    }

    if (warnings.length > 0) {
        lines.push(`\n4. Configuration Warnings:`);
        for (const warn of warnings) {
            lines.push(`  - ${warn}`);
        }
    }

    lines.push("\n==================================================");
    return lines.join("\n");
}

/**
 * Assembles and freezes the structured report.
 */
function buildSecurityAuditReport(vulnerabilities, secrets, warnings) {
    // Score calculation
    let score = 100;
    
    for (const sec of secrets) {
        if (sec.severity === "CRITICAL") score -= 25;
        else if (sec.severity === "HIGH") score -= 15;
        else score -= 10;
    }

    for (const vuln of vulnerabilities) {
        if (vuln.severity === "CRITICAL") score -= 20;
        else if (vuln.severity === "HIGH") score -= 12;
        else score -= 8;
    }

    if (score < 0) score = 0;

    // Passed status: true if score >= 80, meaning no critical issues are outstanding
    const passed = score >= 80 && !secrets.some(s => s.severity === "CRITICAL") && !vulnerabilities.some(v => v.severity === "CRITICAL");

    const text = renderReportText(passed, score, vulnerabilities, secrets, warnings);

    const reportObj = {
        reportVersion: SECURITY_AUDIT_REPORT_VERSION,
        createdAt: new Date().toISOString(),
        passed,
        score,
        vulnerabilities,
        secrets,
        warnings,
        text
    };

    return deepFreeze(reportObj);
}

module.exports = {
    buildSecurityAuditReport,
    deepFreeze
};
