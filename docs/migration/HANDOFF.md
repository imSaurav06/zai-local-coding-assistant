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

*   **CURRENT PHASE**: PHASE 4 (TaskGraph / Simple DAG Planner)
*   **CURRENT TASK PACK**: 4D (Planner Validator)
*   **LAST COMPLETED TASK PACK**: 4D (Planner Validator)
*   **Overall Status**: IN_PROGRESS (Task Packs 4A, 4B, 4C & 4D Complete)

---

- **Git Branch**: `main`
- **Working Tree State**: Unstaged changes (no commit or push performed).
- **FILES CREATED BY 4D**:
  - `backend/core/planner/plannerValidator.js` (Structural & consistency validator)
  - `docs/migration/PHASE_4D_PLANNER_VALIDATOR.md` (Design doc)
- **FILES CHANGED BY 4D**:
  - `backend/core/planner/index.js` (Exports validatePlanner & validatorErrorCodes)
  - `backend/tests/run_tests.js` (Added 10 Planner Validator unit tests)
  - `docs/migration/PHASE_STATUS.md` (Updated status for Phase 4/4D)
  - `docs/migration/HANDOFF.md` (Updated - this document)

---

## 4. Discovered Test Baseline Summary
- **Verified Regression Command**: `node tests/run_tests.js` inside `backend` directory.
- **TESTS LAST RUN**: 2026-07-17T04:40:00+05:30
- **TEST RESULTS**: 373 passed, 0 failed, 0 skipped.
- **New Tests Added**: 10 unit tests added under the suite `Planner Validator (Phase 4D)`, covering:
  - Accepts a valid pre-built frozen Planner
  - Rejects invalid root structures
  - Rejects duplicate stableId across tasks
  - Rejects duplicate displayId across tasks
  - Rejects broken references in dependencies
  - Rejects self-dependencies
  - Rejects asymmetric edges
  - Rejects invalid statuses
  - Rejects non-frozen planners
  - Validation is deterministic, pure, and does not mutate planner parameter
  - Planner input is never mutated, repeated runs are identical and output is frozen
  - Creation is deterministic, pure, and does not mutate planner parameters
  - Populates correct metadata mapping
  - Planner data structures are deeply frozen and immutable
  - Planner creation is stateless and pure
  - Caller taskGraph input parameters are never mutated
  - Rejects broken references (dependencies pointing to non-existent nodes)
  - Cycle detection correctly rejects graphs with cyclic dependencies
  - Validation is deterministic and does not mutate graph parameters
  - Builds are stateless, pure, and deterministic
  - Input parameters are never mutated
  - Output data structure is deeply frozen and immutable
  - Creation is stateless, pure, and deterministic
  - Caller input is never mutated
- **KNOWN FAILURES**: None.
- **BLOCKERS**: None.

---

## 5. Architectural Decisions Accepted
- **ADR-001**: Incremental refactoring loop (no big-bang rewrite).
- **ADR-006**: Limit generation concurrency strictly to 3 concurrent workers.
- **ADR-013**: Code must compile and pass builds to qualify as production-ready.
- **ADR-016**: ProjectSpec Custom Internal Validation Engine (decided against external validator dependency like Ajv/Zod/Joi for lightweight, zero-overhead, offline reliability).

---

## 6. Phase 1 Complete Integration Contract

### 6.1 ProjectSpec Module
*   **SCHEMA VERSION**: `"1.0"`
*   **PUBLIC COMPILER API**:
    *   `compileProjectSpec(legacyPayload)`: Normalizes and validates legacy payload.
    *   `compilerErrorCodes`: Dict of compiler-specific error codes.
*   **COMPILATION RESULT CONTRACT**:
    *   Success: `{ success: true, value: validatedImmutableProjectSpec, errors: [] }`
    *   Failure: `{ success: false, value: null, errors: [{ code, path, message, keyword }] }`

### 6.2 Requirement Identity Module
*   **PUBLIC IDENTITY API**: `deriveRequirementIdentities(validatedProjectSpec)`
*   **IDENTITY VERSION**: `"1.0"`
*   **IDENTITY RESULT CONTRACT**:
    *   Success: `{ success: true, requirements: [...], duplicates: [...] }` (deeply frozen)
    *   Failure: `{ success: false, errors: [{ code, path, message }] }`

### 6.3 Pipeline Integration
*   **INTEGRATION FUNCTION**: `prepareCanonicalProjectSpec(legacyPayload)` in `generationOrchestrator.js`
*   **RETURNS**: `{ projectSpec: frozenCanonicalSpec, requirementIdentity: frozenIdentityResult, rtm: frozenRTM }` (RTM is internal-only)
*   **ERROR CODES**: `PROJECT_PREPARATION_COMPILE_FAILED`, `PROJECT_PREPARATION_IDENTITY_FAILED`, `PROJECT_PREPARATION_RTM_BUILD_FAILED`, `PROJECT_PREPARATION_RTM_VALIDATION_FAILED`
*   **PERSISTENCE ADAPTER**: `adaptProjectSpecForPersistence(projectSpec)` in `projectController.js` (strips schemaVersion and any sidecar data)
*   **BOUNDARY**: Top of `orchestrateGeneration()` — before any planning, scaffolding, or AI calls
*   **SIDECAR**: `requirementIdentity` and `rtm` travel internally alongside `projectSpec` in memory, but are completely stripped from public database saves and client API responses.

---

## 7. Open Architecture Questions
- None.

---

## 8. Next Exact Action
Task Pack 4D is complete. Review `PHASE_4D_PLANNER_VALIDATOR.md` before starting the next Task Pack 4E (Planner State Machine) in the next session.

**FILES TO READ FIRST**:
- [PHASE_4D_PLANNER_VALIDATOR.md](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/docs/migration/PHASE_4D_PLANNER_VALIDATOR.md)
- [plannerValidator.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/core/planner/plannerValidator.js)
- [run_tests.js Phase 4D suite](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/tests/run_tests.js#L5770)

**DO NOT TOUCH**:
- Existing generation orchestration (`backend/services/generationOrchestrator.js`).
- Requirements analysis handlers (`backend/services/projectService.js`).
- Database models (`backend/models/Project.js`, `backend/models/History.js`).
- Stack selection implementation (`backend/services/stackProfiles.js`).
- ProjectSpec Compiler semantics (`backend/core/projectSpec/projectSpecCompiler.js`).
- Requirement Identity semantics (`backend/core/requirements/requirementIdentity.js`).
- Requirement Classification semantics (`backend/core/requirementsClassification/requirementsClassifier.js`).
- RTM model semantics (`backend/core/rtm/rtmModel.js`).
- RTM builder semantics (`backend/core/rtm/rtmBuilder.js`).
- RTM validator semantics (`backend/core/rtm/rtmValidator.js`).
- TaskGraph structures (`backend/core/taskGraph/`).
- Planner structure (`backend/core/planner/`) outside of validation functions.

**STOP CONDITIONS**: Do not start Task Pack 4E in this session. Do not commit or push changes.
