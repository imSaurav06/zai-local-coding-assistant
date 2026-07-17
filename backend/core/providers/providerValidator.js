"use strict";

const { providerErrorCodes } = require("./providerErrors");

const CANONICAL_FIELDS = new Set([
    "id",
    "name",
    "type",
    "version",
    "capabilities",
    "limits",
    "pricing",
    "metadata",
    "status"
]);

const ALLOWED_STATUSES = new Set([
    "ACTIVE",
    "INACTIVE",
    "DEPRECATED",
    "EXPERIMENTAL"
]);

/**
 * Validates a provider configuration object or instantiated provider.
 *
 * @param {Object} provider The provider object to validate
 * @returns {Object} Validation outcome
 */
function validateProvider(provider) {
    if (provider === null || provider === undefined || typeof provider !== "object" || Array.isArray(provider)) {
        return {
            success: false,
            errors: [{
                code: providerErrorCodes.PROVIDER_INVALID_INPUT,
                path: "",
                message: "Provider must be a non-null object."
            }]
        };
    }

    const errors = [];

    // 1. Check for unknown properties
    for (const key of Object.keys(provider)) {
        if (!CANONICAL_FIELDS.has(key)) {
            errors.push({
                code: providerErrorCodes.PROVIDER_UNKNOWN_PROPERTY,
                path: key,
                message: `Unknown property key: '${key}'`
            });
        }
    }

    // 2. Validate id
    if (!provider.hasOwnProperty("id") || typeof provider.id !== "string" || provider.id.trim() === "") {
        errors.push({
            code: providerErrorCodes.PROVIDER_INVALID_STRUCTURE,
            path: "id",
            message: "Property 'id' is required and must be a non-empty string."
        });
    }

    // 3. Validate name
    if (!provider.hasOwnProperty("name") || typeof provider.name !== "string" || provider.name.trim() === "") {
        errors.push({
            code: providerErrorCodes.PROVIDER_INVALID_STRUCTURE,
            path: "name",
            message: "Property 'name' is required and must be a non-empty string."
        });
    }

    // 4. Validate type
    if (!provider.hasOwnProperty("type") || typeof provider.type !== "string" || provider.type.trim() === "") {
        errors.push({
            code: providerErrorCodes.PROVIDER_INVALID_STRUCTURE,
            path: "type",
            message: "Property 'type' is required and must be a non-empty string."
        });
    }

    // 5. Validate version
    if (!provider.hasOwnProperty("version") || typeof provider.version !== "string" || provider.version.trim() === "") {
        errors.push({
            code: providerErrorCodes.PROVIDER_INVALID_STRUCTURE,
            path: "version",
            message: "Property 'version' is required and must be a non-empty string."
        });
    }

    // 6. Validate status
    if (!provider.hasOwnProperty("status") || !ALLOWED_STATUSES.has(provider.status)) {
        errors.push({
            code: providerErrorCodes.PROVIDER_INVALID_STRUCTURE,
            path: "status",
            message: `Property 'status' is required and must be one of: ${Array.from(ALLOWED_STATUSES).join(", ")}.`
        });
    }

    // 7. Validate capabilities
    if (!provider.hasOwnProperty("capabilities") || !Array.isArray(provider.capabilities)) {
        errors.push({
            code: providerErrorCodes.PROVIDER_INVALID_STRUCTURE,
            path: "capabilities",
            message: "Property 'capabilities' is required and must be an array."
        });
    } else {
        const seen = new Set();
        for (let i = 0; i < provider.capabilities.length; i++) {
            const cap = provider.capabilities[i];
            if (typeof cap !== "string" || cap.trim() === "") {
                errors.push({
                    code: providerErrorCodes.PROVIDER_INVALID_STRUCTURE,
                    path: `capabilities[${i}]`,
                    message: "Capability items must be non-empty strings."
                });
            } else if (seen.has(cap)) {
                errors.push({
                    code: providerErrorCodes.PROVIDER_DUPLICATE_CAPABILITY,
                    path: `capabilities[${i}]`,
                    message: `Duplicate capability found: '${cap}'`
                });
            } else {
                seen.add(cap);
            }
        }
    }

    // 8. Validate limits
    if (!provider.hasOwnProperty("limits") || provider.limits === null || typeof provider.limits !== "object" || Array.isArray(provider.limits)) {
        errors.push({
            code: providerErrorCodes.PROVIDER_INVALID_STRUCTURE,
            path: "limits",
            message: "Property 'limits' is required and must be an object."
        });
    } else {
        const limitKeys = Object.keys(provider.limits);
        for (const k of limitKeys) {
            const val = provider.limits[k];
            if (typeof val !== "number" || val < 0 || isNaN(val)) {
                errors.push({
                    code: providerErrorCodes.PROVIDER_INVALID_STRUCTURE,
                    path: `limits.${k}`,
                    message: `Limit value for '${k}' must be a non-negative number.`
                });
            }
        }
    }

    // 9. Validate pricing (optional)
    if (provider.hasOwnProperty("pricing") && provider.pricing !== null && (typeof provider.pricing !== "object" || Array.isArray(provider.pricing))) {
        errors.push({
            code: providerErrorCodes.PROVIDER_INVALID_STRUCTURE,
            path: "pricing",
            message: "Property 'pricing' must be an object or null."
        });
    }

    // 10. Validate metadata (optional)
    if (provider.hasOwnProperty("metadata") && provider.metadata !== null && (typeof provider.metadata !== "object" || Array.isArray(provider.metadata))) {
        errors.push({
            code: providerErrorCodes.PROVIDER_INVALID_STRUCTURE,
            path: "metadata",
            message: "Property 'metadata' must be an object or null."
        });
    }

    return {
        success: errors.length === 0,
        errors
    };
}

module.exports = {
    validateProvider
};
