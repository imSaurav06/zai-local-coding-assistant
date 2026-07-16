"use strict";

const { createVirtualFileSystem, VFS_MODEL_VERSION } = require("./vfsModel");
const { vfsErrorCodes } = require("./vfsErrors");
const { beginTransaction, commitTransaction, rollbackTransaction } = require("./vfsTransaction");
const { createFile, updateFile, deleteFile } = require("./vfsOperations");

module.exports = {
    createVirtualFileSystem,
    VFS_MODEL_VERSION,
    vfsErrorCodes,
    beginTransaction,
    commitTransaction,
    rollbackTransaction,
    createFile,
    updateFile,
    deleteFile
};
