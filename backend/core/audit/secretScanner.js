"use strict";

const SECRET_PATTERNS = [
    {
        name: "Google API Key",
        regex: /AIza[0-9A-Za-z-_]{35}/g,
        severity: "CRITICAL"
    },
    {
        name: "AWS Access Key ID",
        regex: /AKIA[0-9A-Z]{16}/g,
        severity: "CRITICAL"
    },
    {
        name: "Slack Webhook URL",
        regex: /https:\/\/hooks\.slack\.com\/services\/T[A-Za-z0-9_]{8}\/B[A-Za-z0-9_]{8}\/[A-Za-z0-9_]{24}/g,
        severity: "CRITICAL"
    },
    {
        name: "Generic Secret Assignment",
        // Match variables containing secret/key/token/password assigned to a string literal longer than 4 chars.
        regex: /(?:const|let|var|process\.env|)\.?([a-zA-Z0-9_-]*(?:secret|password|token|private_key|api_key|auth_key)[a-zA-Z0-9_-]*)\s*=\s*(["'`])([^"'`]{8,})\2/gi,
        severity: "HIGH"
    }
];

function scanFileSecrets(filePath, content) {
    const findings = [];
    if (typeof content !== "string") return findings;

    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        const lineContent = lines[i];

        for (const pattern of SECRET_PATTERNS) {
            pattern.regex.lastIndex = 0; // Reset index for global regexes
            let match;

            while ((match = pattern.regex.exec(lineContent)) !== null) {
                // If it is a generic assignment, capture group 3 is the actual secret
                const rawSecret = pattern.name === "Generic Secret Assignment" ? match[3] : match[0];
                
                if (pattern.name === "Generic Secret Assignment") {
                    // Avoid false positives for generic patterns if they contain common placeholders
                    const secretLower = rawSecret.toLowerCase();
                    const isPlaceholder = secretLower.includes("placeholder") || 
                                         secretLower.includes("your_") || 
                                         secretLower.includes("enter_") || 
                                         secretLower.includes("dummy") ||
                                         secretLower.includes("example") ||
                                         secretLower.includes("test_value");

                    if (isPlaceholder) continue;
                }

                const preview = rawSecret.substring(0, 4) + "... [REDACTED]";
                findings.push({
                    file: filePath,
                    line: i + 1,
                    type: pattern.name,
                    severity: pattern.severity,
                    preview
                });
            }
        }
    }

    return findings;
}

/**
 * Scans generated code files and env files for credentials and API keys.
 */
function scanSecrets(projectFiles, environmentFiles) {
    const findings = [];

    if (Array.isArray(projectFiles)) {
        for (const file of projectFiles) {
            const path = file.name || file.path || "";
            const content = file.content || "";
            findings.push(...scanFileSecrets(path, content));
        }
    }

    if (Array.isArray(environmentFiles)) {
        for (const envFile of environmentFiles) {
            const path = envFile.name || envFile.path || ".env";
            const content = envFile.content || "";
            findings.push(...scanFileSecrets(path, content));
        }
    }

    return findings;
}

module.exports = {
    scanSecrets
};
