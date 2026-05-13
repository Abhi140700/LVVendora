import Item from "../../models/Item.js";
import Category from "../../models/Category.js";
import { normalizeUnit } from "../../utils/unit.js";

// Get all items
export const getItems = async (req, res) => {
  try {
    const items = await Item.find()
      .populate("category", "name hsn unit")
      .populate("brand", "name")
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (err) {
    console.error("Get Items Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch items"
    });
  }
};

// Create item
export const createItem = async (req, res) => {
  try {
    const { name, category, brand, unit, hsn, size, color, material, style, subStyle, designNo, defaultPurchaseRate, mrp, saleRate } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        success: false,
        message: "Name and category are required"
      });
    }

    const existing = await Item.findOne({ name, category, brand });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Item already exists"
      });
    }

    const categoryDoc = await Category.findById(category).select("unit");
    const resolvedUnit = normalizeUnit(unit || categoryDoc?.unit);

    const item = await Item.create({
      name,
      category,
      brand,
      unit: resolvedUnit,
      hsn,
      size,
      color,
      material,
      style,
      subStyle,
      designNo,
      defaultPurchaseRate,
      mrp,
      saleRate
    });

    res.status(201).json({
      success: true,
      data: item
    });

  } catch (err) {
    console.error("Create Item Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create item"
    });
  }
};

// Update item
export const updateItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    const nextCategoryId = req.body.category || item.category;
    const categoryDoc = nextCategoryId ? await Category.findById(nextCategoryId).select("unit") : null;
    Object.assign(item, req.body);
    item.unit = normalizeUnit(req.body.unit || categoryDoc?.unit || item.unit);
    await item.save();

    res.status(200).json({
      success: true,
      data: item
    });

  } catch (err) {
    console.error("Update Item Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update item"
    });
  }
};

// Delete item
export const deleteItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    await item.deleteOne();

    res.status(200).json({
      success: true,
      message: "Item deleted successfully"
    });

  } catch (err) {
    console.error("Delete Item Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete item"
    });
  }
};
