# Phase 6B — Repository-Aware Context Builder

This document outlines the design, interface, relative import resolution rules, and error taxonomy for the Repository-Aware Context Builder established in Task Pack 6B.

---

## 1. Executive Summary

*   **Objective**: Extend the Context Builder so it can optionally resolve direct relative imports from a provided list of file descriptors (Repository), constructing a localized sub-graph code context for prompt isolation.
*   **Result**: Modified `backend/core/context/contextBuilder.js` and added two new error codes in `contextErrors.js`.
*   **Safety**: Validates repository structures, validates target file existence, resolves only relative imports, avoids recursive traversals, and ensures deterministic sorting.
*   **Tests**: Added **7 new unit tests** in `run_tests.js` verifying invalid repository detection, target file mismatch, correct relative import resolution, direct imports only (no recursion), lexicographical sorting determinism, deep immutability, and parameter non-mutation.
*   **Status**: Regression baseline at **430 assertions passing**.

---

## 2. Expanded Context Structure

When `repository` is provided as a parameter to `buildContext`, the context output is extended with:

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
      "imports": ["./ThemeToggle", "../../hooks/useAuth", "react"]
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
        "imports": ["react"]
      }
    ]
  }
}
```

---

## 3. Resolution Rules

*   **Target Finding**: Resolves target path via task/requirement properties (`targetFile` or `filePath` keys, including payload/metadata nested values).
*   **Direct Imports Only**: Resolves relative path imports starting with `./` or `../`. NPM packages, absolute paths, and external libraries are skipped.
*   **No Recursion**: Resolves only relative imports specified in the *target file* itself. Imports of imported files are not resolved.
*   **Deterministic Sorting**: Resolves paths and lexicographically sorts `importedFiles` by their `path` key to keep prompt execution stable.

---

## 4. Error Taxonomy

*   `CONTEXT_INVALID_REPOSITORY`: Repository is not a valid list of file descriptors.
*   `CONTEXT_TARGET_NOT_FOUND`: Target file could not be mapped, or target path is missing in the repository.
