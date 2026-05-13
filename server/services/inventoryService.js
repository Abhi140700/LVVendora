import Inventory from "../models/Inventory.js";

const clampNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const round2 = (value) => Math.round(clampNumber(value) * 100) / 100;

export const deductInventoryItems = async (saleItems = [], { session, allowNegativeStock = false } = {}) => {
  for (const item of saleItems) {
    const qty = round2(clampNumber(item.qty));
    const updatedInventory = await Inventory.findOneAndUpdate(
      {
        _id: item.inventoryId,
        ...(!allowNegativeStock ? { stock: { $gte: qty } } : {})
      },
      { $inc: { stock: -qty } },
      { returnDocument: "after", session }
    );

    if (!updatedInventory) {
      throw new Error(`Insufficient or missing stock for ${item.itemName || item.inventoryId}`);
    }
  }
};

export const restockInventoryItems = async (items = [], { session } = {}) => {
  for (const item of items) {
    const qty = round2(clampNumber(item.qty));
    const updatedInventory = await Inventory.findOneAndUpdate(
      {
        $or: [
          ...(item.inventoryId ? [{ _id: item.inventoryId }] : []),
          ...(item.itemId ? [{ itemId: item.itemId }] : []),
          ...(item.barcode ? [{ barcode: item.barcode }] : [])
        ]
      },
      { $inc: { stock: qty } },
      { returnDocument: "after", session }
    );

    if (!updatedInventory) {
      throw new Error(`Inventory item not found for ${item.itemName || item.barcode || item.itemId}`);
    }
  }
};
