# Phase 9A — Execution Domain Model

This document defines the architecture, design principles, invariants, and specifications of the **Execution Domain Model** introduced in Phase 9A.

---

## 1. Purpose
The Execution Domain Model serves as the single source of truth representing the active runtime execution state for the `ExecutionOrchestrator`. It maps tasks defined in an immutable `TaskGraph` to their respective execution queues and keeps count of execution stats. This model is purely stateless, deterministic, and immutable. It does NOT schedule, dispatch, run, or retry any work.

---

## 2. Architecture and Data Flow
The Execution Domain Model operates as a pure data transition boundary between the dependency planning stage (`TaskGraph`) and future scheduler engines:

```
[Immutable TaskGraph] ────► [createExecutionState()] ────► [Frozen ExecutionState]
```

---

## 3. Data Structure Specifications

### 3.1 Metadata
Represents global execution status, IDs, and initial timestamps.
*   `status`: Initialized to `"READY"`. Enums supported: `READY`, `RUNNING`, `PAUSED`, `FAILED`, `COMPLETED`.
*   `executionId`: Initialized to `null`.
*   `createdAt`: Initialized to `null`.

### 3.2 Queues
Tracks task stable IDs through their lifecycle stages:
*   `pending`: Stable IDs of tasks that are ready to run or waiting on prerequisites. Initialized to contain all tasks in the TaskGraph, sorted ascendingly by task `displayId` to maintain perfect deterministic execution readiness.
*   `running`: Empty array `[]`.
*   `completed`: Empty array `[]`.
*   `failed`: Empty array `[]`.

### 3.3 Statistics
Aggregates summary counts of tasks within each queue state:
*   `totalTasks`: Total number of tasks present in the TaskGraph.
*   `pending`: Total count of tasks currently in the `pending` state (matches `totalTasks` at initialization).
*   `running`: `0`.
*   `completed`: `0`.
*   `failed`: `0`.

---

## 4. Public API

### `createExecutionState(taskGraph)`
*   **Description**: Translates a frozen `TaskGraph` structure into an initial execution state.
*   **Input**: A validated, deeply frozen `TaskGraph` object.
*   **Returns**:
    ```javascript
    {
        success: Boolean,
        executionState: Object|null,
        errors: Array
    }
    ```

---

## 5. Error Model
Immutable execution error codes are defined in `executionErrors.js`:
*   `EXECUTION_INVALID_INPUT`: The provided input is not a non-null object, or is an array/function.
*   `EXECUTION_MUTABLE_INPUT`: The input TaskGraph (or its internal nodes array) is not deeply frozen.
*   `EXECUTION_INVALID_TASK_GRAPH`: The TaskGraph is malformed structurally or failed topological validation.
*   `EXECUTION_DUPLICATE_TASK`: Multiple task nodes contain duplicate `stableId` or `displayId` entries.

---

## 6. Design Invariants and Guarantees

### 6.1 Immutability
Every successful or failed return object is recursively frozen via a robust `deepFreeze` function. Downstream consumers cannot mutate the execution state or validation errors list.

### 6.2 Determinism
The initial `pending` queue sorting relies strictly on alphanumeric code-point sorting of `displayId`. No timestamps, UUID generation, random numbers, network I/O, or asynchronous calls are executed. The exact same TaskGraph input will always produce a byte-for-byte identical output.
