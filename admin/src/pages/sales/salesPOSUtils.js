export const API_BASE = globalThis.__ERP_API_BASE__ || "/api";

export const BILL_MODES = [
    { id: "cashpay", label: "Cashpay" },
    { id: "exchange", label: "Exchange" },
    { id: "return", label: "Return" },
    { id: "card-upi", label: "Card / UPI" },
    { id: "hold", label: "Hold" },
    { id: "recall", label: "Recall" },
    { id: "credit", label: "Credit" },
    { id: "advance", label: "Advance" },
];

export const POS_SHORTCUTS = [
    { key: "F1", label: "Cash Pay", action: "mode", mode: "cashpay" },
    { key: "F2", label: "Exchange", action: "exchange" },
    { key: "F3", label: "Card / UPI", action: "mode", mode: "card-upi" },
    { key: "F4", label: "Add Customer", action: "add-customer" },
    { key: "F5", label: "Hold Bill", action: "hold" },
    { key: "F6", label: "Recall", action: "holds" },
    { key: "F7", label: "Cash Mode", action: "billing-mode", mode: "cashpay" },
    { key: "F8", label: "Credit Mode", action: "billing-mode", mode: "credit" },
    { key: "F9", label: "Advance Mode", action: "billing-mode", mode: "advance" },
    { key: "Esc", label: "Reset Bill", action: "reset" },
    { key: "F11", label: "Sales Return", action: "route", route: "/sales/return" },
    { key: "F12", label: "Receipt", action: "payment-options" },
    { key: "Ctrl+P", label: "Reprint", action: "print" },
    { key: "Ctrl+L", label: "Print Last", action: "print" },
];

export const PAYMENT_MODE_OPTIONS = ["Cash", "Card", "UPI", "Bank"];

export const EMPTY_CUSTOMER_FORM = {
    recordId: "",
    name: "",
    phone: "",
    customerCode: "",
    customerType: "retail",
    creditLimit: "",
    segmentTags: "",
    loyaltyCardNo: "",
    applyLoyalty: false,
    area: "",
    dateOfBirth: "",
    anniversary: "",
    deliveryInfo: "",
    note: "",
    gstin: "",
    tradeName: "",
    legalName: "",
    address: "",
    city: "",
    pincode: "",
};

export const EMPTY_SALESMAN_FORM = {
    recordId: "",
    salesmanCode: "",
    name: "",
    phone: "",
    location: "",
    notes: "",
};

export const EMPTY_CONFIRMATION = {
    open: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    noLabel: "No",
    cancelLabel: "Cancel",
    tone: "primary",
    onConfirm: null,
    onNo: null,
    onCancel: null,
};

export const DEFAULT_RULES = {
    allowPriceOverride: false,
    maxBillDiscountPercent: 10,
    maxLineDiscountPercent: 10,
    canCloseSession: false,
    canBroadcast: false,
    canReprintLabel: false,
    canReprintBill: false,
    canRecallHoldBill: false,
    canDeleteBill: false,
    canDeletePurchase: false,
    canAdjustStock: false,
};

export const exportRowsAsCsv = (rows, fileName) => {
    const csv = rows
        .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
};

export const createPaymentRow = (mode = "Cash", amount = 0) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mode,
    amount,
    reference: "",
});

export const createSearchFilters = () => ({
    itemName: "",
    category: "",
    brand: "",
    mrp: "",
    saleRate: "",
});

export const createExchangeFilters = () => ({
    billNo: "",
    barcode: "",
    customer: "",
    itemName: "",
});

export const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const clampNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

export const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

export const escapePrintHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const formatPrintMoney = (value) => Number(value || 0).toFixed(2);

const NUMBER_WORDS = {
    ones: ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"],
    teens: ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"],
    tens: ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"],
};

const convertBelowThousand = (value) => {
    const numeric = Math.max(0, Math.floor(Number(value) || 0));
    const parts = [];
    const hundreds = Math.floor(numeric / 100);
    const remainder = numeric % 100;

    if (hundreds > 0) {
        parts.push(`${NUMBER_WORDS.ones[hundreds]} hundred`);
    }
    if (remainder >= 20) {
        const tens = Math.floor(remainder / 10);
        const ones = remainder % 10;
        parts.push([NUMBER_WORDS.tens[tens], NUMBER_WORDS.ones[ones]].filter(Boolean).join(" "));
    } else if (remainder >= 10) {
        parts.push(NUMBER_WORDS.teens[remainder - 10]);
    } else if (remainder > 0) {
        parts.push(NUMBER_WORDS.ones[remainder]);
    }

    return parts.join(" ").trim();
};

const numberToIndianWords = (value) => {
    const numeric = Math.max(0, Math.floor(Number(value) || 0));
    if (numeric === 0) {
        return "zero";
    }

    const crore = Math.floor(numeric / 10000000);
    const lakh = Math.floor((numeric % 10000000) / 100000);
    const thousand = Math.floor((numeric % 100000) / 1000);
    const remainder = numeric % 1000;
    const parts = [];

    if (crore) parts.push(`${convertBelowThousand(crore)} crore`);
    if (lakh) parts.push(`${convertBelowThousand(lakh)} lakh`);
    if (thousand) parts.push(`${convertBelowThousand(thousand)} thousand`);
    if (remainder) parts.push(convertBelowThousand(remainder));

    return parts.join(" ").trim();
};

export const amountToWords = (value) => {
    const numeric = Math.max(0, Number(value) || 0);
    const rupees = Math.floor(numeric);
    const paise = Math.round((numeric - rupees) * 100);
    const rupeeText = `${numberToIndianWords(rupees)} rupees`;
    return paise ? `${rupeeText} and ${numberToIndianWords(paise)} paise` : rupeeText;
};

const METER_UNITS = new Set(["MTR", "MTRS", "METER", "METERS"]);
export const DECIMAL_INPUT_PATTERN = /^(\d+(\.\d*)?|\.\d*)?$/;

export const isMeterUnit = (value) => METER_UNITS.has(String(value || "").trim().toUpperCase());

export const getBarcodeDefaultQty = (product = {}) => {
    const minimumQty = isMeterUnit(product.unit) ? 0.01 : 1;
    const defaultQty = Number(product.defaultSalesQty || product.defaultQty || product.labelQty || 1);
    return Number.isFinite(defaultQty) && defaultQty > 0 ? Math.max(minimumQty, defaultQty) : minimumQty;
};

export const getLineBillableQty = (line = {}) =>
    isMeterUnit(line.unit) ? parseNumericValue(line.mtrQty ?? line.qty, 0) : parseNumericValue(line.qty, 0);

export const parseNumericValue = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

export const getLineDiscountAmount = (line = {}) => {
    const billableQty = getLineBillableQty(line);
    const originalSaleRate = round2(parseNumericValue(line.originalSaleRate || line.saleRate || 0));
    const saleRate = round2(parseNumericValue(line.saleRate || 0));
    return round2(Math.max(0, originalSaleRate - saleRate) * billableQty);
};

export const applyDiscountPercentToLines = (lines = [], discountPercent = 0) => {
    const percent = Math.min(100, Math.max(0, parseNumericValue(discountPercent, 0)));
    if (!lines.length) {
        return lines;
    }

    return lines.map((line) => {
        const originalSaleRate = round2(parseNumericValue(line.originalSaleRate || line.saleRate || 0));
        const nextSaleRate = round2(Math.max(0, originalSaleRate - ((originalSaleRate * percent) / 100)));
        return recalculateLine({
            ...line,
            originalSaleRate,
            saleRate: nextSaleRate,
        });
    });
};

export const getEditableNumericValue = (value, numericValue) => {
    if (typeof value === "string" && DECIMAL_INPUT_PATTERN.test(value)) {
        return value;
    }
    return numericValue;
};

export const isAppleMobileBrowser = () => {
    if (typeof navigator === "undefined") {
        return false;
    }

    const userAgent = navigator.userAgent || "";
    return /iPhone|iPad|iPod/i.test(userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
};

export const normalizeBarcodeValue = (value = "") => String(value || "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();

export const getBarcodeCandidates = (value = "") => {
    const normalized = normalizeBarcodeValue(value);
    const compact = normalized.replace(/\s+/g, "");
    const digitsOnly = compact.replace(/\D/g, "");
    return Array.from(new Set([normalized, compact, digitsOnly].filter(Boolean)));
};

export const normalizeScannerError = (error) => {
    const name = String(error?.name || "");
    const message = String(error?.message || "").trim();

    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        return "Camera permission was denied. Allow camera access in Safari settings and reload the page.";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        return "No camera was found on this device.";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
        return "The camera is busy in another app or tab. Close other camera apps and try again.";
    }
    if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
        return "The rear camera could not be started with the current settings. Retrying with a simpler camera mode may help.";
    }
    if (message.includes("sales-pos-html5-scanner")) {
        return "Scanner view was not ready yet. Retrying the camera start.";
    }
    if (window.isSecureContext === false) {
        return "Live camera scanning requires HTTPS on iPhone. Open the secure HTTPS address for this app.";
    }

    return message || "Unable to start camera scanner.";
};

export const createLineItem = (product, salesmanNumber = "") => {
    const mrp = round2(product.mrp || product.sellingRate || 0);
    const saleRate = round2(product.sellingRate || product.purchaseRate || 0);
    const defaultQty = getBarcodeDefaultQty(product);
    const meterItem = isMeterUnit(product.unit);
    const billableQty = meterItem ? defaultQty : defaultQty;
    return {
        id: `${product._id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        inventoryId: product._id,
        itemId: product.itemId?._id || product.itemId || product._id,
        barcode: product.barcode || "",
        salesmanNumber,
        category: product.category?._id || product.category || "",
        categoryName: product.category?.name || product.categoryName || "General",
        brand: product.brand?._id || product.brand || "",
        brandName: product.brand?.name || product.brandName || "-",
        itemName: product.name || product.itemName || "Item",
        qty: meterItem ? 1 : defaultQty,
        mtrQty: meterItem ? defaultQty : "",
        originalQty: 0,
        stock: Number(product.stock || 0),
        mrp,
        saleRate,
        originalSaleRate: saleRate,
        lineDiscountPercent: 0,
        lineTotal: saleRate * billableQty,
        unit: product.unit || "PC",
    };
};

export const recalculateLine = (line) => {
    const meterItem = isMeterUnit(line.unit);
    const qtyValue = Math.max(1, parseNumericValue(line.qty, 1));
    const mtrQtyValue = meterItem
        ? Math.max(0.01, parseNumericValue(line.mtrQty ?? line.qty, 0.01))
        : "";
    const billableQty = meterItem ? mtrQtyValue : qtyValue;
    const mrpValue = round2(parseNumericValue(line.mrp));
    const originalSaleRate = round2(parseNumericValue(line.originalSaleRate || line.saleRate || 0));
    const saleRateValue = round2(parseNumericValue(line.saleRate));
    const safeOriginal = originalSaleRate || saleRateValue;
    const lineDiscountPercent = safeOriginal > 0
        ? Math.max(0, round2(((safeOriginal - saleRateValue) / safeOriginal) * 100))
        : 0;

    return {
        ...line,
        qty: getEditableNumericValue(line.qty, qtyValue),
        mtrQty: meterItem ? getEditableNumericValue(line.mtrQty, mtrQtyValue) : "",
        mrp: getEditableNumericValue(line.mrp, mrpValue),
        saleRate: getEditableNumericValue(line.saleRate, saleRateValue),
        originalSaleRate: safeOriginal,
        lineDiscountPercent,
        lineTotal: round2(billableQty * saleRateValue),
    };
};

export const mapDraftLine = (item) => recalculateLine({
    id: item._id || item.id || `${item.inventoryId || item.itemId}-${Date.now()}`,
    inventoryId: item.inventoryId || "",
    itemId: item.itemId || "",
    barcode: item.barcode || "",
    salesmanNumber: item.salesmanNumber || "",
    category: item.category || "",
    categoryName: item.categoryName || "General",
    brand: item.brand || "",
    brandName: item.brandName || "-",
    itemName: item.itemName || "Item",
    qty: item.displayQty || item.pcsQty || item.qty || 1,
    mtrQty: item.mtrQty || (isMeterUnit(item.unit) ? item.qty : ""),
    originalQty: item.originalQty ?? item.qty ?? 0,
    stock: item.stock || 0,
    mrp: item.mrp || 0,
    saleRate: item.saleRate ?? item.sellingRate ?? 0,
    originalSaleRate: item.originalSaleRate ?? item.saleRate ?? item.sellingRate ?? 0,
    lineDiscountPercent: item.lineDiscountPercent || 0,
    lineTotal: item.lineTotal || item.total || 0,
    unit: item.unit || "PC",
});
