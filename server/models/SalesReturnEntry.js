import mongoose from "mongoose";

const salesReturnItemSchema = new mongoose.Schema({
  sourceSaleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Sales",
    required: true
  },
  sourceSaleItemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  sourceBillNo: {
    type: String,
    trim: true
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item"
  },
  itemName: {
    type: String,
    trim: true
  },
  barcode: {
    type: String,
    trim: true
  },
  qty: {
    type: Number,
    required: true,
    min: 1
  },
  rate: {
    type: Number,
    default: 0,
    min: 0
  },
  amount: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

const salesReturnEntrySchema = new mongoose.Schema({
  entryType: {
    type: String,
    enum: ["manual-return", "exchange-return"],
    required: true
  },
  linkedSaleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Sales"
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Party"
  },
  customerName: {
    type: String,
    trim: true
  },
  customerPhone: {
    type: String,
    trim: true
  },
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  items: [salesReturnItemSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

const SalesReturnEntry = mongoose.model("SalesReturnEntry", salesReturnEntrySchema);
export default SalesReturnEntry;
