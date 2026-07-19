"use strict";

const { benchmarkSuiteErrorCodes } = require("./benchmarkSuiteErrors");

function createError(message, code) {
    const err = new Error(message);
    err.code = code;
    return err;
}

const VALID_CATEGORIES = Object.freeze(["REFERENCE", "USER", "CUSTOM"]);

/**
 * Normalizes and validates a benchmark scenario definition.
 * Pure function only.
 *
 * @param {Object} scenario Input scenario object
 * @returns {Object} Deeply frozen normalized benchmark scenario object
 */
function normalizeBenchmarkScenario(scenario) {
    if (!scenario || typeof scenario !== "object" || Array.isArray(scenario)) {
        throw createError(
            "Benchmark scenario must be a non-null object.",
            benchmarkSuiteErrorCodes.INVALID_SCENARIO
        );
    }

    const id = scenario.id || scenario.name || null;
    if (!id || typeof id !== "string" || id.trim().length === 0) {
        throw createError(
            "Benchmark scenario requires a valid 'id' or 'name' string.",
            benchmarkSuiteErrorCodes.INVALID_SCENARIO
        );
    }

    const name = scenario.name || id;

    // Validate category (REFERENCE, USER, CUSTOM)
    let category = (scenario.category || "USER").toUpperCase();
    if (!VALID_CATEGORIES.includes(category)) {
        category = "USER";
    }

    // Normalize complexity metadata (informational only)
    const rawComplexity = scenario.complexity && typeof scenario.complexity === "object" ? scenario.complexity : {};
    const complexity = Object.freeze({
        level: String(rawComplexity.level || "MEDIUM").toUpperCase(),
        estimatedModules: typeof rawComplexity.estimatedModules === "number" ? rawComplexity.estimatedModules : 1,
        estimatedRequirements: typeof rawComplexity.estimatedRequirements === "number" ? rawComplexity.estimatedRequirements : 1,
        estimatedWorkers: typeof rawComplexity.estimatedWorkers === "number" ? rawComplexity.estimatedWorkers : 1,
        estimatedArtifacts: typeof rawComplexity.estimatedArtifacts === "number" ? rawComplexity.estimatedArtifacts : 1
    });

    const input = scenario.input && typeof scenario.input === "object" ? scenario.input : {};

    const normalized = {
        id: String(id).trim(),
        name: String(name).trim(),
        category,
        complexity,
        input
    };

    return Object.freeze(normalized);
}

module.exports = {
    normalizeBenchmarkScenario,
    VALID_CATEGORIES
};
