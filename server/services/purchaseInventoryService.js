import Inventory from "../models/Inventory.js";

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const asNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const receivePurchaseIntoInventory = async (purchaseItems = [], { session } = {}) => {
  for (const item of purchaseItems) {
    const itemId = item.itemId?._id || item.itemId || undefined;
    const category = item.category?._id || item.category || undefined;
    const brand = item.brand?._id || item.brand || undefined;
    const name = String(item.name || "").trim();
    const qty = asNumber(item.qty);
    const purchaseRate = asNumber(item.purchaseRate);

    let inventoryRecord = null;
    if (itemId) {
      inventoryRecord = await Inventory.findOne({ itemId }).session(session);
    }

    if (!inventoryRecord && name && category) {
      inventoryRecord = await Inventory.findOne({
        name,
        category,
        ...(brand ? { brand } : {})
      }).session(session);
    }

    if (inventoryRecord) {
      const previousStock = asNumber(inventoryRecord.stock);
      const previousAvg = asNumber(inventoryRecord.avgPurchaseRate || inventoryRecord.purchaseRate);
      const nextStock = round2(previousStock + qty);
      const weightedTotal = round2((previousStock * previousAvg) + (qty * purchaseRate));

      inventoryRecord.stock = nextStock;
      inventoryRecord.purchaseRate = purchaseRate;
      inventoryRecord.avgPurchaseRate = nextStock > 0 ? round2(weightedTotal / nextStock) : 0;
      inventoryRecord.stockValue = round2(nextStock * inventoryRecord.avgPurchaseRate);
      inventoryRecord.lastPurchaseDate = new Date();
      inventoryRecord.unit = item.unit || inventoryRecord.unit || "PC";
      inventoryRecord.mrp = asNumber(item.mrp, inventoryRecord.mrp);
      inventoryRecord.sellingRate = asNumber(item.saleRate, inventoryRecord.sellingRate);
      if (brand) {
        inventoryRecord.brand = brand;
      }
      await inventoryRecord.save({ session });
      continue;
    }

    await Inventory.create([{
      itemId,
      name,
      category,
      brand,
      stock: qty,
      purchaseRate,
      avgPurchaseRate: purchaseRate,
      stockValue: round2(qty * purchaseRate),
      mrp: asNumber(item.mrp),
      sellingRate: asNumber(item.saleRate),
      unit: item.unit || "PC",
      lastPurchaseDate: new Date(),
    }], { session });
  }
};
