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

## 2. Current Migration State

*   **CURRENT PHASE**: PHASE 1 (ProjectSpec Foundation + Stable Requirement IDs)
*   **CURRENT TASK PACK**: 1B (Canonical ProjectSpec Schema + Validation Boundary)
*   **LAST COMPLETED TASK PACK**: 1B (Canonical ProjectSpec Schema + Validation Boundary)
*   **Overall Status**: DONE (Task Pack 1B completed successfully)

---

## 3. Working Tree State & Uncommitted Changes
- **Git Branch**: `main`
- **Working Tree Status**: Modified/Created files present (documentation, new schema module, and test additions).
- **PRE-EXISTING UNTRACKED FILES**:
  - `docs/migration/PHASE_1A_REQUIREMENT_PAYLOAD_CHARACTERIZATION.md`
- **FILES CHANGED/CREATED BY 1B**:
  - `backend/core/projectSpec/projectSpecErrors.js` (New)
  - `backend/core/projectSpec/projectSpecSchema.js` (New)
  - `backend/core/projectSpec/projectSpecValidator.js` (New)
  - `backend/core/projectSpec/index.js` (New)
  - `docs/migration/PHASE_1B_PROJECTSPEC_SCHEMA_AND_VALIDATION.md` (New)
  - `docs/architecture/ARCHITECTURE_DECISIONS.md` (Modified)
  - `backend/tests/run_tests.js` (Modified)
  - `docs/migration/PHASE_STATUS.md` (Modified)
  - `docs/migration/HANDOFF.md` (Modified)

---

## 4. Discovered Test Baseline Summary
- **Verified Regression Command**: `node tests/run_tests.js` inside `backend` directory.
- **TESTS LAST RUN**: 2026-07-10T22:43:00+05:30
- **TEST RESULTS**: 150 passed, 0 failed, 0 skipped.
- **New Tests Added**: 35 unit tests added under the suite `Canonical ProjectSpec Schema & Validation (Phase 1B)`, checking version checks, required fields, primitive/element types, duplicates (routes, APIs, components, database models), env vars, dependency formats, immutability freezing, error deterministic ordering, result consistency, throwing getters protection, plain-object policy validation, prototype-pollution checks, sparse arrays skips, and route syntax checks.
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
*   **PUBLIC PROJECTSPEC API**:
    *   `PROJECT_SPEC_SCHEMA_VERSION`: `"1.0"`
    *   `validateProjectSpec(candidate)`: returns validation outcome.
    *   `errorCodes`: dict of taxonomy strings.
*   **VALIDATION RESULT CONTRACT**:
    *   Success: `{ success: true, value: validatedImmutableProjectSpec, errors: [] }`
    *   Failure: `{ success: false, value: null, errors: [{ code, path, message, keyword }] }`
*   **IMMUTABILITY STRATEGY**: Deep-freeze recursive freeze combined with JSON-compatible deep cloning (`JSON.parse(JSON.stringify(candidate))`) to isolate memory references.

---

## 7. Open Architecture Questions
- How should the compiler in 1C normalize raw AI-generated spec properties (like translating `Ruby on Rails` to dynamic fallback, or filling in missing array properties) prior to validating it?
- How should RTM-lite indices sync prompts with generated code versions without bloat?

---

## 8. Next Exact Action
Review PHASE_1B_PROJECTSPEC_SCHEMA_AND_VALIDATION.md, the ProjectSpec domain module, and Task Pack 1B tests before designing or executing Task Pack 1C.

**FILES TO READ FIRST**:
- [PHASE_1B_PROJECTSPEC_SCHEMA_AND_VALIDATION.md](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/docs/migration/PHASE_1B_PROJECTSPEC_SCHEMA_AND_VALIDATION.md)
- [backend/core/projectSpec/projectSpecValidator.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/core/projectSpec/projectSpecValidator.js)
- [backend/tests/run_tests.js#L1870](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/tests/run_tests.js#L1870)

**DO NOT TOUCH**:
- Existing generation orchestration (`backend/services/generationOrchestrator.js`).
- Requirements analysis handlers (`backend/services/projectService.js`).
- Database models (`backend/models/Project.js`).

**STOP CONDITIONS**: Do not start implementation of Task Pack 1C (compiler/adapter) in this session. Do not commit or push changes.
