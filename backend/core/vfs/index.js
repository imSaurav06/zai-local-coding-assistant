"use strict";

const { createVirtualFileSystem, VFS_MODEL_VERSION } = require("./vfsModel");
const { vfsErrorCodes } = require("./vfsErrors");

module.exports = {
    createVirtualFileSystem,
    VFS_MODEL_VERSION,
    vfsErrorCodes
};
