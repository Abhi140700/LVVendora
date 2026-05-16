import mongoose from "mongoose";

const systemSettingsSchema = new mongoose.Schema({
  companyName: {
    type: String,
    default: "LVVendora",
    trim: true
  },
  companyTagline: {
    type: String,
    default: "Fashion & Tradition",
    trim: true
  },
  companyAddress: {
    type: String,
    default: "26/A SHANIWAR PETH KARAD.",
    trim: true
  },
  companyPhone: {
    type: String,
    default: "7020447205, 9604249177, 8208442643",
    trim: true
  },
  gstin: {
    type: String,
    default: "27AAFFL3196B1ZF",
    trim: true,
    uppercase: true
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
  loyalty: {
    enabled: {
      type: Boolean,
      default: true
    },
    earnPerAmount: {
      type: Number,
      default: 100,
      min: 1
    },
    pointsPerStep: {
      type: Number,
      default: 1,
      min: 0
    },
    redeemValuePerPoint: {
      type: Number,
      default: 1,
      min: 0
    },
    minRedeemPoints: {
      type: Number,
      default: 0,
      min: 0
    },
    maxRedeemPercent: {
      type: Number,
      default: 20,
      min: 0,
      max: 100
    },
    enrollmentFee: {
      type: Number,
      default: 0,
      min: 0
    },
    enrollmentBonusPoints: {
      type: Number,
      default: 0,
      min: 0
    },
    cardSequencePadding: {
      type: Number,
      default: 4,
      min: 1,
      max: 8
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
