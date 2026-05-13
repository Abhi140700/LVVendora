export const POS_RECOVERY_KEY = "sales-pos-recovery-v1";

export const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
export const clampNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

export const validateSaleBeforeSave = ({
    lines = [],
    stockWarnings = [],
    discountPercent = 0,
    permissionRules = {},
    salesSettings = {},
    salesman = "",
    activeMode = "cashpay",
    paidAmount = 0,
    advanceAmount = 0,
    payableAmount = 0,
    customerName = "",
}) => {
    if (lines.length === 0) return "Add at least one item to the bill.";
    if (stockWarnings.length > 0) {
        return `Stock warning: ${stockWarnings[0].itemName} exceeds available stock.`;
    }
    if (discountPercent > Number(permissionRules.maxBillDiscountPercent || 0)) {
        return `Bill discount cannot exceed ${permissionRules.maxBillDiscountPercent}% for your role.`;
    }
    if (salesSettings.salesmanCompulsory && !String(salesman || "").trim()) {
        return "Salesman is compulsory before saving the bill.";
    }
    if (salesSettings.noDiscountCreditSales && activeMode === "credit") {
        const hasLineDiscount = lines.some((line) => round2(line.lineDiscountPercent) > 0);
        if (round2(discountPercent) > 0 || hasLineDiscount) {
            return "Discount is not allowed for credit sales.";
        }
    }
    if ((activeMode === "credit" || activeMode === "advance") && !customerName.trim()) {
        return "Customer is required for credit and advance bills.";
    }
    if (salesSettings.mopMandatory && (activeMode === "card-upi" || activeMode === "advance")) {
        const hasPositivePayment = (salesSettings.paymentRows || []).some((row) => clampNumber(row.amount) > 0 && String(row.mode || "").trim());
        if (!hasPositivePayment) {
            return "Add at least one payment row before saving.";
        }
    }
    if ((activeMode === "cashpay" || activeMode === "card-upi" || activeMode === "return") && round2(paidAmount + advanceAmount) !== payableAmount) {
        return "Settlement must match the net payable amount.";
    }
    if (activeMode === "advance" && round2(paidAmount + advanceAmount) <= 0) {
        return "Enter advance amount or payment before saving.";
    }
    return "";
};

export const getLineUpdateGuard = ({ field, value, permissionRules, line, role }) => {
    if (field === "saleRate" && !permissionRules.allowPriceOverride && round2(value) !== round2(line.saleRate) && role !== "admin" && role !== "manager" && role !== "superadmin") {
        return "Your role is not allowed to override sale rate.";
    }
    if (field === "mrp" && !permissionRules.allowPriceOverride && round2(value) !== round2(line.mrp)) {
        return "Your role is not allowed to override MRP.";
    }
    return "";
};

export const getBillActionGuard = ({ action, permissionRules }) => {
    if (action === "delete" && !permissionRules.canDeleteBill) {
        return "Your role is not allowed to delete the current bill.";
    }
    if (action === "recall" && !permissionRules.canRecallHoldBill) {
        return "Your role is not allowed to recall held bills.";
    }
    if (action === "reprint" && !permissionRules.canReprintBill) {
        return "Your role is not allowed to reprint completed bills.";
    }
    return "";
};

export const hasRecoverableBillState = (snapshot = {}) => (
    Boolean(snapshot?.billNo)
    || Boolean(snapshot?.customer)
    || Boolean(snapshot?.note)
    || (snapshot?.items || []).length > 0
);

export const createRecoverySnapshot = (draftPayload = {}) => ({
    ...draftPayload,
    savedAt: new Date().toISOString(),
});

export const saveRecoverySnapshot = (snapshot) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(POS_RECOVERY_KEY, JSON.stringify(createRecoverySnapshot(snapshot)));
};

export const loadRecoverySnapshot = () => {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(POS_RECOVERY_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

export const clearRecoverySnapshot = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(POS_RECOVERY_KEY);
};
