const express = require("express");
const projectController = require("../controllers/projectController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/analyze", authMiddleware, projectController.analyze);
router.post("/generate", authMiddleware, projectController.generate);
router.get("/:projectId", authMiddleware, projectController.getProjectById);
router.get("/:projectId/download", authMiddleware, projectController.downloadProjectZip);

// Project Preview Sandbox Routes
router.post("/:projectId/preview", authMiddleware, projectController.startPreview);
router.get("/:projectId/preview/status", authMiddleware, projectController.getPreviewStatus);
router.delete("/:projectId/preview", authMiddleware, projectController.stopPreview);

module.exports = router;
