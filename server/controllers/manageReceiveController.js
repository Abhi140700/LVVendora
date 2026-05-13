import { receivePurchase } from "./purchaseController.js";

// Legacy compatibility wrapper. Manage Receive logic is now centralized in purchaseController.
export const receiveBill = (req, res) => receivePurchase(req, res);
