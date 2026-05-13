import express from "express";
import {
  exportTallyJson,
  exportTallyXml,
  getTallyLogs,
  getTallySettings,
  getTallySnapshot,
  prepareTallySync,
  updateTallySettings
} from "../controllers/tallyController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect, authorizeRoles("admin", "accountant", "manager"));

router.get("/snapshot", getTallySnapshot);
router.get("/logs", getTallyLogs);
router.get("/settings", getTallySettings);
router.put("/settings", updateTallySettings);
router.post("/prepare", prepareTallySync);
router.get("/export/json", exportTallyJson);
router.get("/export/xml", exportTallyXml);

export default router;
