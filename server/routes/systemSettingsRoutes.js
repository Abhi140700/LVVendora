import express from "express";
import { getSettings, saveSettings } from "../controllers/systemSettingsController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/", protect, getSettings);
router.put("/", protect, authorizeRoles("admin", "manager"), saveSettings);

export default router;
