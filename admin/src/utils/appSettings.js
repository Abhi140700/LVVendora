import api from "../app/axios";

export const SETTINGS_STORAGE_KEY = "erp-application-settings-v1";
export const SETTINGS_SAVED_AT_KEY = "erp-application-settings-saved-at";
export const APP_SETTINGS_UPDATED_EVENT = "erp-app-settings-updated";

export const DEFAULT_APP_SETTINGS = {
    companyName: "LVVendora",
    billingCounter: "Main Counter",
    thermalPrinter: "Zebra ZD230",
    labelPrinter: "TSC TE244",
    availablePrinters: ["Zebra ZD230", "TSC TE244", "Godex G500"],
    labelSize: "50x25",
    barcodeFormat: "CODE128",
    ui: {
        palette: "lime",
    },
    sales: {
        useDayEnd: true,
        useSystemDate: true,
        multipleCashCounter: false,
        counterWiseSale: true,
        dailySaleNo: true,
        showMeters: true,
        decimalQty: false,
        tokenMode: false,
        lastBillAtBottom: true,
        showDiscPercent: true,
        showDiscAmount: true,
        showCommission: true,
        addStockQty: true,
        stayFocusOnProduct: true,
        promptReceivedAmount: true,
        selectPrinterInSales: true,
        packingEnabled: true,
        salesmanCompulsory: false,
        barcodeOffers: true,
        hideGstInPrint: false,
        negativeBillBlocked: true,
        mopMandatory: true,
        noDiscountCreditSales: true,
    },
    purchase: {
        refillBarcode: true,
        refillAutoPurchase: false,
        hideSupplierLedger: false,
        commissionOnTaxable: true,
        materialMandatory: true,
        linkCategoryMaterial: true,
        defaultQtyMandatory: false,
        styleMandatory: true,
        linkCategoryStyle: true,
        useSingleBrand: false,
        lrMandatory: true,
        defaultGst: true,
        hsnMandatory: true,
        labelPrintingEnabled: true,
        taxAdditionalOnLabel: false,
        allowOldBarcode: true,
        showSaleRateBeforeMrp: true,
        focusToMrp: true,
        thermalPrinterMode: true,
    },
};

const mergeSettings = (parsed = {}) => ({
    ...DEFAULT_APP_SETTINGS,
    ...parsed,
    ui: { ...DEFAULT_APP_SETTINGS.ui, ...(parsed.ui || {}) },
    sales: { ...DEFAULT_APP_SETTINGS.sales, ...(parsed.sales || {}) },
    purchase: { ...DEFAULT_APP_SETTINGS.purchase, ...(parsed.purchase || {}) },
});

const mapServerSettingsToAppSettings = (settings = {}, fallbackSettings = {}) => mergeSettings({
    companyName: settings.companyName ?? fallbackSettings.companyName ?? DEFAULT_APP_SETTINGS.companyName,
    billingCounter: settings.billingCounter ?? fallbackSettings.billingCounter ?? DEFAULT_APP_SETTINGS.billingCounter,
    barcodeFormat: settings.barcodeFormat,
    thermalPrinter: settings.printConfig?.thermalPrinter,
    labelPrinter: settings.printConfig?.labelPrinter,
    availablePrinters: settings.printConfig?.availablePrinters,
    labelSize: settings.printConfig?.labelSize,
    ui: {
        palette: settings.ui?.palette ?? fallbackSettings.ui?.palette ?? DEFAULT_APP_SETTINGS.ui.palette,
    },
    sales: {
        hideGstInPrint: settings.sales?.hideGstInPrint ?? DEFAULT_APP_SETTINGS.sales.hideGstInPrint,
        mopMandatory: settings.sales?.mopMandatory ?? DEFAULT_APP_SETTINGS.sales.mopMandatory,
        salesmanCompulsory: settings.sales?.salesmanCompulsory ?? DEFAULT_APP_SETTINGS.sales.salesmanCompulsory,
        noDiscountCreditSales: settings.sales?.noDiscountCreditSales ?? DEFAULT_APP_SETTINGS.sales.noDiscountCreditSales,
        negativeBillBlocked: settings.sales?.negativeBillBlocked ?? DEFAULT_APP_SETTINGS.sales.negativeBillBlocked,
    },
    purchase: {
        hsnMandatory: settings.purchase?.hsnMandatory ?? DEFAULT_APP_SETTINGS.purchase.hsnMandatory,
        labelPrintingEnabled: settings.purchase?.labelPrintingEnabled ?? DEFAULT_APP_SETTINGS.purchase.labelPrintingEnabled,
        allowOldBarcode: settings.purchase?.allowOldBarcode ?? DEFAULT_APP_SETTINGS.purchase.allowOldBarcode,
    },
});

const mapAppSettingsToServerSettings = (settings = {}) => ({
    companyName: settings.companyName,
    billingCounter: settings.billingCounter,
    barcodeFormat: settings.barcodeFormat,
    paymentModes: ["Cash", "Card", "UPI", "Bank"],
    printConfig: {
        thermalPrinter: settings.thermalPrinter,
        labelPrinter: settings.labelPrinter,
        availablePrinters: settings.availablePrinters,
        labelSize: settings.labelSize,
    },
    ui: {
        palette: settings.ui?.palette,
    },
    sales: {
        hideGstInPrint: settings.sales?.hideGstInPrint,
        mopMandatory: settings.sales?.mopMandatory,
        salesmanCompulsory: settings.sales?.salesmanCompulsory,
        noDiscountCreditSales: settings.sales?.noDiscountCreditSales,
        negativeBillBlocked: settings.sales?.negativeBillBlocked,
    },
    purchase: {
        hsnMandatory: settings.purchase?.hsnMandatory,
        labelPrintingEnabled: settings.purchase?.labelPrintingEnabled,
        allowOldBarcode: settings.purchase?.allowOldBarcode,
    },
});

const persistLocalSettings = (settings) => {
    const mergedSettings = mergeSettings(settings);
    const nextSavedAt = new Date().toLocaleTimeString();
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(mergedSettings));
    localStorage.setItem(SETTINGS_SAVED_AT_KEY, nextSavedAt);
    window.dispatchEvent(new CustomEvent(APP_SETTINGS_UPDATED_EVENT, {
        detail: {
            settings: mergedSettings,
            savedAt: nextSavedAt,
        },
    }));
    return nextSavedAt;
};

export const readAppSettings = () => {
    if (typeof window === "undefined") {
        return DEFAULT_APP_SETTINGS;
    }

    try {
        const parsed = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "null");
        if (!parsed) {
            return DEFAULT_APP_SETTINGS;
        }

        return mergeSettings(parsed);
    } catch (error) {
        console.error("Failed to parse saved application settings", error);
        return DEFAULT_APP_SETTINGS;
    }
};

export const saveAppSettings = (settings) => {
    if (typeof window === "undefined") {
        return "";
    }

    const mergedSettings = mergeSettings(settings);
    const nextSavedAt = persistLocalSettings(mergedSettings);

    const token = localStorage.getItem("token");
    if (token) {
        api.put("/settings", mapAppSettingsToServerSettings(mergedSettings)).catch((error) => {
            console.error("Failed to sync settings to server", error);
        });
    }

    return nextSavedAt;
};

export const saveAppSettingsAsync = async (settings) => {
    if (typeof window === "undefined") {
        return "";
    }

    const mergedSettings = mergeSettings(settings);
    const nextSavedAt = persistLocalSettings(mergedSettings);

    const token = localStorage.getItem("token");
    if (token) {
        const { data } = await api.put("/settings", mapAppSettingsToServerSettings(mergedSettings));
        if (data.success === false) {
            throw new Error(data.message || "Failed to sync settings to server");
        }
        const mapped = mapServerSettingsToAppSettings(data.data || {}, mergedSettings);
        persistLocalSettings(mapped);
    }

    return nextSavedAt;
};

export const syncAppSettingsFromServer = async () => {
    if (typeof window === "undefined") {
        return DEFAULT_APP_SETTINGS;
    }

    const token = localStorage.getItem("token");
    if (!token) {
        return readAppSettings();
    }

    const { data } = await api.get("/settings");
    if (data.success === false) {
        throw new Error(data.message || "Failed to fetch system settings");
    }

    const mapped = mapServerSettingsToAppSettings(data.data || {}, readAppSettings());
    persistLocalSettings(mapped);
    return mapped;
};

export const getCompanyName = () => readAppSettings().companyName || DEFAULT_APP_SETTINGS.companyName;

export const getPrinterOptions = (settings = readAppSettings()) => {
    const configuredPrinters = Array.isArray(settings?.availablePrinters)
        ? settings.availablePrinters
        : [];

    const defaults = [
        settings?.labelPrinter,
        settings?.thermalPrinter,
        ...DEFAULT_APP_SETTINGS.availablePrinters,
    ];

    return [...configuredPrinters, ...defaults]
        .map((printer) => String(printer || "").trim())
        .filter(Boolean)
        .filter((printer, index, list) => list.indexOf(printer) === index);
};

export const getCompanyAcronym = (companyName = getCompanyName()) => {
    const normalizedName = String(companyName || "").trim();
    if (!normalizedName) {
        return "ERP";
    }

    return normalizedName
        .split(/\s+/)
        .map((word) => word.replace(/[^a-z0-9]/gi, "").charAt(0).toUpperCase())
        .filter(Boolean)
        .join("") || "ERP";
};
