"use strict";

/**
 * Centralized error taxonomy for the Audit Orchestrator (Phase 12E).
 */
const auditOrchestratorErrorCodes = Object.freeze({
    AUDIT_ORCHESTRATOR_INVALID_INPUT: "AUDIT_ORCHESTRATOR_INVALID_INPUT",
    AUDIT_ORCHESTRATOR_STAGE_FAILURE: "AUDIT_ORCHESTRATOR_STAGE_FAILURE",
    AUDIT_ORCHESTRATOR_INTERNAL_ERROR: "AUDIT_ORCHESTRATOR_INTERNAL_ERROR"
});

module.exports = {
    auditOrchestratorErrorCodes
};
