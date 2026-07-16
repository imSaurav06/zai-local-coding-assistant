# Phase 5B — Resume State Foundation

This document outlines the design, schema, structure, metadata fields, and validations of the Resume State Domain Model established in Task Pack 5B.

---

## 1. Executive Summary

*   **Objective**: Create the canonical Resume State Domain Model to represent the minimal deterministic state required to continue execution from a checkpoint.
*   **Result**: Created `backend/core/checkpoints/resumeState.js` and exposed `createResumeState` in `index.js`.
*   **Safety**: Pure creator function that deep-clones checkpoint parameters and returns a recursively deep-frozen `resumeState` object.
*   **Tests**: Added **7 new unit tests** in `run_tests.js` verifying input checkpoint validation, structure check rejections, metadata propagation, task list preservation (completed, pending, running, failed), deep freezing, determinism, and parameters non-mutation.
*   **Status**: Regression baseline at **398 assertions passing**.

---

## 2. Resume State Contract

The Resume State is generated in the following format:

```json
{
  "version": "1.0",
  "metadata": {
    "checkpointVersion": "1.0",
    "plannerVersion": "1.0",
    "graphVersion": "1.0",
    "identityVersion": "1.0",
    "createdBy": "test-user"
  },
  "completedTasks": ["t1"],
  "pendingTasks": ["t2"],
  "failedTasks": [],
  "runningTasks": []
}
```

---

## 3. Metadata Mapping

Metadata is directly copied from the checkpoint metadata properties:
*   `checkpointVersion`
*   `plannerVersion`
*   `graphVersion`
*   `identityVersion`
*   `createdBy`

---

## 4. Pure Logic Constraints

To guarantee maximum reproducibility:
*   **No Mutability**: Checkpoints and output objects are completely locked via `deepFreeze`.
*   **No External Dependencies**: No filesystem writes, network operations, database calls, runtime timers, or randomness.
*   **Determinism**: Identical checkpoints will always return structurally identical `resumeState` outputs.

---

## 5. Error Taxonomy

*   `RESUME_INVALID_INPUT`: Checkpoint parameter is null, undefined, or not an object.
*   `RESUME_INVALID_CHECKPOINT`: Checkpoint is missing metadata attributes, version, planner model, or execution lists.
*   `RESUME_INTERNAL_ERROR`: General runtime exception wrapper.
