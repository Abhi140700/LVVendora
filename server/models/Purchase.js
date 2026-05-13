import mongoose from "mongoose";

const purchaseItemSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: false
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true
  },
  received: {
  type: Boolean,
  default: false
},
  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Brand"
  },
  name: {
    type: String,
    required: true
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
  qty: {
    type: Number,
    required: true,
    min: 0.01
  },
  unit: {
    type: String,
    default: "PCS"
  },
  purchaseRate: {
    type: Number,
    required: true,
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
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  netRate: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  labelsPrinted: {
    type: Boolean,
    default: false
  },
  printedLabels: {
    type: Number,
    default: 0,
    min: 0
  }
});

const purchaseSchema = new mongoose.Schema({
  grnNo: { type: String, required: true },
  receiveDate: { type: Date, required: true },
  lrId: { type: String },
  lrNo: { type: String },
  bale: { type: Number },
  transporter: { type: String },
  transporterId: { type: mongoose.Schema.Types.ObjectId, ref: "Party" },
  firm: { type: String },
  firmId: { type: mongoose.Schema.Types.ObjectId, ref: "Party" },
  party: { type: String, required: true },
  partyId: { type: mongoose.Schema.Types.ObjectId, ref: "Party" },
  partyState: { type: String },
  supplier: { type: String },
  agent: { type: String },
  supplierAgent: { type: String },
  supplierAgentId: { type: mongoose.Schema.Types.ObjectId, ref: "Party" },
  billDate: { type: Date, required: true },
  billNo: { type: String, required: true },
  billAmount: { type: Number },
  deliveryChallan: { type: String },
  billVarianceAllowed: { type: Boolean, default: false },
  varianceAmount: { type: Number, default: 0 },
  gstOn: { type: String },
  godown: { type: String },
  inwardDate: { type: Date },
  hundekari: { type: String },
  transportCharges: { type: Number, default: 0 },
  hamaliCharges: { type: Number, default: 0 },
  narration: { type: String },
  attachments: [{
    name: { type: String, trim: true },
    url: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    size: { type: Number, default: 0 },
    dataUrl: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now }
  }],
  items: [purchaseItemSchema],
  discountTotal: { type: Number, default: 0 },
  addCharges: { type: Number, default: 0 },
  gstRate: { type: Number, default: 0 },
  commission: { type: Number, default: 0 },
  packingRoundoff: { type: Number, default: 0 },
  subtotal: { type: Number },
  taxableAmount: { type: Number },
  cgst: { type: Number },
  sgst: { type: Number },
  igst: { type: Number },
  totalGst: { type: Number },
  finalTotal: { type: Number },
  netQty: { type: Number },
  received: { type: Boolean, default: false },
  labelsPrinted: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  tallyExport: {
    exported: { type: Boolean, default: false, index: true },
    exportedAt: { type: Date },
    exportRunType: { type: String, trim: true },
    exportBatchId: { type: String, trim: true }
  }
}, { timestamps: true });

purchaseSchema.index({ party: 1, billNo: 1, billDate: 1 }, { unique: false });

const Purchase = mongoose.model("Purchase", purchaseSchema);
export default Purchase;
