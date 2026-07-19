"use strict";

const targetedRepairService = require("../../services/targetedRepairService");
const { repairErrorCodes } = require("./repairErrors");

/**
 * Repairs only the affected files from a verification report, preserving untouched files.
 */
async function repair(files, verificationReport, projectSpec, contracts, options = {}) {
    if (!verificationReport || typeof verificationReport !== "object") {
        const err = new Error("Invalid verification report.");
        err.code = repairErrorCodes.REPAIR_RESULT_INVALID;
        throw err;
    }

    if (!Array.isArray(files)) {
        const err = new Error("Files must be an array.");
        err.code = repairErrorCodes.REPAIR_RESULT_INVALID;
        throw err;
    }

    // Identify affected files
    const affectedFiles = new Set();
    const errors = verificationReport.errors || [];
    errors.forEach(err => {
        if (err && err.path) {
            affectedFiles.add(err.path);
        }
    });

    // If no path was identified, use mapErrorsToFiles
    if (affectedFiles.size === 0) {
        const mapped = targetedRepairService.mapErrorsToFiles(errors, files);
        mapped.forEach(f => affectedFiles.add(f));
    }

    const targetFiles = Array.from(affectedFiles);
    if (targetFiles.length === 0) {
        // Nothing to repair
        return Object.freeze({
            success: true,
            files: Object.freeze(files.map(f => Object.freeze({ ...f })))
        });
    }

    const updatedFilesMap = new Map(files.map(f => [f.name, f.content]));

    for (const targetName of targetFiles) {
        const fileErrors = errors.filter(e => {
            const errStr = typeof e === "object" && e !== null ? (e.message || e.path || "") : String(e);
            return errStr.includes(targetName) || (e && e.path === targetName);
        });
        const activeErrors = fileErrors.length > 0 ? fileErrors : errors;

        // Perform repair
        let repairResult;
        try {
            repairResult = await targetedRepairService.repairSingleFile(
                targetName,
                activeErrors,
                null,
                files,
                projectSpec,
                contracts,
                options
            );
        } catch (err) {
            const error = new Error(`Repair engine failed: ${err.message}`);
            error.code = repairErrorCodes.REPAIR_ENGINE_FAILED;
            error.originalError = err;
            throw error;
        }

        if (!repairResult || !repairResult.success || !repairResult.repairedFile) {
            const error = new Error(repairResult ? repairResult.message : "Repair engine execution failed.");
            error.code = repairErrorCodes.REPAIR_ENGINE_FAILED;
            throw error;
        }

        // Apply updated content
        updatedFilesMap.set(repairResult.repairedFile.name, repairResult.repairedFile.content);
    }

    const repairedFilesList = files.map(f => {
        return Object.freeze({
            name: f.name,
            content: updatedFilesMap.get(f.name)
        });
    });

    return Object.freeze({
        success: true,
        files: Object.freeze(repairedFilesList)
    });
}

module.exports = {
    repair,
    repairErrorCodes
};
