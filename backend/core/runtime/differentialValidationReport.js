"use strict";

const { differentialValidationErrorCodes } = require("./differentialValidationErrors");

/**
 * Deep freezes an object recursively to guarantee immutability.
 *
 * @param {Object} obj The object to freeze
 */
function deepFreeze(obj) {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach(prop => {
        if (
            obj.hasOwnProperty(prop) &&
            obj[prop] !== null &&
            (typeof obj[prop] === "object" || typeof obj[prop] === "function") &&
            !Object.isFrozen(obj[prop])
        ) {
            deepFreeze(obj[prop]);
        }
    });
    return obj;
}

/**
 * Validates the schema and completeness of a DifferentialValidationReport.
 * Throws DIFFERENTIAL_REPORT_INVALID if the report is invalid or corrupted.
 * 
 * @param {Object} report The report to validate
 */
function validateReport(report) {
    if (report === null || report === undefined || typeof report !== "object" || Array.isArray(report)) {
        const err = new Error("Corrupted comparison report: report must be a non-null object.");
        err.code = differentialValidationErrorCodes.DIFFERENTIAL_REPORT_INVALID;
        throw err;
    }

    const requiredKeys = ["comparisonStatus", "matchedFields", "ignoredFields", "differences", "warnings", "statistics", "runtimeVersions"];
    for (const key of requiredKeys) {
        if (!report.hasOwnProperty(key)) {
            const err = new Error(`Corrupted comparison report: missing required key '${key}'`);
            err.code = differentialValidationErrorCodes.DIFFERENTIAL_REPORT_INVALID;
            throw err;
        }
    }

    if (report.comparisonStatus !== "PASSED" && report.comparisonStatus !== "FAILED") {
        const err = new Error("Corrupted comparison report: invalid comparisonStatus.");
        err.code = differentialValidationErrorCodes.DIFFERENTIAL_REPORT_INVALID;
        throw err;
    }

    if (!Array.isArray(report.matchedFields) || !Array.isArray(report.ignoredFields) || !Array.isArray(report.differences) || !Array.isArray(report.warnings)) {
        const err = new Error("Corrupted comparison report: collection fields must be arrays.");
        err.code = differentialValidationErrorCodes.DIFFERENTIAL_REPORT_INVALID;
        throw err;
    }

    if (report.statistics === null || typeof report.statistics !== "object" || Array.isArray(report.statistics)) {
        const err = new Error("Corrupted comparison report: statistics must be a non-null object.");
        err.code = differentialValidationErrorCodes.DIFFERENTIAL_REPORT_INVALID;
        throw err;
    }

    const requiredStats = ["totalCompared", "totalMatched", "totalIgnored", "totalDifferences"];
    for (const key of requiredStats) {
        if (typeof report.statistics[key] !== "number") {
            const err = new Error(`Corrupted comparison report: statistics missing or invalid key '${key}'`);
            err.code = differentialValidationErrorCodes.DIFFERENTIAL_REPORT_INVALID;
            throw err;
        }
    }

    if (report.runtimeVersions === null || typeof report.runtimeVersions !== "object" || Array.isArray(report.runtimeVersions)) {
        const err = new Error("Corrupted comparison report: runtimeVersions must be an object.");
        err.code = differentialValidationErrorCodes.DIFFERENTIAL_REPORT_INVALID;
        throw err;
    }

    return true;
}

module.exports = {
    validateReport,
    deepFreeze
};
