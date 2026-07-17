const mongoose = require("mongoose");

const checkpointSchema = new mongoose.Schema(
    {
        executionId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        version: {
            type: String,
            required: true
        },
        payload: {
            type: String,
            required: true
        }
    },
    {
        timestamps: true
    }
);

// Prevent compiling model multiple times if required dynamically
const CheckpointModel = mongoose.models.Checkpoint || mongoose.model("Checkpoint", checkpointSchema);

module.exports = CheckpointModel;
