"use strict";

/**
 * Checks that all required generated files are present.
 */
function checkArtifactCompleteness(generatedFiles) {
    const blockers = [];
    const warnings = [];

    if (!Array.isArray(generatedFiles) || generatedFiles.length === 0) {
        blockers.push("BLOCKER: No generated files were provided. Deployment artifact is empty.");
        return { passed: false, blockers, warnings };
    }

    // Look for at least one entry point file
    const entryPoints = ["index.js", "main.jsx", "main.js", "app.js", "server.js", "main.py", "app.py"];
    const filePaths = generatedFiles.map(f => (f.name || f.path || "").toLowerCase().split("/").pop());
    const hasEntryPoint = entryPoints.some(entry => filePaths.includes(entry));

    if (!hasEntryPoint) {
        blockers.push("BLOCKER: No application entry point file detected (e.g. main.jsx, server.js, index.js).");
    }

    // Check for empty or stub files
    let emptyCount = 0;
    for (const file of generatedFiles) {
        const content = file.content || "";
        if (content.trim().length < 10) {
            emptyCount++;
        }
    }

    if (emptyCount > 0) {
        warnings.push(`WARNING: ${emptyCount} generated file(s) appear to have empty or stub content.`);
    }

    return {
        passed: blockers.length === 0,
        blockers,
        warnings
    };
}

/**
 * Checks that the prior audit stages passed successfully.
 */
function checkPriorAuditResults(verificationReport, securityReport, integrationReport, requirementReport) {
    const blockers = [];
    const warnings = [];

    // Verification report check
    if (verificationReport) {
        if (verificationReport.success === false) {
            const errorCount = (verificationReport.errors || []).length;
            blockers.push(`BLOCKER: Verification stage reported failure (${errorCount} error(s)). Deployment cannot proceed.`);
        }
    } else {
        warnings.push("WARNING: No verification report was provided. Skipping verification gate check.");
    }

    // Security report check
    if (securityReport) {
        if (securityReport.passed === false) {
            if (securityReport.secrets && securityReport.secrets.some(s => s.severity === "CRITICAL")) {
                blockers.push("BLOCKER: Security audit detected CRITICAL credential exposure. Deployment cannot proceed.");
            } else {
                warnings.push(`WARNING: Security audit reported score ${securityReport.score}/100. Review before deploying.`);
            }
        }
    } else {
        warnings.push("WARNING: No security audit report was provided. Skipping security gate check.");
    }

    // Integration report check
    if (integrationReport) {
        if (integrationReport.passed === false) {
            blockers.push("BLOCKER: Integration audit failed. Pipeline or contract validation did not pass.");
        }
    } else {
        warnings.push("WARNING: No integration audit report was provided. Skipping integration gate check.");
    }

    // Requirement compliance report check
    if (requirementReport) {
        if (requirementReport.passed === false) {
            const missing = requirementReport.missingRequirements || [];
            if (missing.length > 0) {
                blockers.push(`BLOCKER: Requirement compliance audit failed. ${missing.length} requirement(s) are unaddressed.`);
            }
        }
    } else {
        warnings.push("WARNING: No requirement compliance report was provided. Skipping requirement gate check.");
    }

    return {
        passed: blockers.length === 0,
        blockers,
        warnings
    };
}

/**
 * Checks structural readiness of the project spec for deployment.
 */
function checkSpecDeploymentReadiness(projectSpec) {
    const blockers = [];
    const warnings = [];

    if (!projectSpec || typeof projectSpec !== "object") {
        blockers.push("BLOCKER: Invalid or missing project specification for deployment.");
        return { passed: false, blockers, warnings };
    }

    if (!projectSpec.projectName || typeof projectSpec.projectName !== "string") {
        blockers.push("BLOCKER: Project name is missing or invalid in project spec.");
    }

    if (!projectSpec.projectType || typeof projectSpec.projectType !== "string") {
        warnings.push("WARNING: Project type is not specified in project spec.");
    }

    if (!projectSpec.deploymentRequirements || projectSpec.deploymentRequirements === "None") {
        warnings.push("WARNING: No deployment target specified (e.g., Vercel, Render, AWS). Review deployment configuration.");
    }

    return {
        passed: blockers.length === 0,
        blockers,
        warnings
    };
}

module.exports = {
    checkArtifactCompleteness,
    checkPriorAuditResults,
    checkSpecDeploymentReadiness
};
