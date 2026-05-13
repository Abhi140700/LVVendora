import express from "express";
import {
  getAdvancedReport,
  getCashBookReport,
  getDashboardReport,
  getGstComplianceReport,
  getGstReport,
  getProfitLossReport,
  getPurchaseReport,
  getSalesReport,
  getStockReport
} from "../controllers/reportController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect, authorizeRoles("admin", "accountant", "manager", "sales"));

router.get("/", getDashboardReport);
router.get("/sales", getSalesReport);
router.get("/purchase", getPurchaseReport);
router.get("/stock", getStockReport);
router.get("/gst", getGstReport);
router.get("/gst-compliance", getGstComplianceReport);
router.get("/profit-loss", getProfitLossReport);
router.get("/cash-book", getCashBookReport);
router.get("/advanced/:type", getAdvancedReport);

export default router;
