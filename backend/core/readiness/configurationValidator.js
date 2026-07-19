"use strict";

/**
 * Configuration metadata validator module (Phase 13B).
 * Validates system configuration declarations metadata.
 * Strictly offline: no .env file reading, no secrets inspection, no side effects.
 */

/**
 * Validates system configuration metadata.
 *
 * @param {Object} configuration Configuration metadata input
 * @returns {Object} Validation result { valid: boolean, warnings: string[], errors: string[], details: Object }
 */
function validateConfiguration(configuration) {
    const warnings = [];
    const errors = [];

    if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
        errors.push("Configuration metadata is missing or invalid object.");
        return Object.freeze({
            valid: false,
            warnings: Object.freeze(warnings),
            errors: Object.freeze(errors),
            details: Object.freeze({ jwtDeclared: false, databaseDeclared: false, portDeclared: false })
        });
    }

    // 1. JWT configuration check
    const jwtConfigured = Boolean(
        configuration.jwt ||
        configuration.jwtConfigured ||
        configuration.auth ||
        configuration.jwtSecretDeclared
    );
    if (!jwtConfigured) {
        warnings.push("JWT configuration declaration is missing.");
    }

    // 2. Database configuration check
    const databaseConfigured = Boolean(
        configuration.database ||
        configuration.dbConfigured ||
        configuration.mongo ||
        configuration.dbUriDeclared
    );
    if (!databaseConfigured) {
        warnings.push("Database configuration declaration is missing.");
    }

    // 3. Port configuration check
    const portConfigured = Boolean(
        configuration.port !== undefined && configuration.port !== null ||
        configuration.portConfigured ||
        configuration.serverPort
    );
    if (!portConfigured) {
        errors.push("Server port configuration is not declared.");
    }

    // 4. Schema completeness check
    const schemaComplete = Boolean(
        configuration.schemaComplete !== false &&
        (configuration.schemaVersion || configuration.version || jwtConfigured || databaseConfigured)
    );
    if (!schemaComplete) {
        warnings.push("Configuration schema is incomplete or unverified.");
    }

    const valid = errors.length === 0;

    return Object.freeze({
        valid,
        warnings: Object.freeze(warnings),
        errors: Object.freeze(errors),
        details: Object.freeze({
            jwtDeclared: jwtConfigured,
            databaseDeclared: databaseConfigured,
            portDeclared: portConfigured,
            schemaComplete
        })
    });
}

module.exports = {
    validateConfiguration
};
