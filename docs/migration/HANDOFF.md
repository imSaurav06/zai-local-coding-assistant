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
- Modular Execution Runtime and integration adapters.

---

## 2. Current Migration State

*   **CURRENT PHASE**: PHASE 11A (Execution Runtime Integration - Bridge Layer)
*   **LAST COMPLETED TASK PACK**: Phase 11A-5 (Verification + Repair Integration)
*   **Overall Status**: COMPLETE (Phase 11A Features and Adapter Bridges Integrated)
*   **Completed Phases**:
    *   ✔ Phase 11A-1 — Feature Flag Foundation
    *   ✔ Phase 11A-2 — Execution Runtime Adapter
    *   ✔ Phase 11A-3 — Controller Integration
    *   ✔ Phase 11A-4A — Checkpoint Bridge
    *   ✔ Phase 11A-4B — Mongo Persistence Bridge
    *   ✔ Phase 11A-5 — Verification + Repair Integration
*   **Working Tree State**: Uncommitted Changes (All Phase 11A changes are present, tests verified)

---

## 3. Implementation Summary (Phase 11A)

### 3.1 RuntimeConfig & Feature Flag Foundation
- Added `enableVerification` and `enableRepair` configurations to `RuntimeConfig`.
- Provided loading mappings from environment variables (`ENABLE_VERIFICATION` and `ENABLE_REPAIR`).

### 3.2 Execution Runtime Adapter
- Created `ExecutionRuntimeAdapter` class that implements runtime routing decisions.
- Encapsulates execution boundaries, inputs validation, and backward compatibility.

### 3.3 Checkpoint Bridge & Mongo CheckpointStore
- Created `CheckpointBridge` to manage Durability state transitions.
- Integrated `MongoCheckpointStore` for persistent MongoDB state saves/updates.

### 3.4 Verification & Repair Bridge
- Implemented `VerificationRepairBridge` coordinating `VerificationAdapter` and `RepairSession`.
- Runs syntax validations on output code patches, triggers isolated repairs when errors are detected, and maps failures correctly.
- Safely integrated into `ExecutionRuntimeAdapter` execution flow.

---

## 4. Discovered Test Baseline Summary
- **Verified Regression Command**: `node tests/run_tests.js` inside `backend` directory.
- **TESTS LAST RUN**: 2026-07-17T20:30:49Z
- **TEST RESULTS**: 795 passed, 0 failed.
- **KNOWN FAILURES**: None.
- **BLOCKERS**: None.
- **AI Provider Configuration**:
  - **Primary**: Z.ai (GLM-5.2) - Priority: 1
  - **Fallback**: OpenRouter - Priority: 2

---

## 5. Architectural Decisions Accepted
- **ADR-001**: Incremental refactoring loop (no big-bang rewrite).
- **ADR-006**: Limit generation concurrency strictly to 3 concurrent workers.
- **ADR-011**: Checkpoints are created only after every topological execution wave completes.
- **ADR-013**: Code must compile and pass builds to qualify as production-ready.
- **ADR-016**: ProjectSpec Custom Internal Validation Engine.

---

## 6. Next Exact Action
- **Next Milestone**: Phase 11B — Parallel Scheduler Integration.
- **Objectives**:
  - Integrate modular topological scheduling.
  - Implement concurrent parallel task workers.
