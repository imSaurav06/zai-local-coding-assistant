# Phase State Handoff

This document coordinates the transfer of state between migration sessions.

---

## 1. Project Mission Summary
Evolve the Z.ai Local Coding Assistant into a decoupled, high-reliability AI application builder. Features to migrate:
- Validated canonical, persistence-independent `ProjectSpec` domain contract.
- Stable application-controlled deterministic Requirement IDs and RTM-lite tracing index.
- Contract-first API/DB schemas compile.
- `TaskGraph` DAG planner with parallel workers.
- Transactional virtual file system (VFS) staging edits.
- Incremental verification gates and isolated file repairs.
- Durable checkpoint stores saving progress wave states to MongoDB.

---

### 2. Current Migration State

*   **CURRENT PHASE**: PHASE 9 (Bounded Targeted Repair)
*   **CURRENT TASK PACK**: 9A (Isolated Single-File Repair Engine)
*   **LAST COMPLETED TASK PACK**: 9A (Isolated Single-File Repair Engine) + ContextBuilder Alignment Fix
*   **Overall Status**: IN_PROGRESS (Task Pack 9A Complete + Alignment Fix Integrated)

---

- **Git Branch**: `main`
- **Working Tree State**: Unstaged changes (no commit or push performed).
- **FILES CREATED**:
  - `backend/core/repair/repairErrors.js`
- **FILES CHANGED**:
  - `backend/core/context/contextBuilder.js` (aligned validation contract to canonical `semanticKey` field)
  - `backend/services/targetedRepairService.js` (full refactor — bounded single-file repair engine)
  - `backend/tests/run_tests.js` (Added 20 Phase 9A tests + 7 Phase 6D integration alignment tests)
  - `docs/migration/PHASE_STATUS.md` (Updated status)
  - `docs/migration/HANDOFF.md` (Updated — this document)

---

## 4. Discovered Test Baseline Summary
- **Verified Regression Command**: `node tests/run_tests.js` inside `backend` directory.
- **TESTS LAST RUN**: 2026-07-17T15:05:00+05:30
- **TEST RESULTS**: 539 passed, 0 failed.
- **New Tests Added (Phase 6D Alignment)**: 7 integration tests in suite `ContextBuilder ↔ RequirementIdentity Integration Alignment (Phase 6D)`:
  1. RequirementIdentity output has semanticKey (not description)
  2. ContextBuilder accepts canonical RequirementIdentity output directly
  3. ContextBuilder accepts all derived RequirementIdentity requirements
  4. ContextBuilder preserves semanticKey in context requirement copy
  5. ContextBuilder rejects a requirement with description but no semanticKey
  6. ContextBuilder rejects a requirement with empty semanticKey string
  7. Interface alignment confirmed: zero mismatch between producers and consumer
- **New Tests Added (Phase 9A)**: 20 unit tests in suite `Bounded Targeted Repair — Phase 9A`:
  1. repairErrorCodes is frozen with required error code keys
  2. repairSingleFile rejects empty targetFileName with structured failure
  3. repairSingleFile rejects non-string targetFileName
  4. repairSingleFile rejects empty errors array
  5. repairSingleFile rejects non-array errors
  6. repairSingleFile rejects non-array files
  7. repairSingleFile rejects null projectSpec
  8. repairSingleFile rejects null contracts
  9. Repair failure result is frozen and immutable
  10. Caller files array is never mutated by repairSingleFile
  11. Caller files array is never mutated by repairAffectedFiles (legacy adapter)
  12. mapErrorsToFiles correctly identifies files mentioned in errors
  13. mapErrorsToFiles falls back to all files when no specific match
  14. mapErrorsToFiles handles structured error objects from Phase 8 verification
  15. repairSingleFile processes exactly one file — validated by contract signature
  16. repairAffectedFiles is backward-compatible and still exported
  17. repairSingleFile is exported as a function
  18. mapErrorsToFiles is exported and backward-compatible
  19. repairSingleFile is deterministic — same inputs produce same failure output
  20. No retry loop — repair failure propagates immediately without retry
- **KNOWN FAILURES**: None.
- **BLOCKERS**: None.

---

## 5. Architectural Decisions Accepted
- **ADR-001**: Incremental refactoring loop (no big-bang rewrite).
- **ADR-006**: Limit generation concurrency strictly to 3 concurrent workers.
- **ADR-010**: Bounded Targeted Repair — single-file isolated repair with rollback (Phase 9A implements isolation; Phase 9B implements rollback).
- **ADR-013**: Code must compile and pass builds to qualify as production-ready.
- **ADR-016**: ProjectSpec Custom Internal Validation Engine (decided against external validator dependency like Ajv/Zod/Joi for lightweight, zero-overhead, offline reliability).

---

## 6. Phase 9A Architecture Summary

### 6.1 Repair Engine Contract (Phase 9A)
*   **PRIMARY API**: `repairSingleFile(targetFileName, errors, diagnostics, allFiles, projectSpec, contracts, options)`
*   **REPAIR CONTRACT**: One input file → one isolated repair execution → one output file (or structured failure). Never more than one file processed per invocation.
*   **FAILURE CONTRACT**: If repair fails, returns frozen `{ success: false, code, message, repairedFile: null, metadata }`. No retry. No recursion.
*   **SUCCESS CONTRACT**: Returns frozen `{ success: true, code: null, message: null, repairedFile: { name, content }, metadata, verificationStatus }`.
*   **ERROR CODES**: 11 immutable codes in `backend/core/repair/repairErrors.js` (REPAIR_INVALID_TARGET_FILE, REPAIR_INVALID_ERRORS, REPAIR_INVALID_FILES, REPAIR_INVALID_PROJECT_SPEC, REPAIR_INVALID_CONTRACTS, REPAIR_AI_CALL_FAILED, REPAIR_PARSE_FAILED, REPAIR_SYNTAX_REGRESSION, REPAIR_TARGET_NOT_IN_OUTPUT, REPAIR_MULTI_FILE_REJECTED, REPAIR_INTERNAL_ERROR).
*   **BACKWARD COMPAT API**: `repairAffectedFiles(errors, files, projectSpec, contracts, options)` — preserved, adapts to call `repairSingleFile` per file instead of old 3-file batching.
*   **INPUT IMMUTABILITY**: Caller `files` array is never mutated.
*   **PURITY**: No filesystem writes, no persistence, no repository mutation.

### 6.2 Rollback
*   **NOT IMPLEMENTED in Phase 9A**. Rollback belongs exclusively to Phase 9B (VFS Rollback Integration).

---

## 7. Open Architecture Questions
- None.

---

## 8. Next Exact Action
Task Pack 9A is complete. Proceed to Task Pack 9B in the next session.

**Task Pack 9B**: VFS Rollback Integration
- Integrate VFS rollbacks on invalid syntax repairs.
- On repair failure, the VFS state is rolled back to the pre-repair snapshot.

**FILES TO READ FIRST**:
- [targetedRepairService.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/targetedRepairService.js)
- [repairErrors.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/core/repair/repairErrors.js)
- [vfsTransaction.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/core/vfs/vfsTransaction.js)
- [run_tests.js Phase 9A suite](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/tests/run_tests.js)

**DO NOT TOUCH**:
- Existing generation orchestration logic outside the repair stage.
- Requirements analysis handlers (`backend/services/projectService.js`).
- Database models (`backend/models/Project.js`, `backend/models/History.js`).
- Stack selection implementation (`backend/services/stackProfiles.js`).
- ProjectSpec Compiler semantics (`backend/core/projectSpec/projectSpecCompiler.js`).
- Requirement Identity semantics (`backend/core/requirements/requirementIdentity.js`).
- RTM model semantics (`backend/core/rtm/`).
- TaskGraph structures (`backend/core/taskGraph/`).
- Planner structure (`backend/core/planner/`).
- Checkpoint structures (`backend/core/checkpoints/`).
- Context structures (`backend/core/context/`).
- VFS structures (`backend/core/vfs/`).
- VerificationEngine (`backend/core/verification/`).


**STOP CONDITIONS**: Do not start Phase 9B in this session. Do not commit or push changes.
