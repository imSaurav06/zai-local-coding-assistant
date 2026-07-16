"use strict";

const { vfsErrorCodes } = require("./vfsErrors");

const VFS_MODEL_VERSION = "1.0";

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
 * Creates a deterministic, deeply frozen Virtual File System domain model.
 * 
 * @param {Array} [files] Optional initial files array
 * @param {Object} [options] Optional configuration object
 */
function createVirtualFileSystem(files, options) {
    try {
        if (files === undefined || files === null) {
            files = [];
        }

        if (!Array.isArray(files)) {
            return deepFreeze({
                success: false,
                vfs: null,
                errors: [{
                    code: vfsErrorCodes.VFS_INVALID_INPUT,
                    path: "files",
                    message: "Files parameter must be an array."
                }]
            });
        }

        const pathSet = new Set();
        const validatedFiles = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (typeof file !== "object" || file === null) {
                return deepFreeze({
                    success: false,
                    vfs: null,
                    errors: [{
                        code: vfsErrorCodes.VFS_INVALID_FILE,
                        path: `files[${i}]`,
                        message: "Each file entry must be a non-null object."
                    }]
                });
            }

            if (typeof file.path !== "string" || !file.path.trim()) {
                return deepFreeze({
                    success: false,
                    vfs: null,
                    errors: [{
                        code: vfsErrorCodes.VFS_INVALID_FILE,
                        path: `files[${i}].path`,
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
                        path: `files[${i}].language`,
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
                        path: `files[${i}].content`,
                        message: "File content must be a string."
                    }]
                });
            }

            const status = file.hasOwnProperty("status") ? file.status : "PENDING";
            if (typeof status !== "string" || !status.trim()) {
                return deepFreeze({
                    success: false,
                    vfs: null,
                    errors: [{
                        code: vfsErrorCodes.VFS_INVALID_FILE,
                        path: `files[${i}].status`,
                        message: "File status must be a non-empty string."
                    }]
                });
            }

            const normalizedPath = file.path.replace(/\\/g, "/");
            if (pathSet.has(normalizedPath)) {
                return deepFreeze({
                    success: false,
                    vfs: null,
                    errors: [{
                        code: vfsErrorCodes.VFS_DUPLICATE_PATH,
                        path: `files[${i}].path`,
                        message: `Duplicate file path detected: ${file.path}`
                    }]
                });
            }
            pathSet.add(normalizedPath);

            validatedFiles.push({
                path: file.path,
                language: file.language,
                content: file.content,
                status: status
            });
        }

        const vfs = {
            version: VFS_MODEL_VERSION,
            metadata: {
                vfsVersion: VFS_MODEL_VERSION,
                createdBy: "vfs"
            },
            files: validatedFiles,
            operations: [],
            transaction: {
                active: true
            }
        };

        return deepFreeze({
            success: true,
            vfs,
            errors: []
        });

    } catch (err) {
        return deepFreeze({
            success: false,
            vfs: null,
            errors: [{
                code: vfsErrorCodes.VFS_INTERNAL_ERROR,
                path: "",
                message: `Unexpected internal error during VFS creation: ${err.message}`
            }]
        });
    }
}

module.exports = {
    createVirtualFileSystem,
    VFS_MODEL_VERSION
};
