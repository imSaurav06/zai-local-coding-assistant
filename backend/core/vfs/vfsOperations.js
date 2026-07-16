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
function validateVfs(vfs) {
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
 * Checks if transaction is active.
 */
function checkTransactionRequired(vfs) {
    if (!validateVfs(vfs)) {
        return {
            success: false,
            vfs: null,
            errors: [{
                code: vfsErrorCodes.VFS_TRANSACTION_INVALID_STATE,
                path: "vfs",
                message: "Invalid or malformed VFS object."
            }]
        };
    }
    if (vfs.transaction.active !== true) {
        return {
            success: false,
            vfs: null,
            errors: [{
                code: vfsErrorCodes.VFS_TRANSACTION_REQUIRED,
                path: "vfs.transaction.active",
                message: "Active transaction is required for this operation."
            }]
        };
    }
    return null;
}

/**
 * Sorts files and operations list deterministically.
 */
function sortVfsFields(vfs) {
    vfs.files.sort((a, b) => {
        const pathA = a.path.replace(/\\/g, "/");
        const pathB = b.path.replace(/\\/g, "/");
        return pathA.localeCompare(pathB);
    });
    vfs.operations.sort((a, b) => {
        const typeComp = a.type.localeCompare(b.type);
        if (typeComp !== 0) return typeComp;
        return a.path.replace(/\\/g, "/").localeCompare(b.path.replace(/\\/g, "/"));
    });
}

/**
 * Creates a file in the virtual filesystem.
 * 
 * @param {Object} vfs Transaction-active VFS
 * @param {Object} file File configuration object
 */
function createFile(vfs, file) {
    try {
        const txError = checkTransactionRequired(vfs);
        if (txError) {
            return deepFreeze(txError);
        }

        if (typeof file !== "object" || file === null) {
            return deepFreeze({
                success: false,
                vfs: null,
                errors: [{
                    code: vfsErrorCodes.VFS_INVALID_FILE,
                    path: "file",
                    message: "File parameter must be a non-null object."
                }]
            });
        }

        if (typeof file.path !== "string" || !file.path.trim()) {
            return deepFreeze({
                success: false,
                vfs: null,
                errors: [{
                    code: vfsErrorCodes.VFS_INVALID_FILE,
                    path: "file.path",
                    message: "File path must be a non-empty string."
                }]
            });
        }

        if (typeof file.language !== "string" || !file.language.trim()) {
            return deepFreeze({
                success: false,
                vfs: null,
                errors: [{
                    code: vfsErrorCodes.VFS_INVALID_FILE,
                    path: "file.language",
                    message: "File language must be a non-empty string."
                }]
            });
        }

        if (typeof file.content !== "string") {
            return deepFreeze({
                success: false,
                vfs: null,
                errors: [{
                    code: vfsErrorCodes.VFS_INVALID_FILE,
                    path: "file.content",
                    message: "File content must be a string."
                }]
            });
        }

        if (file.hasOwnProperty("status")) {
            if (typeof file.status !== "string" || !file.status.trim()) {
                return deepFreeze({
                    success: false,
                    vfs: null,
                    errors: [{
                        code: vfsErrorCodes.VFS_INVALID_FILE,
                        path: "file.status",
                        message: "File status must be a non-empty string."
                    }]
                });
            }
        }

        const normalizedNewPath = file.path.replace(/\\/g, "/");
        const exists = vfs.files.some(f => f.path.replace(/\\/g, "/") === normalizedNewPath);
        if (exists) {
            return deepFreeze({
                success: false,
                vfs: null,
                errors: [{
                    code: vfsErrorCodes.VFS_FILE_ALREADY_EXISTS,
                    path: "file.path",
                    message: `File already exists: ${file.path}`
                }]
            });
        }

        const clonedVfs = JSON.parse(JSON.stringify(vfs));
        clonedVfs.files.push({
            path: file.path,
            language: file.language,
            content: file.content,
            status: file.hasOwnProperty("status") ? file.status : "PENDING"
        });
        clonedVfs.operations.push({
            type: "CREATE",
            path: file.path
        });

        sortVfsFields(clonedVfs);

        return deepFreeze({
            success: true,
            vfs: clonedVfs,
            errors: []
        });

    } catch (err) {
        return deepFreeze({
            success: false,
            vfs: null,
            errors: [{
                code: vfsErrorCodes.VFS_OPERATION_INTERNAL_ERROR,
                path: "",
                message: `Unexpected internal error during createFile: ${err.message}`
            }]
        });
    }
}

/**
 * Updates content of an existing file in VFS.
 * 
 * @param {Object} vfs Transaction-active VFS
 * @param {string} path Path to the file
 * @param {string} content New file content
 */
function updateFile(vfs, path, content) {
    try {
        const txError = checkTransactionRequired(vfs);
        if (txError) {
            return deepFreeze(txError);
        }

        if (typeof path !== "string" || !path.trim()) {
            return deepFreeze({
                success: false,
                vfs: null,
                errors: [{
                    code: vfsErrorCodes.VFS_INVALID_INPUT,
                    path: "path",
                    message: "Path must be a non-empty string."
                }]
            });
        }

        if (typeof content !== "string") {
            return deepFreeze({
                success: false,
                vfs: null,
                errors: [{
                    code: vfsErrorCodes.VFS_INVALID_INPUT,
                    path: "content",
                    message: "Content must be a string."
                }]
            });
        }

        const normalizedPath = path.replace(/\\/g, "/");
        const targetIndex = vfs.files.findIndex(f => f.path.replace(/\\/g, "/") === normalizedPath);
        if (targetIndex === -1) {
            return deepFreeze({
                success: false,
                vfs: null,
                errors: [{
                    code: vfsErrorCodes.VFS_FILE_NOT_FOUND,
                    path: "path",
                    message: `File not found: ${path}`
                }]
            });
        }

        const clonedVfs = JSON.parse(JSON.stringify(vfs));
        clonedVfs.files[targetIndex].content = content;
        clonedVfs.operations.push({
            type: "UPDATE",
            path: path
        });

        sortVfsFields(clonedVfs);

        return deepFreeze({
            success: true,
            vfs: clonedVfs,
            errors: []
        });

    } catch (err) {
        return deepFreeze({
            success: false,
            vfs: null,
            errors: [{
                code: vfsErrorCodes.VFS_OPERATION_INTERNAL_ERROR,
                path: "",
                message: `Unexpected internal error during updateFile: ${err.message}`
            }]
        });
    }
}

/**
 * Deletes a file from the virtual filesystem.
 * 
 * @param {Object} vfs Transaction-active VFS
 * @param {string} path Path to the file
 */
function deleteFile(vfs, path) {
    try {
        const txError = checkTransactionRequired(vfs);
        if (txError) {
            return deepFreeze(txError);
        }

        if (typeof path !== "string" || !path.trim()) {
            return deepFreeze({
                success: false,
                vfs: null,
                errors: [{
                    code: vfsErrorCodes.VFS_INVALID_INPUT,
                    path: "path",
                    message: "Path must be a non-empty string."
                }]
            });
        }

        const normalizedPath = path.replace(/\\/g, "/");
        const targetIndex = vfs.files.findIndex(f => f.path.replace(/\\/g, "/") === normalizedPath);
        if (targetIndex === -1) {
            return deepFreeze({
                success: false,
                vfs: null,
                errors: [{
                    code: vfsErrorCodes.VFS_FILE_NOT_FOUND,
                    path: "path",
                    message: `File not found: ${path}`
                }]
            });
        }

        const clonedVfs = JSON.parse(JSON.stringify(vfs));
        clonedVfs.files.splice(targetIndex, 1);
        clonedVfs.operations.push({
            type: "DELETE",
            path: path
        });

        sortVfsFields(clonedVfs);

        return deepFreeze({
            success: true,
            vfs: clonedVfs,
            errors: []
        });

    } catch (err) {
        return deepFreeze({
            success: false,
            vfs: null,
            errors: [{
                code: vfsErrorCodes.VFS_OPERATION_INTERNAL_ERROR,
                path: "",
                message: `Unexpected internal error during deleteFile: ${err.message}`
            }]
        });
    }
}

module.exports = {
    createFile,
    updateFile,
    deleteFile
};
