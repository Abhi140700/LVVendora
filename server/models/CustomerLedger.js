import mongoose from "mongoose";

const customerLedgerSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Party",
    required: true,
    index: true
  },
  customerName: {
    type: String,
    trim: true,
    required: true
  },
  customerPhone: {
    type: String,
    trim: true,
    index: true
  },
  entryType: {
    type: String,
    enum: ["credit-sale", "advance-sale", "payment", "adjustment", "exchange-return"],
    required: true
  },
  direction: {
    type: String,
    enum: ["debit", "credit"],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMode: {
    type: String,
    trim: true
  },
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Sales"
  },
  billNo: {
    type: String,
    trim: true
  },
  referenceNo: {
    type: String,
    trim: true
  },
  note: {
    type: String,
    trim: true
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

customerLedgerSchema.index({ customerId: 1, createdAt: -1 });

const CustomerLedger = mongoose.model("CustomerLedger", customerLedgerSchema);
export default CustomerLedger;
