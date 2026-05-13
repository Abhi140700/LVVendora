import mongoose from "mongoose";

const tallySettingsSchema = new mongoose.Schema({
  companyName: {
    type: String,
    trim: true,
    default: ""
  },
  companyAlias: {
    type: String,
    trim: true,
    default: ""
  },
  fromDate: {
    type: Date
  },
  toDate: {
    type: Date
  },
  voucherTypes: {
    sales: { type: String, trim: true, default: "Sales" },
    purchase: { type: String, trim: true, default: "Purchase" },
    receipt: { type: String, trim: true, default: "Receipt" },
    payment: { type: String, trim: true, default: "Payment" },
    journal: { type: String, trim: true, default: "Journal" }
  },
  ledgers: {
    salesLedger: { type: String, trim: true, default: "Sales Account" },
    purchaseLedger: { type: String, trim: true, default: "Purchase Account" },
    cashLedger: { type: String, trim: true, default: "Cash" },
    customerLedgerControl: { type: String, trim: true, default: "Customer Ledger Control" },
    roundOffLedger: { type: String, trim: true, default: "Round Off" },
    gstOutputLedger: { type: String, trim: true, default: "Output GST" },
    gstInputLedger: { type: String, trim: true, default: "Input GST" }
  },
  exportBehavior: {
    markSalesAsExported: { type: Boolean, default: true },
    markPurchasesAsExported: { type: Boolean, default: true },
    onlyUnexportedByDefault: { type: Boolean, default: true }
  },
  xmlFormat: {
    type: String,
    enum: ["tally-import-v1", "tally-import-v2"],
    default: "tally-import-v1"
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

const TallySettings = mongoose.model("TallySettings", tallySettingsSchema);
export default TallySettings;
