"use strict";

/**
 * Build metadata validator module (Phase 13B).
 * Validates build output metadata supplied as input.
 * Strictly offline: no git operations, no disk/filesystem access.
 */

/**
 * Validates build metadata.
 *
 * @param {Object} build Build metadata input
 * @returns {Object} Validation result { valid: boolean, warnings: string[], errors: string[], details: Object }
 */
function validateBuild(build) {
    const warnings = [];
    const errors = [];

    if (!build || typeof build !== "object" || Array.isArray(build)) {
        errors.push("Build metadata is missing or invalid object.");
        return Object.freeze({
            valid: false,
            warnings: Object.freeze(warnings),
            errors: Object.freeze(errors),
            details: Object.freeze({ status: null, version: null, commitHash: null, timestamp: null })
        });
    }

    // 1. Build status check
    const status = build.status || (build.completed === true ? "SUCCESS" : (build.success === true ? "SUCCESS" : null));
    if (!status || (status !== "SUCCESS" && status !== "COMPLETED" && status !== "PASSED")) {
        errors.push(`Build status is invalid or unfulfilled (status: ${status || "missing"}).`);
    }

    // 2. Version check
    const version = build.version || build.appVersion || build.releaseVersion || null;
    if (!version || typeof version !== "string" || version.trim().length === 0) {
        warnings.push("Build version metadata is missing.");
    }

    // 3. Commit hash check
    const commitHash = build.commitHash || build.commit || build.gitCommit || build.revision || null;
    if (!commitHash || typeof commitHash !== "string" || commitHash.trim().length === 0) {
        warnings.push("Git commit hash metadata is missing from build info.");
    }

    // 4. Build timestamp check
    const timestamp = build.timestamp || build.builtAt || build.createdAt || null;
    if (!timestamp || (typeof timestamp !== "string" && typeof timestamp !== "number")) {
        warnings.push("Build timestamp metadata is missing.");
    }

    const valid = errors.length === 0;

    return Object.freeze({
        valid,
        warnings: Object.freeze(warnings),
        errors: Object.freeze(errors),
        details: Object.freeze({
            status: status ? String(status) : null,
            version: version ? String(version) : null,
            commitHash: commitHash ? String(commitHash) : null,
            timestamp: timestamp ? String(timestamp) : null
        })
    });
}

module.exports = {
    validateBuild
};
