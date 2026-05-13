import mongoose from "mongoose";

const labelSchema = new mongoose.Schema({
  billId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Purchase",
    required: true
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: true
  },
  productName: {
    type: String,
    required: true,
    trim: true
  },
  barcode: {
    type: String,
    required: true,
    index: true,
    unique: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  saleRate: {
    type: Number,
    min: 0,
    default: 0
  },
  purchaseRate: {
    type: Number,
    min: 0,
    default: 0
  },
  mrp: {
    type: Number,
    min: 0,
    default: 0
  },
  qty: {
    type: Number,
    required: true,
    min: 1
  },
  returnedQty: {
    type: Number,
    default: 0,
    min: 0
  },
  printer: {
    type: String,
    default: "default"
  },
  labelSize: {
    type: String,
    default: "50x25"
  },
  brand: {
    type: String,
    trim: true,
    default: ""
  },
  unit: {
    type: String,
    trim: true,
    default: ""
  },
  color: {
    type: String,
    trim: true,
    default: ""
  },
  material: {
    type: String,
    trim: true,
    default: ""
  },
  style: {
    type: String,
    trim: true,
    default: ""
  },
  subStyle: {
    type: String,
    trim: true,
    default: ""
  },
  designNo: {
    type: String,
    trim: true,
    default: ""
  },
  markupPercent: {
    type: Number,
    default: 0
  },
  gstPercent: {
    type: Number,
    default: 0
  },
  copiesPerPrint: {
    type: Number,
    min: 1,
    default: 1
  },
  printedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  batchId: {
    type: String,
    index: true
  },
  notes: {
    type: String,
    trim: true
  },
  category: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Category",
  required: true
},
  printHistory: [{
    action: {
      type: String,
      enum: ["PRINT", "REPRINT"],
      default: "PRINT"
    },
    qty: {
      type: Number,
      min: 1,
      required: true
    },
    copies: {
      type: Number,
      min: 1,
      default: 1
    },
    printer: {
      type: String,
      default: "default"
    },
    labelSize: {
      type: String,
      default: "50x25"
    },
    printedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    printedAt: {
      type: Date,
      default: Date.now
    }
  }],
}, { timestamps: true });

labelSchema.index({ billId: 1, itemId: 1, createdAt: -1 });

const Label = mongoose.model("Label", labelSchema);
export default Label;
