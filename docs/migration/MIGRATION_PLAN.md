# Master Incremental Migration Plan

This plan details the incremental evolution of the Z.ai Application Builder. Each phase is decomposed into small, self-contained Task Packs.

---

## Task Pack Execution Protocol

Every future Task Pack must strictly adhere to this protocol:

### Before Implementation
1. **Read all migration logs**:
   - `TARGET_ARCHITECTURE.md`
   - `ARCHITECTURE_DECISIONS.md`
   - `MIGRATION_PLAN.md`
   - `CURRENT_STATE.md`
   - `PHASE_STATUS.md`
   - `HANDOFF.md`
   - `TEST_BASELINE.md`
2. **Inspect workspace safety**:
   - Run `git status` to verify the working tree is clean.
   - Confirm you are on the correct branch.
   - Run a baseline regression test check: `node tests/run_tests.js`.
3. **Align Scope**: Verify acceptance criteria for the target Task Pack.

### During Implementation
4. **Targeted Changes**: Edit only the specific files required for the Task Pack.
5. **No Scope Creep**: Do not implement future phases or perform unrelated code cleanups.
6. **Backward Compatibility**: Wrap existing boundaries so the codebase continues to compile and run.
7. **Add Tests**: Write unit/integration tests covering new functions or classes.

### After Implementation
8. **Verify code**:
   - Run targeted tests for the modified module.
   - Run full regression tests: `node tests/run_tests.js`.
9. **Update Documentation**:
   - Mark completed status in `PHASE_STATUS.md`.
   - Update `HANDOFF.md` with current working tree progress, test results, and next actions.
   - Update `TEST_BASELINE.md` and `ARCHITECTURE_DECISIONS.md` if baseline metrics or ADR scopes changed.
10. **STOP**: Hand off the progress. Do not start the next Task Pack.

---

## Migration Phases

### PHASE 0: Migration Control Plane + Safety Baseline
- **Goal**: Establish safety guidelines and document current codebase.
- **Dependencies**: None.
- **Task Packs**:
  - **Task Pack 0A**: Safety inspection and current branch git check. (Status: DONE)
  - **Task Pack 0B**: Discover and classify existing test commands. (Status: DONE)
  - **Task Pack 0C**: Create target architecture diagrams and diagrams logs. (Status: DONE)
  - **Task Pack 0D**: Set up handoff protocols and progress tracker. (Status: DONE)
- **Acceptance Criteria**: Control documents exist and 102 tests pass successfully.
- **Relative Effort**: XS.

### PHASE 1: ProjectSpec Foundation + Stable Requirement IDs
- **Goal**: Establish a canonical, persistence-independent ProjectSpec schema and integrate it safely into the existing requirements compiling path.
- **Dependencies**: Phase 0.
- **Task Packs**:
  - **Task Pack 1A**: Current Requirement Payload Characterization
    - *Goal*: Inspect and characterize the exact current output contracts of `projectService.js` requirement analysis, including normal AI output, fallback/default output, parsing/normalization paths, downstream consumers, and compatibility assumptions.
    - *Constraints*: Production behavior must not change. `Project.js` must not be modified. Add characterization tests only when Phase 1A implementation later begins.
  - **Task Pack 1B**: Canonical ProjectSpec Schema + Validation Boundary
    - *Goal*: Introduce a persistence-independent canonical `ProjectSpec` schema/types and validation boundary.
    - *Constraints*: `ProjectSpec` must not be defined as a Mongoose model. MongoDB persistence mapping remains a separate concern. Do not choose or install a new validation dependency until existing repository dependencies and constraints are inspected.
  - **Task Pack 1C**: Requirement Analysis &rarr; ProjectSpec Compiler/Adapter
    - *Goal*: Convert existing requirement-analysis output into canonical `ProjectSpec` without rewriting the existing analyzer.
    - *Constraints*: Preserve backward compatibility with current generation consumers.
  - **Task Pack 1D**: Deterministic Stable Requirement Identity
    - *Goal*: Introduce application-controlled deterministic requirement identity.
    - *Constraints*: Do not rely on the LLM to generate stable IDs. Distinguish internal stable requirement identity from human-readable sequential display IDs if necessary. The exact identity policy must be decided from repository evidence and covered by deterministic tests.
  - **Task Pack 1E**: Existing Pipeline Compatibility Integration
    - *Goal*: Integrate validated `ProjectSpec` into the existing generation pipeline incrementally while preserving current behavior and the 102-test regression baseline.
- **Modules Affected**: `projectService.js`, `Project.js` model.
- **Relative Effort**: M.

### PHASE 2: Requirement Validator + RTM-Lite
- **Goal**: Implement AST checks for specifications and build a requirements mapping index.
- **Dependencies**: Phase 1.
- **Task Packs**:
  - **Task Pack 2A**: Create `RequirementValidator` class checking spec fields.
  - **Task Pack 2B**: Build `RTMLite` tracker mapping requirement IDs to contract files.
- **Modules Affected**: `projectService.js`, `validationProfiles.js`.
- **Relative Effort**: S.

### PHASE 3: Architecture / DB / API / Auth / Deployment Contracts
- **Goal**: Build contract generators that output file tree and interface contracts before code generation.
- **Dependencies**: Phase 2.
- **Task Packs**:
  - **Task Pack 3A**: Refactor `contractBuilder.js` to generate path manifests.
  - **Task Pack 3B**: Add validators verifying that files follow contract boundaries.
- **Modules Affected**: `contractBuilder.js`, `validationProfiles.js`.
- **Relative Effort**: S.

### PHASE 4: TaskGraph / Simple DAG Planner
- **Goal**: Replace heuristic planners with a directed acyclic graph scheduler.
- **Dependencies**: Phase 3.
- **Task Packs**:
  - **Task Pack 4A**: Create `TaskGraph` model.
  - **Task Pack 4B**: Refactor `generationPlanner.js` to output a topological waves schedule.
- **Modules Affected**: `generationPlanner.js`.
- **Relative Effort**: M.

### PHASE 5: Durable Checkpoints + Resume
- **Goal**: Save intermediate generation files and task states to MongoDB to support resuming.
- **Dependencies**: Phase 4.
- **Task Packs**:
  - **Task Pack 5A**: Add `Checkpoint` schema in MongoDB.
  - **Task Pack 5B**: Integrate checkpoint saves after each successful wave in the orchestrator.
- **Modules Affected**: `Project.js` model, `generationOrchestrator.js`.
- **Relative Effort**: M.

### PHASE 6: ContextBuilder
- **Goal**: Build import-subgraph context builders to reduce prompt sizes.
- **Dependencies**: Phase 5.
- **Task Packs**:
  - **Task Pack 6A**: Write an AST relative-import scraper for JS/Python files.
  - **Task Pack 6B**: Integrate `ContextBuilder` into task worker calls.
- **Modules Affected**: `aiGenerationExecutor.js`.
- **Relative Effort**: L.

### PHASE 7: Structured / Transactional File Operations
- **Goal**: Build a transactional virtual file system (VFS) for staging file updates.
- **Dependencies**: Phase 6.
- **Task Packs**:
  - **Task Pack 7A**: Write `FileOperationsEngine` class.
  - **Task Pack 7B**: Update the orchestrator to stage writes in the VFS instead of standard array list.
- **Modules Affected**: `generationOrchestrator.js`, `previewService.js`.
- **Relative Effort**: M.

### PHASE 8: Incremental Verification Engine
- **Goal**: Run syntax and imports verification immediately after a task finishes.
- **Dependencies**: Phase 7.
- **Task Packs**:
  - **Task Pack 8A**: Decouple checkers from `validationProfiles.js` into modular classes.
  - **Task Pack 8B**: Trigger validation checkers at task execution boundaries.
- **Modules Affected**: `validationProfiles.js`, `generationOrchestrator.js`.
- **Relative Effort**: M.

### PHASE 9: Bounded Targeted Repair
- **Goal**: Refactor repair loops to run single-file isolated corrections with rollbacks.
- **Dependencies**: Phase 8.
- **Task Packs**:
  - **Task Pack 9A**: Modify `targetedRepairService.js` to run isolated file repairs.
  - **Task Pack 9B**: Integrate VFS rollbacks on invalid syntax repairs.
- **Modules Affected**: `targetedRepairService.js`.
- **Relative Effort**: M.

### PHASE 10: AI Provider Gateway & Repair Engine Foundation
- **Goal**: Consolidate provider interfaces, implement robust provider gateway routing/retries/fallback, and implement the modular repair engine foundation.
- **Dependencies**: Phase 9.
- **Task Packs**:
  - **Task Pack 10A**: Durable Checkpoint Foundation (Status: COMPLETE)
  - **Task Pack 10B**: AI Provider Gateway (Status: COMPLETE)
  - **Task Pack 10C**: Repair Engine (Status: COMPLETE)
- **Current Regression**: 761 / 761 tests passing

### PHASE 11: Execution Runtime Integration
- **Goal**: Integrate the new modular runtime, replacing legacy orchestration incrementally while preserving compatibility.
- **Task Packs**:
  - **Phase 11A-1**: Feature Flag Foundation (Status: COMPLETE)
  - **Phase 11A-2**: Execution Runtime Adapter (Status: COMPLETE)
  - **Phase 11A-3**: Controller Integration (Status: COMPLETE)
  - **Phase 11A-4A**: Checkpoint Bridge (Status: COMPLETE)
  - **Phase 11A-4B**: Mongo Persistence Bridge (Status: COMPLETE)
  - **Phase 11A-5**: Verification + Repair Integration (Status: COMPLETE)
  - **Phase 11A-6**: Parallel Worker Pool Foundation (Status: COMPLETE)
  - **Phase 11A-7**: Shadow Runtime & Parity Validation (Status: COMPLETE)
  - **Phase 11A-8**: Production Readiness Audit (Status: COMPLETE)
- **Current Status**: COMPLETE.
- **Relative Effort**: L.

### PHASE 12: Requirement / Integration / Security / Deployment Audits
- **Goal**: Implement final system auditors checking coverage, package safety, pipeline integrity, and build outputs. Issue an immutable production certification verdict.
- **Dependencies**: Phase 11.
- **Task Packs**:
  - **Phase 12A**: Requirement Compliance Audit — `auditRequirements()` with RTM coverage scoring (Status: COMPLETE)
  - **Phase 12B**: Security Audit — `auditSecurity()` with secret scanning and dependency vulnerability detection (Status: COMPLETE)
  - **Phase 12C**: Integration Audit — `auditIntegration()` with pipeline sequencing and contract validation (Status: COMPLETE)
  - **Phase 12D**: Deployment Qualification — `qualifyDeployment()` with artifact and gate-based readiness scoring (Status: COMPLETE)
  - **Phase 12E**: Audit Orchestrator & Final Certification — `runFullAudit()` chaining 12A→12B→12C→12D with live gate inputs and `CERTIFIED` / `CONDITIONALLY_CERTIFIED` / `NOT_CERTIFIED` verdict (Status: COMPLETE)
- **Modules Created**: `backend/core/audit/` (20 files across 5 sub-phases)
- **Current Regression**: 984 / 984 tests passing
- **Overall Status**: COMPLETE.
- **Relative Effort**: M.

### PHASE 13: LearnSphere-Scale E2E Benchmark + Release Qualification
- **Goal**: Benchmark the complete system on complex prompts and verify output readiness.
- **Dependencies**: Phase 12.
- **Task Packs**:
  - **Task Pack 13A**: Create the LearnSphere LMS prompt benchmark.
  - **Task Pack 13B**: Audit build qualification and packaging.
- **Modules Affected**: E2E test scripts.
- **Relative Effort**: M.
