# Phase 3D — TaskGraph Validator

This document outlines the design, validation rules, cycle detection algorithms, and API definitions of the TaskGraph Validator established in Task Pack 3D.

---

## 1. Executive Summary

*   **Objective**: Build a standalone TaskGraph Validator that performs structural validation, immutability tests, edge symmetry checks, and cyclic dependency analysis.
*   **Result**: Created `backend/core/taskGraph/taskGraphValidator.js` exporting `validateTaskGraph(graph)`.
*   **Decoupling**: Graph repair, scheduling, task execution, and pipeline integration loops are out of scope.
*   **Tests**: Appended **8 new unit tests** covering valid graph acceptance, frozen requirements, duplicate node IDs, self-loops, broken references, asymmetric edges, and cyclic dependencies.
*   **Status**: Regression baseline at **336 assertions passing**.

---

## 2. Validation Checks

The validator executes the following verification stages sequentially:
1.  **Root Structure**: Ensures `graph` is a non-null object containing `graphVersion`, `metadata`, and a `nodes` array.
2.  **Immutability**: Verifies that the graph root, the nodes list, and all node arrays (`dependencies` and `dependents`) are deeply frozen (`Object.isFrozen` is true).
3.  **Definition Integrity**: Verifies that each node contains all required fields (`stableId`, `displayId`, `kind`, `semanticKey`, `status`, `dependencies`, `dependents`, `metadata`, and `payload`).
4.  **Uniqueness**: Enforces that both `stableId` and `displayId` are strictly unique across all nodes.
5.  **Self-Dependency**: Rejects nodes that contain their own ID inside `dependencies` or `dependents`.
6.  **Broken References**: Ensures all IDs inside `dependencies` and `dependents` lists refer to existing node `stableId` keys in the graph.
7.  **Edge Symmetry**: Confirms that if node A depends on node B, then B must contain A inside its `dependents` list (and vice versa).

---

## 3. Cycle Detection Strategy

A deterministic Depth-First Search (DFS) is used to detect cycles in the dependency graph:
*   **Tracking States**:
    *   `visiting`: Set containing nodes currently present in the active DFS recursion stack.
    *   `visited`: Set containing nodes whose dependencies have been fully processed.
*   **Back-edge Check**: If the DFS traversal encounters a node already present in the `visiting` set, a back-edge (cycle) is detected.
*   **Deterministic Order**: Starts DFS traversals sequentially based on sorted node `stableId` arrays to guarantee deterministic behavior across disconnected graph components.

---

## 4. Error Taxonomy

All failed validations return `success: false` with structured objects in the `errors` array:
*   `TASK_GRAPH_INVALID_GRAPH`: Root level syntax or immutability validation failures.
*   `TASK_GRAPH_INVALID_NODE`: Node property schema definition or missing field failures.
*   `TASK_GRAPH_DUPLICATE_NODE`: Duplicate stableId or displayId keys across nodes.
*   `TASK_GRAPH_BROKEN_REFERENCE`: Dependency or dependent pointers pointing to non-existent nodes.
*   `TASK_GRAPH_SELF_DEPENDENCY`: Self-dependency or self-dependent loops.
*   `TASK_GRAPH_ASYMMETRIC_EDGE`: Edge mismatch between dependencies and dependents lists.
*   `TASK_GRAPH_CYCLE`: Circular dependency cycles detected during DFS.
*   `TASK_GRAPH_INTERNAL_ERROR`: Catch-all wrapper for unexpected validation exceptions.

---

## 5. Future Planner Contract

The validator establishes a strict contract for downstream generation planners:
*   **Builder Responsibility**: Node construction and edge creation.
*   **Validator Responsibility**: Verifying correct, cycle-free topological order.
*   **Planner Responsibility**: Downstream planning modules (Phase 4) trust validated graphs only, running topological sort and task execution loops without verifying graph integrity.
