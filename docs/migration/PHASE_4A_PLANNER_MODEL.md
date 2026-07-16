# Phase 4A — Planner Domain Model

This document outlines the design, initialization logic, metadata schemas, status lifecycles, and validation rules of the Planner Domain Model established in Task Pack 4A.

---

## 1. Executive Summary

*   **Objective**: Create the canonical Planner Domain Model that represents planning tasks, initial statuses, and metadata dependencies.
*   **Result**: Created `backend/core/planner/plannerModel.js`, `plannerErrors.js`, and `index.js`.
*   **Decoupling**: Bypasses topological sorting, scheduling execution loops, worker queues, and parallel pipelines.
*   **Tests**: Added **8 new unit tests** in `run_tests.js` verifying input rejections, metadata keys, default status mappings, immutability, and determinism.
*   **Status**: Regression baseline at **351 assertions passing**.

---

## 2. Planner Root Structure

The Planner Model produces the following canonical data structure:

```json
{
  "version": "1.0",
  "metadata": {
    "plannerVersion": "1.0",
    "graphVersion": "1.0",
    "identityVersion": "1.0",
    "createdBy": "planner"
  },
  "tasks": [
    {
      "stableId": "req_be",
      "displayId": "REQ-001",
      "kind": "backend",
      "status": "PENDING",
      "dependencies": [],
      "dependents": ["req_fe"],
      "ready": false,
      "blocked": false,
      "metadata": { "sourcePath": "backend" }
    }
  ]
}
```

---

## 3. Status Lifecycle Policy

In Task Pack 4A, all tasks are strictly initialized with:
*   `status`: `"PENDING"`
*   `ready`: `false`
*   `blocked`: `false`

Future execution phases (Phase 4B+) will define transitions into active runtime states such as `READY`, `RUNNING`, `COMPLETED`, `FAILED`, `SKIPPED`.

---

## 4. Immutability and Determinism

*   **Stateless Creators**: Creating a planner is a pure, side-effect-free function of the input TaskGraph.
*   **Deep Freezing**: Every created planner structure is recursively deep-frozen using `deepFreeze`.
*   **Non-Mutation**: Verified that input TaskGraph objects are never mutated during planner instantiation.

---

## 5. Error Taxonomy

*   `PLANNER_INVALID_INPUT`: Root parameter null, undefined, or non-object.
*   `PLANNER_INVALID_GRAPH`: TaskGraph missing version, metadata, or nodes list.
*   `PLANNER_DUPLICATE_TASK`: Duplicate stableId or displayId keys found in the graph.
*   `PLANNER_INTERNAL_ERROR`: Catch-all wrapper for unexpected initialization exceptions.
