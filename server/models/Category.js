import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  hsn: { type: String, trim: true, default: "" },
  unit: { type: String, trim: true, enum: ["PCS", "MTRS"], default: "PCS" },
}, { timestamps: true });

const Category = mongoose.model("Category", categorySchema);
export default Category;
