import express from "express";
import {
  createExpenseEntry,
  createLedgerAdjustment,
  createReceipt,
  getExpenseEntries,
  getAccountingCustomers,
  getCustomerLedgerEntries,
  getReceipts
} from "../controllers/accountingController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect, authorizeRoles("admin", "accountant", "manager", "sales"));

router.get("/customers", getAccountingCustomers);
router.get("/receipts", getReceipts);
router.get("/expense-entries", getExpenseEntries);
router.get("/ledger/:customerId", getCustomerLedgerEntries);
router.post("/receipts", createReceipt);
router.post("/ledger-adjustments", createLedgerAdjustment);
router.post("/expense-entries", createExpenseEntry);

export default router;
