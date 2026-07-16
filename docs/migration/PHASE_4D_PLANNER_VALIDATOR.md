# Phase 4D — Planner Validator

This document outlines the validation rules, error boundaries, state invariants, and symmetry checks of the Planner Validator established in Task Pack 4D.

---

## 1. Executive Summary

*   **Objective**: Build a structural and semantic validator for the Planner Domain Model.
*   **Result**: Created `backend/core/planner/plannerValidator.js`. Exposed `validatePlanner` through `index.js`.
*   **Safety**: Enforces strict deep freeze immutability, unique task keys, cycle/self loops detection, status enum values, and edge symmetry.
*   **Tests**: Added **10 new unit tests** in `run_tests.js` verifying valid planner acceptance, invalid root structure rejections, duplicate displayId/stableId rejections, broken links, non-frozen states, invalid statuses, and parameters non-mutation.
*   **Status**: Regression baseline at **373 assertions passing**.

---

## 2. Public API Exports

```javascript
const {
    validatePlanner,
    validatorErrorCodes
} = require("./core/planner");
```

---

## 3. Validation Responsibilities

The validator verifies:
1. **Structural Correctness**: Root planner must have version, metadata, and tasks fields.
2. **Deep Immutability**: All sub-properties, arrays, and objects must be deeply frozen.
3. **Task Constraints**:
   - Every task must contain valid stableId, displayId, kind, status, dependencies, dependents, ready, blocked, and metadata.
   - `ready` and `blocked` must be booleans.
   - Status must equal `"PENDING"` (other statuses remain reserved).
4. **Graph Topology Integrity**:
   - `stableId` and `displayId` must be unique across all tasks.
   - All references in `dependencies` and `dependents` arrays must point to existing tasks in the planner.
   - **Symmetry**: For every edge A -> B (A has dependency B), there must be a matching backlink B -> A (B has dependent A).
   - **Self Loop Check**: No task can list itself as a dependency or dependent.

---

## 4. Error Taxonomy

*   `PLANNER_INVALID_STRUCTURE`: Mismatched root parameters or non-frozen objects.
*   `PLANNER_INVALID_TASK`: Missing required fields in task or non-boolean flags.
*   `PLANNER_DUPLICATE_TASK`: Duplicate stableId or displayId keys found.
*   `PLANNER_BROKEN_REFERENCE`: Dependencies pointing to non-existent nodes.
*   `PLANNER_SELF_DEPENDENCY`: Task lists itself as a dependency.
*   `PLANNER_ASYMMETRIC_EDGE`: Mismatch between dependency and dependent arrays.
*   `PLANNER_INVALID_STATUS`: Task status is not `"PENDING"`.
*   `PLANNER_INTERNAL_ERROR`: General runtime exception wrapper.
