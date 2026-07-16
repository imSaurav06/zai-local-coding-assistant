"use strict";

const { createVirtualFileSystem, VFS_MODEL_VERSION } = require("./vfsModel");
const { vfsErrorCodes } = require("./vfsErrors");
const { beginTransaction, commitTransaction, rollbackTransaction } = require("./vfsTransaction");

module.exports = {
    createVirtualFileSystem,
    VFS_MODEL_VERSION,
    vfsErrorCodes,
    beginTransaction,
    commitTransaction,
    rollbackTransaction
};
