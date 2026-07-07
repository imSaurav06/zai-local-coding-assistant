const express = require("express");
const {
    createHistory,
    getHistory,
    getHistoryById,
    deleteHistory,
} = require("../controllers/historyController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Apply authMiddleware to all routes in this file
router.use(authMiddleware);

router.post("/", createHistory);
router.get("/", getHistory);
router.get("/:id", getHistoryById);
router.delete("/:id", deleteHistory);

module.exports = router;
