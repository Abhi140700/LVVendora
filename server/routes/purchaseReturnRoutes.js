import express from "express";
import {
  createPurchaseReturn,
  deletePurchaseReturn,
  getPurchaseReturnById,
  getPurchaseReturns,
  lookupPurchaseReturnBarcode,
  updatePurchaseReturn
} from "../controllers/purchaseReturnController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect, authorizeRoles("admin", "stock"));

router.get("/", getPurchaseReturns);
router.get("/lookup/:barcode", lookupPurchaseReturnBarcode);
router.get("/:returnId", getPurchaseReturnById);
router.post("/", createPurchaseReturn);
router.put("/:returnId", updatePurchaseReturn);
router.delete("/:returnId", deletePurchaseReturn);

export default router;
