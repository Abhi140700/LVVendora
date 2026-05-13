import express from "express";
import {
  getInventory,
  addInventory,
  updateInventory,
  adjustStock,
  transferStock,
  getInventoryBatches,
  createInventoryBatch,
  getInventoryById,
  deleteInventory,
  lookupInventoryByBarcode
} from "../controllers/inventoryController.js";

import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// POST adjust stock must come BEFORE /:id to avoid route conflict
router.post("/adjust", protect, authorizeRoles("admin", "stock"), async (req, res) => {
  try {
    const updatedItem = await adjustStock(req.body);
    res.status(200).json({ success: true, data: updatedItem });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post("/transfer", protect, authorizeRoles("admin", "stock"), transferStock);
router.get("/batches", protect, getInventoryBatches);
router.post("/batches", protect, authorizeRoles("admin", "stock"), createInventoryBatch);
router.get("/lookup/:barcode", protect, lookupInventoryByBarcode);

// GET inventory list
router.get("/", protect, getInventory);

// GET inventory by ID
router.get("/:id", protect, getInventoryById);

// POST new inventory item
router.post("/", protect, authorizeRoles("admin"), addInventory);

// PUT update inventory item
router.put("/:id", protect, authorizeRoles("admin", "stock"), updateInventory);

// DELETE inventory item
router.delete("/:id", protect, authorizeRoles("admin"), deleteInventory);

export default router;
