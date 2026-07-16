# Phase 1E — Existing Pipeline Compatibility Integration Report

This document records the technical design, compatibility matrices, orchestration boundaries, test results, and safety qualifications of the production integration of canonical `ProjectSpec` and `Requirement Identity` layers into the existing generation pipeline.

---

## 1. Executive Summary
*   **VERIFIED FACT**: Integrated the canonical `ProjectSpec` compiler and `Requirement Identity` derivation engine into the production generation pipeline at the start of `orchestrateGeneration` in `generationOrchestrator.js`.
*   **VERIFIED FACT**: Verified that the canonical compilation and identity layers run exactly once per generation run.
*   **VERIFIED FACT**: Compiler failure prevents identity derivation and all generation side effects.
*   **VERIFIED FACT**: Identity failure prevents all generation side effects.
*   **VERIFIED FACT**: Wrote **21 pipeline integration unit tests** covering compile/identity exactly-once, failure propagation, persistence shape compatibility, API response shape non-leak, multi-profile stack selection, consumer audit, and rollback boundary evidence.
*   **VERIFIED FACT**: The entire regression test baseline remains **100% green** with **272/272 tests passing**.
*   **DESIGN DECISION**: The public analyzer endpoint `/api/project/analyze` continues to return the legacy requirement payload, preventing breakage of existing callers. The cutover compile/identity steps run safely at the generation stage boundary.

---

## 2. Scope
*   Includes exact-once compilation and validation of the incoming spec at the entry point of the generation run.
*   Includes exact-once requirement identity derivation immediately following successful compilation.
*   Enforces error propagation on compile/identity failures, aborting the run before any generation or filesystem side effects take place.
*   Deep-clones the canonical spec at the Mongoose database persistence boundary to prevent casting/mutation errors on frozen objects.
*   Passes the canonical spec verbatim to all planners, contract builders, scaffold builders, and generators.

---

## 3. Non-Goals
*   **DEFERRED**: No implementation of RTM mapping inside worker prompts.
*   **DEFERRED**: No database schema migrations or additions.
*   **DEFERRED**: No modifications to the public controller API response shape.

---

## 4. Starting Baseline
*   **VERIFIED FACT**: The starting baseline count was **251 passed**, 0 failed, 0 skipped (post-Phase 1D).

---

## 5. Exact Production Call Graph (with Repository Evidence)

```
  Client POST /api/project/analyze
    → projectRoutes.js → projectController.analyze()
      → projectService.analyzeRequirements({ prompt })
        → providerRouter → LLM → parse legacy JSON payload
      ← returns legacy payload to client (UNCHANGED in 1E)

  Client POST /api/project/generate
    → projectRoutes.js → projectController.generate()
      → orchestrateGeneration({ originalPrompt, projectSpec }, ...)  [L738]
        │
        ├─ [1E BOUNDARY] prepareCanonicalProjectSpec(projectSpec)     [L740]
        │   ├─ compileProjectSpec(legacyPayload)                     [L39]
        │   │   └─ returns { success, value: frozenCanonicalSpec }
        │   ├─ deriveRequirementIdentities(canonicalSpec)             [L48]
        │   │   └─ returns { success, requirements: [...] }
        │   └─ returns { projectSpec: frozenCanonicalSpec, requirementIdentity }
        │
        ├─ planGeneration(projectSpec)                                [L764]
        ├─ buildSharedContracts(projectSpec)                          [L765]
        ├─ buildProjectManifest(originalPrompt, projectSpec)          [L766]
        ├─ generateScaffoldFiles(plan.scaffoldAdapter, projectSpec)   [L810]
        ├─ aiExecutor.generateUnitCode(unit, projectSpec, ...)       [L834]
        ├─ generateRichReadme(projectSpec, finalFiles)                [L900,L975]
        ├─ validateProjectFiles(finalFiles, projectSpec)              [L915,L952]
        ├─ repairAffectedFiles(errors, files, projectSpec, ...)      [L934]
        ├─ generateRunInstructions(projectSpec, finalFiles)           [L982]
        ├─ generateRichPlan(projectSpec)                              [L985]
        └─ returns { files, runInstructions, summary, model,
                     projectSpec, requirementIdentity }               [L1025-L1032]
      │
      ├─ adaptProjectSpecForPersistence(data.projectSpec)            [L112]
      │   └─ deep-clones + strips schemaVersion
      ├─ Project.create({ ..., projectSpec: dbSpec })                [L115]
      ├─ History.create({ ..., projectSpec: dbSpec })                [L129]
      └─ progressEmitter.end({ success, projectId, ..., model })    [L144]
          └─ NO projectSpec, NO requirementIdentity, NO schemaVersion
```

**Source evidence**: [generationOrchestrator.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/generationOrchestrator.js) lines 1–60, 738–742, 1025–1032. [projectController.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/controllers/projectController.js) lines 9–20, 101–154.

---

## 6. Consumer Compatibility Matrix

For each downstream consumer of `projectSpec` in the codebase:

| Consumer / Module | Entry Function | Fields Read | Mutates Input | Stores Input | Serializes Input | Frozen Input Safe | Canonical spec Compatible | Adapter Required | Required Action in 1E |
|---|---|---|---|---|---|---|---|---|---|
| `generationPlanner` | `planGeneration` | `frontend`, `backend`, `database`, `pagesAndRoutes`, `components`, `databaseModels`, `integrations` | No | No | No | Yes | Yes | No | Pass compiled spec verbatim |
| `contractBuilder` | `buildSharedContracts`, `buildProjectManifest` | `projectName`, `projectType`, `frontend`, `backend`, `database`, `authentication`, `pagesAndRoutes`, `components`, `backendApis`, `databaseModels`, `importantDependencies`, `environmentVariables` | No | No | Yes | Yes | Yes | No | Pass compiled spec verbatim |
| `stackProfiles` / `scaffoldRegistry` | `generateScaffoldFiles`, `getFolderStructure`, `getScaffoldFiles` | `projectName`, `frontend`, `backend`, `database`, `pagesAndRoutes`, `components`, `databaseModels` | No | No | Yes | Yes | Yes | No | Pass compiled spec verbatim |
| `validationProfiles` | `validateProjectFiles` | `frontend`, `backend`, `database` | No | No | No | Yes | Yes | No | Pass compiled spec verbatim |
| `targetedRepairService`| `repairAffectedFiles`, `repairBatch` | `projectName` | No | No | Yes | Yes | Yes | No | Pass compiled spec verbatim |
| `projectController` | `generate` | `projectName`, `projectType` | No (read only) | Yes (MongoDB) | Yes (to JSON) | No (Mongoose casting attempts mutations) | Yes (after deep cloning) | Yes | Deep clone `projectSpec` at DB persistence boundary |

---

## 7. Selected Integration Boundary
*   **DESIGN DECISION**: The boundary was selected at the entry of `orchestrateGeneration` in [generationOrchestrator.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/generationOrchestrator.js#L738) via the helper function `prepareCanonicalProjectSpec(projectSpec)` at [line 20](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/generationOrchestrator.js#L20).

---

## 8. Why This Boundary Is the Narrowest Safe Cutover
*   **DESIGN DECISION**: Placing the boundary at `orchestrateGeneration` ensures that both E2E scripts (`test_e2e_generation.js`) and API controllers (`projectController.generate`) automatically run compilation and identity derivation. It guarantees that no plans are made, no folders are scaffolded, and no network calls are initiated if compilation/validation fails.

---

## 9. compileProjectSpec() Exactly-Once Proof
*   **VERIFIED FACT**: `compileProjectSpec` is invoked exactly once per `prepareCanonicalProjectSpec()` call for a fresh legacy payload. No downstream consumer re-invokes it.
*   **TEST EVIDENCE**: Test #7 "Exactly-once execution tracking in prepareCanonicalProjectSpec" intercepts `_testHooks.compileProjectSpec` and asserts `compileCount === 1`.
*   **TEST EVIDENCE**: Test #6 "Already-canonical bypass check" proves that re-passing a frozen canonical spec skips compilation entirely (`compileCount === 0`).

---

## 10. deriveRequirementIdentities() Exactly-Once Proof
*   **VERIFIED FACT**: `deriveRequirementIdentities` is invoked exactly once per `prepareCanonicalProjectSpec()` call regardless of input path (fresh or already-canonical).
*   **TEST EVIDENCE**: Test #7 asserts `deriveCount === 1` on fresh payload.
*   **TEST EVIDENCE**: Test #6 asserts `deriveCount === 1` on already-frozen canonical input.

---

## 11. Compiler Failure Prevents Identity Derivation and All Generation Side Effects
*   **VERIFIED FACT**: When compilation fails, `deriveRequirementIdentities` is never called.
*   **TEST EVIDENCE**: Test #8 "Compiler failure causes zero identity derivation calls and halts" — `compileCount === 1`, `deriveCount === 0`.
*   **TEST EVIDENCE**: Test #17 "Error propagation: compile failure thrown through orchestrateGeneration boundary" — `orchestrateGeneration` throws with `err.code === "PROJECT_PREPARATION_COMPILE_FAILED"` before any planning, scaffolding, or AI calls.

---

## 12. Identity Failure Prevents All Generation Side Effects
*   **VERIFIED FACT**: When identity derivation fails (after successful compilation), the preparation throws immediately.
*   **TEST EVIDENCE**: Test #11 "Identity failure prevents all generation side effects" — `compileCount === 1`, `deriveCount === 1`, error code `PROJECT_PREPARATION_IDENTITY_FAILED`.
*   **TEST EVIDENCE**: Test #18 "Error propagation: identity failure thrown through orchestrateGeneration boundary" — `orchestrateGeneration` throws with `err.code === "PROJECT_PREPARATION_IDENTITY_FAILED"` before any generation begins.

---

## 13. analyzeRequirements() Observable Contract Unchanged
*   **VERIFIED FACT**: `projectService.analyzeRequirements` remains completely unchanged. Its source does not reference `compileProjectSpec`, `deriveRequirementIdentities`, or `prepareCanonicalProjectSpec`.
*   **TEST EVIDENCE**: Test #12 "analyzeRequirements observable contract remains unchanged" reads the source file and asserts absence of all 1E identifiers.

---

## 14. Requirement Identity Sidecar Policy
*   **DESIGN DECISION**: The derived identities are held as a separate `requirementIdentity` sidecar object returned by both `prepareCanonicalProjectSpec` and `orchestrateGeneration`. They are not embedded or injected into the `ProjectSpec` itself.
*   **TEST EVIDENCE**: Test #19 "Requirement Identity sidecar is retained in orchestrateGeneration return value" — verifies `requirementIdentity` is present in the return and the source code includes it in the return shape.

---

## 15. Pre-1E vs Post-1E Persistence Shape Comparison

### Pre-1E `Project.create` call (from `git show HEAD:backend/controllers/projectController.js`):
```javascript
const dbProject = await Project.create({
    userId: req.user._id,
    projectName: projectSpec.projectName || "Project Scaffold",
    projectType: projectSpec.projectType || "Web Application",
    summary: data.summary,
    files: data.files,
    runInstructions: data.runInstructions,
    model: data.model,
    originalPrompt,
    projectSpec,              // ← raw legacy payload (unfrozen, no schemaVersion)
    generationStatus: "success"
});
```

### Post-1E `Project.create` call:
```javascript
const dbSpec = adaptProjectSpecForPersistence(data.projectSpec);

const dbProject = await Project.create({
    userId: req.user._id,
    projectName: data.projectSpec.projectName || "Project Scaffold",
    projectType: data.projectSpec.projectType || "Web Application",
    summary: data.summary,
    files: data.files,
    runInstructions: data.runInstructions,
    model: data.model,
    originalPrompt,
    projectSpec: dbSpec,      // ← deep-cloned, schemaVersion stripped
    generationStatus: "success"
});
```

**Key differences**: `projectSpec` field now receives a deep clone with `schemaVersion` stripped. `projectName` and `projectType` are read from `data.projectSpec` (canonical) instead of the raw `req.body.projectSpec`, but the actual values are identical because compilation preserves them.

*   **TEST EVIDENCE**: Test #13 "Pre-1E vs Post-1E Project.create persistence shape equivalence" — verifies `schemaVersion === undefined`, all 18 semantic fields present, and `requirementIdentity/stableId/displayId/duplicates === undefined`.
*   **TEST EVIDENCE**: Test #14 "Pre-1E vs Post-1E History.create persistence shape equivalence" — same checks for History documents.

---

## 16. Fields NOT Newly Persisted

| Field | Persisted Pre-1E | Persisted Post-1E | Evidence |
|---|---|---|---|
| `schemaVersion` | No | No | `adaptProjectSpecForPersistence` explicitly deletes it. Test #13 asserts `undefined`. |
| `requirementIdentity` | No | No | Only in orchestrator return; not passed to `Project.create`. Test #13 asserts `undefined`. |
| `stableId` | No | No | Not a top-level ProjectSpec field. Test #13 asserts `undefined`. |
| `displayId` | No | No | Not a top-level ProjectSpec field. Test #13 asserts `undefined`. |
| `duplicates` | No | No | Not a top-level ProjectSpec field. Test #13 asserts `undefined`. |

---

## 17. Public API Response Shape Unchanged
*   **VERIFIED FACT**: The `progressEmitter.end()` response contains: `success`, `projectId`, `projectName`, `summary`, `files`, `runInstructions`, `result`, `model`, `generationStatus`. It does **not** include `projectSpec`, `requirementIdentity`, or `schemaVersion`.
*   **TEST EVIDENCE**: Test #15 "Public API response shape does not leak internal sidecar data" — parses the source and asserts none of the internal fields appear in the `progressEmitter.end()` call.

---

## 18. Stack Selection Compatibility

### Profiles Verified Through Compiled Canonical Boundary

| Legacy Payload Stack | Compiled Canonical Stack | Detected Profile | Test Evidence |
|---|---|---|---|
| React + Express + MongoDB | Same (preserved) | `mern` | Test #5, Test #16 |
| React (Vite) + None + None | Same (preserved) | `react-vite` | Test #16 |
| Next.js 14 + None + None | Same (preserved) | `nextjs` | Test #16 |

*   **TEST EVIDENCE**: Test #5 single-profile, Test #16 multi-profile.

---

## 19. Downstream Consumer Audit (Frozen Input Compatibility)
*   **VERIFIED FACT**: All production consumers accept the deeply-frozen canonical spec without throwing.
*   **TEST EVIDENCE**: Test #10 "Immutable actual consumer audit checks compatibility" — calls `planGeneration`, `buildSharedContracts`, `buildProjectManifest`, `detectProfile`, `generateScaffoldFiles`, and `validateProjectFiles` on frozen compiled spec.

---

## 20. Failure Propagation Policy
*   If compilation fails: throws `PROJECT_PREPARATION_COMPILE_FAILED` with structured `errors[]` array. No scaffold, no AI calls, no DB saves.
*   If identity derivation fails: throws `PROJECT_PREPARATION_IDENTITY_FAILED` with structured `errors[]` array. No scaffold, no AI calls, no DB saves.
*   Both error codes propagate through `orchestrateGeneration` to the controller catch block.

---

## 21. Generation Side-Effect Boundary
*   **VERIFIED FACT**: The preparation boundary executes before any files are written, temp folders are created, or providers are called, ensuring clean failures on malformed specifications.

---

## 22. Integration Error Taxonomy
*   `PROJECT_PREPARATION_COMPILE_FAILED`: Compilation or Validation failed on the input spec.
*   `PROJECT_PREPARATION_IDENTITY_FAILED`: Requirement identity derivation failed (e.g., hash collision).

---

## 23. Rollback Strategy
*   **DESIGN DECISION**: If rollback is required, reverting the Task Pack 1E changes to `generationOrchestrator.js` and `projectController.js` cleanly removes all compilation and identity-derivation steps, restoring the orchestrator to its raw legacy spec execution path.
*   **1E touch surface**: Only 2 production files modified (`generationOrchestrator.js`, `projectController.js`) + test file.
*   **Orchestrator changes**: 2 new `require()` imports, 1 `_testHooks` constant, 1 `prepareCanonicalProjectSpec()` function, 3-line call site at top of `orchestrateGeneration`, 2 new fields in return object.
*   **Controller changes**: 1 `adaptProjectSpecForPersistence()` function, 1 `dbSpec` variable, and 3 line changes in the `Project.create`/`History.create` calls.
*   **TEST EVIDENCE**: Test #20 "Rollback boundary" structurally validates the presence of all 1E additions as localized and revertible.

---

## 24. Immutable ProjectSpec Propagation
*   **VERIFIED FACT**: The compiled spec is recursively frozen. Since downstream consumers are read-only, it propagates safely through all services without modification.

---

## 25. Tests Added
*   Added **21 integration tests** in the `Pipeline Integration (Phase 1E)` suite within [backend/tests/run_tests.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/tests/run_tests.js#L3760).

### Test Index
| # | Test Name | Objective Covered |
|---|---|---|
| 1 | prepareCanonicalProjectSpec compiles, validates and derives identities | Basic integration |
| 2 | prepareCanonicalProjectSpec throws PROJECT_PREPARATION_COMPILE_FAILED on invalid spec | Compile failure |
| 3 | Canonical ProjectSpec and Requirement Identity are deeply immutable and isolated | Immutability |
| 4 | Generation planner and contract builder accept canonical ProjectSpec verbatim | Consumer compatibility |
| 5 | Stack selection quirks are preserved on compiled canonical boundary | Stack compat |
| 6 | Already-canonical bypass check avoids double compilation but derives identities | Exactly-once (bypass) |
| 7 | Exactly-once execution tracking in prepareCanonicalProjectSpec | Exactly-once (fresh) |
| 8 | Compiler failure causes zero identity derivation calls and halts | Failure sequencing |
| 9 | Persistence adapter strips schemaVersion and deep-clones ProjectSpec | Persistence compat |
| 10 | Immutable actual consumer audit checks compatibility | Consumer frozen audit |
| 11 | Identity failure prevents all generation side effects | Identity failure halt |
| 12 | analyzeRequirements observable contract remains unchanged | Analyze API preserved |
| 13 | Pre-1E vs Post-1E Project.create persistence shape equivalence | Persistence shape |
| 14 | Pre-1E vs Post-1E History.create persistence shape equivalence | Persistence shape |
| 15 | Public API response shape does not leak internal sidecar data | API response safety |
| 16 | Stack selection across multiple profiles through compiled canonical boundary | Multi-profile stack |
| 17 | Error propagation: compile failure thrown through orchestrateGeneration boundary | Error propagation |
| 18 | Error propagation: identity failure thrown through orchestrateGeneration boundary | Error propagation |
| 19 | Requirement Identity sidecar is retained in orchestrateGeneration return value | Sidecar retention |
| 20 | Rollback boundary: reverting 1E changes removes all new imports and functions | Rollback evidence |
| 21 | adaptProjectSpecForPersistence handles null/undefined gracefully | Edge case |

---

## 26. Targeted Test Results
*   **VERIFIED FACT**: All 21 Phase 1E integration tests pass successfully.

---

## 27. Full Regression Results
*   **Total tests**: 272 passed.
*   **Failed**: 0.
*   **Skipped**: 0.

---

## 28. Compatibility Preserved from Phase 1A
*   Verified that the legacy requirements output values remain fully compatible.

---

## 29. Canonical Contract Preserved from Phase 1B
*   Revalidation strictly adheres to Phase 1B schema requirements.

---

## 30. Compiler Semantics Preserved from Phase 1C
*   Compiler normalization mappings and default fallbacks function identically.

---

## 31. Requirement Identity Semantics Preserved from Phase 1D
*   Deterministic stable hashes and zero-padded display IDs are computed identically.

---

## 32. Deliberately Deferred Responsibilities
*   **DEFERRED**: RTM tracking inside worker prompts, contract enforcement audits, and checkpoint resumes are deferred to future phases.

---

## 33. Known Risks / Open Questions
*   None.

---

## 34. Exact Production Boundary Available to Phase 2
*   **Production Boundary**: `prepareCanonicalProjectSpec(legacySpec)` yields `{ projectSpec, requirementIdentity }`, providing the validated canonical configuration AST and the stable requirements identity map ready for RTM integrations in Phase 2.
