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

*   **CURRENT PHASE**: PHASE 6 (ContextBuilder)
*   **CURRENT TASK PACK**: 6B (Repository-Aware Context Builder)
*   **LAST COMPLETED TASK PACK**: 6B (Repository-Aware Context Builder)
*   **Overall Status**: IN_PROGRESS (Task Packs 6A & 6B Complete)

---

- **Git Branch**: `main`
- **Working Tree State**: Unstaged changes (no commit or push performed).
- **FILES CREATED BY 6B**:
  - `docs/migration/PHASE_6B_REPOSITORY_CONTEXT.md` (Design doc)
- **FILES CHANGED BY 6B**:
  - `backend/core/context/contextErrors.js` (Added repo errors)
  - `backend/core/context/contextBuilder.js` (Implemented import resolution)
  - `backend/tests/run_tests.js` (Added 7 Repository-Aware Context Builder unit tests)
  - `docs/migration/PHASE_STATUS.md` (Updated status for Phase 6/6B)
  - `docs/migration/HANDOFF.md` (Updated - this document)

---

## 4. Discovered Test Baseline Summary
- **Verified Regression Command**: `node tests/run_tests.js` inside `backend` directory.
- **TESTS LAST RUN**: 2026-07-17T07:21:00+05:30
- **TEST RESULTS**: 430 passed, 0 failed, 0 skipped.
- **New Tests Added**: 7 unit tests added under the suite `Repository-Aware Context (Phase 6B)`, covering:
  - Checkpoint Builder executes exactly once in preparation pipeline
  - Checkpoint Validator executes exactly once in preparation pipeline
  - Resume State Builder executes exactly once in preparation pipeline
  - Checkpoint creation failure halts preparation and throws correct error code
  - Checkpoint validation failure halts preparation and throws correct error code
  - Resume state creation failure halts preparation and throws correct error code
  - Checkpoint and ResumeState remain frozen in preparation result
  - Checkpoint and ResumeState never reach persistence adapter
  - Checkpoint and ResumeState sidecars are not returned by public orchestrateGeneration result
  - Accepts a valid pre-built frozen Checkpoint
  - Rejects invalid root structures
  - Rejects invalid metadata attributes
  - Rejects duplicate task IDs across planner tasks
  - Rejects non-frozen checkpoint configurations
  - Validation process is pure, side-effect-free, and deterministic
  - Input parameters are never mutated
  - Rejects invalid non-object checkpoint inputs
  - Rejects malformed checkpoint structure
  - Resume state initializes correctly and preserves metadata
  - Completed/pending/running/failed tasks arrays are correctly preserved
  - Resume state output is deeply frozen and immutable
  - Resume state creation is stateless, pure, and deterministic
  - Input parameters are never mutated
  - Rejects invalid non-object planner inputs
  - Rejects invalid planner structures
  - Rejects duplicate task IDs
  - Checkpoint initializes correctly and populates executionState groups
  - Checkpoint is deeply frozen and immutable
  - Creation is stateless, pure, and deterministic
  - Input parameters are never mutated
- **New Tests Added**: 11 unit tests added under the suite `Planner Pipeline Integration (Phase 4E)`, covering:
  - Planner Model executes exactly once in preparation pipeline
  - Planner Topology executes exactly once in preparation pipeline
  - Ready Queue Builder executes exactly once in preparation pipeline
  - Planner Validator executes exactly once in preparation pipeline
  - Planner Model failure prevents planning and throws correct error code
  - Planner Topology failure prevents planning and throws correct error code
  - Ready Queue failure prevents planning and throws correct error code
  - Planner validation failure prevents planning and throws correct error code
  - Planner remains frozen in preparation result
  - Planner never reaches persistence adapter
  - Planner sidecar is not returned by public orchestrateGeneration result
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
*   **RETURNS**: `{ projectSpec: frozenCanonicalSpec, requirementIdentity: frozenIdentityResult, rtm: frozenRTM, taskGraph: frozenTaskGraph, planner: frozenPlanner, checkpoint: frozenCheckpoint, resumeState: frozenResumeState }` (RTM, TaskGraph, Planner, Checkpoint, ResumeState are internal-only sidecars)
*   **ERROR CODES**: `PROJECT_PREPARATION_COMPILE_FAILED`, `PROJECT_PREPARATION_IDENTITY_FAILED`, `PROJECT_PREPARATION_RTM_BUILD_FAILED`, `PROJECT_PREPARATION_RTM_VALIDATION_FAILED`, `PROJECT_PREPARATION_TASK_GRAPH_BUILD_FAILED`, `PROJECT_PREPARATION_TASK_GRAPH_VALIDATION_FAILED`, `PROJECT_PREPARATION_PLANNER_BUILD_FAILED`, `PROJECT_PREPARATION_PLANNER_TOPOLOGY_FAILED`, `PROJECT_PREPARATION_PLANNER_READY_FAILED`, `PROJECT_PREPARATION_PLANNER_VALIDATION_FAILED`, `PROJECT_PREPARATION_CHECKPOINT_BUILD_FAILED`, `PROJECT_PREPARATION_CHECKPOINT_VALIDATION_FAILED`, `PROJECT_PREPARATION_RESUME_STATE_FAILED`
*   **PERSISTENCE ADAPTER**: `adaptProjectSpecForPersistence(projectSpec)` in `projectController.js` (strips schemaVersion and any sidecar data)
*   **BOUNDARY**: Top of `orchestrateGeneration()` — before any planning, scaffolding, or AI calls
*   **SIDECAR**: `requirementIdentity` and `rtm` travel internally alongside `projectSpec` in memory, but are completely stripped from public database saves and client API responses.

---

## 7. Open Architecture Questions
- None.

---

## 8. Next Exact Action
Task Pack 6B is complete. Review `PHASE_6B_REPOSITORY_CONTEXT.md` before starting Task Pack 6C (Context Validator) in the next session.

**FILES TO READ FIRST**:
- [PHASE_6B_REPOSITORY_CONTEXT.md](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/docs/migration/PHASE_6B_REPOSITORY_CONTEXT.md)
- [contextBuilder.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/core/context/contextBuilder.js)
- [run_tests.js Phase 6B suite](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/tests/run_tests.js#L6711)

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
- Planner structure (`backend/core/planner/`).
- Checkpoint structures (`backend/core/checkpoints/`).
- Context structures (`backend/core/context/`) outside of buildContext parameter extensions.

**STOP CONDITIONS**: Do not start Task Pack 6C in this session. Do not commit or push changes.
