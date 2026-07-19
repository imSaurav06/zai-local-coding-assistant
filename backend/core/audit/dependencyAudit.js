"use strict";

const KNOWN_VULNERABILITIES = {
    npm: [
        {
            package: "lodash",
            safeVersion: "4.17.21",
            vulnerability: "Prototype Pollution in defaultsDeep and merge",
            severity: "HIGH"
        },
        {
            package: "axios",
            safeVersion: "1.6.0",
            vulnerability: "Server-Side Request Forgery (SSRF)",
            severity: "HIGH"
        },
        {
            package: "minimist",
            safeVersion: "1.2.6",
            vulnerability: "Prototype Pollution in setAssociated",
            severity: "MEDIUM"
        },
        {
            package: "express",
            safeVersion: "4.19.2",
            vulnerability: "Open Redirect and Denials of Service",
            severity: "HIGH"
        },
        {
            package: "jsonwebtoken",
            safeVersion: "9.0.0",
            vulnerability: "Signature Verification Bypass via Key Confusion",
            severity: "CRITICAL"
        }
    ],
    pypi: [
        {
            package: "requests",
            safeVersion: "2.31.0",
            vulnerability: "Leakage of credentials in cross-domain redirects",
            severity: "MEDIUM"
        },
        {
            package: "django",
            safeVersion: "4.2.11",
            vulnerability: "Directory Traversal in file uploads",
            severity: "HIGH"
        },
        {
            package: "flask",
            safeVersion: "2.3.3",
            vulnerability: "Denials of Service via header injection",
            severity: "MEDIUM"
        }
    ]
};

function parseVersion(vStr) {
    const clean = vStr.replace(/[^0-9.]/g, "");
    const parts = clean.split(".").map(x => parseInt(x, 10) || 0);
    while (parts.length < 3) parts.push(0);
    return parts;
}

/**
 * Returns -1 if v1 < v2, 1 if v1 > v2, 0 if v1 === v2
 */
function compareVersions(v1, v2) {
    const parts1 = parseVersion(v1);
    const parts2 = parseVersion(v2);
    for (let i = 0; i < 3; i++) {
        if (parts1[i] < parts2[i]) return -1;
        if (parts1[i] > parts2[i]) return 1;
    }
    return 0;
}

function scanNpmDependencies(depsMap, findings) {
    if (!depsMap || typeof depsMap !== "object") return;

    for (const pkg of Object.keys(depsMap)) {
        const versionVal = depsMap[pkg];
        const knownVuln = KNOWN_VULNERABILITIES.npm.find(v => v.package === pkg);
        if (knownVuln) {
            // If current version is less than the safe version, it's vulnerable
            if (compareVersions(versionVal, knownVuln.safeVersion) < 0) {
                findings.push({
                    package: pkg,
                    type: "npm",
                    version: versionVal,
                    safeVersion: knownVuln.safeVersion,
                    vulnerability: knownVuln.vulnerability,
                    severity: knownVuln.severity
                });
            }
        }
    }
}

function parseRequirementsText(reqText, findings) {
    if (typeof reqText !== "string") return;

    const lines = reqText.split("\n");
    for (const line of lines) {
        const cleanLine = line.trim();
        if (cleanLine === "" || cleanLine.startsWith("#")) continue;

        // Matches package==version or package>=version
        const match = cleanLine.match(/^([a-zA-Z0-9_-]+)\s*(?:==|>=|<=|>|<|~=)\s*([0-9.]+)/);
        if (match) {
            const pkg = match[1].toLowerCase();
            const versionVal = match[2];

            const knownVuln = KNOWN_VULNERABILITIES.pypi.find(v => v.package === pkg);
            if (knownVuln) {
                if (compareVersions(versionVal, knownVuln.safeVersion) < 0) {
                    findings.push({
                        package: pkg,
                        type: "pypi",
                        version: versionVal,
                        safeVersion: knownVuln.safeVersion,
                        vulnerability: knownVuln.vulnerability,
                        severity: knownVuln.severity
                    });
                }
            }
        }
    }
}

/**
 * Scans dependencies in package.json or requirements.txt for known vulnerabilities.
 */
function auditDependencies(packageManifest) {
    const findings = [];
    if (!packageManifest) return findings;

    // 1. If packageManifest is an object (already parsed package.json)
    if (typeof packageManifest === "object" && !Array.isArray(packageManifest)) {
        scanNpmDependencies(packageManifest.dependencies, findings);
        scanNpmDependencies(packageManifest.devDependencies, findings);
    } 
    // 2. If packageManifest is a string (could be package.json text or requirements.txt text)
    else if (typeof packageManifest === "string") {
        try {
            const parsed = JSON.parse(packageManifest);
            scanNpmDependencies(parsed.dependencies, findings);
            scanNpmDependencies(parsed.devDependencies, findings);
        } catch (e) {
            // Fallback to requirements.txt scanning
            parseRequirementsText(packageManifest, findings);
        }
    }

    return findings;
}

module.exports = {
    auditDependencies,
    compareVersions
};
