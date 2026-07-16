# Phase 6A — Context Builder Foundation

This document outlines the design, interface, validation guidelines, and error taxonomy for the Context Builder Domain Model established in Task Pack 6A.

---

## 1. Executive Summary

*   **Objective**: Create the canonical Context Builder Domain Model to aggregate the ProjectSpec, requirement identity, and planner task into a deeply frozen, single context block for downstream AI generation.
*   **Result**: Created `backend/core/context/contextErrors.js`, `contextBuilder.js`, and `index.js`.
*   **Safety**: Complete parameter validation, deep cloning, and deep freezing ensure that execution context objects are immutable and free of runtime side effects.
*   **Tests**: Added **9 new unit tests** in `run_tests.js` verifying input null checks, malformed structures (ProjectSpec, requirements, tasks), mismatched identifiers, valid configurations, deep freeze immutability, determinism, and input parameters non-mutation.
*   **Status**: Regression baseline at **423 assertions passing**.

---

## 2. Context Object Structure

The Context Builder aggregates and outputs data in the following format:

```json
{
  "version": "1.0",
  "metadata": {
    "contextVersion": "1.0",
    "plannerVersion": "1.0",
    "graphVersion": "1.0",
    "identityVersion": "1.0",
    "createdBy": "contextBuilder"
  },
  "projectSpec": { ... },
  "requirement": { ... },
  "plannerTask": { ... }
}
```

---

## 3. Builder Rules

To guarantee correctness and determinism:
*   **Isolation**: No AI provider wrappers, template files, prompt builders, or file system IO are placed in this module.
*   **Semantic Matching**: The builder validates that `requirement.stableId === plannerTask.stableId` and `requirement.displayId === plannerTask.displayId` to prevent mismatch aggregation errors.
*   **Deep Immutability**: Clones the inputs to prevent shared Mongoose references, returning a recursively frozen object graph.

---

## 4. Error Taxonomy

*   `CONTEXT_INVALID_INPUT`: Inputs are null/undefined or have mismatched identifier keys.
*   `CONTEXT_INVALID_PROJECT_SPEC`: Malformed ProjectSpec missing projectName/projectType.
*   `CONTEXT_INVALID_REQUIREMENT`: Malformed requirement missing stableId/displayId/kind/description.
*   `CONTEXT_INVALID_TASK`: Malformed planner task missing stableId/displayId/status/dependencies/dependents.
*   `CONTEXT_INTERNAL_ERROR`: General runtime exception wrapper.
