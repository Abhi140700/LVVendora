import express from "express";
import { getCategories, createCategory, updateCategory, deleteCategory } from "../../controllers/master/categoryController.js";
import { protect } from "../../middleware/authMiddleware.js";
import { authorizeRoles } from "../../middleware/roleMiddleware.js";

const router = express.Router();
router.get("/", protect, getCategories);
router.post("/", protect, authorizeRoles("admin"), createCategory);
router.put("/:id", protect, authorizeRoles("admin"), updateCategory);
router.delete("/:id", protect, authorizeRoles("admin"), deleteCategory);
export default router;
