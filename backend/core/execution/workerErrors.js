"use strict";

const workerErrorCodes = Object.freeze({
    WORKER_INVALID_INPUT: "WORKER_INVALID_INPUT",
    WORKER_INVALID_STATUS: "WORKER_INVALID_STATUS",
    WORKER_DUPLICATE_ID: "WORKER_DUPLICATE_ID",
    WORKER_MUTABLE_INPUT: "WORKER_MUTABLE_INPUT"
});

module.exports = {
    workerErrorCodes
};
