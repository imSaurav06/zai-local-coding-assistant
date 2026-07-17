# Phase 9B — Worker Lifecycle

This document defines the architecture, design principles, invariants, and specifications of the **Worker Lifecycle** module introduced in Phase 9B.

---

## 1. Purpose
The Worker Lifecycle module establishes the canonical representation of execution slots (workers) that manage concurrent or sequential task processing inside the generic `ExecutionOrchestrator`. It models individual worker instances, registers active worker pools, and validates worker state transitions. Like other core modules, all functions are pure, stateless, and deeply frozen.

---

## 2. Architecture and Data Flow
Workers represent abstract execution contexts. The Worker Registry stores and updates workers functionally:

```
[createWorker()] ──► [validateWorker()] ──► [WorkerRegistry.create()] ──► [Frozen Registry]
```

---

## 3. Data Structure Specifications

### 3.1 Worker Model
A worker represents exactly one task execution container. It contains:
*   `workerId`: String. Unique, non-empty identifier.
*   `status`: String status enum. Initialized to `"IDLE"`.
*   `currentTask`: String task ID (`stableId`) of the currently running task, or `null`.
*   `completedTasks`: Array of strings containing stable IDs of completed tasks.
*   `metadata`: Configuration parameters:
    *   `createdBy`: `"ExecutionOrchestrator"`.
    *   `version`: `"1.0"`.

### 3.2 Worker Statuses
Worker statuses represent the execution lifecycle:
*   `IDLE`: Worker is available to be assigned a task.
*   `ASSIGNED`: Worker has been assigned a task but execution has not yet started.
*   `RUNNING`: Worker is actively processing the task.
*   `FAILED`: Task processing failed.
*   `COMPLETED`: Task completed successfully.

### 3.3 Worker Registry
The registry is an immutable worker list manager. It provides:
*   `workers`: Map of registered frozen workers, keyed by ID.
*   `create(workerId)`: Instantiates a new worker and returns a new frozen registry copy containing it. Returns failure if `workerId` is invalid or a duplicate.
*   `lookup(workerId)`: Finds a worker by ID or returns `null`.
*   `exists(workerId)`: Checks existence of a worker by ID.

---

## 4. Public API
*   `createWorker(workerId)`: Creates a worker object.
*   `createWorkerRegistry(workers?)`: Creates a worker registry.
*   `validateWorker(worker)`: Audits fields, status enum, required structures, and freezing.

---

## 5. Error Model
Immutable worker error codes:
*   `WORKER_INVALID_INPUT`: Invalid inputs, fields, or metadata.
*   `WORKER_INVALID_STATUS`: The status is not one of the approved enums.
*   `WORKER_DUPLICATE_ID`: Worker ID already registered.
*   `WORKER_MUTABLE_INPUT`: Worker or its subcomponents are not deeply frozen.

---

## 6. Design Invariants
1.  **Strict Immutability**: All models, registries, and validators are deeply frozen. Any modifications return a new copy.
2.  **Stateless & Deterministic**: Functions contain no side effects, asynchronous methods, randomness, or environment dependencies.
