"use strict";

/**
 * Environment metadata validator module (Phase 13B).
 * Validates runtime environment metadata supplied as input.
 * Strictly pure: no process.env access, no filesystem I/O, no network.
 */

/**
 * Validates runtime environment metadata.
 *
 * @param {Object} environment Environment metadata input
 * @returns {Object} Validation result { valid: boolean, warnings: string[], errors: string[], details: Object }
 */
function validateEnvironment(environment) {
    const warnings = [];
    const errors = [];

    if (!environment || typeof environment !== "object" || Array.isArray(environment)) {
        errors.push("Environment metadata is missing or invalid object.");
        return Object.freeze({
            valid: false,
            warnings: Object.freeze(warnings),
            errors: Object.freeze(errors),
            details: Object.freeze({ runtime: null, nodeVersion: null, environmentType: null })
        });
    }

    // 1. Runtime check
    const runtime = environment.runtime || environment.name || null;
    if (!runtime || typeof runtime !== "string" || runtime.trim().length === 0) {
        errors.push("Runtime identifier is missing (e.g. 'node', 'nodejs').");
    }

    // 2. Node version check
    const nodeVersion = environment.nodeVersion || environment.version || null;
    if (!nodeVersion || typeof nodeVersion !== "string" || nodeVersion.trim().length === 0) {
        warnings.push("Node version metadata is missing or empty.");
    }

    // 3. Environment type check
    const environmentType = environment.environmentType || environment.envType || environment.env || null;
    if (!environmentType || typeof environmentType !== "string" || environmentType.trim().length === 0) {
        warnings.push("Environment type is not specified (e.g. 'production', 'staging').");
    }

    // 4. Execution metadata check
    const executionMetadata = environment.executionMetadata || environment.execution || null;
    if (!executionMetadata || typeof executionMetadata !== "object") {
        warnings.push("Execution metadata object is missing from environment definition.");
    }

    const valid = errors.length === 0;

    return Object.freeze({
        valid,
        warnings: Object.freeze(warnings),
        errors: Object.freeze(errors),
        details: Object.freeze({
            runtime: runtime ? String(runtime) : null,
            nodeVersion: nodeVersion ? String(nodeVersion) : null,
            environmentType: environmentType ? String(environmentType) : null,
            hasExecutionMetadata: Boolean(executionMetadata)
        })
    });
}

module.exports = {
    validateEnvironment
};
