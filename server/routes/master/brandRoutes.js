// routes/brandRoutes.js
import express from "express";
import { getBrands, createBrand } from "../../controllers/master/brandController.js";
import { protect } from "../../middleware/authMiddleware.js";
import { authorizeRoles } from "../../middleware/roleMiddleware.js";

const router = express.Router();
router.get("/", protect, getBrands);
router.post("/", protect, authorizeRoles("admin"), createBrand);
export default router;