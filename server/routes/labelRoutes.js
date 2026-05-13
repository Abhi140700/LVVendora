import express from "express";
import { createLabel, getHistory, getLabelsByItem, getNextBarcode, reprintLabel } from "../controllers/labelController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Create a new label
router.post("/create", protect, authorizeRoles("admin", "stock"), createLabel);
router.post("/reprint/:labelId", protect, authorizeRoles("admin", "stock"), reprintLabel);

// Get the next sequential barcode
router.get("/next-barcode", protect, authorizeRoles("admin", "stock"), getNextBarcode);

// Get label history by bill
router.get("/history/:billId", protect, getHistory);

// Get labels by item
router.get("/item/:itemId", protect, getLabelsByItem);

export default router;
