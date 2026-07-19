"use strict";

const { readinessErrorCodes } = require("./readinessErrors");
const { validateEnvironment } = require("./environmentValidator");
const { validateProviders } = require("./providerValidator");
const { validateConfiguration } = require("./configurationValidator");
const { validateBuild } = require("./buildValidator");
const { calculateReadinessScore } = require("./readinessScore");
const { buildReadinessReport, deepFreeze } = require("./readinessReport");

function createError(message, code) {
    const err = new Error(message);
    err.code = code;
    return err;
}

/**
 * Public API to validate production readiness.
 *
 * @param {Object} input Input metadata bundle
 * @param {Object} [input.environment] Runtime environment metadata
 * @param {Object} [input.providers] AI provider configuration metadata
 * @param {Object} [input.configuration] System configuration metadata
 * @param {Object} [input.build] Build metadata
 * @returns {Object} Deeply frozen readiness validation result ({ ready, score, warnings, checks, report })
 */
function validateProductionReadiness(input) {
    // 1. Guard check input
    if (input === null || input === undefined || typeof input !== "object" || Array.isArray(input)) {
        throw createError(
            "Production readiness input must be a non-null object.",
            readinessErrorCodes.INVALID_INPUT
        );
    }

    const { environment, providers, configuration, build } = input;

    // 2. Coordinate category validations
    let envResult;
    try {
        envResult = validateEnvironment(environment);
    } catch (err) {
        throw createError(
            `Environment validation failed: ${err.message}`,
            readinessErrorCodes.INVALID_ENVIRONMENT
        );
    }

    let provResult;
    try {
        provResult = validateProviders(providers);
    } catch (err) {
        throw createError(
            `Provider validation failed: ${err.message}`,
            readinessErrorCodes.INVALID_PROVIDER
        );
    }

    let configResult;
    try {
        configResult = validateConfiguration(configuration);
    } catch (err) {
        throw createError(
            `Configuration validation failed: ${err.message}`,
            readinessErrorCodes.INVALID_CONFIGURATION
        );
    }

    let buildResult;
    try {
        buildResult = validateBuild(build);
    } catch (err) {
        throw createError(
            `Build validation failed: ${err.message}`,
            readinessErrorCodes.INVALID_BUILD
        );
    }

    // 3. Aggregate checks and warnings
    const checks = {
        environment: envResult.valid,
        providers: provResult.valid,
        configuration: configResult.valid,
        build: buildResult.valid
    };

    const warnings = [
        ...envResult.warnings,
        ...provResult.warnings,
        ...configResult.warnings,
        ...buildResult.warnings
    ];

    const categoryResults = {
        environment: envResult,
        providers: provResult,
        configuration: configResult,
        build: buildResult
    };

    // 4. Invoke score calculation
    let score;
    try {
        score = calculateReadinessScore(categoryResults);
    } catch (err) {
        throw createError(
            `Readiness score calculation failed: ${err.message}`,
            readinessErrorCodes.INVALID_SCORE
        );
    }

    // 5. Readiness determination (All mandatory categories valid AND score >= 70)
    const allCategoriesValid = checks.environment && checks.providers && checks.configuration && checks.build;
    const ready = allCategoriesValid && score >= 70;

    // 6. Invoke report builder
    let report;
    try {
        report = buildReadinessReport({ ready, score, warnings, checks });
    } catch (err) {
        throw createError(
            `Readiness report generation failed: ${err.message}`,
            readinessErrorCodes.REPORT_BUILD_FAILED
        );
    }

    // 7. Assemble and freeze output contract
    const result = {
        ready,
        score,
        warnings,
        checks,
        report
    };

    return deepFreeze(result);
}

module.exports = {
    validateProductionReadiness
};
