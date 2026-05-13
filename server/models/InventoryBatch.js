import mongoose from "mongoose";

const inventoryBatchSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      default: "",
      trim: true,
    },
    brand: {
      type: String,
      default: "",
      trim: true,
    },
    batchNo: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    qty: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

inventoryBatchSchema.index({ itemName: 1, batchNo: 1 }, { unique: true });

const InventoryBatch = mongoose.model("InventoryBatch", inventoryBatchSchema);

export default InventoryBatch;
