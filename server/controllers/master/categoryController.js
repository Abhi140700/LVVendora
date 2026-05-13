import Category from "../../models/Category.js";
import { normalizeUnit } from "../../utils/unit.js";

export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 }).lean();
    res.json({ success: true, categories });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch categories" });
  }
};

export const createCategory = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const hsn = String(req.body.hsn || "").trim();
    const unit = normalizeUnit(req.body.unit);
    if (!name) return res.status(400).json({ success: false, message: "Name required" });

    const existing = await Category.findOne({ name });
    if (existing) return res.status(400).json({ success: false, message: "Category already exists" });

    const category = await Category.create({ name, hsn, unit });
    res.status(201).json({ success: true, category });
  } catch {
    res.status(500).json({ success: false, message: "Failed to create category" });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const name = String(req.body.name || "").trim();
    const hsn = String(req.body.hsn || "").trim();
    const unit = normalizeUnit(req.body.unit);
    if (!name) {
      return res.status(400).json({ success: false, message: "Name required" });
    }

    category.name = name;
    category.hsn = hsn;
    category.unit = unit;
    await category.save();
    return res.json({ success: true, category });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to update category" });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }
    await category.deleteOne();
    return res.json({ success: true, message: "Category deleted successfully" });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to delete category" });
  }
};
