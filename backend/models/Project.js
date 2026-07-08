const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        projectName: {
            type: String,
            required: true,
        },
        projectType: {
            type: String,
        },
        summary: {
            type: String,
        },
        files: [
            {
                name: {
                    type: String,
                    required: true,
                },
                content: {
                    type: String,
                    required: true,
                },
            },
        ],
        runInstructions: {
            prerequisites: [String],
            steps: [String],
            frontendUrl: String,
            backendUrl: String,
        },
        model: {
            type: String,
        },
        originalPrompt: {
            type: String,
        },
        projectSpec: {
            type: mongoose.Schema.Types.Mixed,
        },
        generationStatus: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

const Project = mongoose.model("Project", projectSchema);

module.exports = Project;
