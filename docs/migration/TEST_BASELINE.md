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

## 4. Minimum Regression Suite for Future Task Packs

Before checking off any future Task Pack as `DONE`:
1. Run `node tests/run_tests.js` inside the `backend` directory.
2. Confirm: **102 passed, 0 failed**.
3. If new methods/modules are created by a Task Pack, add corresponding test assertions inside `backend/tests/run_tests.js` or in a new file, and ensure they run automatically within the test suite runner.
