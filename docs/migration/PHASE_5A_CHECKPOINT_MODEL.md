# Phase 5A — Checkpoint Domain Model

This document outlines the design, initialization properties, state groups, and validation rules of the Checkpoint Domain Model established in Task Pack 5A.

---

## 1. Executive Summary

*   **Objective**: Create the canonical Checkpoint Domain Model representing the complete offline execution state at a single point in time.
*   **Result**: Created `backend/core/checkpoints/checkpointModel.js`, `checkpointErrors.js`, and `index.js`.
*   **Decoupling**: Built completely offline without filesystem operations, databases, or runtime scheduler changes.
*   **Tests**: Added **7 new unit tests** in `run_tests.js` verifying input planner validations, duplicate ID rejections, default state groupings, deep freezing immutability, determinism, and input parameters non-mutation.
*   **Status**: Regression baseline at **391 assertions passing**.

---

## 2. Checkpoint Structure

The Checkpoint Domain Model instantiates the following canonical data structure:

```json
{
  "version": "1.0",
  "metadata": {
    "checkpointVersion": "1.0",
    "plannerVersion": "1.0",
    "graphVersion": "1.0",
    "identityVersion": "1.0",
    "createdBy": "planner"
  },
  "planner": { ... },
  "executionState": {
    "completedTasks": [],
    "runningTasks": [],
    "pendingTasks": ["t1", "t2"],
    "failedTasks": []
  }
}
```

---

## 3. Execution State Groupings

Tasks are sorted deterministically by their `displayId` ascending and placed into status categories based on their `status`:
*   `COMPLETED` -> `completedTasks`
*   `RUNNING` -> `runningTasks`
*   `FAILED` -> `failedTasks`
*   All other statuses (including `PENDING`) -> `pendingTasks`

---

## 4. Immutability and Determinism

*   **Pure Creators**: Checkpoint instantiations are purely stateless, deterministic functions of the input Planner state.
*   **Deep Freezing**: Every created checkpoint result is recursively deep-frozen using `deepFreeze`.
*   **Deep Cloning**: The planner is deep-cloned into the checkpoint structure to prevent any shared reference mutations.
*   **No Runtime Side Effects**: No timestamps, runtime random UUIDs, or system environment dependencies are utilized.

---

## 5. Error Taxonomy

*   `CHECKPOINT_INVALID_INPUT`: Root planner parameter is null/undefined/non-object.
*   `CHECKPOINT_INVALID_PLANNER`: Missing planner version, metadata, or tasks collection.
*   `CHECKPOINT_DUPLICATE_TASK`: Duplicate stableId or displayId keys found.
*   `CHECKPOINT_INTERNAL_ERROR`: General runtime exception wrapper.
