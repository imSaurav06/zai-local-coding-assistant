"use strict";

/**
 * Provider metadata validator module (Phase 13B).
 * Validates AI provider configuration metadata.
 * Strictly offline: no provider calls, no API key validation, no network.
 */

/**
 * Validates AI provider metadata.
 *
 * @param {Object} providers Provider metadata input
 * @returns {Object} Validation result { valid: boolean, warnings: string[], errors: string[], details: Object }
 */
function validateProviders(providers) {
    const warnings = [];
    const errors = [];

    if (!providers || typeof providers !== "object" || Array.isArray(providers)) {
        errors.push("Provider metadata is missing or invalid object.");
        return Object.freeze({
            valid: false,
            warnings: Object.freeze(warnings),
            errors: Object.freeze(errors),
            details: Object.freeze({ primaryProvider: null, model: null, fallbackProvider: null })
        });
    }

    // 1. Primary provider check
    const primaryProvider = providers.primaryProvider || providers.primary || providers.name || null;
    if (!primaryProvider || (typeof primaryProvider !== "string" && typeof primaryProvider !== "object")) {
        errors.push("Primary provider is not defined.");
    }

    const isPrimaryObj = primaryProvider !== null && typeof primaryProvider === "object";
    const primaryName = isPrimaryObj ? (primaryProvider.name || primaryProvider.id || null) : primaryProvider;
    if (!primaryName || typeof primaryName !== "string" || primaryName.trim().length === 0) {
        errors.push("Primary provider identifier is missing or empty.");
    }

    // 2. Provider model check
    const model = providers.model || providers.primaryModel || (isPrimaryObj ? primaryProvider.model : null) || null;
    if (!model || typeof model !== "string" || model.trim().length === 0) {
        errors.push("Provider model is missing or empty.");
    }

    // 3. Fallback provider check (if configured)
    const fallbackProvider = providers.fallbackProvider || providers.fallback || null;
    let fallbackValid = true;
    if (fallbackProvider) {
        const isFallbackObj = fallbackProvider !== null && typeof fallbackProvider === "object";
        const fallbackName = isFallbackObj ? (fallbackProvider.name || fallbackProvider.id || null) : fallbackProvider;
        if (!fallbackName || typeof fallbackName !== "string" || fallbackName.trim().length === 0) {
            warnings.push("Fallback provider is configured but missing provider identifier.");
            fallbackValid = false;
        }
    } else {
        warnings.push("No fallback provider metadata configured.");
    }


    const valid = errors.length === 0;

    return Object.freeze({
        valid,
        warnings: Object.freeze(warnings),
        errors: Object.freeze(errors),
        details: Object.freeze({
            primaryProvider: primaryName ? String(primaryName) : null,
            model: model ? String(model) : null,
            fallbackProvider: fallbackProvider ? (typeof fallbackProvider === "object" ? fallbackProvider.name || fallbackProvider.id : String(fallbackProvider)) : null,
            fallbackValid
        })
    });
}

module.exports = {
    validateProviders
};
