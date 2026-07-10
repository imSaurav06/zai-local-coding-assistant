# Phase 1B — Canonical ProjectSpec Schema and Validation Contract

This document freezes the technical design and contract boundaries of the canonical, persistence-independent `ProjectSpec` domain model and its validation engine.

---

## 1. Executive Summary
As part of the Z.ai Local Coding Assistant migration, a canonical domain model for project specifications (`ProjectSpec`) has been introduced. This domain contract defines a strict JSON validation boundary separating unstable requirement-analysis outputs from internal downstream consumers (planners, scaffolders, virtual file systems, generators, and verification loops).

A custom, dependency-free internal validation module has been implemented and verified via 28 new unit tests (bringing the regression baseline to 143/143 tests passing).

---

## 2. Scope / Non-Goals
*   **Goals**:
    *   Define a strict, versioned domain contract for `ProjectSpec` matching Phase 1A baseline requirements.
    *   Implement an offline, dependency-free validator that rejects invalid candidates.
    *   Expose a secure API that returns structured, sorted validation errors.
    *   Return a deeply frozen, reference-isolated copy of successfully validated candidates.
*   **Non-Goals**:
    *   No automatic defaulting or normalization of invalid payloads (deferred to Task Pack 1C's compiler/adapter).
    *   No integration of this validator into existing routes or services (deferred to Task Pack 1E).
    *   No persistent schema changes to MongoDB or mongoose models (persistence remains decoupled).

---

## 3. Dependency Decision
*   **Design Decision**: A custom, lightweight, in-house validator has been chosen over third-party libraries (Ajv, Zod, Joi).
*   **Rationale**:
    *   Avoids dependency bloat and locks file drift.
    *   Allows deterministic and highly specific validation error taxonomies without regex-message parsing.
    *   Performs completely offline with zero package startup overhead.
    *   Satisfies the exact needs of this migration phase without unused feature surface area.

---

## 4. Module Location and Public API
The new domain module is isolated within a dedicated subfolder:
*   [index.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/core/projectSpec/index.js) (Public Boundary Entry)
*   [projectSpecSchema.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/core/projectSpec/projectSpecSchema.js) (Declaration of allowed properties and versions)
*   [projectSpecErrors.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/core/projectSpec/projectSpecErrors.js) (Error taxonomy definitions)
*   [projectSpecValidator.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/core/projectSpec/projectSpecValidator.js) (Structural validation engine)

### Public API Exposes:
*   `PROJECT_SPEC_SCHEMA_VERSION` (String `"1.0"`)
*   `validateProjectSpec(candidate)` (Function returning validation results)
*   `errorCodes` (Object dictionary mapping unique error string identifiers)

---

## 5. Schema Versioning Policy
*   **Design Decision**: Only schemaVersion `"1.0"` is supported.
*   **Behavior**: Any missing or mismatching version (e.g. `"2.0"`) is explicitly rejected by the validator.
*   **Future Scope**: Version migration/negotiation code is deferred; if the spec format shifts, a separate adapter schema version must be registered.

---

## 6. Canonical ProjectSpec Contract
Successfully validated canonical specs represent the single source of truth for downstream code generation. The contract guarantees type safety, lack of duplicate values, syntactic path conventions, and deep immutability.

---

## 7. Field-by-Field Schema Definition
The specification is composed of exactly 19 fields:

1.  **schemaVersion** (String): Must match `"1.0"`.
2.  **projectName** (String): Safe project identifier.
3.  **projectType** (String): High-level description.
4.  **frontend** (String): Selected UI framework/libraries.
5.  **backend** (String): Selected server runtime.
6.  **database** (String): Database platform.
7.  **authentication** (String): Auth profile name.
8.  **designRequirements** (String): Style parameters.
9.  **pagesAndRoutes** (Array): Configured views/routes.
10. **components** (Array): Custom modular components.
11. **backendApis** (Array): Endpoint list.
12. **databaseModels** (Array): Mongoose/SQL structures.
13. **integrations** (Array of Strings): Third-party systems.
14. **importantDependencies** (Array of Strings): NPM libraries.
15. **environmentVariables** (Array of Strings): System config variables.
16. **architectureConstraints** (Array of Strings): Sandboxing guidelines.
17. **runBuildRequirements** (Object): Action scripts.
18. **deploymentRequirements** (String): Production hosts.
19. **assumptions** (Array of Strings): Logic guidelines.

---

## 8. Nested Object Contracts
*   **pagesAndRoutes** item:
    *   `path` (String): Must start with `/`.
    *   `name` (String): Alphanumeric page name.
    *   `description` (String): Page functionality.
*   **components** item:
    *   `name` (String): Unique React/Vite/HTML component label.
    *   `purpose` (String): Component outline.
*   **backendApis** item:
    *   `method` (String): Valid HTTP method (GET, POST, etc.).
    *   `path` (String): Path pattern (must start with `/`).
    *   `purpose` (String): Controller functionality description.
*   **databaseModels** item:
    *   `name` (String): Model name.
    *   `fields` (Array of Strings): Field rules/descriptions.
*   **runBuildRequirements** object:
    *   `runScript` (String): Dev execution script.
    *   `buildScript` (String): Output bundle compile script (can be empty string `""` but not null/missing).

---

## 9. Required vs Optional Policy
*   **Design Decision**: All 19 fields are strictly required at the schema validation boundary.
*   **Reasoning**: This prevents downstream components from encountering unhandled property access runtime errors.
*   **Compatibility Note**: Payloads missing fields are normalized with fallbacks in Task Pack 1C before hitting this boundary.

---

## 10. Strictness Policy
*   **Design Decision**: Strict validation is enforced. Any structural deviation, incorrect type, empty string, or whitespace-only value results in validation failure.

---

## 11. Additional Property Policy
*   **Design Decision**: Strict check. Any unknown top-level key or nested property (e.g., adding `foo` to components items) triggers an `UNKNOWN_FIELD` error.

---

## 12. Duplicate Detection Policy
*   Duplicate page routes (`pagesAndRoutes[].path`) are rejected case-insensitively.
*   Duplicate backend APIs (`method` + `path` combination) are rejected case-insensitively.
*   Duplicate component names are rejected case-insensitively.
*   Duplicate database model names are rejected case-insensitively.

---

## 13. String Validation Policy
*   All string values (except `runBuildRequirements.buildScript`) must be non-empty and contain non-whitespace characters.

---

## 14. HTTP Method / Route Validation Policy
*   `backendApis[].method` must match one of: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`, `HEAD`.
*   Both API and Page paths must start with `/`.

---

## 15. Environment Variable Validation Policy
*   Environment variables must match a valid alphanumeric identifier regex: `/^[a-zA-Z_][a-zA-Z0-9_]*$/`.

---

## 16. Dependency Name Validation Policy
*   Dependency package names must match valid NPM rules (alphanumeric, dashes, dots, underscores, optionally matching scoped format `@scope/package`): `/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i`.

---

## 17. Validation Result Contract
Calling `validateProjectSpec(candidate)` returns:
*   **Success**:
    ```javascript
    {
      success: true,
      value: validatedImmutableProjectSpec,
      errors: []
    }
    ```
*   **Failure**:
    ```javascript
    {
      success: false,
      value: null,
      errors: [
        {
          code: "PROJECTSPEC_...",
          path: "...",
          message: "...",
          keyword: "..."
        }
      ]
    }
    ```

---

## 18. Error Taxonomy
The following unique string error codes are defined in `projectSpecErrors.js`:
*   `MISSING_VERSION`: Missing schemaVersion.
*   `INVALID_VERSION`: Unsupported schemaVersion value.
*   `MISSING_REQUIRED`: Top-level or nested key is missing.
*   `INVALID_TYPE`: Value does not match expected primitive/element type.
*   `INVALID_VALUE`: String or parameter contains an empty or whitespace-only value.
*   `DUPLICATE_ROUTE`: Duplicate page path route detected.
*   `DUPLICATE_API`: Duplicate API endpoint detected.
*   `DUPLICATE_COMPONENT`: Duplicate component name detected.
*   `DUPLICATE_MODEL`: Duplicate database model name detected.
*   `INVALID_HTTP_METHOD`: Invalid HTTP verb used in backend APIs.
*   `INVALID_API_PATH`: API endpoint path does not start with `/`.
*   `INVALID_PAGE_ROUTE`: Page path does not start with `/`.
*   `INVALID_ENV_VAR`: Environment variable violates alphanumeric naming rules.
*   `INVALID_DEP_NAME`: Dependency package name violates NPM guidelines.
*   `UNKNOWN_FIELD`: Additional property found in candidate spec or sub-elements.

---

## 19. Deterministic Error Ordering
*   **Design Decision**: Errors are sorted lexicographically by `path`, and then by `code`. This guarantees consistent output formats regardless of candidate object key ordering.

---

## 20. Immutability Strategy
*   **Design Decision**: Deep-freezing copies.
*   **Mechanism**: The validator recursively locks all objects and arrays using `Object.freeze` to make properties read-only.

---

## 21. Input/Output Reference Isolation
*   **Design Decision**: The input object is deep-cloned via `JSON.parse(JSON.stringify(candidate))` before executing freeze operations.
*   **Result**: Validated specs share zero mutable pointer references with caller-supplied candidates.

---

## 22. Tests Added
35 new tests added under the `Canonical ProjectSpec Schema & Validation (Phase 1B)` suite in [backend/tests/run_tests.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/tests/run_tests.js):
*   Tests 1-4 cover validity, reference isolation, and deep immutability under modifications.
*   Tests 5-25 assert individual error constraints, regex mappings, duplicates, and strictness behaviors.
*   Tests 26-28 assert error arrays, deterministic sorting, and result consistency.
*   Tests 29-32 assert arbitrary JS input boundary safety, sparse array catches, prototype-pollution defenses, and safe catch-all execution wrappers for throwing properties.
*   Tests 33-35 check route/API paths rules, dependency npm scope package rules, and env var format restrictions.

---

## 23. Regression Results
*   **VERIFIED FACT**: Baseline test execution passes successfully:
    *   **Total tests**: 150 passed.
    *   **Failed**: 0.
    *   **Skipped**: 0.

---

## 24. Compatibility Constraints Preserved from Phase 1A
*   **Wording Correction**: Phase 1B preserves the characterized semantic field surface and establishes the canonical validation contract. Legacy payload compatibility will be implemented/proven by Task Pack 1C compiler normalization and Task Pack 1E pipeline integration.
*   The validator checks the exact 18 fields characterized in Phase 1A, plus `schemaVersion`.
*   Expected structures of sub-arrays (`pagesAndRoutes`, `components`, `backendApis`, `databaseModels`, `runBuildRequirements`) mirror the downstream schema assumptions.

---

## 25. Deliberately Deferred Responsibilities
*   **DEFERRED**: Automatic compiler mapping and payload fallback defaulting are deferred to Task Pack 1C.
*   **DEFERRED**: Requirement IDs generation is deferred to Task Pack 1D.

---

## 26. Known Risks / Open Questions
*   No version migration adapter is yet designed. If schemaVersion `"2.0"` is introduced later, a formal migration adapter layer will be necessary.

---

## 27. Exact Input Boundary for Task Pack 1C
Task Pack 1C must receive the raw requirements payload analyzer output, execute compatibility sanitization and fallback mapping, attach `schemaVersion: "1.0"`, and output a candidate spec matching the canonical ProjectSpec contract.
