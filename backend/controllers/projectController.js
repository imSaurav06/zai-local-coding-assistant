const projectService = require("../services/projectService");
const Project = require("../models/Project");
const History = require("../models/History");
const AdmZip = require("adm-zip");
const { orchestrateGeneration } = require("../services/generationOrchestrator");
const { createProgressEmitter } = require("../services/progressEmitter");

/**
 * Stage 1: Requirement Analysis
 * POST /api/project/analyze
 */
const analyze = async (req, res) => {
    console.log("REQUEST:", req.method, req.url);

    try {
        const { prompt } = req.body;

        if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Prompt is required and must be a non-empty string",
            });
        }

        const projectSpec = await projectService.analyzeRequirements({
            prompt
        });

        res.status(200).json({
            success: true,
            projectSpec
        });

    } catch (error) {
        console.error("PROJECT ANALYZE ERROR:", error.message);
        res.status(500).json({
            success: false,
            message: "Failed to analyze project requirements",
            error: error.message
        });
    }
};

/**
 * Stage 2: Project Generation
 * POST /api/project/generate
 */
const generate = async (req, res) => {
    console.log("REQUEST:", req.method, req.url);

    try {
        const { originalPrompt, projectSpec } = req.body;

        if (!originalPrompt || typeof originalPrompt !== "string" || originalPrompt.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "originalPrompt is required and must be a non-empty string",
            });
        }

        if (!projectSpec || typeof projectSpec !== "object") {
            return res.status(400).json({
                success: false,
                message: "projectSpec is required and must be an object",
            });
        }

        // Initialize progress emitter (SSE)
        const progressEmitter = createProgressEmitter(res);

        let cancelled = false;
        let completed = false;
        const controller = new AbortController();

        req.on("close", () => {
            if (completed) return; // Verify response is not already completed before aborting
            cancelled = true;
            controller.abort();
            console.log("CLIENT DISCONNECTED: Cancelling generation orchestrator...");
        });

        const checkCancellation = () => {
            if (cancelled) throw new Error("Generation was cancelled due to client disconnection.");
        };

        const data = await orchestrateGeneration({
            originalPrompt,
            projectSpec
        }, progressEmitter, checkCancellation, {
            cancelSignal: controller.signal
        });

        checkCancellation();

        progressEmitter.emit("Saving Project", "Writing codebase configuration to database...");

        // Save to Database with spec details
        const dbProject = await Project.create({
            userId: req.user._id,
            projectName: projectSpec.projectName || "Project Scaffold",
            projectType: projectSpec.projectType || "Web Application",
            summary: data.summary,
            files: data.files,
            runInstructions: data.runInstructions,
            model: data.model,
            originalPrompt,
            projectSpec,
            generationStatus: "success"
        });

        // Save to History Database
        await History.create({
            userId: req.user._id,
            prompt: `Build Project: ${dbProject.projectName} - ${originalPrompt.substring(0, 40)}...`,
            response: data.summary || "Project generated successfully.",
            type: "project",
            model: data.model,
            projectId: dbProject._id,
            originalPrompt,
            projectSpec,
            generationStatus: "success",
            summary: dbProject.summary
        });

        completed = true;

        progressEmitter.end({
            success: true,
            projectId: dbProject._id,
            projectName: dbProject.projectName,
            summary: dbProject.summary,
            files: dbProject.files,
            runInstructions: dbProject.runInstructions,
            result: data.summary,
            model: data.model,
            generationStatus: "success"
        });

    } catch (error) {
        console.error("PROJECT GENERATION ERROR:", error.message);
        
        if (progressEmitter && typeof progressEmitter.clear === "function") {
            progressEmitter.clear();
        }
        
        if (cancelled) {
            console.log("ABORT COMPLETE: Preventing DB saves and response ends.");
            return;
        }

        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({ stage: "Error", error: error.message })}\n\n`);
            res.end();
        } else {
            res.status(500).json({
                success: false,
                message: "Failed to generate project codebase. Validation/repair failed.",
                error: error.message
            });
        }
    }
};

const downloadProjectZip = async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) {
            return res.status(404).json({ success: false, message: "Project not found" });
        }

        // Check ownership
        if (project.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized to download this project" });
        }

        const zip = new AdmZip();

        // Add files to zip archive
        project.files.forEach(file => {
            zip.addFile(file.name, Buffer.from(file.content, "utf8"));
        });

        const zipBuffer = zip.toBuffer();

        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="${project.projectName.toLowerCase().replace(/\s+/g, "_")}.zip"`);
        res.status(200).send(zipBuffer);

    } catch (error) {
        console.error("Download project zip error:", error.message);
        res.status(500).json({
            success: false,
            message: "Server error generating zip file",
            error: error.message,
        });
    }
};

const getProjectById = async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) {
            return res.status(404).json({ success: false, message: "Project not found" });
        }

        if (project.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized to access this project" });
        }

        res.status(200).json(project);
    } catch (error) {
        console.error("Get project details error:", error.message);
        res.status(500).json({
            success: false,
            message: "Server error retrieving project details",
            error: error.message,
        });
    }
};

module.exports = {
    analyze,
    generate,
    downloadProjectZip,
    getProjectById,
};
