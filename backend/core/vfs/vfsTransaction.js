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
 * Begins a transaction on a VFS instance, returning a new active transactional VFS.
 * 
 * @param {Object} vfs Validated VFS instance
 */
function beginTransaction(vfs) {
    try {
        if (!validateVfsStructure(vfs)) {
            return deepFreeze({
                success: false,
                vfs: null,
                errors: [{
                    code: vfsErrorCodes.VFS_TRANSACTION_INVALID_STATE,
                    path: "vfs",
                    message: "Invalid or malformed VFS object."
                }]
            });
        }

        if (vfs.transaction.active === true) {
            return deepFreeze({
                success: false,
                vfs: null,
                errors: [{
                    code: vfsErrorCodes.VFS_TRANSACTION_ALREADY_ACTIVE,
                    path: "vfs.transaction.active",
                    message: "Transaction is already active."
                }]
            });
        }

        const clonedVfs = JSON.parse(JSON.stringify(vfs));
        clonedVfs.transaction.active = true;
        clonedVfs.transaction.snapshot = JSON.parse(JSON.stringify(vfs.files));

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
                code: vfsErrorCodes.VFS_TRANSACTION_INTERNAL_ERROR,
                path: "",
                message: `Unexpected internal error during beginTransaction: ${err.message}`
            }]
        });
    }
}

/**
 * Commits the active transaction, making all buffered changes permanent.
 * 
 * @param {Object} vfs Validated VFS instance
 */
function commitTransaction(vfs) {
    try {
        if (!validateVfsStructure(vfs)) {
            return deepFreeze({
                success: false,
                vfs: null,
                errors: [{
                    code: vfsErrorCodes.VFS_TRANSACTION_INVALID_STATE,
                    path: "vfs",
                    message: "Invalid or malformed VFS object."
                }]
            });
        }

        if (vfs.transaction.active !== true) {
            return deepFreeze({
                success: false,
                vfs: null,
                errors: [{
                    code: vfsErrorCodes.VFS_TRANSACTION_NOT_ACTIVE,
                    path: "vfs.transaction.active",
                    message: "Transaction is not active."
                }]
            });
        }

        const clonedVfs = JSON.parse(JSON.stringify(vfs));
        clonedVfs.transaction.active = false;
        clonedVfs.operations = [];
        if (clonedVfs.transaction.hasOwnProperty("snapshot")) {
            delete clonedVfs.transaction.snapshot;
        }

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
                code: vfsErrorCodes.VFS_TRANSACTION_INTERNAL_ERROR,
                path: "",
                message: `Unexpected internal error during commitTransaction: ${err.message}`
            }]
        });
    }
}

/**
 * Rolls back the active transaction, restoring files to the saved snapshot.
 * 
 * @param {Object} vfs Validated VFS instance
 */
function rollbackTransaction(vfs) {
    try {
        if (!validateVfsStructure(vfs)) {
            return deepFreeze({
                success: false,
                vfs: null,
                errors: [{
                    code: vfsErrorCodes.VFS_TRANSACTION_INVALID_STATE,
                    path: "vfs",
                    message: "Invalid or malformed VFS object."
                }]
            });
        }

        if (vfs.transaction.active !== true) {
            return deepFreeze({
                success: false,
                vfs: null,
                errors: [{
                    code: vfsErrorCodes.VFS_TRANSACTION_NOT_ACTIVE,
                    path: "vfs.transaction.active",
                    message: "Transaction is not active."
                }]
            });
        }

        if (!Array.isArray(vfs.transaction.snapshot)) {
            return deepFreeze({
                success: false,
                vfs: null,
                errors: [{
                    code: vfsErrorCodes.VFS_TRANSACTION_INVALID_STATE,
                    path: "vfs.transaction.snapshot",
                    message: "Rollback snapshot is missing or invalid."
                }]
            });
        }

        const clonedVfs = JSON.parse(JSON.stringify(vfs));
        clonedVfs.files = JSON.parse(JSON.stringify(vfs.transaction.snapshot));
        clonedVfs.operations = [];
        clonedVfs.transaction.active = false;
        if (clonedVfs.transaction.hasOwnProperty("snapshot")) {
            delete clonedVfs.transaction.snapshot;
        }

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
                code: vfsErrorCodes.VFS_TRANSACTION_INTERNAL_ERROR,
                path: "",
                message: `Unexpected internal error during rollbackTransaction: ${err.message}`
            }]
        });
    }
}

module.exports = {
    beginTransaction,
    commitTransaction,
    rollbackTransaction
};
