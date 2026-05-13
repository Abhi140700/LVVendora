import mongoose from "mongoose";

const systemSettingsSchema = new mongoose.Schema({
  companyName: {
    type: String,
    default: "LVVendora",
    trim: true
  },
  billingCounter: {
    type: String,
    default: "Main Counter",
    trim: true
  },
  gstEnabled: {
    type: Boolean,
    default: true
  },
  roundingRule: {
    type: String,
    enum: ["none", "nearest-rupee", "floor", "ceil"],
    default: "nearest-rupee"
  },
  allowNegativeStock: {
    type: Boolean,
    default: false
  },
  paymentModes: {
    type: [String],
    default: ["Cash", "Card", "UPI", "Bank"]
  },
  barcodeFormat: {
    type: String,
    default: "CODE128",
    trim: true
  },
  printConfig: {
    thermalPrinter: {
      type: String,
      default: "Zebra ZD230",
      trim: true
    },
    labelPrinter: {
      type: String,
      default: "TSC TE244",
      trim: true
    },
    availablePrinters: {
      type: [String],
      default: ["Zebra ZD230", "TSC TE244", "Godex G500"]
    },
    labelSize: {
      type: String,
      default: "50x25",
      trim: true
    }
  },
  ui: {
    palette: {
      type: String,
      enum: ["lime", "sky", "coral", "violet"],
      default: "lime",
      trim: true
    }
  },
  sales: {
    hideGstInPrint: {
      type: Boolean,
      default: false
    },
    mopMandatory: {
      type: Boolean,
      default: true
    },
    salesmanCompulsory: {
      type: Boolean,
      default: false
    },
    noDiscountCreditSales: {
      type: Boolean,
      default: true
    },
    negativeBillBlocked: {
      type: Boolean,
      default: true
    }
  },
  purchase: {
    hsnMandatory: {
      type: Boolean,
      default: true
    },
    labelPrintingEnabled: {
      type: Boolean,
      default: true
    },
    allowOldBarcode: {
      type: Boolean,
      default: true
    }
  }
}, { timestamps: true });

const SystemSettings = mongoose.model("SystemSettings", systemSettingsSchema);
export default SystemSettings;
