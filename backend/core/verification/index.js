"use strict";

const { runVerification, verificationErrors, verificationResult } = require("./verificationEngine");
const { verificationSeverity, verificationCategory } = require("./verificationErrors");
const { computeDiagnostics, measureVerification } = require("./verificationDiagnostics");
const { buildReport } = require("./verificationReporter");

module.exports = {
    // Phase 8A
    runVerification,
    verificationErrors,
    verificationResult,
    // Phase 8C — enums
    verificationSeverity,
    verificationCategory,
    // Phase 8C — diagnostics
    computeDiagnostics,
    measureVerification,
    // Phase 8C — reporting
    buildReport
};
