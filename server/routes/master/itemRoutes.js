import express from "express";
import { createItem, deleteItem, getItems, updateItem } from "../../controllers/master/itemController.js";
import { protect } from "../../middleware/authMiddleware.js";
import { authorizeRoles } from "../../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/", protect, getItems);
router.post("/", protect, authorizeRoles("admin"), createItem);
router.put("/:id", protect, authorizeRoles("admin"), updateItem);
router.delete("/:id", protect, authorizeRoles("admin"), deleteItem);

export default router;
