"use strict";

const checkpointRestoreErrorCodes = Object.freeze({
    CHECKPOINT_RESTORE_FAILED: "CHECKPOINT_RESTORE_FAILED",
    CHECKPOINT_RESUME_INVALID: "CHECKPOINT_RESUME_INVALID",
    CHECKPOINT_CORRUPTED: "CHECKPOINT_CORRUPTED",
    CHECKPOINT_STATE_MISMATCH: "CHECKPOINT_STATE_MISMATCH"
});

function validateResumeState(checkpoint, taskGraph) {
    if (!checkpoint || typeof checkpoint !== "object" || Array.isArray(checkpoint)) {
        const err = new Error("Checkpoint must be a non-null object.");
        err.code = checkpointRestoreErrorCodes.CHECKPOINT_CORRUPTED;
        throw err;
    }

    // 1. Unknown version
    if (checkpoint.version !== "1.0") {
        const err = new Error(`Unsupported checkpoint version: '${checkpoint.version}'`);
        err.code = checkpointRestoreErrorCodes.CHECKPOINT_RESUME_INVALID;
        throw err;
    }

    // 2. Missing metadata
    if (!checkpoint.executionId || !checkpoint.metadata || typeof checkpoint.metadata !== "object") {
        const err = new Error("Missing execution metadata.");
        err.code = checkpointRestoreErrorCodes.CHECKPOINT_RESUME_INVALID;
        throw err;
    }

    // 3. Corrupted properties
    if (
        !checkpoint.queues ||
        typeof checkpoint.queues !== "object" ||
        !Array.isArray(checkpoint.queues.pending) ||
        !Array.isArray(checkpoint.queues.completed) ||
        !checkpoint.statistics ||
        typeof checkpoint.statistics !== "object"
    ) {
        const err = new Error("Checkpoint queues or statistics are corrupted.");
        err.code = checkpointRestoreErrorCodes.CHECKPOINT_CORRUPTED;
        throw err;
    }

    // 4. Task graph mismatch
    if (taskGraph) {
        const graphTaskIds = new Set((taskGraph.nodes || []).map(n => n.stableId || n.id));
        
        for (const taskId of checkpoint.queues.completed) {
            if (!graphTaskIds.has(taskId)) {
                const err = new Error(`Checkpoint completed task '${taskId}' not found in task graph.`);
                err.code = checkpointRestoreErrorCodes.CHECKPOINT_STATE_MISMATCH;
                throw err;
            }
        }

        for (const taskId of checkpoint.queues.pending) {
            if (!graphTaskIds.has(taskId)) {
                const err = new Error(`Checkpoint pending task '${taskId}' not found in task graph.`);
                err.code = checkpointRestoreErrorCodes.CHECKPOINT_STATE_MISMATCH;
                throw err;
            }
        }

        // 5. Invalid completed task list (dependency check)
        const completedSet = new Set(checkpoint.queues.completed);
        const nodeMap = new Map((taskGraph.nodes || []).map(n => [n.stableId || n.id, n]));

        for (const taskId of checkpoint.queues.completed) {
            const node = nodeMap.get(taskId);
            if (node && node.dependencies) {
                for (const depId of node.dependencies) {
                    if (!completedSet.has(depId)) {
                        const err = new Error(`Task '${taskId}' is completed, but its dependency '${depId}' is not completed.`);
                        err.code = checkpointRestoreErrorCodes.CHECKPOINT_RESUME_INVALID;
                        throw err;
                    }
                }
            }
        }
    }

    return true;
}

module.exports = {
    validateResumeState,
    checkpointRestoreErrorCodes
};
