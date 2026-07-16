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

*   **CURRENT PHASE**: PHASE 3 (Architecture / DB / API / Auth / Deployment Contracts)
*   **CURRENT TASK PACK**: 3E (TaskGraph Pipeline Integration)
*   **LAST COMPLETED TASK PACK**: 3E (TaskGraph Pipeline Integration)
*   **Overall Status**: DONE (Task Packs 3A, 3B, 3C, 3D & 3E Complete)

---

- **Git Branch**: `main`
- **Working Tree State**: Unstaged changes in 5 files (no commit or push performed).
- **FILES CREATED BY 3E**:
  - `docs/migration/PHASE_3E_TASKGRAPH_PIPELINE_INTEGRATION.md` (Design doc)
- **FILES CHANGED BY 3E**:
  - `backend/services/generationOrchestrator.js` (Pipeline integration)
  - `backend/core/taskGraph/dependencyRules.js` (Plural kind support mappings)
  - `backend/tests/run_tests.js` (Added 7 Pipeline Integration unit tests)
  - `docs/migration/PHASE_STATUS.md` (Updated status for Phase 3/3E)
  - `docs/migration/HANDOFF.md` (Updated - this document)

---

## 4. Discovered Test Baseline Summary
- **Verified Regression Command**: `node tests/run_tests.js` inside `backend` directory.
- **TESTS LAST RUN**: 2026-07-17T03:45:00+05:30
- **TEST RESULTS**: 343 passed, 0 failed, 0 skipped.
- **New Tests Added**: 7 unit tests added under the suite `TaskGraph Pipeline Integration (Phase 3E)`, covering:
  - TaskGraph Builder executes once in preparation pipeline
  - TaskGraph Validator executes once in preparation pipeline
  - Builder failure halts preparation and throws correct error code
  - Validator failure halts preparation and throws correct error code
  - TaskGraph remains frozen in preparation result
  - TaskGraph never reaches persistence adapter
  - TaskGraph sidecar is not returned by public orchestrateGeneration result
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
Task Pack 3E is complete. Review `PHASE_3E_TASKGRAPH_PIPELINE_INTEGRATION.md` before starting the next Phase (such as Contracts, Scheduling, or Executor systems) in the next session.

**FILES TO READ FIRST**:
- [PHASE_3E_TASKGRAPH_PIPELINE_INTEGRATION.md](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/docs/migration/PHASE_3E_TASKGRAPH_PIPELINE_INTEGRATION.md)
- [generationOrchestrator.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/generationOrchestrator.js)
- [run_tests.js Phase 3E suite](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/tests/run_tests.js#L5309)

**DO NOT TOUCH**:
- Existing generation orchestration (`backend/services/generationOrchestrator.js`) outside of preparation functions.
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

**STOP CONDITIONS**: Do not start any subsequent task pack in this session. Do not commit or push changes.
