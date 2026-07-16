# Phase 2A — Requirement Classification Foundation (Hardened)

This document details the hardened design of the Requirement Classification engine introduced in Task Pack 2A. The classification model has been advanced from a single-category keyword-priority model to a multi-dimensional Primary Category + Secondary Tags model.

---

## 1. Executive Summary

*   **Goal**: Establish a multi-dimensional, high-integrity requirement classification foundation.
*   **Result**: Migrated the `requirementsClassification` module to categorize requirements using a strict `primaryCategory` (mapping 1-to-1 with the requirement's `kind`) and a list of sorted, unique, uppercase `secondaryTags` derived from keywords.
*   **Decoupled Domain**: The module depends strictly on structural attributes (`kind`, `semanticKey`, `payload`) and is 100% offline and deterministic.
*   **Immutability**: All return values, array structures, and nested tag arrays are deeply frozen via recursive `deepFreeze`.
*   **Verification**: Executed **7 unit tests** in `run_tests.js` with **279/279 unit assertions** passing successfully.

---

## 2. Public API Structure

The public entry file is located at `backend/core/requirementsClassification/index.js` and exposes:

```javascript
const { classifyRequirements, classificationErrorCodes } = require("./requirementsClassification");
```

### 2.1 The classifyRequirements() API
- **Signature**: `classifyRequirements(requirements)`
- **Input**: `requirements[]` (array of requirement objects derived by the Requirement Identity layer).
- **Return Shape**:
  - Success: `{ success: true, classifications: [...], errors: [] }` (deeply frozen).
  - Failure: `{ success: false, classifications: [], errors: [{ code, path, message }] }`.

---

## 3. Output Contract

For a successful classification run, the elements in the `classifications` array adhere to the following schema:

```json
{
  "stableId": "req_v1_8ab2d9f3...",
  "displayId": "REQ-001",
  "kind": "component",
  "semanticKey": "LoginForm",
  "primaryCategory": "UI",
  "secondaryTags": [
    "AUTH",
    "DESIGN"
  ]
}
```

- `stableId` (String): The immutable hash identity of the requirement.
- `displayId` (String): The sequential representation ID (e.g. `REQ-001`).
- `kind` (String): The source classification kind.
- `semanticKey` (String): The name or URI path of the requirement.
- `primaryCategory` (String): Authoritative primary category (determined strictly from kind).
- `secondaryTags` (Array of Strings): Optional secondary tags representing specific features, sorted alphabetically, unique, and uppercase.

---

## 4. Classification Rules

### 4.1 Primary Category Mapping
The `primaryCategory` is mapped strictly 1-to-1 from the requirement `kind` without keyword processing or semantic inference:

| Requirement `kind` | `primaryCategory` |
|---|---|
| `pageRoute` / `route` | `ROUTE` |
| `component` | `UI` |
| `backendApi` / `api` | `API` |
| `databaseModel` / `database` | `DATABASE` |
| `frontend` | `FRONTEND` |
| `backend` | `BACKEND` |
| `authentication` | `AUTH` |
| `integration` | `INTEGRATION` |
| `deploymentRequirement` / `deploymentRequirements` | `DEPLOYMENT` |
| `architectureConstraint` / `architecture` | `ARCHITECTURE` |
| `designRequirement` / `designRequirements` | `DESIGN` |
| Any other unknown kind | `OTHER` |

### 4.2 Secondary Tag Rules
Secondary tags are optional metadata tags derived by scanning `semanticKey` and all string fields recursively extracted from the requirement `payload` for specific keywords (using regex word boundaries `\bkeyword\b` to avoid prefix/suffix false positives).

The matching rules append the following tags:
- **`AUTH`**: Matching `auth`, `login`, `signup`, `signin`, `logout`, `jwt`, `token`, `session`, `password`, `bcrypt`, `passport`, `oauth`, `credential`, `authorize`, `authentication`.
- **`PAYMENT`**: Matching `stripe`, `paypal`, `payment`, `checkout`, `card`, `subscription`, `billing`, `transaction`, `invoice`, `pay`.
- **`ADMIN`**: Matching `admin`, `dashboard`, `moderator`, `backoffice`, `portal`, `management`.
- **`AI`**: Matching `openai`, `gpt`, `llm`, `claude`, `gemini`, `ai`, `ml`, `chatbot`, `intelligent`, `prediction`, `chatgpt`.
- **`CHAT`**: Matching `chat`, `message`, `messaging`, `slack`, `discord`, `websocket`, `ws`, `conversation`, `inbox`.
- **`VIDEO`**: Matching `video`, `media`, `stream`, `youtube`, `vimeo`, `player`, `zoom`, `meeting`.
- **`EMAIL`**: Matching `email`, `mail`, `sendgrid`, `smtp`, `newsletter`, `mailchimp`.
- **`STORAGE`**: Matching `s3`, `storage`, `upload`, `download`, `file`, `cloudinary`, `aws-s3`, `multer`, `bucket`.
- **`ANALYTICS`**: Matching `analytics`, `tracking`, `metrics`, `log`, `chart`, `graph`, `google-analytics`, `mixpanel`, `telemetry`.
- **`NOTIFICATION`**: Matching `notification`, `notify`, `push`, `alert`, `sms`, `twilio`, `firebase-messaging`.

**Uniqueness & Sorting**: All tags matched are gathered into a unique set, converted to uppercase, sorted alphabetically, and recursively frozen.

---

## 5. Future Requirements Traceability Matrix (RTM) Usage

The introduced primary categories and secondary tags serve as index keys for RTM tracing:
- **Phase 2B (Requirement Code Validator)**: The validator will scan generated code files and match their locations to the requirement `primaryCategory` (e.g. `ROUTE` matches routes files, `UI` matches component files).
- **Secondary verification**: The validator will inspect code files for specific keywords corresponding to the `secondaryTags` to ensure that specific requirement domains (e.g. `AUTH` or `PAYMENT`) are indeed implemented in the corresponding files.
- **Traceability matrix**: The matrix will build a cross-reference map: `stableId` &rarr; `primaryCategory` &rarr; `secondaryTags` &rarr; `matching file paths` &rarr; `verification status`.

---

## 6. Tests Index (Phase 2A suite)

The unit tests are located in [run_tests.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/tests/run_tests.js#L4181).

| Test # | Test Name | Objective Covered |
|---|---|---|
| 1 | Rejects invalid non-array input | Asserts boundaries on non-array parameter inputs. |
| 2 | Rejects requirements missing fields | Verifies structural validation (`stableId`, `displayId`, `kind`, `semanticKey`, `payload`). |
| 3 | Primary category maps strictly by kind | Verifies that kind-based mapping is deterministic and matches the spec mapping table. |
| 4 | Changing keywords never changes primaryCategory | Proves that `primaryCategory` remains unaffected by keywords, which instead correctly populate `secondaryTags`. |
| 5 | Secondary tags are sorted and unique | Validates that multiple matches yield distinct, unique, alphabetically sorted tags. |
| 6 | Output is deeply immutable and frozen | Asserts that returning objects are frozen recursively. |
| 7 | Deterministic runs | Proves repeated executions yield exact structural equivalence. |
