import SystemSettings from "../models/SystemSettings.js";

export const DEFAULT_SYSTEM_SETTINGS = {
  companyName: "LVVendora",
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
