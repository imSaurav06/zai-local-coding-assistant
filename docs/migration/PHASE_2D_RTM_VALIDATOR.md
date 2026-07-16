# Phase 2D — RTM-Lite Validator

This document outlines the architectural validator boundary, rules, schemas, errors taxonomy, and verification logic of the Requirements Traceability Matrix validator (RTM-Lite Validator) introduced in Task Pack 2D.

---

## 1. Executive Summary

*   **Goal**: Ensure structural integrity, metadata completeness, and data consistency of an existing RTM-Lite object.
*   **Result**: Created `rtmValidator.js` providing validation boundaries and structural safety rules.
*   **Decoupled Domain**: The validator runs offline, is stateless, pure, and does not access the database or filesystem.
*   **Zero Mutation**: Caller inputs are never modified. Only validated read actions occur.
*   **Verification**: Registered **10 new unit tests** in `run_tests.js`. All **302 unit assertions** pass successfully.

---

## 2. Public API Structure

Exposed under the unified namespace in `backend/core/rtm/index.js`:

```javascript
const { validateRTM, RTM_MODEL_VERSION, rtmErrorCodes } = require("./backend/core/rtm");
```

### 2.1 The validateRTM() API
- **Signature**: `validateRTM(rtm)`
- **Input**: `rtm` (RTM-Lite candidate object).
- **Return Shape**:
  - Success: `{ success: true, errors: [] }`
  - Failure: `{ success: false, errors: [{ code, path, message }] }`

---

## 3. Validation Boundary & Rules

The validator verifies the following constraints in sequence:

### 3.1 Plain Object & Root Structure
- The root parameter must be a plain object (not an array, primitive, or null).
- It must contain the fields: `success` (Boolean), `rtmVersion` (`"1.0"`), `entries` (Array), `metadata` (Plain Object), `errors` (Array).
- The root structure and entries array must be frozen.

### 3.2 Root Metadata Constraints
- The `metadata` plain object must contain:
  - `identityVersion` (String)
  - `classificationVersion` (String)
  - `createdBy` (String)
  - `modelVersion` (`"1.0"`)
  - `totalRequirementsCount` (Number, must equal `entries.length`)

### 3.3 Entries Array Schema Checks
Each element inside `entries` must be a frozen plain object containing:
- **Core fields**: `stableId`, `displayId`, `kind`, `semanticKey`, `primaryCategory`, `secondaryTags`, `status`, `evidence`, `metadata`.
- **DisplayId format**: Must match `REQ-\d{3,}` and be strictly sequential matching its array index position (index 0 maps to `REQ-001`, index 1 to `REQ-002`, etc.).
- **Uniqueness constraints**:
  - `stableId` must be unique across all entries.
  - `displayId` must be unique across all entries.
  - `semanticKey` must be unique within entries sharing the same `kind` value.

### 3.4 Enumeration Safety
- **status**: Must belong to `UNTRACKED`, `PLANNED`, `GENERATED`, `VERIFIED`, `FAILED`.
- **primaryCategory**: Must belong to the 12 categories (`UI`, `ROUTE`, `API`, `DATABASE`, `AUTH`, `INTEGRATION`, `DEPLOYMENT`, `ARCHITECTURE`, `DESIGN`, `BACKEND`, `FRONTEND`, `OTHER`).

### 3.5 Secondary Tags Schema
- `secondaryTags` must be a frozen array of strings.
- Each tag must be in uppercase format, unique inside the tag array, and sorted alphabetically.

### 3.6 Evidence Schema
- `evidence` must be a frozen plain object containing the following frozen arrays of strings: `generatedFiles`, `generatedApis`, `generatedRoutes`, `generatedComponents`, `notes`.

### 3.7 Immutability
- Verifies that root, entries list, entries objects, tag arrays, evidence objects, and metadata scopes are all deeply frozen via `Object.isFrozen`.

---

## 4. Error Taxonomy

Validation failures map to the following error codes under `rtmErrorCodes`:
*   `RTM_INVALID_STRUCTURE`: Schema errors on root parameters or metadata configurations, or non-frozen state.
*   `RTM_INVALID_ENTRY`: Missing fields or sequential errors on entries lists, or duplicate `semanticKey` matching.
*   `RTM_DUPLICATE_STABLE_ID`: Duplicate `stableId` keys found in different entries.
*   `RTM_DUPLICATE_DISPLAY_ID`: Duplicate sequential indices.
*   `RTM_INVALID_STATUS`: Unsupported status enum values.
*   `RTM_INVALID_CATEGORY`: Unsupported primaryCategory labels.
*   `RTM_INVALID_TAGS`: Bad tags formatting (lowercase, duplicate elements, or unsorted sequence lists).
*   `RTM_INTERNAL_ERROR`: Unexpected exception.

---

## 5. Future Phase 2E Integration

In Task Pack 2E (Production Pipeline Integration):
- **Integrity checks**: The orchestrator (`prepareCanonicalProjectSpec`) will pass the built RTM-Lite structure through `validateRTM(rtm)` before any planning steps are triggered.
- **Fail-fast gate**: If validation returns `success: false`, execution halts immediately to prevent planning or code generation based on corrupt matrices.

---

## 6. Tests Index (Phase 2D suite)

Located in [run_tests.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/tests/run_tests.js#L4548).

| Test # | Test Name | Objective Covered |
|---|---|---|
| 1 | Valid frozen RTM is successfully accepted | Verifies validation passes on properly built RTM instances. |
| 2 | Rejects invalid root structures | Checks type constraints and missing root fields. |
| 3 | Rejects non-frozen RTM structures | Proves validation checks immutability bounds. |
| 4 | Rejects invalid status in entries | Checks unsupported statuses. |
| 5 | Rejects invalid primaryCategory in entries | Checks unsupported primary categories. |
| 6 | Rejects invalid secondaryTags array patterns | Checks tag casing, duplicates, and sorting. |
| 7 | Rejects duplicate stableId across entries | Asserts stableId uniqueness. |
| 8 | Rejects duplicate displayId | Verifies strict displayId index sequence check. |
| 9 | Rejects duplicate semanticKey within same kind | Asserts consistency check of semanticKey per kind. |
| 10 | Determinism and zero mutation | Validates statelessness and zero input modification. |
