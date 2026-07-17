# Phase 9C — Scheduler

This document defines the architecture, design principles, invariants, and specifications of the **Task Scheduler Decision Layer** introduced in Phase 9C.

---

## 1. Purpose
The Scheduler serves as the pure decision-making intelligence for the `ExecutionOrchestrator`. It evaluates task readiness based on dependencies, counts available IDLE workers, enforces parallelism concurrency limits (ADR-006), and maps eligible tasks to available workers. The Scheduler is completely stateless and deterministic: it does not dispatch, execute, retry, or modify any actual tasks or state.

---

## 2. Architecture and Data Flow
The Scheduler is a pure function taking the current states and returning a new immutable scheduling decision:

```
[ExecutionState] ───┐
[WorkerRegistry] ───┼─► [computeSchedule()] ──► [Schedule Decision]
[TaskGraph]      ───┘
```

---

## 3. Core Scheduling Policies

### 3.1 Ready Node Rule
A task is eligible for execution (`READY`) if and only if:
1.  It is in the `pending` queue.
2.  All of its prerequisites (dependencies) in the `TaskGraph` are present in the `completed` queue.
Pending tasks with any incomplete or running dependencies must remain in the `blocked` category.

### 3.2 Worker Status Rules
Only workers with `IDLE` status are eligible to receive new task assignments. Workers in any other state (`ASSIGNED`, `RUNNING`, `FAILED`, `COMPLETED`) are active and must not receive new tasks.

### 3.3 Concurrency Control (ADR-006 Parallelism Limit)
The total number of concurrent workers (workers with `ASSIGNED` or `RUNNING` status) must not exceed the specified limit (strictly capped at `3` concurrent workers). Available assignment slots are computed dynamically:
`availableSlots = max(0, 3 - activeWorkersCount)`.

---

## 4. Data Structures

### 4.1 Schedule Decision Output
```javascript
{
    readyTasks: [/* stableIds */],
    assignments: [
        { workerId: "w-1", taskId: "task-1" }
    ],
    blockedTasks: [/* stableIds */],
    metadata: {
        availableWorkers: Number,
        blockedCount: Number,
        readyCount: Number
    }
}
```

---

## 5. Public API
*   `createScheduler()`: Instantiates the scheduler controller.
*   `computeSchedule(executionState, workerRegistry, taskGraph)`: Evaluates inputs and returns a deeply frozen schedule decision. Throws structured errors on invalid inputs.
*   `validateSchedule(schedule)`: Verifies that the returned schedule object complies structurally with required schema constraints.

---

## 6. Error Model
*   `SCHEDULER_INVALID_INPUT`: The input TaskGraph is null, mutable, or malformed.
*   `SCHEDULER_INVALID_STATE`: The input ExecutionState is null, mutable, or malformed.
*   `SCHEDULER_INVALID_WORKER`: The input WorkerRegistry is null, mutable, or malformed.
*   `SCHEDULER_DEPENDENCY_ERROR`: A task ID in the state queues or dependency lists does not exist in the TaskGraph.

---

## 7. Determinism and Immutability
To guarantee perfect determinism:
*   Ready tasks are sorted alphabetically by `displayId` ascending.
*   Idle workers are sorted alphabetically by `workerId` ascending.
*   All computed outputs are recursively frozen using `deepFreeze`.
*   Inputs are never mutated.
Same inputs will always yield byte-for-byte identical output.
