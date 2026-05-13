import express from "express";
import {
  broadcastMessage,
  getWhatsAppConnectionStatus,
  initializeWhatsAppConnection,
  sendBillOnWhatsApp
} from "../controllers/whatsappController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/status", protect, authorizeRoles("admin", "manager", "sales"), getWhatsAppConnectionStatus);
router.post("/connect", protect, authorizeRoles("admin", "manager", "sales"), initializeWhatsAppConnection);
router.post("/send-bill/:saleId", protect, authorizeRoles("admin", "manager", "sales"), sendBillOnWhatsApp);
router.post("/broadcast", protect, authorizeRoles("admin", "manager"), broadcastMessage);

export default router;
