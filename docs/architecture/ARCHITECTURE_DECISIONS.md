# Architecture Decision Log (ADR)

This log documents the key architectural decisions for the Z.ai Application Builder migration.

---

## ADR-001: Incremental Migration instead of Big-Bang Rewrite
*   **Context**: The repository contains active, verified generation, validation, repair, and preview logic. A big-bang rewrite poses high regression risks and context window management bloat.
*   **Decision**: Run modular refactoring in sequential phases. Introduce adapters and interface boundaries, wrapping existing code.
*   **Current Status**: ACCEPTED (Active Phase: Phase 0).
*   **Reason**: Minimizes implementation risk and maintains backward compatibility.
*   **Consequences**: The system must maintain dual-mode support during migration.
*   **Migration Dependencies**: None.
*   **Open Questions**: None.

---

## ADR-002: ProjectSpec as Canonical Source of Truth
*   **Context**: Spec parameters are passed directly from prompts to scaffold templates or are heuristically matched. This creates fragility during schema modifications.
*   **Decision**: Introduce `ProjectSpec` as the single canonical schema.
*   **Current Status**: PROPOSED.
*   **Reason**: Centralizes validation checks and structure declarations.
*   **Consequences**: Code generation and template adapters must consume strictly typed ProjectSpec models.
*   **Migration Dependencies**: ADR-001.
*   **Open Questions**: What JSON schema parser is most performant for Node?

---

## ADR-003: Stable Requirement IDs and RTM-lite
*   **Context**: Prompt guidelines get dropped or altered by AI workers during code generation or targeted repair iterations.
*   **Decision**: Assign unique, stable IDs to requirements (e.g. `REQ-001`) during compile, and track them via an RTM-lite index mapped to files and verification logs.
*   **Current Status**: PROPOSED.
*   **Reason**: Enforces strict coverage and ensures generated code fulfills original prompt criteria.
*   **Consequences**: High tracking complexity.
*   **Migration Dependencies**: ADR-002.
*   **Open Questions**: How should prompt changes be synced back to the RTM?

---

## ADR-004: Contract-First Generation
*   **Context**: AI workers generate folder files in a single wave, which leads to import conflicts, file collisions, or missing interfaces.
*   **Decision**: Pre-compile API endpoints, DB schemas, variables, and structure contracts first, validating path integrity before generating file contents.
*   **Current Status**: PROPOSED.
*   **Reason**: Minimizes local relative import resolution errors.
*   **Consequences**: Increases initial latency before generation starts.
*   **Migration Dependencies**: ADR-002.
*   **Open Questions**: None.

---

## ADR-005: Dependency-Aware TaskGraph / DAG Execution
*   **Context**: File chunking uses hardcoded wave lists. This does not scale to arbitrary frameworks.
*   **Decision**: Parse dependencies between contracts and construct a directed acyclic graph (DAG) scheduler.
*   **Current Status**: PROPOSED.
*   **Reason**: Enables topological sorting and allows safe parallel execution of independent tasks.
*   **Consequences**: Requires a robust in-memory task scheduler.
*   **Migration Dependencies**: ADR-004.
*   **Open Questions**: None.

---

## ADR-006: Bounded Parallelism
*   **Context**: Multi-tier generations (like MERN) can issue many concurrent requests, risking API rate limits (HTTP 429).
*   **Decision**: Cap concurrent task execution workers strictly to a configuration limit (default 3 concurrent workers).
*   **Current Status**: ACCEPTED.
*   **Reason**: Avoids exhausting provider limits.
*   **Consequences**: Limits absolute speed, but ensures generation stability.
*   **Migration Dependencies**: ADR-005.
*   **Open Questions**: Can the thread cap be dynamically altered on local user systems?

---

## ADR-007: Repository-Aware Task-Specific ContextBuilder
*   **Context**: Dumping the complete file tree in every prompt call consumes high token counts and degrades performance.
*   **Decision**: Pass only the files and contract endpoints that are directly imported by the current task target (sub-graph context).
*   **Current Status**: PROPOSED.
*   **Reason**: Reduces context sizes and avoids token-limit exhaustion.
*   **Consequences**: Requires import-graph parsing on the virtual file system.
*   **Migration Dependencies**: ADR-005.
*   **Open Questions**: How to handle circular dependencies inside context?

---

## ADR-008: Structured / Transactional File Operations
*   **Context**: Writing directly to sandbox directories is non-atomic and lacks rollback capabilities.
*   **Decision**: Build a transactional Virtual File System (VFS). Changes are staged, verified, and committed.
*   **Current Status**: PROPOSED.
*   **Reason**: Prevents corrupting files on disk during intermediate repair loops.
*   **Consequences**: Increases complexity of file operations.
*   **Migration Dependencies**: None.
*   **Open Questions**: None.

---

## ADR-009: Incremental Verification Gates
*   **Context**: Validation is run only at the very end of all chunk generations, leading to late discovery of deep errors.
*   **Decision**: Run syntax and import validation immediately after a task finishes code generation, before moving to dependent tasks.
*   **Current Status**: PROPOSED.
*   **Reason**: Catches compilation and syntax failures early.
*   **Consequences**: Adds minor validation overhead.
*   **Migration Dependencies**: ADR-008.
*   **Open Questions**: None.

---

## ADR-010: Bounded Targeted Repair
*   **Context**: Repair loop batches multiple files together, which can cause repair oscillation.
*   **Decision**: Implement a targeted repair engine that isolates single-file repairs and rolls back to a previous valid state if a repair fails.
*   **Current Status**: PROPOSED.
*   **Reason**: Ensures stability of the repair phase.
*   **Consequences**: Increases AI calls for isolated repairs but prevents code degradation.
*   **Migration Dependencies**: ADR-009.
*   **Open Questions**: What is the optimal number of lines of context history to pass for repairs?

---

## ADR-011: Durable Checkpoints and Resumable Execution
*   **Context**: State is currently kept in-memory. Process crashes require restarting from scratch.
*   **Decision**: Save intermediate VFS states and Task statuses to MongoDB after every topological wave completes.
*   **Current Status**: PROPOSED.
*   **Reason**: Saves time and API costs on failure.
*   **Consequences**: Introduces MongoDB database writes during the generation flow.
*   **Migration Dependencies**: ADR-008.
*   **Open Questions**: How do we expire stale checkpoints?

---

## ADR-012: StackAdapter Abstraction
*   **Context**: Stack profiles are hardcoded in `stackProfiles.js` and contain complex conditions.
*   **Decision**: Decouple stack logic into pluggable configuration-driven adapters.
*   **Current Status**: PROPOSED.
*   **Reason**: Simplifies adding new frameworks (like Rails or Django) via JSON configurations.
*   **Consequences**: Decoupled framework validation.
*   **Migration Dependencies**: None.
*   **Open Questions**: None.

---

## ADR-013: Evidence-Based Production/Deployment Qualification
*   **Context**: Deployment qualification is based on AI declarations rather than evidence.
*   **Decision**: Enforce that a project can be marked "production-ready" only if build compilation tests, imports audit, and health checks pass successfully.
*   **Current Status**: ACCEPTED.
*   **Reason**: Guarantees runnable and qualified codebases.
*   **Consequences**: Increases required verification times.
*   **Migration Dependencies**: ADR-009.
*   **Open Questions**: Can we integrate automated lighthouse audits?

---

## ADR-014: AIProviderGateway and Task-Aware Provider Routing
*   **Context**: Model retry and failovers are coupled in `aiGenerationExecutor.js` and `providerRouter.js`.
*   **Decision**: Unify calling adapters into a single `AIProviderGateway` class that dynamically adjusts timeouts and token budgets per task type.
*   **Current Status**: PROPOSED.
*   **Reason**: Centralizes rate limit and fallback configurations.
*   **Consequences**: Cleaner provider calling abstraction.
*   **Migration Dependencies**: None.
*   **Open Questions**: None.

---

## ADR-015: Future GLM-5.2 Primary / OpenRouter Fallback Migration
*   **Context**: OpenRouter is primary, Z.ai is fallback. Later, GLM-5.2 is intended to become primary, OpenRouter fallback.
*   **Decision**: Design the provider gateway interfaces to be configuration-driven so that changing primary/fallback involves only environment variables updates without code modifications.
*   **Current Status**: PROPOSED.
*   **Reason**: Decouples code from specific API providers.
*   **Consequences**: Eases model migration path.
*   **Migration Dependencies**: ADR-014.
*   **Open Questions**: None.
