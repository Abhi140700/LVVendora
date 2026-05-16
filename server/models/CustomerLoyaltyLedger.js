import mongoose from "mongoose";

const customerLoyaltyLedgerSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Party",
    index: true
  },
  customerName: {
    type: String,
    trim: true
  },
  customerPhone: {
    type: String,
    trim: true,
    index: true
  },
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Sales",
    index: true
  },
  billNo: {
    type: String,
    trim: true
  },
  invoiceNo: {
    type: String,
    trim: true
  },
  entryType: {
    type: String,
    enum: ["earn", "redeem", "adjustment", "reversal"],
    required: true,
    index: true
  },
  points: {
    type: Number,
    required: true
  },
  amountValue: {
    type: Number,
    default: 0,
    min: 0
  },
  balanceAfter: {
    type: Number,
    default: 0,
    min: 0
  },
  note: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

customerLoyaltyLedgerSchema.index({ customerId: 1, createdAt: -1 });
customerLoyaltyLedgerSchema.index({ customerPhone: 1, createdAt: -1 });

const CustomerLoyaltyLedger = mongoose.model("CustomerLoyaltyLedger", customerLoyaltyLedgerSchema);
export default CustomerLoyaltyLedger;
