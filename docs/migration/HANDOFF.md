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

*   **CURRENT PHASE**: PHASE 1 (ProjectSpec Foundation + Stable Requirement IDs)
*   **CURRENT TASK PACK**: 1D (Deterministic Stable Requirement Identity)
*   **LAST COMPLETED TASK PACK**: 1D (Deterministic Stable Requirement Identity)
*   **Overall Status**: DONE (Task Pack 1D completed successfully)

---

- **Git Branch**: `main`
- **Working Tree State**: Clean and tested codebase with new requirement identity modules.
- **PRE-EXISTING UNTRACKED FILES**:
  - `.vscode/`
  - `discovery_report.md`
  - `discovery_report.pdf`
- **FILES CHANGED/CREATED BY 1D**:
  - `backend/core/requirements/requirementIdentity.js` (New)
  - `backend/core/requirements/requirementIdentityErrors.js` (New)
  - `backend/core/requirements/index.js` (New)
  - `docs/migration/PHASE_1D_REQUIREMENT_IDENTITY.md` (New)
  - `backend/tests/run_tests.js` (Modified)
  - `docs/migration/PHASE_STATUS.md` (Modified)
  - `docs/migration/HANDOFF.md` (Modified)

---

## 4. Discovered Test Baseline Summary
- **Verified Regression Command**: `node tests/run_tests.js` inside `backend` directory.
- **TESTS LAST RUN**: 2026-07-11T18:55:00+05:30
- **TEST RESULTS**: 251 passed, 0 failed, 0 skipped.
- **New Tests Added**: 58 unit tests added under the suite `Requirement Identity (Phase 1D)`, verifying stable content hashing, displayId formatting, revalidation, duplicate contract mapping, reordering preservation, recursive canonical serialization, exact None sentinels, and circular/throwing getters safety.
- **KNOWN FAILURES**: None.
- **BLOCKERS**: None.

---

## 5. Architectural Decisions Accepted
- **ADR-001**: Incremental refactoring loop (no big-bang rewrite).
- **ADR-006**: Limit generation concurrency strictly to 3 concurrent workers.
- **ADR-013**: Code must compile and pass builds to qualify as production-ready.
- **ADR-016**: ProjectSpec Custom Internal Validation Engine (decided against external validator dependency like Ajv/Zod/Joi for lightweight, zero-overhead, offline reliability).

---

## 6. ProjectSpec Module Integration Contract
*   **SCHEMA VERSION**: `"1.0"`
*   **PUBLIC COMPILER API**:
    *   `compileProjectSpec(legacyPayload)`: Normalizes and validates legacy payload.
    *   `compilerErrorCodes`: Dict of compiler-specific error codes.
*   **COMPILATION RESULT CONTRACT**:
    *   Success: `{ success: true, value: validatedImmutableProjectSpec, errors: [] }`
    *   Failure: `{ success: false, value: null, errors: [{ code, path, message, keyword }] }`
*   **NORMALIZATION POLICY**: Field-specific string normalization with case preservation, trim-only parameters, specific case-insensitive `"none"` to `"None"` canonicalization sentinels, and strict uppercase HTTP method conversions.
*   **UNKNOWN FIELD POLICY**: Rejects unknown top-level or nested properties with structured error `COMPILE_ERROR_UNKNOWN_FIELD`.
*   **SCHEMA VERSION OWNERSHIP**: Compiler overwrites any caller-supplied parameter, ignores override attempts, and explicitly assigns v1.0 schema version, touching it to validate throwing getters.
*   **STACK COMPATIBILITY BOUNDARY**: Preserves semantic stack fields verbatim. Downstream stack detection is unaffected.
*   **IMMUTABILITY GUARANTEES**: Successful output is cloned and frozen recursively (`Object.freeze`).
*   **VALIDATOR DELEGATION**: Normalized candidates are passed directly to `validateProjectSpec()`.

---

## 7. Open Architecture Questions
- None.

---

## 8. Next Exact Action
Review PHASE_1D_REQUIREMENT_IDENTITY.md, Requirement Identity module, architecture decisions, and Task Pack 1D tests before designing or executing Task Pack 1E.

**FILES TO READ FIRST**:
- [PHASE_1D_REQUIREMENT_IDENTITY.md](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/docs/migration/PHASE_1D_REQUIREMENT_IDENTITY.md)
- [backend/core/requirements/requirementIdentity.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/core/requirements/requirementIdentity.js)
- [backend/tests/run_tests.js#L2804](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/tests/run_tests.js#L2804)

**DO NOT TOUCH**:
- Existing generation orchestration (`backend/services/generationOrchestrator.js`).
- Requirements analysis handlers (`backend/services/projectService.js`).
- Database models (`backend/models/Project.js`).

**STOP CONDITIONS**: Do not start implementation of Task Pack 1E in this session. Do not commit or push changes.
