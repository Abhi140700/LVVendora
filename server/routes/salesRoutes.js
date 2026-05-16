import express from "express";
import {
  clearSalesDraft,
  closePosSession,
  createOrLookupCustomer,
  createSale,
  dayEndPosSession,
  deleteSalesCustomer,
  getLoyaltySummary,
  getCustomerCommunicationHistory,
  getNextSalesBillNo,
  getSalesCustomers,
  getSales,
  getSalesWorkbench,
  holdSalesDraft,
  openPosSession,
  processSalesReturn,
  recallHeldDraft,
  undoDayEndPosSession,
  updateSalesCustomer,
  upsertSalesDraft
} from "../controllers/salesController.js";
import {
  getCashSalesAdjustmentHistory,
  previewCashSalesAdjustment,
  processCashSalesAdjustment,
  reverseCashSalesAdjustment
} from "../controllers/cashSalesAdjustmentController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// GET all sales
router.get("/", protect, getSales);
router.get("/workbench", protect, authorizeRoles("admin", "sales", "manager", "accountant"), getSalesWorkbench);
router.get("/next-bill-no", protect, authorizeRoles("admin", "sales", "manager", "accountant"), getNextSalesBillNo);
router.get("/loyalty/:customerPhone", protect, getLoyaltySummary);
router.get("/customers/communication/history", protect, authorizeRoles("admin", "sales", "manager", "accountant"), getCustomerCommunicationHistory);
router.post("/cash-adjustment/preview", protect, authorizeRoles("superadmin"), previewCashSalesAdjustment);
router.post("/cash-adjustment/process", protect, authorizeRoles("superadmin"), processCashSalesAdjustment);
router.get("/cash-adjustment/history", protect, authorizeRoles("superadmin"), getCashSalesAdjustmentHistory);
router.post("/cash-adjustment/reverse", protect, authorizeRoles("superadmin"), reverseCashSalesAdjustment);
router.post("/session/open", protect, authorizeRoles("admin", "sales", "manager", "accountant"), openPosSession);
router.post("/session/close", protect, authorizeRoles("admin", "manager", "accountant"), closePosSession);
router.post("/session/day-end", protect, authorizeRoles("admin", "manager", "accountant"), dayEndPosSession);
router.post("/session/day-end/undo", protect, authorizeRoles("superadmin"), undoDayEndPosSession);
router.post("/draft", protect, authorizeRoles("admin", "sales", "manager", "accountant"), upsertSalesDraft);
router.delete("/draft", protect, authorizeRoles("admin", "sales", "manager"), clearSalesDraft);
router.post("/hold", protect, authorizeRoles("admin", "sales", "manager", "accountant"), holdSalesDraft);
router.post("/recall/:id", protect, authorizeRoles("admin", "sales", "manager", "accountant"), recallHeldDraft);
router.get("/customers", protect, authorizeRoles("admin", "sales", "manager", "accountant"), getSalesCustomers);
router.post("/customers", protect, authorizeRoles("admin", "sales", "manager", "accountant"), createOrLookupCustomer);
router.put("/customers/:id", protect, authorizeRoles("admin", "sales", "manager", "accountant"), updateSalesCustomer);
router.delete("/customers/:id", protect, authorizeRoles("admin", "sales", "manager", "accountant"), deleteSalesCustomer);
router.post("/return/:saleId", protect, authorizeRoles("admin", "sales", "manager", "accountant"), processSalesReturn);

// POST create sale → only admin & sales
router.post("/", protect, authorizeRoles("admin", "sales", "manager"), createSale);

export default router;
