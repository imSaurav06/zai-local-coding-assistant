# Testing Baseline Record

This document lists the test suites discovered, classifies their network and billing risks, and tracks the execution metrics for regression testing.

---

## 1. Test Discovery and Classification

We scanned the repository and identified the following testing files. They are categorized based on their external service calls and billing risks:

| Test File Path | Execution Command | Classification | Rationale |
|---|---|---|---|
| [backend/tests/run_tests.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/tests/run_tests.js) | `node tests/run_tests.js` | **SAFE_OFFLINE** | Uses fully mocked AI providers and in-memory mock variables. Safe for local continuous integration. |
| [backend/test_adaptive_engine.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/test_adaptive_engine.js) | `node test_adaptive_engine.js` | **SAFE_OFFLINE** | Performs unit testing on code scaffolders and planning planners. No real provider API calls. |
| [backend/test_analyze_regression.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/test_analyze_regression.js) | `node test_analyze_regression.js` | **SAFE_OFFLINE** | Local mock test assertions for specifications parsing. |
| [backend/test_auth_integration.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/test_auth_integration.js) | `node test_auth_integration.js` | **SAFE_BUT_REQUIRES_EXTERNAL_SERVICES** | Requires local running instance of MongoDB database. |
| [backend/test_providers.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/test_providers.js) | `node test_providers.js` | **SAFE_BUT_REQUIRES_EXTERNAL_SERVICES** | Calls real OpenRouter/Z.ai API endpoints. Consumes tokens. |
| [backend/test_raw_ai_call.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/test_raw_ai_call.js) | `node test_raw_ai_call.js` | **SAFE_BUT_REQUIRES_EXTERNAL_SERVICES** | Directly triggers real AI completions. Consumes tokens. |
| [backend/verify_tests.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/verify_tests.js) | `node verify_tests.js` | **EXPENSIVE_E2E** | Spawns project analysis and full-code generation requests. Requires local server + real AI tokens. |
| [backend/test_e2e_generation.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/test_e2e_generation.js) | `node test_e2e_generation.js` | **EXPENSIVE_E2E** | Spawns complete E2E generation workloads. |
| [backend/e2e_successful_generation.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/e2e_successful_generation.js) | `node e2e_successful_generation.js` | **EXPENSIVE_E2E** | Spawns complete E2E generation workloads. |
| [backend/run_portfolio_e2e.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/run_portfolio_e2e.js) | `node run_portfolio_e2e.js` | **EXPENSIVE_E2E** | Spawns portfolio site generation and runs local npm dev server preview tests. |

---

## 2. Phase 0 Executed Test Results

We executed the `SAFE_OFFLINE` test suite to check for any regressions before starting.

- **Exact Command Run**: `node tests/run_tests.js` inside `backend` directory.
- **Passed**: 102
- **Failed**: 0
- **Skipped**: 0
- **Duration**: ~3.2 seconds
- **Environments Limitations**: Offline. Local host environment.
- **Historical 97 Deterministic Tests Status**: All 97 original tests passed successfully.
- **Hardening Regression Status**: 5 new tests successfully executed, validating the following fixes:
  - Preserves user custom build script configurations when writing package files.
  - Keeps adaptive timeout ranges strictly bound between 120s and 240s.
  - Confirms that preview servers start up correctly even under delayed ports allocation.
  - Captures child process exits prior to readiness flagging and returns failure.
  - Enforces readiness timing budgets to transition preview handles to FAILED.

---

## 3. Testing Gaps & Critical Untested Modules

The following core modules are not covered by any active local mock unit tests:
- `backend/services/aiService.js` (No unit test).
- `backend/services/progressEmitter.js` (No test coverage).
- `backend/services/aiProviders/openRouterProvider.js` (No direct unit test, relies on external integration run).
- `backend/services/aiProviders/zaiProvider.js` (No direct unit test, relies on external integration run).

---

## 4. Current Regression Suite Baseline (Phase 12 Complete)

- **Exact Command Run**: `node tests/run_tests.js` inside `backend` directory.
- **Total Tests**: 984
- **Passed**: 984
- **Failed**: 0
- **Last Recorded**: 2026-07-19

### Test Suites Registered in `run_tests.js`

| Suite Group | Description | Phase |
|---|---|---|
| Requirement Characterization | Spec parsing and normalization | Phase 1A |
| ProjectSpec Schema & Validation | Canonical spec schema validation | Phase 1B |
| ProjectSpec Compiler Adapter | AI output → canonical ProjectSpec | Phase 1C |
| Requirement Identity | Stable ID derivation | Phase 1D |
| Pipeline Compatibility Integration | End-to-end spec pipeline | Phase 1E |
| Requirement Classification | RTM-lite classification | Phase 2A |
| RTM Model | Requirement tracking model | Phase 2B |
| RTM Builder | RTM construction | Phase 2C |
| RTM Validator | RTM validation | Phase 2D |
| RTM Pipeline Integration | RTM E2E pipeline | Phase 2E |
| TaskGraph Model | DAG task model | Phase 3A |
| Dependency Rule Engine | Task dependency rules | Phase 3B |
| TaskGraph Builder | Graph construction | Phase 3C |
| TaskGraph Validator | Graph validation | Phase 3D |
| TaskGraph Pipeline Integration | Graph E2E pipeline | Phase 3E |
| Planner Model | Scheduling model | Phase 4A |
| Planner Topology | Topological sort | Phase 4B |
| Ready Queue | Worker queue management | Phase 4C |
| Planner Validator | Planner correctness | Phase 4D |
| Planner Pipeline Integration | Planner E2E pipeline | Phase 4E |
| Checkpoint Model | Checkpoint domain model | Phase 5A |
| Resume State | Resume state initialization | Phase 5B |
| Checkpoint Validator | Checkpoint validation | Phase 5C |
| Checkpoint Pipeline Integration | Checkpoint E2E pipeline | Phase 5D |
| Context Builder | Import subgraph scraping | Phase 6A |
| Repository Context | Repo-level context building | Phase 6B |
| Symbol Context | Symbol-level context building | Phase 6C |
| VFS Model | Virtual file system model | Phase 7A |
| VFS Transaction | Transactional VFS operations | Phase 7B |
| VFS Operations | VFS CRUD operations | Phase 7C |
| VFS Sync | VFS sync to disk | Phase 7D |
| Verification Engine | Syntax and import checking | Phase 8 |
| Repair Engine | Isolated file repair | Phase 9A |
| Execution Domain Model | Execution state model | Phase 9A |
| Worker Lifecycle | Worker creation and registry | Phase 9B |
| Scheduler Decision Layer | Topological scheduling | Phase 9C |
| Execution Pipeline Coordinator | Pipeline orchestration | Phase 9D |
| Recovery Layer | Failure recovery and backoff | Phase 9E |
| AI Provider Gateway | Provider routing and failover | Phase 10B |
| Checkpoint Foundation | Durable checkpoint store | Phase 10A |
| Repair Engine Foundation | Modular repair engine | Phase 10C |
| Feature Flag Foundation | Runtime configuration flags | Phase 11A-1 |
| Execution Runtime Adapter | Modular runtime adapter | Phase 11A-2 |
| Controller Integration | Runtime controller bridge | Phase 11A-3 |
| Checkpoint Bridge | Durability bridge | Phase 11A-4A |
| Mongo Persistence Bridge | MongoDB persistence bridge | Phase 11A-4B |
| Verification + Repair Integration | V+R bridge integration | Phase 11A-5 |
| Worker Pool Foundation | Parallel worker pool | Phase 11A-6 |
| Shadow Runtime & Parity | Shadow execution validation | Phase 11A-7 |
| **Requirement Audit** | **RTM coverage and evidence collection** | **Phase 12A** |
| **Security Audit** | **Secret scanning and dependency vulnerability** | **Phase 12B** |
| **Integration Audit** | **Pipeline sequencing and contract compliance** | **Phase 12C** |
| **Deployment Qualification** | **Artifact and gate-based deployment readiness** | **Phase 12D** |
| **Audit Orchestrator** | **Full certification via runFullAudit()** | **Phase 12E** |

---

## 5. Minimum Regression Suite for Future Task Packs

Before checking off any future Task Pack as `DONE`:
1. Run `node tests/run_tests.js` inside the `backend` directory.
2. Confirm: **984 passed, 0 failed**.
3. If new methods/modules are created by a Task Pack, add corresponding test assertions inside `backend/tests/run_tests.js` or in a new file, and ensure they run automatically within the test suite runner.
