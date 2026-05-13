import api from "../../app/axios";

export const API_BASE = globalThis.__ERP_API_BASE__ || "/api";
export const COMPANY_STATE_CODE = "27";
export const UNIT_OPTIONS = ["PC", "MTR", "KG"];

export const normalizeInputType = (type = "text") => (type === "number" ? "text" : type);
export const getInputMode = (type = "text") => (type === "number" ? "decimal" : undefined);

export const EMPTY_FILTERS = {
    grn: "",
    party: "",
    supplier: "",
    agent: "",
    billNo: "",
    billDate: "",
    lrNo: "",
    category: "",
    brand: "",
    itemName: "",
    barcode: "",
};

export const hasValidSearchFilters = (filters = EMPTY_FILTERS) =>
    Object.values(filters).some((value) => String(value || "").trim() !== "");

export const createItemDraft = () => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemId: "",
    barcode: "",
    category: "",
    brand: "",
    name: "",
    hsn: "",
    size: "",
    color: "",
    material: "",
    style: "",
    subStyle: "",
    designNo: "",
    qty: 1,
    unit: "PC",
    purchaseRate: 0,
    mrp: 0,
    saleRate: 0,
    discount: 0,
    netRate: 0,
    total: 0,
    received: false,
    printedLabels: 0,
    labelsPrinted: false,
});

export const createBillDraft = () => {
    const today = new Date().toISOString().split("T")[0];
    return {
        _id: null,
        grnNo: "",
        receiveDate: today,
        lrId: "",
        lrNo: "",
        bale: "",
        transporter: "",
        firm: "",
        party: "",
        partyState: COMPANY_STATE_CODE,
        supplier: "",
        agent: "",
        supplierAgent: "",
        billDate: today,
        billNo: "",
        billAmount: 0,
        deliveryChallan: "",
        gstOn: "Bill Total",
        godown: "",
        inwardDate: today,
        hundekari: "",
        transportCharges: 0,
        hamaliCharges: 0,
        gstRate: 5,
        addCharges: 0,
        discountTotal: 0,
        commission: 0,
        packingRoundoff: 0,
        received: false,
        labelsPrinted: false,
        items: [createItemDraft()],
    };
};

export const asNumber = (value) => Number(value || 0);

export const getDisplayText = (value, fallback = "") => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    if (typeof value === "object") {
        return String(
            value.name ||
            value.displayName ||
            value.label ||
            value.title ||
            value.billNo ||
            value.grnNo ||
            value._id ||
            fallback,
        );
    }
    return String(value || fallback);
};

export const getLowerText = (value) => getDisplayText(value).toLowerCase();

export const recalculateItem = (item) => {
    const qty = asNumber(item.qty);
    const purchaseRate = asNumber(item.purchaseRate);
    const discount = asNumber(item.discount);
    const netRate = purchaseRate - (purchaseRate * discount) / 100;
    const total = qty * netRate;

    return {
        ...item,
        qty,
        purchaseRate,
        discount,
        netRate,
        total,
    };
};

export const mapItemToDraft = (item = {}, fallbackId = null) => recalculateItem({
    _id: item._id || "",
    id: item._id || item.id || fallbackId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemId: item.itemId?._id || item.itemId || "",
    stockOnHand: Number(item.stockOnHand ?? item.stock ?? 0),
    barcode: item.barcode || item.itemId?.barcode || "",
    category: getDisplayText(item.category?.name || item.category),
    brand: getDisplayText(item.brand?.name || item.brand),
    name: item.name || item.itemName || item.itemId?.name || "",
    hsn: item.hsn || item.itemId?.hsn || "",
    size: item.size || "",
    color: item.color || item.colour || "",
    material: item.material || item.fabric || "",
    style: item.style || "",
    subStyle: item.subStyle || "",
    designNo: item.designNo || "",
    qty: item.qty ?? 1,
    unit: item.unit || item.itemId?.unit || "PC",
    purchaseRate: item.purchaseRate ?? item.itemId?.defaultPurchaseRate ?? 0,
    mrp: item.mrp ?? item.itemId?.mrp ?? item.sellingRate ?? item.price ?? 0,
    saleRate: item.saleRate ?? item.itemId?.saleRate ?? item.sellingRate ?? item.price ?? item.mrp ?? 0,
    discount: item.discount ?? 0,
    netRate: item.netRate ?? 0,
    total: item.total ?? 0,
    received: Boolean(item.received),
    printedLabels: Number(item.printedLabels || 0),
    labelsPrinted: Boolean(item.labelsPrinted),
});

export const mapBillToDraft = (bill) => ({
    _id: bill._id,
    grnNo: bill.grnNo || "",
    receiveDate: bill.receiveDate ? new Date(bill.receiveDate).toISOString().split("T")[0] : "",
    lrId: bill.lrId || "",
    lrNo: bill.lrNo || "",
    bale: bill.bale ?? "",
    transporter: bill.transporter || "",
    firm: getDisplayText(bill.firm),
    party: getDisplayText(bill.party?.name || bill.party),
    partyState: bill.partyState || COMPANY_STATE_CODE,
    supplier: getDisplayText(bill.supplier || bill.supplierAgent),
    agent: getDisplayText(bill.agent),
    supplierAgent: getDisplayText(bill.supplierAgent),
    billDate: bill.billDate ? new Date(bill.billDate).toISOString().split("T")[0] : "",
    billNo: bill.billNo || "",
    billAmount: bill.billAmount ?? 0,
    deliveryChallan: bill.deliveryChallan || "",
    gstOn: bill.gstOn || "Bill Total",
    godown: bill.godown || "",
    inwardDate: bill.inwardDate ? new Date(bill.inwardDate).toISOString().split("T")[0] : "",
    hundekari: bill.hundekari || "",
    transportCharges: bill.transportCharges ?? 0,
    hamaliCharges: bill.hamaliCharges ?? 0,
    gstRate: bill.gstRate ?? 5,
    addCharges: bill.addCharges ?? 0,
    discountTotal: bill.discountTotal ?? 0,
    commission: bill.commission ?? 0,
    packingRoundoff: bill.packingRoundoff ?? 0,
    received: Boolean(bill.received),
    labelsPrinted: Boolean(bill.labelsPrinted),
    items: (bill.items || []).length > 0
        ? bill.items.map((item, index) => mapItemToDraft(item, `${bill._id}-${index}`))
        : [createItemDraft()],
});

export const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
};

export const toPositiveNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};

const normalizeLookupText = (value = "") => getDisplayText(value).trim().toLowerCase();

const getItemLookupKey = (item = {}) => [
    normalizeLookupText(item.name || item.itemName),
    normalizeLookupText(item.category?.name || item.category),
    normalizeLookupText(item.brand?.name || item.brand),
].join("|");

const getInventoryItemId = (item = {}) => String(item.itemId?._id || item.itemId || "").trim();

const enrichBillItemsWithInventory = (items = [], inventoryByItemId = new Map(), inventoryByIdentity = new Map()) =>
    items.map((item) => {
        const itemIdKey = getInventoryItemId(item);
        const inventoryItem = inventoryByItemId.get(itemIdKey) || inventoryByIdentity.get(getItemLookupKey(item));

        if (!inventoryItem) {
            return item;
        }

        return {
            ...item,
            stockOnHand: Number(inventoryItem.stock || 0),
            barcode: item.barcode || inventoryItem.barcode || item.itemId?.barcode || "",
            mrp: toPositiveNumber(item.mrp, toPositiveNumber(inventoryItem.mrp, toPositiveNumber(item.itemId?.mrp, 0))),
            saleRate: toPositiveNumber(
                item.saleRate,
                toPositiveNumber(
                    inventoryItem.sellingRate ?? inventoryItem.saleRate,
                    toPositiveNumber(item.itemId?.saleRate ?? item.itemId?.sellingRate, toPositiveNumber(item.mrp, 0)),
                ),
            ),
        };
    });

export const enrichBillsWithInventory = (bills = [], inventoryItems = []) => {
    const inventoryByItemId = new Map();
    const inventoryByIdentity = new Map();

    inventoryItems.forEach((inventoryItem) => {
        const itemIdKey = getInventoryItemId(inventoryItem);
        if (itemIdKey) {
            inventoryByItemId.set(itemIdKey, inventoryItem);
        }
        inventoryByIdentity.set(getItemLookupKey(inventoryItem), inventoryItem);
    });

    return bills.map((bill) => ({
        ...bill,
        items: enrichBillItemsWithInventory(bill.items || [], inventoryByItemId, inventoryByIdentity),
    }));
};

const toApiUrl = (url = "") => {
    const apiBase = API_BASE.replace(/\/$/, "");
    const value = String(url);

    if (value.startsWith(apiBase)) {
        return value.slice(apiBase.length) || "/";
    }

    return value;
};

export async function request(url, options = {}) {
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

        if (data.success === false) {
            throw new Error(data.message || "Request failed");
        }

        return data;
    } catch (error) {
        throw new Error(error.response?.data?.message || error.message || "Request failed");
    }
}

const focusNextFocusable = (currentTarget) => {
    if (!currentTarget || typeof document === "undefined") {
        return;
    }

    const scope = currentTarget.closest("[data-enter-scope='manage-receive']") || document;
    const focusableElements = Array.from(scope.querySelectorAll("input, select, textarea, button"))
        .filter((element) => !element.disabled && element.tabIndex !== -1 && element.type !== "hidden");
    const currentIndex = focusableElements.indexOf(currentTarget);

    if (currentIndex === -1) {
        return;
    }

    const nextElement = focusableElements.slice(currentIndex + 1)
        .find((element) => !element.readOnly && element.tagName !== "BUTTON");

    if (!nextElement) {
        return;
    }

    nextElement.focus();
    if (typeof nextElement.select === "function" && nextElement.tagName === "INPUT") {
        nextElement.select();
    }
};

export const handleAdvanceOnEnter = (event) => {
    if (event.key !== "Enter") {
        return;
    }

    if (event.currentTarget.tagName === "TEXTAREA") {
        return;
    }

    event.preventDefault();
    focusNextFocusable(event.currentTarget);
};
