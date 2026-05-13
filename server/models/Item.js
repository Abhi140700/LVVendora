import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  hsn: {
    type: String,
    trim: true
  },
  size: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    trim: true
  },
  material: {
    type: String,
    trim: true
  },
  style: {
    type: String,
    trim: true
  },
  subStyle: {
    type: String,
    trim: true
  },
  designNo: {
    type: String,
    trim: true
  },
  unit: {
    type: String,
    trim: true,
    default: "PC"
  },
  defaultPurchaseRate: {
    type: Number,
    default: 0,
    min: 0
  },
  mrp: {
    type: Number,
    default: 0,
    min: 0
  },
  saleRate: {
    type: Number,
    default: 0,
    min: 0
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category"
  },
  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Brand"
  }
}, { timestamps: true });

const Item = mongoose.model("Item", itemSchema);
export default Item;
