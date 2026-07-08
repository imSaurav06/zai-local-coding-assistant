const History = require("../models/History");

const MAX_PROMPT_LENGTH = 50000;      // ~50KB limit
const MAX_RESPONSE_LENGTH = 250000;   // ~250KB limit
const MAX_HISTORY_RECORDS = 50;

// @desc    Create a new history record
// @route   POST /api/history
// @access  Private
const createHistory = async (req, res) => {
    try {
        const { prompt, response, type, model, projectId, originalPrompt, projectSpec, generationStatus, summary } = req.body;

        if (!prompt || !response || !type || !model) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required fields: prompt, response, type, model",
            });
        }

        // Validate payload sizes to return 413
        if (prompt.length > MAX_PROMPT_LENGTH || response.length > MAX_RESPONSE_LENGTH) {
            return res.status(413).json({
                success: false,
                message: "Payload too large. Prompt max 50KB, Response max 250KB.",
            });
        }

        // Create new history record belonging to the authenticated user
        const newRecord = await History.create({
            userId: req.user._id,
            prompt,
            response,
            type,
            model,
            projectId,
            originalPrompt,
            projectSpec,
            generationStatus,
            summary
        });

        // Automatically delete oldest records if total count exceeds the limit of 50
        const count = await History.countDocuments({ userId: req.user._id });
        if (count > MAX_HISTORY_RECORDS) {
            const oldestRecords = await History.find({ userId: req.user._id })
                .sort({ createdAt: 1 }) // oldest first
                .limit(count - MAX_HISTORY_RECORDS);
            
            const oldestIds = oldestRecords.map(r => r._id);
            await History.deleteMany({ _id: { $in: oldestIds } });
        }

        res.status(201).json(newRecord);
    } catch (error) {
        console.error("Create history error:", error.message);
        res.status(500).json({
            success: false,
            message: "Server error creating history record",
            error: error.message,
        });
    }
};

// @desc    Get user history list
// @route   GET /api/history
// @access  Private
const getHistory = async (req, res) => {
    try {
        const list = await History.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json(list);
    } catch (error) {
        console.error("Get history error:", error.message);
        res.status(500).json({
            success: false,
            message: "Server error retrieving history list",
            error: error.message,
        });
    }
};

// @desc    Get single history record by ID
// @route   GET /api/history/:id
// @access  Private
const getHistoryById = async (req, res) => {
    try {
        const item = await History.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "History record not found",
            });
        }

        // Ensure user owns this history record
        if (item.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to access this history record",
            });
        }

        res.status(200).json(item);
    } catch (error) {
        console.error("Get history item by ID error:", error.message);
        res.status(500).json({
            success: false,
            message: "Server error retrieving history item",
            error: error.message,
        });
    }
};

// @desc    Delete a history record
// @route   DELETE /api/history/:id
// @access  Private
const deleteHistory = async (req, res) => {
    try {
        const item = await History.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "History record not found",
            });
        }

        // Ensure user owns this history record
        if (item.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to delete this history record",
            });
        }

        await History.deleteOne({ _id: item._id });

        res.status(200).json({
            success: true,
            message: "History record deleted successfully",
        });
    } catch (error) {
        console.error("Delete history error:", error.message);
        res.status(500).json({
            success: false,
            message: "Server error deleting history record",
            error: error.message,
        });
    }
};

module.exports = {
    createHistory,
    getHistory,
    getHistoryById,
    deleteHistory,
};
