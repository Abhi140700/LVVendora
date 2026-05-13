import mongoose from "mongoose";

const cashEntrySchema = new mongoose.Schema({
  entryDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  businessDate: {
    type: Date,
    required: true,
    index: true
  },
  entryType: {
    type: String,
    enum: ["expense", "bank-deposit", "bank-withdrawal", "cash-adjustment"],
    required: true,
    index: true
  },
  direction: {
    type: String,
    enum: ["in", "out"],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMode: {
    type: String,
    enum: ["Cash", "Bank", "UPI", "Card"],
    default: "Cash"
  },
  category: {
    type: String,
    trim: true,
    default: ""
  },
  accountLabel: {
    type: String,
    trim: true,
    default: ""
  },
  referenceNo: {
    type: String,
    trim: true,
    default: ""
  },
  note: {
    type: String,
    trim: true,
    default: ""
  },
  posSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "POSSession"
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  tallyExport: {
    exported: {
      type: Boolean,
      default: false,
      index: true
    },
    exportedAt: {
      type: Date
    },
    exportRunType: {
      type: String,
      trim: true
    },
    exportBatchId: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ["pending", "exported", "failed", "reconciled"],
      default: "pending"
    },
    lastError: {
      type: String,
      trim: true,
      default: ""
    }
  }
}, { timestamps: true });

cashEntrySchema.index({ businessDate: 1, entryType: 1, createdAt: -1 });

const CashEntry = mongoose.model("CashEntry", cashEntrySchema);
export default CashEntry;
