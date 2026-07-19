"use strict";

const { runVerification } = require("../verification/verificationEngine");
const { buildVerificationReport } = require("../verification/verificationReporter");
const { verificationErrorCodes } = require("../verification/verificationErrors");

const VERIFICATION_BRIDGE_VERSION = "1.0";

function createVerificationBridge(config = {}) {
    if (config === null || typeof config !== "object") {
        const err = new Error("Invalid configuration object.");
        err.code = "VERIFICATION_CONFIGURATION_INVALID";
        throw err;
    }

    const enableVerification = !!config.enableVerification;
    const verificationEngine = config.verificationEngine || null;

    const bridge = {
        config: Object.freeze({
            enableVerification
        }),
        async verifyResult(executionResult, options = {}) {
            if (!enableVerification) {
                return executionResult;
            }

            if (!executionResult || typeof executionResult !== "object") {
                const err = new Error("ExecutionResult must be a non-null object.");
                err.code = "VERIFICATION_REPORT_INVALID";
                throw err;
            }

            let files = [];
            if (executionResult.files) {
                files = executionResult.files;
            } else if (executionResult.execution && executionResult.execution.vfsState && Array.isArray(executionResult.execution.vfsState.files)) {
                files = executionResult.execution.vfsState.files;
            }

            // Run verification engine
            let verificationResult = executionResult.verification;
            const startTime = Date.now();
            if (!verificationResult) {
                try {
                    const engine = verificationEngine || require("../verification/verificationEngine");
                    verificationResult = engine.runVerification(files, options);
                } catch (err) {
                    const error = new Error(`Verification engine failed: ${err.message}`);
                    error.code = "VERIFICATION_ENGINE_FAILED";
                    error.originalError = err;
                    throw error;
                }
            }

            if (!verificationResult || typeof verificationResult !== "object") {
                const err = new Error("Verification engine returned an invalid result.");
                err.code = "VERIFICATION_REPORT_INVALID";
                throw err;
            }

            // Build verification report
            const durationMs = Date.now() - startTime;
            let report;
            try {
                report = buildVerificationReport(verificationResult, durationMs, files);
            } catch (err) {
                const error = new Error(`Failed to build verification report: ${err.message}`);
                error.code = "VERIFICATION_REPORT_INVALID";
                error.originalError = err;
                throw error;
            }

            if (report.status !== "PASSED" && report.status !== "FAILED") {
                const err = new Error("Unknown verifier result status.");
                err.code = "VERIFICATION_REPORT_INVALID";
                throw err;
            }

            const output = {
                ...executionResult,
                verificationReport: report
            };

            if (report.status === "FAILED") {
                output.success = false;
            }

            // Deep freeze the output to guarantee immutability
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

            return deepFreeze(output);
        }
    };

    return Object.freeze(bridge);
}

module.exports = {
    createVerificationBridge,
    VERIFICATION_BRIDGE_VERSION,
    verificationErrorCodes
};
