# Phase 6C — Symbol-Aware Context Resolution

This document outlines the design, interface, symbol resolution rules, and error taxonomy for the Symbol-Aware Context Resolution extension established in Task Pack 6C.

---

## 1. Executive Summary

*   **Objective**: Extend the Repository-Aware Context Builder to extract symbol-level metadata from file descriptors, filtering and sorting the results so downstream AI receives a minimal, relevant code context.
*   **Result**: Modified `backend/core/context/contextBuilder.js` and updated error definitions in `contextErrors.js`.
*   **Safety**: Validates `importMetadata` structures recursively on repository files, skipping external packages/node_modules, and ignoring unsupported import styles.
*   **Tests**: Added **9 focused unit tests** in `run_tests.js` verifying validation rejections, target symbol extraction, namespace/default/named resolving, ignored import styles, ordering determinism, immutability, non-mutation of inputs, and backwards compatibility.
*   **Status**: Regression baseline at **439 assertions passing**.

---

## 2. Expanded Context Structure

When `options.includeImportedSymbols` is set to `true`, the `repositoryContext` inside the returned context is extended with the `importedSymbols` key:

```json
{
  "version": "1.0",
  "metadata": {
    "contextVersion": "1.0",
    "plannerVersion": "1.0",
    "graphVersion": "1.0",
    "identityVersion": "1.0",
    "createdBy": "contextBuilder"
  },
  "projectSpec": { ... },
  "requirement": { ... },
  "plannerTask": { ... },
  "repositoryContext": {
    "targetFile": {
      "path": "frontend/src/components/layout/Navbar.jsx",
      "language": "javascript",
      "imports": ["./ThemeToggle", "../../hooks/useAuth", "react"],
      "importMetadata": [
        {
          "source": "./ThemeToggle",
          "symbol": "ThemeToggle",
          "importType": "default"
        },
        {
          "source": "../../hooks/useAuth",
          "symbol": "useAuth",
          "importType": "named"
        }
      ]
    },
    "importedFiles": [
      {
        "path": "frontend/src/components/layout/ThemeToggle.jsx",
        "language": "javascript",
        "imports": []
      },
      {
        "path": "frontend/src/hooks/useAuth.js",
        "language": "javascript",
        "imports": []
      }
    ],
    "importedSymbols": [
      {
        "file": "frontend/src/components/layout/ThemeToggle.jsx",
        "symbol": "ThemeToggle",
        "importType": "default"
      },
      {
        "file": "frontend/src/hooks/useAuth.js",
        "symbol": "useAuth",
        "importType": "named"
      }
    ]
  }
}
```

---

## 3. Resolution Rules

*   **Options-Controlled Activation**: Symbol-aware context parsing triggers only when `options.includeImportedSymbols === true`. If omitted or false, the output structure retains 100% backward compatibility (no `importedSymbols` field).
*   **Import Type Filtering**: We only resolve the standard import styles: `default`, `named`, and `namespace`.
*   **Ignore Patterns**: Dynamic imports, `require()` calls, `node_modules`, and external modules (anything whose path does not start with `./` or `../`) are silently ignored/skipped.
*   **Deterministic Sorting**: Output in `importedSymbols` is lexicographically sorted:
    1. First by the resolved `file` path key.
    2. Secondly by the `symbol` name key.
*   **Deep Immutability**: All returned context sidecars are recursively frozen using `deepFreeze`.

---

## 4. Error Taxonomy

*   `CONTEXT_INVALID_IMPORT_METADATA`: Returned if any file descriptor in the repository contains an `importMetadata` field that is not an array, contains non-object items, or contains items missing `source`, `symbol`, or `importType` string keys.
