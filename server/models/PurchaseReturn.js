import mongoose from "mongoose";

const purchaseReturnItemSchema = new mongoose.Schema({
  labelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Label",
    required: true
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: true
  },
  sourceBillId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Purchase",
    required: true
  },
  sourcePurchaseItemId: {
    type: mongoose.Schema.Types.ObjectId
  },
  barcode: {
    type: String,
    required: true,
    trim: true
  },
  sourceBillNo: {
    type: String,
    trim: true
  },
  sourceGrnNo: {
    type: String,
    trim: true
  },
  brandName: {
    type: String,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  boxNo: {
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
  },
  gstPercent: {
    type: Number,
    default: 0,
    min: 0
  },
  stockAtReturn: {
    type: Number,
    default: 0,
    min: 0
  },
  commission: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

const purchaseReturnSchema = new mongoose.Schema({
  returnNo: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  debitNoteNo: {
    type: String,
    trim: true,
    index: true
  },
  returnDate: {
    type: Date,
    required: true
  },
  firm: {
    type: String,
    trim: true,
    index: true
  },
  party: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  partyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Party"
  },
  partyPhone: {
    type: String,
    trim: true
  },
  partyState: {
    type: String,
    trim: true
  },
  shipTo: {
    type: String,
    trim: true
  },
  eWayBillNo: {
    type: String,
    trim: true
  },
  eInvoiceNo: {
    type: String,
    trim: true
  },
  eInvoiceAckNo: {
    type: String,
    trim: true
  },
  transporterName: {
    type: String,
    trim: true
  },
  transporterId: {
    type: String,
    trim: true
  },
  distanceKm: {
    type: Number,
    default: 0,
    min: 0
  },
  transportMode: {
    type: String,
    trim: true,
    default: "Road"
  },
  vehicleType: {
    type: String,
    trim: true,
    default: "Regular"
  },
  lrNo: {
    type: String,
    trim: true
  },
  lrDate: {
    type: Date
  },
  vehicleNo: {
    type: String,
    trim: true
  },
  narration: {
    type: String,
    trim: true
  },
  addCharges: {
    type: Number,
    default: 0,
    min: 0
  },
  roundOff: {
    type: Number,
    default: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  gstAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  taxableAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalItems: {
    type: Number,
    default: 0,
    min: 0
  },
  totalQty: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  netAmount: {
    type: Number,
    default: 0
  },
  printBarcodeLabels: {
    type: Boolean,
    default: false
  },
  items: [purchaseReturnItemSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

purchaseReturnSchema.index({ returnDate: -1, party: 1 });

const PurchaseReturn = mongoose.model("PurchaseReturn", purchaseReturnSchema);
export default PurchaseReturn;
