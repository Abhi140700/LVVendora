import api from "../../app/axios";
import { normalizeUnit } from "../../utils/unit";

export const API_BASE = globalThis.__ERP_API_BASE__ || "/api";
export const COMPANY_STATE_CODE = "27";
export const COMPANY_STATE_NAME = "Maharashtra";

export const GST_OPTIONS = ["Bill Total", "Item"];
export const PURCHASE_DRAFT_KEY = "purchaseEntryDraftV2";
export const normalizeInputType = (type = "text") => (type === "number" ? "text" : type);
export const getInputMode = (type = "text") => (type === "number" ? "decimal" : undefined);

export const ENTITY_LABELS = {
    party: "Party",
    transporter: "Transporter",
    supplierAgent: "Supplier / Agent",
    firm: "Firm",
    category: "Category",
    brand: "Brand",
};

export const DETAILED_ENTITY_TYPES = new Set(["party", "transporter", "supplierAgent"]);
export const GST_ENABLED_ENTITY_TYPES = new Set(["party", "supplierAgent"]);

export const initialModalState = {
    open: false,
    type: "party",
    rowId: null,
    loadingGst: false,
    form: {
        name: "",
        hsn: "",
        unit: "PCS",
        contactPerson: "",
        phone: "",
        email: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        stateCode: "",
        pincode: "",
        gstNo: "",
        bankName: "",
        bankBranch: "",
        accountNo: "",
        ifsc: "",
        notes: "",
    },
};

export const initialSaveConfirmState = {
    open: false,
    title: "",
    message: "",
};

export const normalizeName = (value = "") => value.trim().replace(/\s+/g, " ");
export const DECIMAL_INPUT_PATTERN = /^(\d+(\.\d*)?|\.\d*)?$/;
export const isMeterCategory = (value = "") => {
    const normalized = normalizeName(value).toUpperCase();
    return ["SHIRTING", "SUITING", "FABRIC", "CLOTH"].includes(normalized);
};

export const parseNumericValue = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const getEditableNumericValue = (value, numericValue) => {
    if (typeof value === "string" && DECIMAL_INPUT_PATTERN.test(value)) {
        return value;
    }

    return numericValue;
};

export const hasMeaningfulItemContent = (item = {}) => (
    Boolean(item.itemId)
    || Boolean(normalizeName(item.category))
    || Boolean(item.categoryId)
    || Boolean(normalizeName(item.hsn))
    || Boolean(normalizeName(item.brand))
    || Boolean(item.brandId)
    || Boolean(normalizeName(item.size))
    || Boolean(normalizeName(item.name))
    || Number(item.qty || 0) > 1
    || Number(item.purchaseRate || 0) > 0
    || Number(item.discount || 0) > 0
);

export const buildRowErrors = (item = {}, hsnMandatory = false) => {
    if (!hasMeaningfulItemContent(item)) {
        return {
            category: false,
            hsn: false,
            name: false,
            qty: false,
            purchaseRate: false,
        };
    }

    const hasCategory = Boolean(item.categoryId) || Boolean(normalizeName(item.category));
    const hasName = Boolean(item.itemId) || Boolean(normalizeName(item.name));
    const hasHsn = Boolean(normalizeName(item.hsn));

    return {
        category: !hasCategory,
        hsn: hsnMandatory && !hasHsn,
        name: !hasName,
        qty: Number(item.qty || 0) <= 0,
        purchaseRate: Number(item.purchaseRate || 0) <= 0,
    };
};

export const createEmptyItem = () => ({
    id: Date.now() + Math.floor(Math.random() * 1000),
    itemId: "",
    category: "",
    categoryId: "",
    hsn: "",
    brand: "",
    brandId: "",
    size: "",
    color: "",
    material: "",
    style: "",
    designNo: "",
    name: "",
    qty: 1,
    unit: "PCS",
    purchaseRate: 0,
    discount: 0,
    netRate: 0,
    total: 0,
    perPercent: 0,
    mrp: 0,
    saleRate: 0,
    extraDiscount: 0,
    labelPerPc: 1,
    packOf: "",
    packQty: "",
    subStyle: "",
    rowDate: "",
    partyName: "",
});

export const emptyInsight = {
    lastBillNo: "",
    lastBillDate: null,
    lastBillAmount: 0,
    outstandingApprox: 0,
};

export const recalculateItem = (item) => {
    const qty = parseNumericValue(item.qty);
    const purchaseRate = parseNumericValue(item.purchaseRate);
    const discount = parseNumericValue(item.discount);
    const netRate = purchaseRate - (purchaseRate * discount) / 100;
    const total = netRate * qty;

    return {
        ...item,
        qty: getEditableNumericValue(item.qty, qty),
        unit: normalizeUnit(item.unit),
        purchaseRate: getEditableNumericValue(item.purchaseRate, purchaseRate),
        discount: getEditableNumericValue(item.discount, discount),
        netRate,
        total,
        perPercent: getEditableNumericValue(item.perPercent, parseNumericValue(item.perPercent)),
        mrp: getEditableNumericValue(item.mrp, parseNumericValue(item.mrp)),
        saleRate: getEditableNumericValue(item.saleRate, parseNumericValue(item.saleRate)),
        extraDiscount: getEditableNumericValue(item.extraDiscount, parseNumericValue(item.extraDiscount)),
        labelPerPc: getEditableNumericValue(item.labelPerPc, parseNumericValue(item.labelPerPc) || 1),
        packOf: item.packOf || "",
        packQty: item.packQty || "",
        subStyle: item.subStyle || "",
        color: item.color || "",
        material: item.material || "",
        style: item.style || "",
        designNo: item.designNo || "",
        rowDate: item.rowDate || "",
        partyName: item.partyName || "",
    };
};

export const findByName = (options, value) => {
    const normalized = normalizeName(value).toLowerCase();
    return options.find((option) => option.name.toLowerCase() === normalized) || null;
};

export const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const toApiUrl = (url = "") => {
    const apiBase = API_BASE.replace(/\/$/, "");
    const value = String(url);

    if (value.startsWith(apiBase)) {
        return value.slice(apiBase.length) || "/";
    }

    return value;
};

export async function fetchWithAuth(url, options = {}) {
    const method = options.method || "GET";
    let payload = options.body;

    if (typeof payload === "string") {
        try {
            payload = JSON.parse(payload);
        } catch {
            payload = undefined;
        }
    }

    try {
        const { data } = await api.request({
            url: toApiUrl(url),
            method,
            data: payload,
            headers: options.headers,
        });

        return data;
    } catch (error) {
        const responseData = error.response?.data || {};
        throw new Error(responseData.error || responseData.message || error.message || "Request failed");
    }
}
