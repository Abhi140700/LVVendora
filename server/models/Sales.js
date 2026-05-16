import mongoose from "mongoose";

const salesItemSchema = new mongoose.Schema({
  inventoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Inventory"
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: true
  },
  itemName: {
    type: String,
    trim: true
  },
  categoryName: {
    type: String,
    trim: true
  },
  brandName: {
    type: String,
    trim: true
  },
  barcode: {
    type: String,
    trim: true
  },
  salesmanNumber: {
    type: String,
    trim: true
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
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category"
  },
  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Brand"
  },
  qty: {
    type: Number,
    required: true,
    min: 0.01
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
  unit: {
    type: String,
    default: "PCS"
  },
  sellingRate: {
    type: Number,
    default: 0,
    min: 0
  },
  mrp: {
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
    default: 0,
    min: 0
  },
  returnedQty: {
    type: Number,
    default: 0,
    min: 0
  }
});

const salesSchema = new mongoose.Schema({
  invoiceNo: {
    type: String,
    required: true,
    unique: true
  },
  saleDate: {
    type: Date,
    default: Date.now
  },
  customer: {
    type: String
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Party"
  },
  customerPhone: {
    type: String,
    trim: true
  },
  billType: {
    type: String,
    enum: ["cashpay", "exchange", "return", "card-upi", "hold", "recall", "credit", "advance"],
    default: "cashpay"
  },
  billingMode: {
    type: String,
    enum: ["CASH", "ADVANCE", "CREDIT"],
    default: "CASH",
    index: true
  },
  modeBillNo: {
    type: Number,
    min: 1,
    index: true
  },
  displayBillNo: {
    type: String,
    trim: true,
    index: true
  },
  paymentStatus: {
    type: String,
    enum: ["PAID", "PARTIAL", "PENDING"],
    default: "PAID",
    index: true
  },
  paymentSummary: {
    cash: { type: Number, default: 0, min: 0 },
    card: { type: Number, default: 0, min: 0 },
    upi: { type: Number, default: 0, min: 0 },
    advanceUsed: { type: Number, default: 0, min: 0 },
    creditAmount: { type: Number, default: 0, min: 0 },
    receivedAmount: { type: Number, default: 0, min: 0 },
    balanceAmount: { type: Number, default: 0, min: 0 }
  },
  billNo: {
    type: String,
    trim: true
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
  counterName: {
    type: String,
    trim: true
  },
  salespersonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  posSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "POSSession"
  },
  items: [salesItemSchema],
  subtotal: {
    type: Number,
    default: 0,
    min: 0
  },
  gstRate: {
    type: Number,
    default: 0,
    min: 0
  },
  gstAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  discountPercent: {
    type: Number,
    default: 0,
    min: 0
  },
  exchangeAmount: {
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
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  paymentBreakdown: [{
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
  }],
  exchangeItems: [{
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
    amount: {
      type: Number,
      default: 0,
      min: 0
    }
  }],
  loyaltyPointsEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  loyaltyPointsRedeemed: {
    type: Number,
    default: 0,
    min: 0
  },
  loyaltyRedeemedAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  advanceDetails: {
    advanceAmount: { type: Number, default: 0, min: 0 },
    remainingAmount: { type: Number, default: 0, min: 0 },
    deliveryStatus: {
      type: String,
      enum: ["DELIVERED", "PENDING"],
      default: "DELIVERED"
    },
    expectedDeliveryDate: { type: Date },
    remarks: { type: String, trim: true }
  },
  creditDetails: {
    creditAmount: { type: Number, default: 0, min: 0 },
    dueDate: { type: Date },
    creditDays: { type: Number, default: 0, min: 0 },
    remarks: { type: String, trim: true }
  },
  invoicePrintedAt: {
    type: Date
  },
  whatsappSentAt: {
    type: Date
  },
  totalReturnedAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
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
    }
  }
}, { timestamps: true });

salesSchema.index({ billingMode: 1, modeBillNo: 1 }, { unique: true, sparse: true });

const Sales = mongoose.model("Sales", salesSchema);
export default Sales;
