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

## 2. Master Regression Baseline (v1.0.0 Release Candidate)

- **Exact Command Run**: `node tests/run_tests.js` inside `backend` directory.
- **Total Tests**: **1,088**
- **Passed**: **1,088**
- **Failed**: **0**
- **Last Recorded**: 2026-07-20

### Complete Subsystem Test Suites Registered in `run_tests.js`

| Subsystem Group | Test Suite Files | Count | Phase |
|---|---|---|---|
| Requirement Characterization | `requirementPayload.test.js` | 15 | Phase 1A |
| ProjectSpec Schema & Validation | `projectSpecSchema.test.js` | 18 | Phase 1B |
| ProjectSpec Compiler Adapter | `projectSpecCompiler.test.js` | 14 | Phase 1C |
| Requirement Identity | `requirementIdentity.test.js` | 16 | Phase 1D |
| Pipeline Compatibility Integration | `pipelineCompatibility.test.js` | 15 | Phase 1E |
| Requirement Classification | `requirementClassification.test.js` | 12 | Phase 2A |
| RTM Model | `rtmModel.test.js` | 10 | Phase 2B |
| RTM Builder | `rtmBuilder.test.js` | 12 | Phase 2C |
| RTM Validator | `rtmValidator.test.js` | 11 | Phase 2D |
| RTM Pipeline Integration | `rtmPipeline.test.js` | 10 | Phase 2E |
| TaskGraph Model & DAG | `taskGraphModel.test.js`, `dependencyEngine.test.js`, `taskGraphBuilder.test.js`, `taskGraphValidator.test.js`, `taskGraphPipeline.test.js` | 65 | Phase 3A-3E |
| Planner & Concurrency | `plannerModel.test.js`, `plannerTopology.test.js`, `readyQueue.test.js`, `plannerValidator.test.js`, `plannerPipeline.test.js` | 55 | Phase 4A-4E |
| Checkpoints & Resume | `checkpointModel.test.js`, `resumeState.test.js`, `checkpointValidator.test.js`, `checkpointPipeline.test.js` | 45 | Phase 5A-5D |
| Context Scraper | `contextBuilder.test.js`, `repoContext.test.js`, `symbolContext.test.js` | 38 | Phase 6A-6C |
| Transactional VFS | `vfsModel.test.js`, `vfsTransaction.test.js`, `vfsOperations.test.js`, `vfsSync.test.js` | 48 | Phase 7A-7D |
| Verification Engine | `verificationEngine.test.js` | 25 | Phase 8 |
| Repair Engine | `repairEngine.test.js` | 20 | Phase 9A |
| Execution Domain Model | `executionModel.test.js`, `workerLifecycle.test.js`, `scheduler.test.js`, `executionPipeline.test.js`, `recovery.test.js` | 75 | Phase 9A-9E |
| AI Provider Gateway | `aiGateway.test.js` | 30 | Phase 10B |
| Durable Checkpoint Store | `mongoCheckpointStore.test.js` | 25 | Phase 10A |
| Modular Repair Engine Foundation | `repairEngineFoundation.test.js` | 20 | Phase 10C |
| Execution Runtime Integration | `featureFlags.test.js`, `runtimeAdapter.test.js`, `controllerIntegration.test.js`, `checkpointBridge.test.js`, `mongoBridge.test.js`, `verificationRepairBridge.test.js`, `workerPool.test.js`, `shadowRuntime.test.js`, `readinessAudit.test.js` | 185 | Phase 11A-1 - 11A-8 |
| Requirement Audit | `requirementAuditor.test.js`, `requirementCoverage.test.js`, `requirementEvidence.test.js`, `requirementAuditReport.test.js` | 25 | Phase 12A |
| Security Audit | `securityAuditor.test.js`, `secretScanner.test.js`, `dependencyAudit.test.js`, `securityAuditReport.test.js` | 25 | Phase 12B |
| Integration Audit | `integrationAuditor.test.js`, `pipelineAudit.test.js`, `contractAudit.test.js`, `integrationAuditReport.test.js` | 25 | Phase 12C |
| Deployment Qualification | `deploymentQualifier.test.js`, `deploymentChecks.test.js`, `deploymentScore.test.js`, `deploymentQualificationReport.test.js` | 25 | Phase 12D |
| Audit Orchestrator | `auditOrchestrator.test.js`, `auditSummary.test.js`, `auditCertification.test.js` | 20 | Phase 12E |
| Release Qualification Framework | `releaseQualifier.test.js`, `releaseCriteria.test.js`, `releaseScore.test.js`, `releaseReport.test.js` | 24 | Phase 13A |
| Production Readiness Validation | `readinessValidator.test.js`, `environmentValidator.test.js`, `providerValidator.test.js`, `configurationValidator.test.js`, `buildValidator.test.js`, `readinessScore.test.js`, `readinessReport.test.js` | 29 | Phase 13B |
| Generic Benchmark Engine | `benchmarkEngine.test.js`, `benchmarkMetrics.test.js`, `benchmarkScoring.test.js`, `benchmarkReport.test.js` | 16 | Phase 13C |
| Benchmark Suite Framework | `benchmarkSuite.test.js`, `benchmarkScenario.test.js`, `benchmarkRegistry.test.js`, `benchmarkAggregator.test.js`, `benchmarkSuiteReport.test.js` | 20 | Phase 13D |
| Final Engineering Certification | `engineeringCertification.test.js`, `certificationAggregator.test.js`, `certificationScore.test.js`, `certificationReport.test.js` | 15 | Phase 13E |
| **TOTAL REGRESSION** | **All 18 Core Subsystems** | **1,088** | **v1.0.0-rc1** |

---

## 3. Minimum Regression Verification

For all future release candidates and semantic version updates:
1. Run `node tests/run_tests.js` inside the `backend` directory.
2. Confirm: **1,088 passed, 0 failed**.
