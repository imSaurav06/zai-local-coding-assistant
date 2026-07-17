# Phase 9E — Recovery

This document defines the architecture, design principles, invariants, and specifications of the **Recovery Layer** introduced in Phase 9E.

---

## 1. Purpose
The Recovery Layer manages state transitions and recovery decisions when failures or exceptions occur during task execution. It acts as a pure decision engine: it classifies errors, computes retry counts and exponential backoff delays, checks checkpoint consistency against active state, and indicates whether to save, restore, or abort. The Recovery Layer does not implement actual execution, networking, VFS modifications, or MongoDB/persistence queries.

---

## 2. Architecture and Data Flow
The Recovery controller receives frozen inputs and returns a new deeply frozen recovery decision:

```
[ExecutionState] ───┐
[Checkpoint]     ───┼─► [recoverExecution()] ──► [Recovery Decision]
[PipelineResult] ───┘
```

---

## 3. Failure Classification Categories
The Recovery Layer classifies failures into standard categories:
*   `RECOVERABLE`: Task failures that are safe to retry.
*   `NON_RECOVERABLE`: Critical context or structural failures that must abort immediately.
*   `VERIFICATION_FAILURE`: Unit test, compile, or syntax errors returned from verification gates.
*   `PROVIDER_FAILURE` / `WORKER_FAILURE`: Model timeouts, provider service outages, or file generation errors.
*   `CHECKPOINT_FAILURE`: Mismatches between active execution state and checkpoint state, indicating state corruption.

---

## 4. Retry and Checkpoint Policies

### 4.1 Retry Decisions
Retries are calculated using exponential backoff:
*   `delay = 1000ms * 2^(retryCount - 1)`.
*   Retries are permitted only if `currentRetryCount < maxRetries` (default: `3`).
*   Once retry limit is reached, decision transitions to `"ABORT"`.

### 4.2 Checkpoint Actions
*   `SAVE`: Recommended on successful pipeline runs.
*   `RESTORE`: Recommended on recoverable retry triggers or checkpoint state mismatches.
*   `NONE`: Recommended on non-recoverable abort states.

---

## 5. Public API
*   `createRecovery()`: Instantiates the recovery manager controller.
*   `recoverExecution(executionState, checkpoint, pipelineResult, options)`: Evaluates parameters and returns a deeply frozen recovery decision. Throws structured errors on invalid inputs.
*   `validateRecovery(result)`: Structural validator verifying recovery output result fields.

---

## 6. Error Model
*   `RECOVERY_INVALID_INPUT`: The execution state or input options are null, mutable, or invalid.
*   `RECOVERY_INVALID_CHECKPOINT`: The checkpoint is null, mutable, or invalid.
*   `RECOVERY_INVALID_PIPELINE`: The pipeline result is null, mutable, or invalid.
*   `RECOVERY_UNSUPPORTED_FAILURE`: The pipeline error code is unrecognized or unsupported.
