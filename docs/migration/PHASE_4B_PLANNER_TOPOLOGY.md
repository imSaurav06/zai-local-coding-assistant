# Phase 4B — Topological Planner Foundation

This document outlines the design, execution planning algorithm, validation checks, and error boundaries of the Topological Planning Engine established in Task Pack 4B.

---

## 1. Executive Summary

*   **Objective**: Build a deterministic topological planning engine that resolves node sequences inside a Directed Acyclic Graph (DAG).
*   **Result**: Created `backend/core/planner/plannerTopology.js`. Exposed `createExecutionPlan` through `index.js`.
*   **Safety**: Validates inputs, duplicate ids, dangling reference pointers, and dependency cycles.
*   **Tests**: Added **6 new unit tests** in `run_tests.js` verifying simple DAGs, roots resolving, diamond graphs, independent paths sorting, cycle checks, and parameter non-mutation.
*   **Status**: Regression baseline at **357 assertions passing**.

---

## 2. Public API Exports

```javascript
const {
    createExecutionPlan,
    topologyErrorCodes
} = require("./core/planner");
```

---

## 3. Sort Algorithm: Kahn's Algorithm

To resolve task sequence orders deterministically:
1. Calculates in-degree (# of incoming dependency edges) for every node.
2. Identifies all starting nodes with in-degree = 0.
3. **Deterministic Ordering Policy**: When multiple sibling nodes are ready at the same time, Kahn's ready queue sorts them in ascending order of `displayId` (e.g. `REQ-001` before `REQ-002`).
4. Iteratively removes nodes, updates target in-degrees, and queues newly freed children.
5. If the returned execution path size is less than the total task count, a cycle exists.

---

## 4. Error Taxonomy

*   `PLANNER_TOPOLOGY_INVALID_INPUT`: Root planner argument is null/undefined/non-object.
*   `PLANNER_TOPOLOGY_INVALID_GRAPH`: Tasks array missing or invalid node values.
*   `PLANNER_TOPOLOGY_CYCLE`: Graph has one or more circular references.
*   `PLANNER_TOPOLOGY_INTERNAL_ERROR`: General runtime exception wrapper.
