import SystemSettings from "../models/SystemSettings.js";

export const DEFAULT_SYSTEM_SETTINGS = {
  companyName: "LVVendora",
  companyTagline: "Fashion & Tradition",
  companyAddress: "26/A SHANIWAR PETH KARAD.",
  companyPhone: "7020447205, 9604249177, 8208442643",
  gstin: "27AAFFL3196B1ZF",
  billingCounter: "Main Counter",
  gstEnabled: true,
  roundingRule: "nearest-rupee",
  allowNegativeStock: false,
  paymentModes: ["Cash", "Card", "UPI", "Bank"],
  barcodeFormat: "CODE128",
  printConfig: {
    thermalPrinter: "Zebra ZD230",
    labelPrinter: "TSC TE244",
    availablePrinters: ["Zebra ZD230", "TSC TE244", "Godex G500"],
    labelSize: "50x25"
  },
  ui: {
    palette: "lime"
  },
  loyalty: {
    enabled: true,
    earnPerAmount: 100,
    pointsPerStep: 1,
    redeemValuePerPoint: 1,
    minRedeemPoints: 0,
    maxRedeemPercent: 20,
    enrollmentFee: 0,
    enrollmentBonusPoints: 0,
    cardSequencePadding: 4
  },
  sales: {
    hideGstInPrint: false,
    mopMandatory: true,
    salesmanCompulsory: false,
    noDiscountCreditSales: true,
    negativeBillBlocked: true
  },
  purchase: {
    hsnMandatory: true,
    labelPrintingEnabled: true,
    allowOldBarcode: true
  }
};

export const normalizeSystemSettings = (doc = {}) => ({
  ...DEFAULT_SYSTEM_SETTINGS,
  ...(doc || {}),
  printConfig: {
    ...DEFAULT_SYSTEM_SETTINGS.printConfig,
    ...(doc?.printConfig || {})
  },
  ui: {
    ...DEFAULT_SYSTEM_SETTINGS.ui,
    ...(doc?.ui || {})
  },
  loyalty: {
    ...DEFAULT_SYSTEM_SETTINGS.loyalty,
    ...(doc?.loyalty || {})
  },
  sales: {
    ...DEFAULT_SYSTEM_SETTINGS.sales,
    ...(doc?.sales || {})
  },
  purchase: {
    ...DEFAULT_SYSTEM_SETTINGS.purchase,
    ...(doc?.purchase || {})
  }
});

export const getSystemSettings = async () => {
  const settings = await SystemSettings.findOne().sort({ updatedAt: -1 }).lean();
  return normalizeSystemSettings(settings);
};

export const updateSystemSettings = async (payload = {}) => {
  const nextSettings = normalizeSystemSettings(payload);
  const updated = await SystemSettings.findOneAndUpdate(
    {},
    nextSettings,
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
      runValidators: true
    }
  ).lean();

  return normalizeSystemSettings(updated);
};
