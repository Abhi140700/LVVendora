import express from "express";
import { deleteAuditLog, getAuditLogs } from "../controllers/auditController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/", protect, authorizeRoles("admin", "manager", "accountant"), getAuditLogs);
router.delete("/:id", protect, authorizeRoles("admin", "manager"), deleteAuditLog);

export default router;
