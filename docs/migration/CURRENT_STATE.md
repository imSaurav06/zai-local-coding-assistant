# Current Codebase State Record

This document records the exact state of the Z.ai Local Coding Assistant codebase prior to starting target architecture modifications.

---

## 1. Git State and Safety Summary
- **Current Branch**: `main` (Verified by `git status`).
- **Working Tree State**: Clean.
- **Uncommitted Changes**: None. (The hardening changes and adaptive timeouts work were committed in b80fae565f49838c1647c70a3c0ee0baba0f0d71 and bbb13e2b8acd7f8a3b5459510f12dda79ede5680).
- **Untracked Files**:
  - `.vscode/`
  - `discovery_report.md`
  - `discovery_report.pdf`
  - `docs/` (Created in Phase 0).

---

## 2. Evidence-Based System Overview

### 2.1 Current E2E Generation Flow
- **Trace**:
  1. Frontend sends prompt to `POST /api/project/analyze` ([projectRoutes.js:L7](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/routes/projectRoutes.js#L7)) which maps to `projectController.analyze` ([projectController.js:L13](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/controllers/projectController.js#L13)).
  2. `projectService.analyzeRequirements` calls the AI model ([projectService.js:L9](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/projectService.js#L9)) using system prompts detailing a structure JSON specifications schema.
  3. Frontend parses `projectSpec` and opens an SSE connection calling `POST /api/project/generate` ([projectRoutes.js:L8](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/routes/projectRoutes.js#L8)) mapping to `projectController.generate` ([projectController.js:L49](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/controllers/projectController.js#L49)).
  4. Controller triggers `orchestrateGeneration` ([generationOrchestrator.js:L685](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/generationOrchestrator.js#L685)).
  5. The planner resolves stack profiles, scaffold parameters, and dependency wave groups ([generationPlanner.js:L13](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/generationPlanner.js#L13)).
  6. Seeding logic writes configurations locally via `scaffoldRegistry.js`. Source code modules are concurrently written using Waves (max 3 concurrent calls).
  7. Verification checks syntax, relative imports, and dependencies ([validationProfiles.js:L141](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/validationProfiles.js#L141)).
  8. If errors exist, `targetedRepairService.js` repairs files in batches of 3.
  9. Code files are saved as a monolithic document in MongoDB ([Project.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/models/Project.js)) at completion.

### 2.2 Current AI Provider Architecture
- **Adapter Clients**:
  - OpenRouter: Calls `openRouterProvider.sendChatCompletion` ([openRouterProvider.js:L3](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/aiProviders/openRouterProvider.js#L3)) pointing to `google/gemini-2.5-flash` by default.
  - Z.ai: Calls `zaiProvider.sendChatCompletion` ([zaiProvider.js:L3](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/aiProviders/zaiProvider.js#L3)) pointing to `glm-4.5-flash` by default.
- **Failover Logic**: Handled in `providerRouter.js` and `aiGenerationExecutor.js`. If the primary client encounters network/rate limits/timeout errors, it automatically falls back to Z.ai.
- **Retry Backoff**: Standard exponential retry with random jitter up to 3 retries ([aiGenerationExecutor.js:L20](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/aiGenerationExecutor.js#L20)).
- **Timeout Bound**: Adaptive timeout clamped between 120s and 240s ([aiGenerationExecutor.js:L9](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/aiGenerationExecutor.js#L9)).

### 2.3 Current Requirement Representation
- Prompts are translated into structural JSON spec lists containing pages, database models, environment vars, and build/run scripts.
- Schema verification is handled via simple defaults assignment in [projectService.js:L146](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/projectService.js#L146).
- There are no requirement IDs or traceability indices.

### 2.4 Current Planner and Concurrency Model
- Planning uses heuristic check gates mapping stacks to wave groups ([generationPlanner.js:L237](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/generationPlanner.js#L237)).
- Concurrency uses `Promise.allSettled` waves capped at a maximum execution count of 3 concurrent workers.
- There are no checkpoint logs or resume features.

### 2.5 Current File Operations
- All code files are stored in-memory during generation as `{ name, content }` objects in a simple array.
- Preview sandboxes extract and write these files non-atomically using standard `fs.writeFileSync` in `temp_previews/`.

### 2.6 Current Verification and Repair System
- Babel parser verifies JavaScript syntax. Imports validator maps relative module dependencies.
- Targeted repairs batch up to 3 files together. Code changes are rejected if a repair breaks syntax. Maximum attempts: 2.

### 2.7 Current Persistence and Recovery
- Project history and files are stored in MongoDB under monolithic Project and History schemas. State is completely in-memory during generation and cannot be resumed on crash.

### 2.8 Current Stack Support
- Enforced using profiles inside `stackProfiles.js` (mern, react-vite, nextjs, express, fastapi, vanilla, dynamic). Contains seeder configs, validations, build scripts, and ports.

---

## 3. Discovered Technical Debt and Known Failures
- **God Modules**: `generationOrchestrator.js` and `previewService.js` contain high coupling, mixing processes controls with file writing and validation loops.
- **Circular References**: High risk of circular reference between `previewService.js` (imports orchestrator helper `applyContentGuard`) and projectController (which imports both).
- **Scalability Barriers**: Sending all contracts and complete files in prompt contexts will hit token budget ceilings for LMS-scale projects.
- **Mongoose Deprecations**: Obsolescent mongoose connect options (`useNewUrlParser` and `useUnifiedTopology`) must be scrubbed out of generated backend code.

---

## 4. Current Migration Status

- **Phase 0**  ✅ Complete
- **Phase 1**  ✅ Complete
- **Phase 2**  ✅ Complete
- **Phase 3**  ✅ Complete
- **Phase 4**  ✅ Complete
- **Phase 5**  ✅ Complete
- **Phase 6**  ✅ Complete
- **Phase 7**  ✅ Complete
- **Phase 8**  ✅ Complete
- **Phase 9**  ✅ Complete
- **Phase 10A** ✅ Durable Checkpoint Foundation
- **Phase 10B** ✅ AI Provider Gateway
- **Phase 10C** ✅ Repair Engine
- **Phase 11A-1** ✅ Execution Runtime Integration (Feature Flag Foundation)
- **Phase 11A-2** ✅ Execution Runtime Integration (Execution Runtime Adapter)
- **Phase 11A-3** ✅ Execution Runtime Integration (Controller Integration)
- **Phase 11A-4A** ✅ Execution Runtime Integration (Checkpoint Bridge)
- **Phase 11A-4B** ✅ Execution Runtime Integration (Mongo Persistence Bridge)
- **Phase 11A-5** ✅ Execution Runtime Integration (Verification + Repair Integration)
- **Phase 11A-6** ✅ Execution Runtime Integration (Parallel Worker Pool Foundation)
- **Phase 11A-7** ✅ Execution Runtime Integration (Shadow Runtime & Parity Validation)
- **Phase 11A-8** ✅ Execution Runtime Integration (Production Readiness Audit)

### Current Regression Status
- **Total Tests**: 823 / 823 tests passing
- **Failed**: 0 failed

### Current AI Provider Configuration
* **Primary Provider**: Z.ai
  * **Model**: GLM-5.2
  * **Priority**: 1
* **Fallback Provider**: OpenRouter
  * **Priority**: 2

### Current System State
The modular architecture for:
* Durable Checkpoints
* AI Provider Gateway
* Repair Engine
* Verification + Repair Integration
* Worker Pool Foundation
* Shadow Runtime & Parity Validation
has been completed successfully. The project is now ready to begin Phase 11B Parallel Scheduling Integration.



