"use strict";

const { vfsErrorCodes } = require("./vfsErrors");

/**
 * Deep freezes an object recursively to guarantee immutability.
 */
function deepFreeze(obj) {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach(prop => {
        if (
            obj.hasOwnProperty(prop) &&
            obj[prop] !== null &&
            (typeof obj[prop] === "object" || typeof obj[prop] === "function") &&
            !Object.isFrozen(obj[prop])
        ) {
            deepFreeze(obj[prop]);
        }
    });
    return obj;
}

/**
 * Validates basic VFS structure.
 */
function validateVfsStructure(vfs) {
    return (
        typeof vfs === "object" && vfs !== null &&
        typeof vfs.version === "string" &&
        typeof vfs.metadata === "object" && vfs.metadata !== null &&
        Array.isArray(vfs.files) &&
        Array.isArray(vfs.operations) &&
        typeof vfs.transaction === "object" && vfs.transaction !== null &&
        typeof vfs.transaction.active === "boolean"
    );
}

/**
 * Normalizes, dedupes, and sorts a list of file entries deterministically.
 */
function canonicalizeFiles(files) {
    const filesMap = new Map();
    files.forEach(file => {
        if (typeof file === "object" && file !== null && typeof file.path === "string") {
            const normalizedPath = file.path.replace(/\\/g, "/");
            filesMap.set(normalizedPath, {
                path: normalizedPath,
                language: typeof file.language === "string" ? file.language : "",
                content: typeof file.content === "string" ? file.content : "",
                status: typeof file.status === "string" ? file.status : "PENDING"
            });
        }
    });
    const dedupedList = Array.from(filesMap.values());
    dedupedList.sort((a, b) => a.path.localeCompare(b.path));
    return dedupedList;
}

/**
 * Synchronizes the Virtual File System into one deterministic canonical state.
 * 
 * @param {Object} vfs VFS object
 */
function synchronizeVfs(vfs) {
    try {
        if (!validateVfsStructure(vfs)) {
            return deepFreeze({
                success: false,
                vfs: null,
                errors: [{
                    code: vfsErrorCodes.VFS_CANONICAL_SYNC_FAILED,
                    path: "vfs",
                    message: "Invalid or malformed VFS structure."
                }]
            });
        }

        const syncedFiles = canonicalizeFiles(vfs.files);

        // Normalize operations log path delimiters and sort deterministically
        const syncedOperations = vfs.operations.map(op => {
            const pathStr = typeof op.path === "string" ? op.path.replace(/\\/g, "/") : "";
            return {
                type: typeof op.type === "string" ? op.type : "",
                path: pathStr
            };
        });

        syncedOperations.sort((a, b) => {
            const typeComp = a.type.localeCompare(b.type);
            if (typeComp !== 0) return typeComp;
            return a.path.localeCompare(b.path);
        });

        const syncedVfs = {
            version: vfs.version,
            metadata: JSON.parse(JSON.stringify(vfs.metadata)),
            files: syncedFiles,
            operations: syncedOperations,
            transaction: {
                active: vfs.transaction.active
            }
        };

        if (Array.isArray(vfs.transaction.snapshot)) {
            syncedVfs.transaction.snapshot = canonicalizeFiles(vfs.transaction.snapshot);
        }

        return deepFreeze({
            success: true,
            vfs: syncedVfs,
            errors: []
        });

    } catch (err) {
        return deepFreeze({
            success: false,
            vfs: null,
            errors: [{
                code: vfsErrorCodes.VFS_CANONICAL_SYNC_FAILED,
                path: "",
                message: `Unexpected internal error during synchronizeVfs: ${err.message}`
            }]
        });
    }
}

/**
 * Verifies that the VFS instance holds a canonical state.
 * 
 * @param {Object} vfs VFS object
 */
function verifyCanonicalVfs(vfs) {
    try {
        if (!validateVfsStructure(vfs)) {
            return deepFreeze({
                success: false,
                errors: [{
                    code: vfsErrorCodes.VFS_CANONICAL_VALIDATION_FAILED,
                    path: "vfs",
                    message: "Invalid or malformed VFS object."
                }]
            });
        }

        // 1. Immutable structure check (deeply frozen)
        if (!Object.isFrozen(vfs)) {
            return deepFreeze({
                success: false,
                errors: [{
                    code: vfsErrorCodes.VFS_CANONICAL_VALIDATION_FAILED,
                    path: "vfs",
                    message: "VFS object is not frozen."
                }]
            });
        }

        if (!Object.isFrozen(vfs.metadata)) {
            return deepFreeze({
                success: false,
                errors: [{
                    code: vfsErrorCodes.VFS_CANONICAL_VALIDATION_FAILED,
                    path: "vfs.metadata",
                    message: "VFS metadata is not frozen."
                }]
            });
        }

        if (!Object.isFrozen(vfs.files)) {
            return deepFreeze({
                success: false,
                errors: [{
                    code: vfsErrorCodes.VFS_CANONICAL_VALIDATION_FAILED,
                    path: "vfs.files",
                    message: "VFS files array is not frozen."
                }]
            });
        }

        for (let i = 0; i < vfs.files.length; i++) {
            if (!Object.isFrozen(vfs.files[i])) {
                return deepFreeze({
                    success: false,
                    errors: [{
                        code: vfsErrorCodes.VFS_CANONICAL_VALIDATION_FAILED,
                        path: `files[${i}]`,
                        message: `File entry at index ${i} is not frozen.`
                    }]
                });
            }
        }

        if (!Object.isFrozen(vfs.operations)) {
            return deepFreeze({
                success: false,
                errors: [{
                    code: vfsErrorCodes.VFS_CANONICAL_VALIDATION_FAILED,
                    path: "vfs.operations",
                    message: "VFS operations array is not frozen."
                }]
            });
        }

        for (let i = 0; i < vfs.operations.length; i++) {
            if (!Object.isFrozen(vfs.operations[i])) {
                return deepFreeze({
                    success: false,
                    errors: [{
                        code: vfsErrorCodes.VFS_CANONICAL_VALIDATION_FAILED,
                        path: `operations[${i}]`,
                        message: `Operation entry at index ${i} is not frozen.`
                    }]
                });
            }
        }

        if (!Object.isFrozen(vfs.transaction)) {
            return deepFreeze({
                success: false,
                errors: [{
                    code: vfsErrorCodes.VFS_CANONICAL_VALIDATION_FAILED,
                    path: "vfs.transaction",
                    message: "VFS transaction state is not frozen."
                }]
            });
        }

        if (Array.isArray(vfs.transaction.snapshot)) {
            if (!Object.isFrozen(vfs.transaction.snapshot)) {
                return deepFreeze({
                    success: false,
                    errors: [{
                        code: vfsErrorCodes.VFS_CANONICAL_VALIDATION_FAILED,
                        path: "vfs.transaction.snapshot",
                        message: "VFS snapshot array is not frozen."
                    }]
                });
            }
            for (let i = 0; i < vfs.transaction.snapshot.length; i++) {
                if (!Object.isFrozen(vfs.transaction.snapshot[i])) {
                    return deepFreeze({
                        success: false,
                        errors: [{
                            code: vfsErrorCodes.VFS_CANONICAL_VALIDATION_FAILED,
                            path: `transaction.snapshot[${i}]`,
                            message: `Snapshot file entry at index ${i} is not frozen.`
                        }]
                    });
                }
            }
        }

        // 2. Canonical path uniqueness and ordering
        const pathSet = new Set();
        for (let i = 0; i < vfs.files.length; i++) {
            const file = vfs.files[i];
            
            if (typeof file !== "object" || file === null || typeof file.path !== "string") {
                return deepFreeze({
                    success: false,
                    errors: [{
                        code: vfsErrorCodes.VFS_CANONICAL_VALIDATION_FAILED,
                        path: `files[${i}]`,
                        message: "File entry is invalid or missing path."
                    }]
                });
            }

            const p = file.path;

            // Check if path contains Windows delimiters
            if (p.includes("\\")) {
                return deepFreeze({
                    success: false,
                    errors: [{
                        code: vfsErrorCodes.VFS_CANONICAL_VALIDATION_FAILED,
                        path: `files[${i}].path`,
                        message: "Path contains Windows backslash path separators."
                    }]
                });
            }

            // Uniqueness
            if (pathSet.has(p)) {
                return deepFreeze({
                    success: false,
                    errors: [{
                        code: vfsErrorCodes.VFS_CANONICAL_VALIDATION_FAILED,
                        path: `files[${i}].path`,
                        message: `Duplicate path detected: ${p}`
                    }]
                });
            }
            pathSet.add(p);

            // Lexicographical sorting check
            if (i > 0) {
                const prevPath = vfs.files[i - 1].path;
                if (prevPath.localeCompare(p) >= 0) {
                    return deepFreeze({
                        success: false,
                        errors: [{
                            code: vfsErrorCodes.VFS_CANONICAL_VALIDATION_FAILED,
                            path: `files[${i}].path`,
                            message: `Files are not ordered lexicographically. Out of order: ${prevPath} vs ${p}`
                        }]
                    });
                }
            }
        }

        // 3. Operations validation & deterministic sorting check
        for (let i = 0; i < vfs.operations.length; i++) {
            const op = vfs.operations[i];
            if (typeof op !== "object" || op === null || typeof op.type !== "string" || typeof op.path !== "string") {
                return deepFreeze({
                    success: false,
                    errors: [{
                        code: vfsErrorCodes.VFS_CANONICAL_VALIDATION_FAILED,
                        path: `operations[${i}]`,
                        message: "Operation entry is malformed."
                    }]
                });
            }

            if (op.path.includes("\\")) {
                return deepFreeze({
                    success: false,
                    errors: [{
                        code: vfsErrorCodes.VFS_CANONICAL_VALIDATION_FAILED,
                        path: `operations[${i}].path`,
                        message: "Operation path contains Windows backslash path separators."
                    }]
                });
            }

            // Ordering check
            if (i > 0) {
                const prev = vfs.operations[i - 1];
                const typeComp = prev.type.localeCompare(op.type);
                if (typeComp > 0) {
                    return deepFreeze({
                        success: false,
                        errors: [{
                            code: vfsErrorCodes.VFS_CANONICAL_VALIDATION_FAILED,
                            path: `operations[${i}]`,
                            message: "Operations are not sorted deterministically by type."
                        }]
                    });
                } else if (typeComp === 0) {
                    if (prev.path.localeCompare(op.path) > 0) {
                        return deepFreeze({
                            success: false,
                            errors: [{
                                code: vfsErrorCodes.VFS_CANONICAL_VALIDATION_FAILED,
                                path: `operations[${i}].path`,
                                message: "Operations are not sorted lexicographically by path within type groups."
                            }]
                        });
                    }
                }
            }
        }

        return deepFreeze({
            success: true,
            errors: []
        });

    } catch (err) {
        return deepFreeze({
            success: false,
            errors: [{
                code: vfsErrorCodes.VFS_CANONICAL_VALIDATION_FAILED,
                path: "",
                message: `Unexpected internal error during verifyCanonicalVfs: ${err.message}`
            }]
        });
    }
}

module.exports = {
    synchronizeVfs,
    verifyCanonicalVfs
};
