import mongoose from "mongoose";

const paymentRowSchema = new mongoose.Schema({
  mode: {
    type: String,
    trim: true
  },
  amount: {
    type: Number,
    default: 0,
    min: 0
  },
  reference: {
    type: String,
    trim: true
  }
}, { _id: false });

const draftLineSchema = new mongoose.Schema({
  inventoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Inventory"
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item"
  },
  barcode: {
    type: String,
    trim: true
  },
  itemName: {
    type: String,
    trim: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category"
  },
  categoryName: {
    type: String,
    trim: true
  },
  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Brand"
  },
  brandName: {
    type: String,
    trim: true
  },
  salesmanNumber: {
    type: String,
    trim: true
  },
  qty: {
    type: Number,
    default: 1,
    min: 1
  },
  displayQty: {
    type: Number,
    default: 0,
    min: 0
  },
  mtrQty: {
    type: Number,
    default: 0,
    min: 0
  },
  stock: {
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
  originalSaleRate: {
    type: Number,
    default: 0,
    min: 0
  },
  lineDiscountPercent: {
    type: Number,
    default: 0,
    min: 0
  },
  lineTotal: {
    type: Number,
    default: 0,
    min: 0
  },
  unit: {
    type: String,
    default: "PC"
  }
}, { _id: true });

const exchangeItemSchema = new mongoose.Schema({
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Sales"
  },
  saleItemId: {
    type: mongoose.Schema.Types.ObjectId
  },
  billNo: {
    type: String,
    trim: true
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
    default: 1,
    min: 1
  },
  amount: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

const posDraftSchema = new mongoose.Schema({
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ["draft", "hold"],
    default: "draft",
    index: true
  },
  billNo: {
    type: String,
    trim: true,
    required: true
  },
  billType: {
    type: String,
    enum: ["cashpay", "exchange", "return", "card-upi", "hold", "recall", "credit", "advance"],
    default: "cashpay"
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Party"
  },
  customer: {
    type: String,
    trim: true
  },
  customerPhone: {
    type: String,
    trim: true
  },
  salespersonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  salesman: {
    type: String,
    trim: true
  },
  note: {
    type: String,
    trim: true
  },
  deliveryInfo: {
    type: String,
    trim: true
  },
  referenceNo: {
    type: String,
    trim: true
  },
  discountPercent: {
    type: Number,
    default: 0,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  subtotal: {
    type: Number,
    default: 0,
    min: 0
  },
  exchangeAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  payableAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  advanceAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  creditDue: {
    type: Number,
    default: 0,
    min: 0
  },
  paymentBreakdown: [paymentRowSchema],
  exchangeItems: [exchangeItemSchema],
  items: [draftLineSchema],
  lastTouchedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

posDraftSchema.index({ createdBy: 1, status: 1, updatedAt: -1 });

const POSDraft = mongoose.model("POSDraft", posDraftSchema);
export default POSDraft;
