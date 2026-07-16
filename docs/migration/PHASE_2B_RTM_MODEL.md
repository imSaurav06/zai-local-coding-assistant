# Phase 2B — RTM-Lite Data Model

This document outlines the architectural data model, entry structures, status lifecycle, evidence schemas, and metadata definitions of the Requirements Traceability Matrix (RTM-Lite) introduced in Task Pack 2B.

---

## 1. Executive Summary

*   **Goal**: Establish a deterministic, high-integrity RTM-Lite data model structure.
*   **Result**: Created `backend/core/rtm/` containing the canonical RTM-Lite domain models.
*   **Decoupling**: Built as a pure, stateless in-memory model with zero dependencies on database engines, Express routing, or AI providers.
*   **Immutability**: All returned structures (the root RTM object, entries arrays, evidence containers, and metadata fields) are recursively deep-frozen using `deepFreeze`.
*   **Verification**: Registered **7 new unit tests** in `run_tests.js`. All **286 backend unit assertions** pass successfully.

---

## 2. Public API Structure

The public exports under `backend/core/rtm/index.js` are:

```javascript
const { createRTM, RTM_MODEL_VERSION, rtmErrorCodes } = require("./backend/core/rtm");
```

### 2.1 The createRTM() API
- **Signature**: `createRTM(requirements)`
- **Input**: `requirements[]` (array of canonical requirement objects returned by the Requirement Identity layer).
- **Return Shape**:
  - Success: `{ success: true, rtmVersion: "1.0", entries: [...], metadata: { ... }, errors: [] }` (deeply frozen).
  - Failure: `{ success: false, rtmVersion: "1.0", entries: [], metadata: {}, errors: [{ code, path, message }] }` (deeply frozen).

---

## 3. RTM Entry Model Contract

Every requirement matched by the identity layer translates 1-to-1 into an RTM entry:

```json
{
  "stableId": "req_v1_9c2a4f...",
  "displayId": "REQ-001",
  "kind": "component",
  "semanticKey": "Navbar",
  "primaryCategory": "UI",
  "secondaryTags": [],
  "status": "UNTRACKED",
  "evidence": {
    "generatedFiles": [],
    "generatedApis": [],
    "generatedRoutes": [],
    "generatedComponents": [],
    "notes": []
  },
  "metadata": {
    "identityVersion": "1.0",
    "classificationVersion": "1.0",
    "createdBy": "rtm-lite",
    "modelVersion": "1.0"
  }
}
```

### 3.1 Status Lifecycle
The status defines the current implementation trace status of the requirement:
*   `UNTRACKED`: Initial state. The requirement is identified but no generation tasks have referenced it yet.
*   `PLANNED`: The planner has assigned this requirement to a specific generation unit or file path.
*   `GENERATED`: The generator has written code mapping to this requirement.
*   `VERIFIED`: The verification engine has run tests or semantic matches proving the requirement is successfully implemented.
*   `FAILED`: The verification engine or parser failed to find matching code for the requirement, or tests targeting this requirement failed.

### 3.2 Evidence Model
A structured container representing the matching code files and endpoint traces compiled during verification:
*   `generatedFiles` (Array of Strings): File paths implementing this requirement.
*   `generatedApis` (Array of Strings): HTTP APIs or methods implementing this requirement.
*   `generatedRoutes` (Array of Strings): Frontend page routes mapping to the requirement.
*   `generatedComponents` (Array of Strings): React components implementing this requirement.
*   `notes` (Array of Strings): Informational logs or verification check messages.

### 3.3 Metadata Schema
Provides traceability versions and counts:
*   `identityVersion`: Requirements hashing protocol version (`"1.0"`).
*   `classificationVersion`: Rules version used to determine categories (`"1.0"`).
*   `createdBy`: Service identifier (`"rtm-lite"`).
*   `modelVersion`: RTM structure version (`"1.0"`).
*   `totalRequirementsCount` (Root only): The total number of tracking requirements.

---

## 4. Future Phase 2C Responsibilities

The RTM model created in Phase 2B is a passive construct. In Phase 2C (RTM-Lite Trace Builder), we will introduce:
1.  **Passive Tracing**: Building active RTM trace builders that scan generated file paths and match them to RTM entries based on `primaryCategory`.
2.  **Evidence Collection**: Collecting evidence (files created, APIs exported, routes registered) and appending it to each RTM entry.
3.  **Status Transition Rules**: Transitioning statuses from `UNTRACKED` &rarr; `PLANNED` &rarr; `GENERATED` &rarr; `VERIFIED` based on trace hits.

---

## 5. Tests Index (Phase 2B suite)

Located in [run_tests.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/tests/run_tests.js#L4335).

| Test # | Test Name | Objective Covered |
|---|---|---|
| 1 | Rejects invalid non-array inputs | Validates boundary checking at RTM entry. |
| 2 | Rejects requirements missing required fields | Verifies structural check of input properties. |
| 3 | Detects duplicate stableId and rejects creation | Asserts that duplicate stableIds throw error instead of corrupting matrix. |
| 4 | Instantiates default status and empty evidence | Asserts initial status is `UNTRACKED` and arrays are initialized. |
| 5 | Populates correct deterministic metadata structure | Validates identity, model, and classification schema version bindings. |
| 6 | Output data structure is deeply frozen and immutable | Verifies that attempts to change properties or push elements throw `TypeError`. |
| 7 | Creation is stateless, pure, and deterministic | Asserts that repeated construction calls yield identical output structures. |
