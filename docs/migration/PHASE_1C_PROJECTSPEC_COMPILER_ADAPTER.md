# Phase 1C — Requirement Analysis &rarr; ProjectSpec Compiler/Adapter Report

This document records the design decisions, normalization policies, and validation boundaries hardened in Task Pack 1C.

---

## 1. Executive Summary
*   **VERIFIED FACT**: Introduced a deterministic, persistence-independent `ProjectSpec` Compiler that converts the characterized legacy requirements payload into a canonical ProjectSpec v1.0 candidate and validates it using the validation boundary established in Phase 1B.
*   **VERIFIED FACT**: The compiler is fully implemented and tested with 43 new unit tests. The regression test suite remains 100% green with 193/193 passed tests.

---

## 2. Scope
*   Includes compatibility-normalization, default mappings, error classifications, and validation delegation for the 18 legacy requirements fields.
*   Guarantees total safety against circular references, throwing getters, sparse arrays, and invalid input types.

---

## 3. Non-Goals
*   No integration of the compiler into production files generation pipeline (`projectService.js` is unchanged).
*   No database/Mongoose schema modifications.
*   No implementation of stable Requirement IDs or TaskGraph / DAG.

---

## 4. Legacy Input Boundary
*   Conforms exactly to the characterized 18-property field surface emitted by `analyzeRequirements()`.

---

## 5. Legacy Compatibility Table

| Field Path | Observed Legacy Types | Observed Defaults | Normalization Rule | Canonical Output Type | Irrecoverable Condition |
|---|---|---|---|---|---|
| `projectName` | `String` | `"MyProject"` | Trimmed. Case preserved. | `String` | Non-string type |
| `projectType` | `String` | `"Web Application"` | Trimmed. Case preserved. Cased "none" &rarr; "None". | `String` | Non-string type |
| `frontend` | `String` | `"None"` | Trimmed. Case preserved. Cased "none" &rarr; "None". | `String` | Non-string type |
| `backend` | `String` | `"None"` | Trimmed. Case preserved. Cased "none" &rarr; "None". | `String` | Non-string type |
| `database` | `String` | `"None"` | Trimmed. Case preserved. Cased "none" &rarr; "None". | `String` | Non-string type |
| `authentication` | `String` | `"None"` | Trimmed. Case preserved. Cased "none" &rarr; "None". | `String` | Non-string type |
| `designRequirements`| `String` | `"None"` | Trimmed. Case preserved. Cased "none" &rarr; "None". | `String` | Non-string type |
| `pagesAndRoutes` | `Array` | `[]` | Object validation. String trims. Case preserved. | `Array<Object>` | Non-array type |
| `components` | `Array` | `[]` | Object validation. String trims. Case preserved. | `Array<Object>` | Non-array type |
| `backendApis` | `Array` | `[]` | HTTP method normalized to uppercase. Paths preserved. | `Array<Object>` | Non-array type |
| `databaseModels` | `Array` | `[]` | Model name trim & case preserved. Fields trim & case preserved. | `Array<Object>` | Non-array type |
| `integrations` | `Array<String>` | `[]` | Elements trimmed, case preserved. No "None" mapping. | `Array<String>` | Non-array / sparse |
| `importantDependencies`| `Array<String>`| `[]` | Elements trimmed, exact case preserved. | `Array<String>` | Non-array / sparse |
| `environmentVariables`| `Array<String>`| `[]` | Elements trimmed, exact uppercase cased. | `Array<String>` | Non-array / sparse |
| `architectureConstraints`| `Array<String>`| `[]` | Elements trimmed, case preserved. | `Array<String>` | Non-array / sparse |
| `runBuildRequirements`| `Object` | (Default object) | Script commands trim & case preserved. No "None" mapping. | `Object` | Non-object type |
| `deploymentRequirements`| `String` | `"None"` | Trimmed. Case preserved. Cased "none" &rarr; "None". | `String` | Non-string type |
| `assumptions` | `Array<String>`| `[]` | Elements trimmed, case preserved. | `Array<String>` | Non-array / sparse |

---

## 6. Compiler Module Location
*   [backend/core/projectSpec/projectSpecCompiler.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/core/projectSpec/projectSpecCompiler.js)

---

## 7. Public API
*   `compileProjectSpec(legacyPayload)` exported via [backend/core/projectSpec/index.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/core/projectSpec/index.js).

---

## 8. Compilation Result Contract
*   **Success**: `{ success: true, value: validatedImmutableProjectSpec, errors: [] }`
*   **Failure**: `{ success: false, value: null, errors: [{ code, path, message, keyword }] }`

---

## 9. Compiler Error Taxonomy
*   `COMPILE_ERROR_INVALID_INPUT`: Raw candidate is not a plain object.
*   `COMPILE_ERROR_UNKNOWN_FIELD`: Unexpected top-level or nested keys.
*   `COMPILE_ERROR_CIRCULAR_REFERENCE`: Infinite looping input detected.
*   `COMPILE_ERROR_SPARSE_ARRAY`: Empty elements in array parameters.
*   `COMPILE_ERROR_INVALID_TYPE`: Input field does not match the primitive requirement.

---

## 10. Field-Specific Normalization & Case Preservation Policy
*   **projectName**: Trimmed only, exact case is preserved. E.g. `"myProject"` stays `"myProject"`.
*   **projectType**: Trimmed only, case preserved, case-insensitive `"none"` sentinels canonicalized to `"None"`.
*   **frontend, backend, database, authentication, designRequirements, deploymentRequirements**: Trimmed only, case preserved, case-insensitive `"none"` sentinels canonicalized to `"None"`.
*   **integrations, importantDependencies, environmentVariables, architectureConstraints, assumptions**: Elements are trimmed only, exact case is preserved. Package names and variable names casing are not altered. No `"None"` sentinels are canonicalized inside arrays.
*   **pagesAndRoutes**: Trimmed only. Path and name case preserved.
*   **components**: Trimmed only. Component name and purpose case preserved.
*   **backendApis**: Method is trimmed and normalized to uppercase. Path and purpose case preserved.
*   **databaseModels**: Name and fields list items trimmed, exact case preserved.
*   **runScript, buildScript**: Commands are trimmed only, case preserved. No `"None"` canonicalization occurs.

---

## 11. Missing, Undefined, and Null Normalization Policies Matrix

| Field Category | Input: Omitted (Missing) | Input: `undefined` | Input: `null` |
|---|---|---|---|
| **Top-Level Strings** | Map to characterized default | Map to characterized default | Map to characterized default |
| **Top-Level Arrays** | Map to `[]` | Map to `[]` | Map to `[]` |
| **Nested Collections** | Map to `[]` | Map to `[]` | Map to `[]` |
| **runBuildRequirements** | Map to `{ runScript: "npm run dev", buildScript: "" }` | Map to `{ runScript: "npm run dev", buildScript: "" }` | Map to `{ runScript: "npm run dev", buildScript: "" }` |
| **Nested Required Properties** | Pass through (let validator reject) | Pass through (let validator reject) | Pass through (let validator reject) |
| **String Array Elements** | N/A | Pass through (let validator reject) | Pass through (let validator reject) |

*   **VERIFIED FACT**: Normalization of top-level `null` parameters to default objects/arrays/strings is a verified fact of legacy compatibility. In the legacy requirements analyzer (`projectService.js`), fields were extracted using `||` checks (e.g. `spec.runBuildRequirements || { runScript: "npm run dev", buildScript: "" }`) or `Array.isArray(spec.integrations) ? spec.integrations : []`, which naturally defaulted `null` or `undefined` inputs to their standard default values.
*   **VERIFIED FACT**: Individual array items or nested object parameters were not defaulted by legacy logic, and therefore the compiler delegates `null` or `undefined` values inside arrays or nested objects directly to the validator for structured type rejections.

---

## 12. Schema Version Caller-Supplied Input Policy
*   **schemaVersion** is recognized as compiler-owned metadata.
*   Caller-supplied `schemaVersion` is ignored and cannot override `PROJECT_SPEC_SCHEMA_VERSION` (always compiled as `"1.0"`).
*   It is not treated as an unknown semantic field (accepted without triggering `COMPILE_ERROR_UNKNOWN_FIELD`).
*   Throwing getters on `schemaVersion` are touched and validated during compilation to ensure exceptions are caught and reported as structured errors.

---

## 13. Stack-Selection Semantic Preservation
*   No rewriting or mapping of stack properties (`projectType`, `frontend`, `backend`, `database`) to preset profile templates.
*   Trimming is applied, but the casing is fully preserved so that downstream stack detection collision logic behaves exactly as characterized in Phase 1A.

---

## 14. Compiler Totality / Safety
*   Wrapped with recursive checks and error wrappers to prevent crashes from throwing getters or symbols.

---

## 15. Input Immutability
*   Input objects are never modified. Value isolation is guaranteed.

---

## 16. Validator Delegation
*   Delegates schema schema rules validation to `validateProjectSpec()`.

---

## 17. Determinism Guarantees
*   Strictly offline, stateless, and timestamp-free. Identical inputs yield identical outcomes.

---

## 18. Tests Added
*   Added **43 new unit tests** covering all normalization, circular checks, default mappings, error formatting, and safety invariants.

---

## 19. Regression Results
*   **193 Passed**, 0 Failed, 0 Skipped.
