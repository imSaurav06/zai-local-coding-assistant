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

*   **Current Phase**: PHASE 1 (ProjectSpec Foundation + Stable Requirement IDs)
*   **Current Task Pack**: 1A (Current Requirement Payload Characterization)
*   **Last Completed Task Pack**: Task Pack 1A (Current Requirement Payload Characterization)
*   **Overall Status**: DONE (Task Pack 1A completed successfully)

---

## 3. Working Tree State & Uncommitted Changes
- **Git Branch**: `main`
- **Working Tree Status**: Modified files present (documentation and test changes).
- **Files Created/Changed in Task Pack 1A**:
  - [PHASE_1A_REQUIREMENT_PAYLOAD_CHARACTERIZATION.md](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/docs/migration/PHASE_1A_REQUIREMENT_PAYLOAD_CHARACTERIZATION.md) (Created)
  - [backend/tests/run_tests.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/tests/run_tests.js) (Modified to add characterization tests)
  - [docs/migration/PHASE_STATUS.md](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/docs/migration/PHASE_STATUS.md) (Modified status)
  - [docs/migration/HANDOFF.md](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/docs/migration/HANDOFF.md) (Modified handoff)

---

## 4. Discovered Test Baseline Summary
- **Verified Regression Command**: `node tests/run_tests.js` inside `backend` directory.
- **Last Test Metrics**: 115 passed, 0 failed, 0 skipped.
- **Historical 97 Deterministic Tests**: Verified passing.
- **New Tests Added**: 13 unit characterization tests protecting parsing, fenced JSON isolation, missing fields defaulting, transient retry limits, dynamic profile stack mapping, projectSpec reference immutability, and 6 stack selection priority collision scenarios.
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
Review PHASE_1A_REQUIREMENT_PAYLOAD_CHARACTERIZATION.md and the Phase 1A characterization tests before designing or executing Task Pack 1B.

**STOP CONDITIONS**: Do not edit production source files or start implementation of Task Pack 1B until the next session is initialized.
