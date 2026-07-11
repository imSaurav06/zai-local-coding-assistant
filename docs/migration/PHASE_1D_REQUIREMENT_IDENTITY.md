# Phase 1D — Deterministic Stable Requirement Identity Report

This document records the technical design, contracts, classification matrices, and safety bounds of the persistence-independent Requirement Identity layer implemented in Task Pack 1D.

---

## 1. Executive Summary
*   **VERIFIED FACT**: Introduced a deterministic, offline, and persistence-independent Requirement Identity layer that extracts stable machine identities (`stableId`) and human-readable sequential display IDs (`displayId`) from a validated canonical `ProjectSpec`.
*   **VERIFIED FACT**: Hardened the layer through a dedicated corrective pass to ensure precise duplicate semantics, semanticKey non-authority, sorted database field-sets, and canonical recursive serialization.
*   **VERIFIED FACT**: Implemented comprehensive unit tests (58 unit tests now) covering all validation/verification criteria. The Z.ai backend unit test suite remains 100% green (251/251 tests passed).
*   **DESIGN DECISION**: The identity layer remains entirely isolated from the production generation pipeline (`projectService.js`), which behaves identically to previous phases. RTM tracking is deferred to subsequent phases.

---

## 2. Scope
*   Includes revalidation of the `ProjectSpec` at the public boundary.
*   Traverses and extracts traceable fields in a deterministic order.
*   Serializes extracted requirements canonically to compute stable SHA-256 hashes.
*   Assesses set-like collections (specifically database model fields) to preserve stable IDs across array reordering.
*   Generates zero-padded, sequential human-readable display IDs (`REQ-001` format).
*   Enforces deep-cloning and recursive freeze patterns to ensure total immutability and value isolation.
*   Implements pre-flight safeguards against circular references and throwing getters.

---

## 3. Non-Goals
*   **DEFERRED**: No database integration or Mongo model updates.
*   **DEFERRED**: No integration into `projectService.js` production generation execution.
*   **DEFERRED**: No DAG scheduler or execution planner integration.
*   **DEFERRED**: No implementation of RTM mapping.

---

## 4. Requirement-Bearing Field Classification Matrix

We classified the 19 standard fields of the canonical `ProjectSpec` as follows:

| Kind / Field Path | Source ProjectSpec Field | Payload Shape | Array-Order Semantics | Stable-ID Relevant Fields | SemanticKey Derivation |
|---|---|---|---|---|---|
| `frontend` | `frontend` | `String` | N/A | Entire string | Verbatim string |
| `backend` | `backend` | `String` | N/A | Entire string | Verbatim string |
| `database` | `database` | `String` | N/A | Entire string | Verbatim string |
| `authentication` | `authentication` | `String` | N/A | Entire string | Verbatim string |
| `designRequirements` | `designRequirements` | `String` | N/A | Entire string | Verbatim string |
| `pageRoute` | `pagesAndRoutes[]` | `{ path: String, name: String, description: String }` | N/A | `path`, `name`, `description` | `payload.path` |
| `component` | `components[]` | `{ name: String, purpose: String }` | N/A | `name`, `purpose` | `payload.name` |
| `backendApi` | `backendApis[]` | `{ method: String, path: String, purpose: String }` | N/A | `method`, `path`, `purpose` | `${payload.method} ${payload.path}` |
| `databaseModel` | `databaseModels[]` | `{ name: String, fields: Array<String> }` | Set-like (sorted) | `name`, `fields` (order-independent) | `payload.name` |
| `integration` | `integrations[]` | `String` | N/A | Entire string | Verbatim string |
| `architectureConstraint`| `architectureConstraints[]`| `String` | N/A | Entire string | Verbatim string |
| `deploymentRequirement`| `deploymentRequirements` | `String` | N/A | Entire string | Verbatim string |

---

## 5. Requirement Descriptor Contract

Extracted requirements are structured in a flat list conforming to the following shape:

```json
{
  "stableId": "req_v1_d856f2f...",
  "displayId": "REQ-001",
  "kind": "pageRoute",
  "sourcePath": "pagesAndRoutes[0]",
  "semanticKey": "/",
  "payload": {
    "path": "/",
    "name": "LandingPage",
    "description": "Hero section"
  }
}
```

*   `stableId`: Durable content-derived machine identity.
*   `displayId`: Human-readable sequential ID.
*   `kind`: String representing the field category (e.g. `"frontend"`, `"pageRoute"`).
*   `sourcePath`: Precise pointer to origin in the ProjectSpec (e.g. `"pagesAndRoutes[0]"`).
*   `semanticKey`: Human-readable identifier key (derived internally from payload).
*   `payload`: isolated deep clone of the requirement value.

---

## 6. Identity Policy Version
*   **DESIGN DECISION**: We introduce version namespace `"1.0"`.
*   The policy version is exported as `REQUIREMENT_IDENTITY_VERSION`.
*   All stableId hashes incorporate the policy version to prevent silent reinterpretation in the future.

---

## 7. Stable ID Algorithm
*   Uses Node's built-in `node:crypto` standard module.
*   Uses **SHA-256** content-hashing algorithm.
*   Input content string formula: `${REQUIREMENT_IDENTITY_VERSION}:${kind}:${canonicalPayloadString}`
*   Output format: `req_v1_${hex_digest}`.

---

## 8. Stable ID Format
*   `req_v1_` prefix followed by the full 64-character hex digest of the SHA-256 hash. E.g.: `req_v1_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

---

## 9. Canonical Serialization Guarantee
*   **DESIGN DECISION**: Primitives and objects are stringified using a custom recursive serializer that guarantees lexicographical sorting of all keys in objects via standard `.sort()` (UTF-16 code-point order).
*   Prevents object key insertion-order differences from changing stable IDs.
*   Arrays preserve their original order except for field-specific normalizations (e.g., `databaseModel` fields are pre-sorted).
*   Unsupported types return structured failures.

---

## 10. Array-Order Semantics
*   **DESIGN DECISION**: Inside database model payloads, the `fields` array represents a set-like structure. It is cloned and sorted lexicographically using code-point ordering (`.sort()`) without deduplication prior to serialization.
*   Reordering collections (pages, APIs, components) alters their display order/traversal index but leaves their stableIds completely unchanged since the index/sourcePath is not part of the stableId hash input.

---

## 11. Extraction Granularity
*   Only traceable fields generate requirements. Flat fields generate 1 requirement. Collection arrays generate 1 requirement per child item. Commas/periods/bullets inside free-text fields are not parsed to guarantee absolute determinism.

---

## 12. None / Empty Semantics
*   **VERIFIED FACT**: Sentinel values matching exact `"None"` (case-sensitive) on canonical fields (`frontend`, `backend`, `database`, `authentication`, `designRequirements`, `deploymentRequirements`) are skipped and do not produce requirements.
*   `integrations` and `architectureConstraints` containing literal `"none"` or `"None"` remain requirements (they are not skipped).

---

## 13. Duplicate Semantic Requirement Policy
*   **DESIGN DECISION**: If two items inside the ProjectSpec possess identical semantics (kind + canonical payload), they derive the same `stableId`.
*   Only the first occurrence is appended to the `requirements` array.
*   Subsequent occurrences are cataloged inside the `duplicates` array under a minimal contract:
    ```json
    {
      "stableId": "req_v1_...",
      "displayId": "REQ-001",
      "canonicalSourcePath": "integrations[0]",
      "duplicateSourcePath": "integrations[1]"
    }
    ```
*   Duplicates reuse the canonical `displayId` and do NOT increment the sequence counter or create sequence gaps.

---

## 14. Display ID Policy
*   Sequential counter starting at `REQ-001`, zero-padded to at least 3 digits.
*   For indices &ge; 1000, display IDs continue as `REQ-1000`, `REQ-1001` without truncation.
*   Display IDs do not participate in stableId derivation.

---

## 15. Source Path Policy
*   Precise canonical JSON paths are used (e.g., `frontend`, `pagesAndRoutes[0]`, `backendApis[3]`).
*   Does not participate in `stableId` calculation.

---

## 16. Input Boundary / Revalidation Policy
*   **DESIGN DECISION**: The public boundary revalidates every candidate against the canonical ProjectSpec schema using `validateProjectSpec()`. Invalid candidates are safely rejected with structured validation errors.

---

## 17. Result Contract
*   Calling `deriveRequirementIdentities(spec)` returns:
    *   **Success**:
        ```json
        {
          "success": true,
          "requirements": [...],
          "duplicates": [...],
          "errors": []
        }
        ```
    *   **Failure**:
        ```json
        {
          "success": false,
          "requirements": [],
          "duplicates": [],
          "errors": [
            {
              "code": "REQUIREMENT_ID_...",
              "path": "...",
              "message": "...",
              "keyword": "..."
            }
          ]
        }
        ```

---

## 18. Error Taxonomy
*   `REQUIREMENT_ID_INVALID_INPUT`: Raw candidate is not a plain object.
*   `REQUIREMENT_ID_VALIDATION_FAILED`: Validation boundary checks failed.
*   `REQUIREMENT_ID_UNSUPPORTED_VALUE`: Unsupported property values detected.
*   `REQUIREMENT_ID_COLLISION`: Hash collision detected between two distinct payloads.
*   `REQUIREMENT_ID_INTERNAL_ERROR`: Circular reference or throwing getter encountered.

---

## 19. Collision Detection Policy
*   **DESIGN DECISION**: During execution, we track `stableId` mappings. If two non-equivalent requirements produce the same hash, a structured `REQUIREMENT_ID_COLLISION` error is emitted.
*   **COLLISION-TEST SEAM**: The production public API `deriveRequirementIdentities(projectSpec)` does NOT expose options/hasher parameters. To test collision handling, the module-private helper function `_deriveRequirementIdentitiesInternal(projectSpec, hasher)` is exported from `requirementIdentity.js` and imported directly in the test suite.

---

## 20. Immutability / Reference Isolation
*   Successful output objects and array elements are recursively frozen (`Object.freeze`) and isolated via deep cloning to ensure downstream components cannot mutate them.

---

## 21. Determinism Guarantees
*   Purely stateless and deterministic. Uses no randomness, timestamps, or system env properties.

---

## 22. Tests Added
*   **58 unit tests** added in [backend/tests/run_tests.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/tests/run_tests.js) under the suite `Requirement Identity (Phase 1D)`.
*   Covers revalidation, immutability, deterministic stableIds, displayId padding, duplicates, reordering, semantic changes, semanticKey non-authority, database model sorting, None sentinel behaviors, and property insertion order independence.

---

## 23. Regression Results
*   **VERIFIED FACT**: Baseline test execution passes successfully:
    *   **Total tests**: 251 passed.
    *   **Failed**: 0.
    *   **Skipped**: 0.

---

## 24. Compatibility Boundaries

*   **Phase 1A Characterization**: Extracted requirements map strictly to standard, characterized JSON specification parameters.
*   **Phase 1B Validation**: Revalidation utilizes the Phase 1B offline validation boundary.
*   **Phase 1C Compiler**: Normalization default paths are respected.
*   **Task Pack 1E Output Boundary**: Public function `deriveRequirementIdentities(spec)` is fully available. Output results will be integrated into execution planner maps and tracing modules during Task Pack 1E.

---

## 25. Deliberately Deferred Responsibilities
*   **DEFERRED**: RTM compilation, contract generation validations, DAG scheduler wave planner, and transactional VFS integration are deferred to subsequent phases.

---

## 26. Known Risks / Open Questions
*   None. The boundary is completely offline, lightweight, and offline-validated.
