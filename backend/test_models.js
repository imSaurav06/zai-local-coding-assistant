const mongoose = require('mongoose');
const Project = require('./models/Project');
const History = require('./models/History');
require('dotenv').config();

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to Mongo.");
    try {
        const dummyProj = await Project.create({
            userId: new mongoose.Types.ObjectId(),
            projectName: "Test",
            projectType: "Test",
            summary: "Test",
            files: [{ name: "test.txt", content: "test" }],
            runInstructions: { steps: ["test"] },
            model: "test-model",
            originalPrompt: "test prompt",
            projectSpec: { test: 123 },
            generationStatus: "success"
        });
        console.log("Project created successfully!", dummyProj._id);
        
        const dummyHistory = await History.create({
            userId: dummyProj.userId,
            prompt: "test prompt",
            response: "test response",
            type: "project",
            model: "test-model",
            projectId: dummyProj._id,
            originalPrompt: "test prompt",
            projectSpec: { test: 123 },
            generationStatus: "success",
            summary: "test summary"
        });
        console.log("History created successfully!", dummyHistory._id);

        // cleanup
        await Project.deleteOne({ _id: dummyProj._id });
        await History.deleteOne({ _id: dummyHistory._id });
        console.log("Cleanup complete.");
    } catch (e) {
        console.error("Mongoose Model Error:", e);
    }
    await mongoose.disconnect();
}
run();
