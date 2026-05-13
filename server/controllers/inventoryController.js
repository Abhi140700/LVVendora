import mongoose from "mongoose";
import Inventory from "../models/Inventory.js";
import InventoryBatch from "../models/InventoryBatch.js";
import Label from "../models/Label.js";
import { normalizeUnit } from "../utils/unit.js";

// GET all inventory
export const getInventory = async (req, res) => {
  try {
    const inventory = await Inventory.find()
      .populate("category", "name unit")
      .populate("brand", "name")
      .populate("itemId", "name unit")
      .sort({ createdAt: -1 })
      .lean();

    const itemIds = inventory
      .map((item) => item.itemId?._id || item.itemId)
      .filter(Boolean);

    const labels = itemIds.length > 0
      ? await Label.find({ itemId: { $in: itemIds } })
        .sort({ createdAt: -1 })
        .select("itemId barcode price saleRate mrp unit qty createdAt")
        .lean()
      : [];

    const latestLabelByItemId = new Map();
    for (const label of labels) {
      const key = String(label.itemId);
      if (!latestLabelByItemId.has(key)) {
        latestLabelByItemId.set(key, label);
      }
    }

    const enrichedInventory = inventory.map((item) => {
      const itemIdKey = String(item.itemId?._id || item.itemId || "");
      const latestLabel = latestLabelByItemId.get(itemIdKey);
      const derivedMrp = Number(item.mrp || latestLabel?.mrp || latestLabel?.price || 0);
      const derivedSaleRate = Number(item.sellingRate || latestLabel?.saleRate || latestLabel?.price || 0);
      const derivedUnit = normalizeUnit(
        item.itemId?.unit
        || item.category?.unit
        || latestLabel?.unit
        || item.unit,
      );

      return {
        ...item,
        barcode: item.barcode || latestLabel?.barcode || "",
        defaultSalesQty: Number(latestLabel?.qty || 1),
        mrp: derivedMrp,
        sellingRate: derivedSaleRate,
        unit: derivedUnit,
      };
    });

    return res.status(200).json({
      success: true,
      count: enrichedInventory.length,
      data: enrichedInventory,
    });
  } catch (err) {
    console.error("Get Inventory Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch inventory" });
  }
};

export const lookupInventoryByBarcode = async (req, res) => {
  try {
    const rawBarcode = String(req.params.barcode || "").trim();
    if (!rawBarcode) {
      return res.status(400).json({
        success: false,
        message: "Barcode is required"
      });
    }

    let inventoryItem = await Inventory.findOne({ barcode: rawBarcode })
      .populate("category", "name unit")
      .populate("brand", "name")
      .populate("itemId", "name unit")
      .lean();

    let matchedLabel = null;
    if (!inventoryItem) {
      matchedLabel = await Label.findOne({ barcode: rawBarcode })
        .sort({ createdAt: -1 })
        .lean();

      if (matchedLabel?.itemId) {
        inventoryItem = await Inventory.findOne({ itemId: matchedLabel.itemId })
          .populate("category", "name unit")
          .populate("brand", "name")
          .populate("itemId", "name unit")
          .lean();
      }
    }

    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: "Barcode not found in inventory"
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...inventoryItem,
        barcode: inventoryItem.barcode || matchedLabel?.barcode || rawBarcode,
        defaultSalesQty: Number(matchedLabel?.qty || 1),
        mrp: Number(inventoryItem.mrp ?? matchedLabel?.mrp ?? matchedLabel?.price ?? 0),
        sellingRate: Number(inventoryItem.sellingRate ?? matchedLabel?.saleRate ?? matchedLabel?.price ?? 0),
        unit: normalizeUnit(
          inventoryItem.itemId?.unit
          || inventoryItem.category?.unit
          || matchedLabel?.unit
          || inventoryItem.unit,
        ),
      }
    });
  } catch (err) {
    console.error("Lookup Inventory Barcode Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to lookup barcode"
    });
  }
};

// Add new inventory item
export const addInventory = async (req, res) => {
  try {
    const { itemId, name, category, brand, stock, purchaseRate, sellingRate, barcode, mrp } =
      req.body;

    if (!itemId || !name || !category) {
      return res
        .status(400)
        .json({ success: false, message: "Required fields missing" });
    }

    const item = await Inventory.create({
      itemId,
      name,
      category,
      brand,
      stock,
      purchaseRate,
      sellingRate,
      barcode,
      mrp,
    });

    return res.status(201).json({ success: true, data: item });
  } catch (err) {
    console.error("Add Inventory Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to add inventory" });
  }
};

// Update inventory item
export const updateInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const inventory = await Inventory.findById(id);
    if (!inventory)
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });

    Object.assign(inventory, req.body);
    await inventory.save();

    return res.status(200).json({ success: true, data: inventory });
  } catch (err) {
    console.error("Update Inventory Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update inventory" });
  }
};

// Adjust stock (used for purchase receive or label creation)
export const adjustStock = async ({
  itemId,
  name,
  category,
  brand,
  barcode,
  qty,
  mrp,
  sellingRate,
  purchaseRate,
  unit,
}) => {
  const normalizedItemId = mongoose.Types.ObjectId.isValid(itemId) ? itemId : undefined;
  const normalizedCategory = mongoose.Types.ObjectId.isValid(category) ? category : undefined;
  const normalizedBrand = mongoose.Types.ObjectId.isValid(brand) ? brand : undefined;

  if (!name || !normalizedCategory) {
    throw new Error("Name and category are required for inventory");
  }

  let existing;

  if (normalizedItemId) {
    existing = await Inventory.findOne({ itemId: normalizedItemId });
  } else {
    existing = await Inventory.findOne({
      name: name.trim(),
      category: normalizedCategory,
      ...(normalizedBrand ? { brand: normalizedBrand } : {}),
    });
  }

  const newQty = qty || 0;
  const rate = purchaseRate || 0;

  if (existing) {
    // Update existing inventory
    const totalOldValue =
      existing.stock * (existing.avgPurchaseRate || existing.purchaseRate || 0);
    const totalNewValue = newQty * rate;

    existing.stock += newQty;
    existing.avgPurchaseRate =
      existing.stock > 0 ? (totalOldValue + totalNewValue) / existing.stock : 0;
    existing.purchaseRate = rate;
    existing.stockValue = existing.stock * existing.avgPurchaseRate;
    existing.unit = unit || existing.unit;
    existing.lastPurchaseDate = new Date();
    existing.barcode = barcode || existing.barcode;
    existing.mrp = Number(mrp ?? existing.mrp ?? sellingRate ?? 0);
    existing.sellingRate = Number(sellingRate ?? existing.sellingRate ?? mrp ?? 0);
    if (normalizedBrand) {
      existing.brand = normalizedBrand;
    }

    await existing.save();
    return existing;
  } else {
    // Create new inventory item if itemId not provided
    const newItem = await Inventory.create({
      itemId: normalizedItemId,
      name,
      category: normalizedCategory,
      brand: normalizedBrand,
      stock: newQty,
      barcode,
      mrp: Number(mrp ?? sellingRate ?? 0),
      purchaseRate: rate,
      sellingRate: Number(sellingRate ?? mrp ?? 0),
      avgPurchaseRate: rate,
      stockValue: newQty * rate,
      unit,
      lastPurchaseDate: new Date(),
    });
    return newItem;
  }
};

export const transferStock = async (req, res) => {
  try {
    const { itemId, sourceLocation, destinationLocation, qty } = req.body;
    const numericQty = Number(qty || 0);

    if (!itemId || !sourceLocation || !destinationLocation || numericQty <= 0) {
      return res.status(400).json({
        success: false,
        message: "Item, source location, destination location, and positive quantity are required"
      });
    }

    if (String(sourceLocation).trim() === String(destinationLocation).trim()) {
      return res.status(400).json({
        success: false,
        message: "Source and destination locations must be different"
      });
    }

    const item = await Inventory.findById(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found"
      });
    }

    const totalStock = Number(item.stock || 0);
    if (numericQty > totalStock) {
      return res.status(400).json({
        success: false,
        message: "Transfer quantity exceeds available stock"
      });
    }

    const sourceKey = String(sourceLocation).trim();
    const destinationKey = String(destinationLocation).trim();
    const locationStock = new Map(item.locationStock || []);
    const sourceAvailable = Number(locationStock.get(sourceKey) ?? totalStock);

    if (numericQty > sourceAvailable) {
      return res.status(400).json({
        success: false,
        message: `Only ${sourceAvailable} units are available in ${sourceKey}`
      });
    }

    locationStock.set(sourceKey, sourceAvailable - numericQty);
    locationStock.set(destinationKey, Number(locationStock.get(destinationKey) || 0) + numericQty);
    item.locationStock = locationStock;
    await item.save();

    return res.status(200).json({
      success: true,
      message: "Stock transferred successfully",
      data: {
        itemId: item._id,
        name: item.name,
        qty: numericQty,
        sourceLocation: sourceKey,
        destinationLocation: destinationKey,
        locationStock: Object.fromEntries(locationStock.entries()),
      }
    });
  } catch (err) {
    console.error("Transfer Stock Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to transfer stock"
    });
  }
};

export const getInventoryBatches = async (req, res) => {
  try {
    const batches = await InventoryBatch.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, count: batches.length, data: batches });
  } catch (err) {
    console.error("Get Inventory Batches Error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch inventory batches" });
  }
};

export const createInventoryBatch = async (req, res) => {
  try {
    const { itemName, category, brand, batchNo, expiryDate, qty } = req.body;

    if (!String(itemName || "").trim() || !String(batchNo || "").trim()) {
      return res.status(400).json({
        success: false,
        message: "Item name and batch number are required",
      });
    }

    const batch = await InventoryBatch.create({
      itemName: String(itemName).trim(),
      category: String(category || "").trim(),
      brand: String(brand || "").trim(),
      batchNo: String(batchNo).trim(),
      expiryDate: expiryDate || null,
      qty: Number(qty || 0),
    });

    return res.status(201).json({
      success: true,
      message: "Batch saved successfully",
      data: batch,
    });
  } catch (err) {
    console.error("Create Inventory Batch Error:", err);

    if (err?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This batch number already exists for the selected item",
      });
    }

    return res.status(500).json({ success: false, message: "Failed to save inventory batch" });
  }
};

// Get inventory by ID
export const getInventoryById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid inventory ID",
      });
    }

    const item = await Inventory.findById(req.params.id)
      .populate("category", "name")
      .populate("brand", "name")
      .populate("itemId", "name");

    if (!item)
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });

    return res.status(200).json({ success: true, data: item });
  } catch (err) {
    console.error("Get Inventory By ID Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch item" });
  }
};

// Delete inventory
export const deleteInventory = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item)
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });

    await item.deleteOne();
    return res
      .status(200)
      .json({ success: true, message: "Item deleted successfully" });
  } catch (err) {
    console.error("Delete Inventory Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete item" });
  }
};
