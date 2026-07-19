"use strict";

const REQUIRED_PIPELINE_STAGES = ["PLAN", "GENERATE", "VERIFY"];

/**
 * Validates the execution metadata and pipeline stage sequences.
 */
function validatePipeline(executionMetadata) {
    const errors = [];
    const warnings = [];

    if (!executionMetadata || typeof executionMetadata !== "object") {
        errors.push("Missing or invalid execution metadata.");
        return { success: false, errors, warnings };
    }

    const { stages, startTime, endTime, steps } = executionMetadata;

    // 1. Verify timestamps
    if (startTime && endTime) {
        const start = new Date(startTime).getTime();
        const end = new Date(endTime).getTime();
        if (isNaN(start) || isNaN(end)) {
            errors.push("Invalid timestamp format in execution metadata.");
        } else if (end < start) {
            errors.push("Execution end time cannot be before start time.");
        }
    } else {
        warnings.push("Execution timestamps are missing in metadata.");
    }

    // 2. Validate stages sequence
    if (Array.isArray(stages)) {
        // Check presence of required stages
        for (const stage of REQUIRED_PIPELINE_STAGES) {
            if (!stages.includes(stage)) {
                errors.push(`Required pipeline stage '${stage}' is missing from stages log.`);
            }
        }

        // Check logical sequence: PLAN -> GENERATE -> VERIFY
        const planIndex = stages.indexOf("PLAN");
        const generateIndex = stages.indexOf("GENERATE");
        const verifyIndex = stages.indexOf("VERIFY");

        if (planIndex !== -1 && generateIndex !== -1 && planIndex > generateIndex) {
            errors.push("Invalid pipeline sequence: 'PLAN' stage must execute before 'GENERATE' stage.");
        }
        if (generateIndex !== -1 && verifyIndex !== -1 && generateIndex > verifyIndex) {
            errors.push("Invalid pipeline sequence: 'GENERATE' stage must execute before 'VERIFY' stage.");
        }
    } else {
        errors.push("Execution stages list is missing or not an array.");
    }

    // 3. Verify step completion statuses
    if (Array.isArray(steps)) {
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const name = step.name || `step[${i}]`;
            if (step.status !== "COMPLETED" && step.status !== "SUCCESS") {
                if (step.status === "FAILED") {
                    errors.push(`Pipeline step '${name}' failed during execution.`);
                } else {
                    warnings.push(`Pipeline step '${name}' did not complete successfully (Status: ${step.status}).`);
                }
            }
        }
    }

    return {
        success: errors.length === 0,
        errors,
        warnings
    };
}

module.exports = {
    validatePipeline
};
