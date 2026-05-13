import Brand from "../../models/Brand.js";

// Get all brands
export const getBrands = async (req, res) => {
  try {
    const brands = await Brand.find().sort({ name: 1 });
    res.json({ success: true, brands });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch brands" });
  }
};

// Create new brand
export const createBrand = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Name required" });

    const existing = await Brand.findOne({ name });
    if (existing) return res.status(400).json({ success: false, message: "Brand already exists" });

    const brand = await Brand.create({ name });
    res.status(201).json({ success: true, brand });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to create brand" });
  }
};