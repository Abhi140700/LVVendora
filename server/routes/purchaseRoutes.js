import express from "express";
import {
  createOrUpdateLrEntry,
  checkDuplicatePurchaseBill,
  createPurchase,
  deletePurchase,
  getLrEntryById,
  getNextGrnNo,
  getNextLrId,
  getPurchaseById,
  getPurchaseByLrId,
  getPurchasePartyInsights,
  getPurchases,
  previewPurchaseBillScan,
  receivePurchase,
  updatePurchaseLrDetails,
  updatePurchase
} from "../controllers/purchaseController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// POST a new purchase → only admin & stock
router.post("/", protect, authorizeRoles("admin", "stock"), createPurchase);

// PUT update purchase → only admin & stock
router.put("/:billId", protect, authorizeRoles("admin", "stock"), updatePurchase);

// DELETE purchase → only admin & stock
router.delete("/:billId", protect, authorizeRoles("admin"), deletePurchase);

// GET all purchases → any logged-in user
router.get("/next-grn", protect, authorizeRoles("admin", "stock"), getNextGrnNo);
router.get("/next-lr-id", protect, authorizeRoles("admin", "stock"), getNextLrId);
router.get("/party-insights", protect, authorizeRoles("admin", "stock"), getPurchasePartyInsights);
router.get("/duplicate-check", protect, authorizeRoles("admin", "stock"), checkDuplicatePurchaseBill);
router.post("/bill-scan/preview", protect, authorizeRoles("admin", "stock"), previewPurchaseBillScan);
router.get("/lr-entry/:lrId", protect, getLrEntryById);
router.post("/lr-entry", protect, authorizeRoles("admin", "stock"), createOrUpdateLrEntry);
router.get("/", protect, getPurchases);

// GET purchase by LR ID
router.get("/lr/:lrId", protect, getPurchaseByLrId);
router.get("/detail/:billId", protect, getPurchaseById);

// POST receive purchase → only admin & stock
router.post("/:billId/receive", protect, authorizeRoles("admin", "stock"), receivePurchase);
router.patch("/:billId/lr-details", protect, authorizeRoles("admin", "stock"), updatePurchaseLrDetails);

export default router;
