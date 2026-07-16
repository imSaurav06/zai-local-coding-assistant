# Phase 3C — TaskGraph (DAG) Builder

This document outlines the architecture, integration properties, edge resolution policies, and structural details of the TaskGraph DAG Builder established in Task Pack 3C.

---

## 1. Executive Summary

*   **Objective**: Build the canonical TaskGraph DAG builder module that populates dependency and dependent edges across nodes.
*   **Result**: Created `backend/core/taskGraph/taskGraphBuilder.js` exporting `buildTaskGraph(requirements)`.
*   **Decoupling**: Bypasses scheduling, cycle checks, topological sorting, and production execution pipelines.
*   **Tests**: Appended **7 new unit tests** covering edge mapping, dependents validation, kind omissions, immutability, and determinism.
*   **Status**: Regression baseline at **328 assertions passing**.

---

## 2. Edge Resolution and Node Linking

The builder resolves dependencies dynamically for every node by checking the allowed prerequisites from the Dependency Rule Engine:
1.  **Read Rules**: Invokes `getDependenciesForKind(node.kind)` to fetch candidate kinds.
2.  **Match Candidates**: Matches other nodes in the graph that belong to the allowed kind lists.
3.  **Create Edges**: Adds the prerequisite node `stableId` to the current node's `dependencies` list, and appends the current node `stableId` to the prerequisite node's `dependents` list.
4.  **Deterministic Sort**: Sorts the `dependencies` and `dependents` string lists alphabetically to guarantee absolute graph determinism.

---

## 3. Edge Reference and Omission Policies

*   **StableId Policy**: Edges in both `dependencies` and `dependents` arrays must reference only the unique hash `stableId` (such as `req_arch`), never sequential sequence display IDs (such as `REQ-001`). This ensures graph robustness against requirement list order changes.
*   **Dependency Omission Policy**: If an expected prerequisite kind (e.g. `databaseModel`) is absent from the input requirement list, the builder **does not fail**. It simply skips drawing that edge, and continues mapping other kinds.

---

## 4. Error Taxonomy

*   `TASK_GRAPH_BUILD_FAILED`: Returned if baseline parameters fail model creation checks, or if getDependenciesForKind throws rules errors.
*   `TASK_GRAPH_INVALID_REQUIREMENT`: Returned if individual items lack required identity parameters.
*   `TASK_GRAPH_INTERNAL_ERROR`: Catch-all wrapper for unexpected execution errors.

---

## 5. Future Cycle Detection Ownership

This builder module owns **only** graph edge mapping. It does not perform path tracing, cycle detection, or acyclic validation:
*   **Task Pack 3C Scope**: Draw edges and dependents pointers based on allowed kind-to-kind rules.
*   **Task Pack 3D Scope (Next)**: A standalone TaskGraph Validator module will run cycle checks (DFS/tarjan path verification) to validate that the builder's output is indeed a true Directed Acyclic Graph (DAG) before allowing task execution.
