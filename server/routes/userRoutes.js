import express from "express";
import { createUser, deleteUser, getUsers } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/", protect, authorizeRoles("admin"), getUsers);
router.post("/", protect, authorizeRoles("admin"), createUser);
router.delete("/:id", protect, authorizeRoles("admin"), deleteUser);

export default router;
