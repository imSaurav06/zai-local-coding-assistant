# Phase State Handoff

This document coordinates the transfer of state between migration sessions.

---

## 1. Project Mission Summary
Evolve the Z.ai Local Coding Assistant into a decoupled, high-reliability AI application builder. Features to migrate:
- Validated `ProjectSpec` (the canonical JSON structure).
- Stable Requirement IDs and RTM-lite tracing index.
- Contract-first API/DB schemas compile.
- `TaskGraph` DAG planner with parallel workers.
- Transactional virtual file system (VFS) staging edits.
- Incremental verification gates and isolated file repairs.
- Durable checkpoint stores saving progress wave states to MongoDB.

---

## 2. Current Migration State

*   **Current Phase**: PHASE 0 (Migration Control Plane + Safety Baseline)
*   **Current Task Pack**: None (Phase 0 is complete)
*   **Last Completed Task Pack**: Task Pack 0E (Handoff Protocol)
*   **Overall Status**: DONE (Phase 0 has succeeded)

---

## 3. Working Tree State & Uncommitted Changes
- **Git Branch**: `main`
- **Working Tree Status**: Clean. (All pre-existing hardening changes are committed in previous commits b80fae565f49838c1647c70a3c0ee0baba0f0d71 and bbb13e2b8acd7f8a3b5459510f12dda79ede5680).
- **Preserved Uncommitted Work**: N/A (No pre-existing modifications to protect).
- **Files Created/Changed in Phase 0**:
  - [TARGET_ARCHITECTURE.md](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/docs/architecture/TARGET_ARCHITECTURE.md)
  - [ARCHITECTURE_DECISIONS.md](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/docs/architecture/ARCHITECTURE_DECISIONS.md)
  - [MIGRATION_PLAN.md](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/docs/migration/MIGRATION_PLAN.md)
  - [CURRENT_STATE.md](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/docs/migration/CURRENT_STATE.md)
  - [PHASE_STATUS.md](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/docs/migration/PHASE_STATUS.md)
  - [HANDOFF.md](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/docs/migration/HANDOFF.md)
  - [TEST_BASELINE.md](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/docs/migration/TEST_BASELINE.md)

---

## 4. Discovered Test Baseline Summary
- **Verified Regression Command**: `node tests/run_tests.js` inside `backend` directory.
- **Last Test Metrics**: 102 passed, 0 failed, 0 skipped.
- **Historical 97 Deterministic Tests**: Verified passing.
- **New Tests Added**: 5 unit tests verifying Vite scripts preservation, timeout bounds clamping, and preview ready transitions.
- **Untested Critical Modules**: `aiService.js`, `providerRouter.js`, `openRouterProvider.js`, `zaiProvider.js`, `progressEmitter.js`.

---

## 5. Architectural Decisions Accepted
- **ADR-001**: Incremental refactoring loop (no big-bang rewrite).
- **ADR-006**: Limit generation concurrency strictly to 3 concurrent workers.
- **ADR-013**: Code must compile and pass builds to qualify as production-ready.

---

## 6. Open Architecture Questions
- What validation framework should be introduced for checking `ProjectSpec` formatting? (e.g. Ajv).
- How should RTM-lite indices sync prompts with generated code versions without bloat?

---

## 7. Next Exact Action
1. **Initialize Phase 1**: Review the scope of Task Pack 1A in [MIGRATION_PLAN.md](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/docs/migration/MIGRATION_PLAN.md).
2. **Read First**:
   - [TARGET_ARCHITECTURE.md](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/docs/architecture/TARGET_ARCHITECTURE.md)
   - [MIGRATION_PLAN.md](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/docs/migration/MIGRATION_PLAN.md)
   - [projectService.js:analyzeRequirements](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/projectService.js#L9) (for Phase 1 refactoring).
3. **Execute First**: Run the regression tests `node tests/run_tests.js` inside `backend` to verify safety.

**STOP CONDITIONS**: Do not edit production source files or start implementation of Phase 1 until the next session is initialized.
