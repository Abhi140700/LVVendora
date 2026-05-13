import mongoose from "mongoose";

const affectedSaleSchema = new mongoose.Schema({
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Sales"
  },
  invoiceNo: {
    type: String,
    trim: true
  },
  billNo: {
    type: String,
    trim: true
  },
  saleDate: {
    type: Date
  },
  customer: {
    type: String,
    trim: true
  },
  cashAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  matchedItemCount: {
    type: Number,
    default: 0,
    min: 0
  },
  matchedItemAmount: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

const cashSalesAdjustmentSchema = new mongoose.Schema({
  voucherNo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  cashSalesAmountBefore: {
    type: Number,
    required: true,
    min: 0
  },
  amountToReduce: {
    type: Number,
    required: true,
    min: 0.01
  },
  cashSalesAmountAfter: {
    type: Number,
    required: true,
    min: 0
  },
  saleRateFrom: {
    type: Number,
    default: 0,
    min: 0
  },
  saleRateTo: {
    type: Number,
    default: 0,
    min: 0
  },
  mode: {
    type: String,
    required: true,
    enum: [
      "REMOVE_FIXED_ITEMS",
      "REMOVE_BARCODE_AND_FIXED_ITEMS",
      "REMOVE_CTRL_K_ITEMS",
      "CHANGE_FIXED_ITEM",
      "DOWN_5R_TO_5"
    ]
  },
  affectedSales: [affectedSaleSchema],
  status: {
    type: String,
    enum: ["PREVIEWED", "PROCESSED", "REVERSED"],
    default: "PROCESSED",
    index: true
  },
  reversalOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CashSalesAdjustment"
  },
  reversedAt: {
    type: Date
  },
  reversedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  reversalReason: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  createdByName: {
    type: String,
    trim: true
  }
}, { timestamps: true });

cashSalesAdjustmentSchema.index({ date: -1, createdAt: -1 });

const CashSalesAdjustment = mongoose.model("CashSalesAdjustment", cashSalesAdjustmentSchema);
export default CashSalesAdjustment;
