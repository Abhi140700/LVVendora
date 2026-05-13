import express from "express";
import {
  createParty,
  deleteParty,
  getParties,
  getNextPartyCode,
  lookupGstDetails,
  updateParty
} from "../../controllers/master/partyController.js";
import { protect } from "../../middleware/authMiddleware.js";
import { authorizeRoles } from "../../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/", protect, getParties);
router.get("/next-code", protect, getNextPartyCode);
router.get("/gst/:gstNo", protect, lookupGstDetails);
router.post("/", protect, authorizeRoles("admin", "stock"), createParty);
router.put("/:id", protect, authorizeRoles("admin", "stock"), updateParty);
router.delete("/:id", protect, authorizeRoles("admin"), deleteParty);

export default router;
