import express from "express";
import { getSystemNotifications } from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/", protect, authorizeRoles("admin", "manager", "sales", "stock", "accountant"), getSystemNotifications);

export default router;
