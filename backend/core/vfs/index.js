"use strict";

const { createVirtualFileSystem, VFS_MODEL_VERSION } = require("./vfsModel");
const { vfsErrorCodes } = require("./vfsErrors");
const { beginTransaction, commitTransaction, rollbackTransaction } = require("./vfsTransaction");
const { createFile, updateFile, deleteFile } = require("./vfsOperations");
const { synchronizeVfs, verifyCanonicalVfs } = require("./vfsSync");

module.exports = {
    createVirtualFileSystem,
    VFS_MODEL_VERSION,
    vfsErrorCodes,
    beginTransaction,
    commitTransaction,
    rollbackTransaction,
    createFile,
    updateFile,
    deleteFile,
    synchronizeVfs,
    verifyCanonicalVfs
};
