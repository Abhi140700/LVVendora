import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { QRCodeSVG } from "qrcode.react";
import { renderToStaticMarkup } from "react-dom/server";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../app/axios";
import useAppSettings from "../../hooks/useAppSettings";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { PosBillHeader, PosLineItemsTable, PosPaymentPanel } from "./posComponents";
import {
    clearRecoverySnapshot,
    getBillActionGuard,
    getLineUpdateGuard,
    hasRecoverableBillState,
    loadRecoverySnapshot,
    saveRecoverySnapshot,
    validateSaleBeforeSave,
} from "./posLogic";

import styles from "./salesPOSStyles";
import {
    CardUpiBillingModal,
    CashBillingModal,
    Field,
    Modal,
    PaymentModal,
    SummaryLine,
    getCardUpiTotals,
    moveActiveIndex,
} from "./components/SalesPOSModals";
import {
    API_BASE,
    BILL_MODES,
    DEFAULT_RULES,
    DECIMAL_INPUT_PATTERN,
    EMPTY_CONFIRMATION,
    EMPTY_CUSTOMER_FORM,
    EMPTY_SALESMAN_FORM,
    PAYMENT_MODE_OPTIONS,
    POS_SHORTCUTS,
    amountToWords,
    clampNumber,
    createExchangeFilters,
    createLineItem,
    createPaymentRow,
    createSearchFilters,
    escapePrintHtml,
    exportRowsAsCsv,
    formatPrintMoney,
    applyDiscountPercentToLines,
    getBarcodeCandidates,
    getBarcodeDefaultQty,
    getLineBillableQty,
    getLineDiscountAmount,
    isAppleMobileBrowser,
    isMeterUnit,
    mapDraftLine,
    nextFrame,
    normalizeBarcodeValue,
    normalizeScannerError,
    parseNumericValue,
    recalculateLine,
    round2,
} from "./salesPOSUtils";

const toApiUrl = (url = "") => {
    const apiBase = API_BASE.replace(/\/$/, "");
    const value = String(url);

    if (value.startsWith(apiBase)) {
        return value.slice(apiBase.length) || "/";
    }

    return value;
};

const apiFetch = async (url, options = {}) => {
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
        const response = await api.request({
            url: toApiUrl(url),
            method,
            data: payload,
            headers: options.headers,
        });

        return {
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            json: async () => response.data,
        };
    } catch (error) {
        const response = error.response;

        return {
            ok: false,
            status: response?.status || 0,
            json: async () => response?.data || { message: error.message || "Request failed" },
        };
    }
};

const getBillingModeFromPosMode = (mode = "cashpay") => {
    if (mode === "advance") return "ADVANCE";
    if (mode === "credit") return "CREDIT";
    return "CASH";
};

const SalesPOS = () => {
    const appSettings = useAppSettings();
    const salesSettings = appSettings.sales || {};
    const navigate = useNavigate();
    const location = useLocation();
    const role = localStorage.getItem("role") || "sales";
    const token = localStorage.getItem("token");
    const barcodeInputRef = useRef(null);
    const barcodeFocusFrameRef = useRef(null);
    const barcodeFocusTimerRef = useRef(null);
    const barcodeFocusLockRef = useRef(false);
    const scannerVideoRef = useRef(null);
    const scannerStreamRef = useRef(null);
    const scannerFrameRef = useRef(null);
    const html5QrCodeRef = useRef(null);
    const scannerFileInputRef = useRef(null);
    const scannerMissRef = useRef({ code: "", timestamp: 0 });
    const scannerLookupInFlightRef = useRef(false);
    const scannerClosingRef = useRef(false);
    const autosaveTimerRef = useRef(null);
    const draftReadyRef = useRef(false);
    const qtyInputRefs = useRef(new Map());
    const meterInputRefs = useRef(new Map());
    const searchRowRefs = useRef(new Map());
    const customerRowRefs = useRef(new Map());
    const salesmanRowRefs = useRef(new Map());
    const heldBillRefs = useRef(new Map());
    const [pendingQtyFocusLineId, setPendingQtyFocusLineId] = useState("");

    const [inventory, setInventory] = useState([]);
    const [salesHistory, setSalesHistory] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [salespeople, setSalespeople] = useState([]);
    const [heldBills, setHeldBills] = useState([]);
    const [activeSession, setActiveSession] = useState(null);
    const [permissionRules, setPermissionRules] = useState(DEFAULT_RULES);
    const [whatsappStatus, setWhatsappStatus] = useState({ enabled: false, message: "" });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeMode, setActiveMode] = useState("cashpay");
    const [billingMode, setBillingMode] = useState("CASH");
    const [billNo, setBillNo] = useState("");
    const [barcodeInput, setBarcodeInput] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [customerId, setCustomerId] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerLocation, setCustomerLocation] = useState("");
    const [customerDob, setCustomerDob] = useState("");
    const [customerAnniversary, setCustomerAnniversary] = useState("");
    const [loyaltySummary, setLoyaltySummary] = useState({ earned: 0, redeemed: 0, balance: 0, history: [] });
    const [loyaltyRedeemPoints, setLoyaltyRedeemPoints] = useState("");
    const [deliveryInfo, setDeliveryInfo] = useState("");
    const [referenceNo, setReferenceNo] = useState("");
    const [note, setNote] = useState("");
    const [salesman, setSalesman] = useState("");
    const [salespersonId, setSalespersonId] = useState("");
    const [salesmanCodeInput, setSalesmanCodeInput] = useState("");
    const [salesmanLookupInput, setSalesmanLookupInput] = useState("");
    const [discountPercent, setDiscountPercent] = useState(0);
    const [discountPercentInput, setDiscountPercentInput] = useState("");
    const [manualAdvanceAmount, setManualAdvanceAmount] = useState(0);
    const [advanceExpectedDeliveryDate, setAdvanceExpectedDeliveryDate] = useState("");
    const [creditDueDate, setCreditDueDate] = useState("");
    const [lines, setLines] = useState([]);
    const [paymentRows, setPaymentRows] = useState([createPaymentRow("Cash", 0)]);
    const [searchModalOpen, setSearchModalOpen] = useState(false);
    const [customerModalOpen, setCustomerModalOpen] = useState(false);
    const [customerFormOpen, setCustomerFormOpen] = useState(false);
    const [salesmanModalOpen, setSalesmanModalOpen] = useState(false);
    const [salesmanFormOpen, setSalesmanFormOpen] = useState(false);
    const [scannerModalOpen, setScannerModalOpen] = useState(false);
    const [scannerSessionKey, setScannerSessionKey] = useState(0);
    const [scannerMode, setScannerMode] = useState("native");
    const [scannerCanUpload, setScannerCanUpload] = useState(false);
    const [mobileShortcutChoice, setMobileShortcutChoice] = useState("");
    const [discountModalOpen, setDiscountModalOpen] = useState(false);
    const [exchangeModalOpen, setExchangeModalOpen] = useState(false);
    const [holdModalOpen, setHoldModalOpen] = useState(false);
    const [printModalOpen, setPrintModalOpen] = useState(false);
    const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
    const [sessionModalOpen, setSessionModalOpen] = useState(false);
    const [confirmationState, setConfirmationState] = useState(EMPTY_CONFIRMATION);
    const [lastCompletedSale, setLastCompletedSale] = useState(null);
    const [searchFilters, setSearchFilters] = useState(createSearchFilters());
    const [exchangeFilters, setExchangeFilters] = useState(createExchangeFilters());
    const [customerSearch, setCustomerSearch] = useState("");
    const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER_FORM);
    const [salesmanSearch, setSalesmanSearch] = useState("");
    const [salesmanForm, setSalesmanForm] = useState(EMPTY_SALESMAN_FORM);
    const [selectedExchangeItems, setSelectedExchangeItems] = useState([]);
    const [statusMessage, setStatusMessage] = useState("");
    const [scannerStatus, setScannerStatus] = useState("");
    const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
    const [broadcastMessage, setBroadcastMessage] = useState("");
    const [sendingBroadcast, setSendingBroadcast] = useState(false);
    const [sessionForm, setSessionForm] = useState({ openingCash: 0, closingCash: 0, expenseAmount: 0, expenseNote: "" });
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedPaymentMode, setSelectedPaymentMode] = useState("Cash");
    const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
    const [activeCustomerIndex, setActiveCustomerIndex] = useState(-1);
    const [activeSalesmanIndex, setActiveSalesmanIndex] = useState(-1);
    const [activeHeldBillIndex, setActiveHeldBillIndex] = useState(-1);

    const cancelPendingBarcodeFocus = useCallback(() => {
        if (barcodeFocusFrameRef.current) {
            cancelAnimationFrame(barcodeFocusFrameRef.current);
            barcodeFocusFrameRef.current = null;
        }
        if (barcodeFocusTimerRef.current) {
            clearTimeout(barcodeFocusTimerRef.current);
            barcodeFocusTimerRef.current = null;
        }
    }, []);

    const scheduleBarcodeFocus = useCallback((delay = 0) => {
        cancelPendingBarcodeFocus();
        const focusBarcode = () => {
            if (barcodeFocusLockRef.current) {
                return;
            }
            barcodeInputRef.current?.focus();
        };

        if (delay > 0) {
            barcodeFocusTimerRef.current = window.setTimeout(() => {
                barcodeFocusTimerRef.current = null;
                barcodeFocusFrameRef.current = requestAnimationFrame(() => {
                    barcodeFocusFrameRef.current = null;
                    focusBarcode();
                });
            }, delay);
            return;
        }

        barcodeFocusFrameRef.current = requestAnimationFrame(() => {
            barcodeFocusFrameRef.current = null;
            focusBarcode();
        });
    }, [cancelPendingBarcodeFocus]);

    const reserveQtyFocus = useCallback((lineId) => {
        if (!lineId) {
            return;
        }
        barcodeFocusLockRef.current = true;
        cancelPendingBarcodeFocus();
        setPendingQtyFocusLineId(lineId);
        if (document.activeElement === barcodeInputRef.current) {
            barcodeInputRef.current?.blur();
        }
    }, [cancelPendingBarcodeFocus]);
    const [billingActionModal, setBillingActionModal] = useState(null);
    const isAnyModalOpen = Boolean(
        billingActionModal
        || paymentModalOpen
        || searchModalOpen
        || customerModalOpen
        || salesmanModalOpen
        || scannerModalOpen
        || exchangeModalOpen
        || holdModalOpen
        || discountModalOpen
        || printModalOpen
        || broadcastModalOpen
        || sessionModalOpen
        || confirmationState.open,
    );

    const currentDateLabel = useMemo(() => {
        const referenceDate = activeSession?.businessDate || new Date();
        return new Date(referenceDate).toLocaleDateString("en-IN");
    }, [activeSession?.businessDate]);
    const lastBillAmount = useMemo(() => round2(salesHistory[0]?.totalAmount || 0), [salesHistory]);

    const itemDiscountAmount = useMemo(() => round2(lines.reduce((sum, line) => sum + getLineDiscountAmount(line), 0)), [lines]);
    const subtotal = useMemo(() => lines.reduce((sum, line) => sum + round2(line.lineTotal), 0), [lines]);
    const discountAmount = useMemo(() => round2((subtotal * clampNumber(discountPercent)) / 100), [discountPercent, subtotal]);
    const exchangeAmount = useMemo(() => selectedExchangeItems.reduce((sum, item) => sum + round2(item.amount), 0), [selectedExchangeItems]);
    const payableAmount = useMemo(() => round2(Math.max(0, subtotal - discountAmount - exchangeAmount)), [discountAmount, exchangeAmount, subtotal]);
    const loyaltyRedeemAmount = useMemo(() => {
        const points = Math.max(0, Math.floor(clampNumber(loyaltyRedeemPoints)));
        const valuePerPoint = Math.max(0, clampNumber(appSettings.loyalty?.redeemValuePerPoint, 1));
        return round2(points * valuePerPoint);
    }, [appSettings.loyalty?.redeemValuePerPoint, loyaltyRedeemPoints]);
    const tenderPayableAmount = useMemo(() => round2(Math.max(0, payableAmount - loyaltyRedeemAmount)), [loyaltyRedeemAmount, payableAmount]);
    const paymentRowsPaidAmount = useMemo(() => (
        paymentRows.reduce((sum, row) => sum + clampNumber(row.amount), 0)
    ), [paymentRows]);
    const paidAmount = useMemo(() => round2(paymentRowsPaidAmount + loyaltyRedeemAmount), [loyaltyRedeemAmount, paymentRowsPaidAmount]);
    const advanceAmount = useMemo(() => (
        activeMode === "advance" ? round2(paymentRowsPaidAmount) : 0
    ), [activeMode, paymentRowsPaidAmount]);
    const creditDue = useMemo(() => {
        if (activeMode === "credit" || activeMode === "advance") {
            return round2(Math.max(0, payableAmount - paidAmount));
        }
        return 0;
    }, [activeMode, paidAmount, payableAmount]);
    const activeShortcutLabels = useMemo(() => {
        const primaryPayLabel = activeMode === "credit"
            ? "Credit Pay"
            : activeMode === "advance"
                ? "Advance Pay"
                : "Cash Pay";
        const secondaryPayLabel = activeMode === "credit"
            ? "Credit Card / UPI"
            : activeMode === "advance"
                ? "Advance Card / UPI"
                : "Card / UPI";

        return POS_SHORTCUTS.map((shortcut) => {
            if (shortcut.key === "F1") {
                return { ...shortcut, label: primaryPayLabel };
            }
            if (shortcut.key === "F3") {
                return { ...shortcut, label: secondaryPayLabel };
            }
            return shortcut;
        });
    }, [activeMode]);
    const selectedCustomerRecord = useMemo(() => (
        customers.find((customer) => String(customer._id || "") === String(customerId || ""))
    ), [customerId, customers]);
    const isLoyaltyMember = useMemo(() => (
        Boolean(selectedCustomerRecord?.loyaltyCardNo || loyaltySummary?.balance > 0 || loyaltySummary?.history?.length > 0)
    ), [loyaltySummary?.balance, loyaltySummary?.history?.length, selectedCustomerRecord?.loyaltyCardNo]);

    const linesSignature = useMemo(() => JSON.stringify(lines), [lines]);
    const paymentRowsSignature = useMemo(() => JSON.stringify(paymentRows), [paymentRows]);
    const exchangeSignature = useMemo(() => JSON.stringify(selectedExchangeItems), [selectedExchangeItems]);

    const stockWarnings = useMemo(() => lines
        .filter((line) => getLineBillableQty(line) > (clampNumber(line.stock) + clampNumber(line.originalQty)))
        .map((line) => ({
            id: line.id,
            itemName: line.itemName,
            requestedQty: getLineBillableQty(line),
            stock: clampNumber(line.stock) + clampNumber(line.originalQty),
        })), [lines]);

    const filteredInventory = useMemo(() => inventory.filter((item) => {
        const itemName = String(item.name || "").toLowerCase();
        const category = String(item.category?.name || "").toLowerCase();
        const brand = String(item.brand?.name || "").toLowerCase();
        const mrp = String(item.mrp || item.sellingRate || "");
        const saleRate = String(item.sellingRate || "");

        if (searchFilters.itemName && !itemName.includes(searchFilters.itemName.toLowerCase())) return false;
        if (searchFilters.category && !category.includes(searchFilters.category.toLowerCase())) return false;
        if (searchFilters.brand && !brand.includes(searchFilters.brand.toLowerCase())) return false;
        if (searchFilters.mrp && !mrp.includes(searchFilters.mrp)) return false;
        if (searchFilters.saleRate && !saleRate.includes(searchFilters.saleRate)) return false;
        return true;
    }), [inventory, searchFilters]);

    const filteredExchangeSales = useMemo(() => salesHistory.filter((sale) => {
        const billValue = String(sale.billNo || sale.invoiceNo || "").toLowerCase();
        const customerValue = String(sale.customer || "").toLowerCase();
        const itemMatch = (sale.items || []).some((item) => {
            const barcodeValue = String(item.barcode || "").toLowerCase();
            const itemName = String(item.itemName || item.itemId?.name || "").toLowerCase();
            const remainingQty = Math.max(0, clampNumber(item.remainingQty ?? (item.qty - (item.returnedQty || 0))));

            if (remainingQty <= 0) return false;
            if (exchangeFilters.barcode && !barcodeValue.includes(exchangeFilters.barcode.toLowerCase())) return false;
            if (exchangeFilters.itemName && !itemName.includes(exchangeFilters.itemName.toLowerCase())) return false;
            return true;
        });

        if (exchangeFilters.billNo && !billValue.includes(exchangeFilters.billNo.toLowerCase())) return false;
        if (exchangeFilters.customer && !customerValue.includes(exchangeFilters.customer.toLowerCase())) return false;
        if ((exchangeFilters.barcode || exchangeFilters.itemName) && !itemMatch) return false;
        return true;
    }), [exchangeFilters, salesHistory]);

    const filteredCustomers = useMemo(() => customers.filter((customer) => {
        const name = String(customer.name || "").toLowerCase();
        const phone = String(customer.phone || "").toLowerCase();
        return !customerSearch || name.includes(customerSearch.toLowerCase()) || phone.includes(customerSearch.toLowerCase());
    }), [customerSearch, customers]);
    const filteredSalespeople = useMemo(() => salespeople.filter((person) => {
        const name = String(person.name || "").toLowerCase();
        const phone = String(person.phone || "").toLowerCase();
        const code = String(person.salesmanCode || "");
        const search = salesmanSearch.toLowerCase();
        return !salesmanSearch || name.includes(search) || phone.includes(search) || code.includes(search);
    }), [salesmanSearch, salespeople]);

    useEffect(() => {
        setActiveSearchIndex(searchModalOpen && filteredInventory.length > 0 ? 0 : -1);
    }, [filteredInventory.length, searchModalOpen]);

    useEffect(() => {
        setActiveCustomerIndex(customerModalOpen && !customerFormOpen && filteredCustomers.length > 0 ? 0 : -1);
    }, [customerFormOpen, customerModalOpen, filteredCustomers.length]);

    useEffect(() => {
        setActiveSalesmanIndex(salesmanModalOpen && !salesmanFormOpen && filteredSalespeople.length > 0 ? 0 : -1);
    }, [filteredSalespeople.length, salesmanFormOpen, salesmanModalOpen]);

    useEffect(() => {
        setActiveHeldBillIndex(holdModalOpen && heldBills.length > 0 ? 0 : -1);
    }, [heldBills.length, holdModalOpen]);

    useEffect(() => {
        if (!searchModalOpen || activeSearchIndex < 0) {
            return;
        }
        searchRowRefs.current.get(activeSearchIndex)?.scrollIntoView?.({ block: "nearest" });
    }, [activeSearchIndex, searchModalOpen]);

    useEffect(() => {
        if (!customerModalOpen || customerFormOpen || activeCustomerIndex < 0) {
            return;
        }
        customerRowRefs.current.get(activeCustomerIndex)?.scrollIntoView?.({ block: "nearest" });
    }, [activeCustomerIndex, customerFormOpen, customerModalOpen]);

    useEffect(() => {
        if (!salesmanModalOpen || salesmanFormOpen || activeSalesmanIndex < 0) {
            return;
        }
        salesmanRowRefs.current.get(activeSalesmanIndex)?.scrollIntoView?.({ block: "nearest" });
    }, [activeSalesmanIndex, salesmanFormOpen, salesmanModalOpen]);

    useEffect(() => {
        if (!holdModalOpen || activeHeldBillIndex < 0) {
            return;
        }
        heldBillRefs.current.get(activeHeldBillIndex)?.scrollIntoView?.({ block: "nearest" });
    }, [activeHeldBillIndex, holdModalOpen]);
    const selectedSalesmanSummary = useMemo(() => {
        const code = String(salesmanCodeInput || "").trim();
        const name = String(salesman || "").trim();
        if (code && name) {
            return `${code} - ${name}`;
        }
        return name || code;
    }, [salesman, salesmanCodeInput]);

    const buildDraftPayload = useCallback(() => ({
        billNo,
        billType: activeMode,
        billingMode,
        counterName: appSettings.billingCounter || "Main Counter",
        customerId,
        customer: customerName,
        customerPhone,
        location: customerLocation,
        customerType: selectedCustomerRecord?.customerType,
        creditLimit: selectedCustomerRecord?.creditLimit,
        segmentTags: selectedCustomerRecord?.segmentTags || [],
        loyaltyCardNo: selectedCustomerRecord?.loyaltyCardNo,
        dateOfBirth: customerDob,
        anniversary: customerAnniversary,
        salespersonId,
        salesmanCode: salesmanCodeInput,
        salesman,
        note,
        deliveryInfo,
        referenceNo,
        discountPercent: clampNumber(discountPercent),
        discountAmount,
        subtotal,
        exchangeAmount,
        payableAmount,
        advanceAmount,
        creditDue,
        advanceDetails: {
            advanceAmount,
            remainingAmount: creditDue,
            deliveryStatus: "DELIVERED",
            expectedDeliveryDate: advanceExpectedDeliveryDate,
        },
        creditDetails: {
            creditAmount: creditDue,
            dueDate: creditDueDate,
        },
        paymentBreakdown: paymentRows.map((row) => ({
            mode: row.mode,
            amount: clampNumber(row.amount),
            reference: row.reference,
        })),
        exchangeItems: selectedExchangeItems.map((item) => ({
            saleId: item.saleId,
            saleItemId: item.saleItemId,
            billNo: item.billNo,
            itemName: item.itemName,
            barcode: item.barcode,
            qty: item.qty || 1,
            amount: item.amount,
        })),
        items: lines.map((line) => ({
            inventoryId: line.inventoryId,
            itemId: line.itemId,
            barcode: line.barcode,
            itemName: line.itemName,
            category: line.category,
            categoryName: line.categoryName,
            brand: line.brand,
            brandName: line.brandName,
            salesmanNumber: line.salesmanNumber,
            qty: getLineBillableQty(line),
            displayQty: clampNumber(line.qty),
            mtrQty: isMeterUnit(line.unit) ? clampNumber(line.mtrQty) : undefined,
            stock: clampNumber(line.stock),
            mrp: round2(line.mrp),
            saleRate: round2(line.saleRate),
            originalSaleRate: round2(line.originalSaleRate || line.saleRate),
            lineDiscountPercent: round2(line.lineDiscountPercent),
            lineTotal: round2(line.lineTotal),
            unit: line.unit,
        })),
    }), [
        activeMode,
        advanceExpectedDeliveryDate,
        appSettings.billingCounter,
        advanceAmount,
        billNo,
        billingMode,
        creditDue,
        creditDueDate,
        customerId,
        customerLocation,
        customerName,
        customerPhone,
        customerDob,
        customerAnniversary,
        deliveryInfo,
        discountAmount,
        discountPercent,
        exchangeAmount,
        lines,
        note,
        payableAmount,
        paymentRows,
        referenceNo,
        salesmanCodeInput,
        salespersonId,
        salesman,
        selectedCustomerRecord,
        selectedExchangeItems,
        subtotal,
    ]);

    const resetBill = useCallback((nextBillNo = "") => {
        setActiveMode("cashpay");
        setBillingMode("CASH");
        setBillNo(nextBillNo);
        setCustomerId("");
        setCustomerName("");
        setCustomerPhone("");
        setCustomerLocation("");
        setCustomerDob("");
        setCustomerAnniversary("");
        setLoyaltySummary({ earned: 0, redeemed: 0, balance: 0, history: [] });
        setLoyaltyRedeemPoints("");
        setDeliveryInfo("");
        setReferenceNo("");
        setNote("");
        setSalesman("");
        setSalespersonId("");
        setSalesmanCodeInput("");
        setSalesmanLookupInput("");
        setDiscountPercent(0);
        setDiscountPercentInput("");
        setManualAdvanceAmount(0);
        setAdvanceExpectedDeliveryDate("");
        setCreditDueDate("");
        setLines([]);
        setPaymentRows([createPaymentRow("Cash", 0)]);
        setSelectedExchangeItems([]);
        setBarcodeInput("");
    }, []);

    const fetchNextBillNo = useCallback(async (mode = billingMode) => {
        const nextBillRes = await apiFetch(`${API_BASE}/sales/next-bill-no?mode=${encodeURIComponent(mode)}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const nextBillData = await nextBillRes.json();
        if (!nextBillRes.ok || !nextBillData.success) {
            throw new Error(nextBillData.message || "Failed to fetch next bill number");
        }
        return nextBillData?.data?.billNo || "";
    }, [billingMode, token]);

    const refreshCustomers = useCallback(async (query = "") => {
        const params = query ? `?q=${encodeURIComponent(query)}` : "";
        const response = await apiFetch(`${API_BASE}/sales/customers${params}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || "Failed to fetch customers");
        }
        setCustomers(data.data || []);
        return data.data || [];
    }, [token]);

    const resetCurrentBill = useCallback(async () => {
        try {
            await apiFetch(`${API_BASE}/sales/draft`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            const nextBillNo = await fetchNextBillNo("CASH");
            resetBill(nextBillNo);
            clearRecoverySnapshot();
            setStatusMessage("Bill reset.");
            toast.success("Bill deleted.");
            scheduleBarcodeFocus();
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to reset bill");
        }
    }, [fetchNextBillNo, resetBill, scheduleBarcodeFocus, token]);

    const hydrateFromDraft = useCallback((draft, fallbackBillNo) => {
        if (!draft) {
            resetBill(fallbackBillNo);
            return;
        }

        setActiveMode(draft.billType || "cashpay");
        setBillingMode(draft.billingMode || getBillingModeFromPosMode(draft.billType || "cashpay"));
        setBillNo(draft.billNo || fallbackBillNo);
        setCustomerId(draft.customerId || "");
        setCustomerName(draft.customer || "");
        setCustomerPhone(draft.customerPhone || "");
        setCustomerLocation(draft.location || "");
        setCustomerDob(draft.dateOfBirth ? String(draft.dateOfBirth).slice(0, 10) : "");
        setCustomerAnniversary(draft.anniversary ? String(draft.anniversary).slice(0, 10) : "");
        setDeliveryInfo(draft.deliveryInfo || "");
        setReferenceNo(draft.referenceNo || "");
        setNote(draft.note || "");
        setSalesman(draft.salesman || "");
        setSalespersonId(draft.salespersonId || "");
        setSalesmanCodeInput(draft.salesmanCode || "");
        setSalesmanLookupInput([draft.salesmanCode || "", draft.salesman || ""].filter(Boolean).join(" - "));
        setDiscountPercent(clampNumber(draft.discountPercent));
        setDiscountPercentInput("");
        setManualAdvanceAmount(clampNumber(draft.advanceAmount));
        setAdvanceExpectedDeliveryDate(draft.advanceDetails?.expectedDeliveryDate ? String(draft.advanceDetails.expectedDeliveryDate).slice(0, 10) : "");
        setCreditDueDate(draft.creditDetails?.dueDate ? String(draft.creditDetails.dueDate).slice(0, 10) : "");
        setLines((draft.items || []).map(mapDraftLine));
        setPaymentRows((draft.paymentBreakdown || []).length > 0
            ? draft.paymentBreakdown.map((row, index) => ({ id: `${Date.now()}-${index}`, ...row }))
            : [createPaymentRow("Cash", 0)]);
        setSelectedExchangeItems((draft.exchangeItems || []).map((item, index) => ({
            ...item,
            key: `${item.saleId || "sale"}-${item.saleItemId || index}`,
        })));
        saveRecoverySnapshot(draft);
    }, [resetBill]);

    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        try {
            const [inventoryRes, salesRes, workbenchRes] = await Promise.all([
                apiFetch(`${API_BASE}/inventory`, { headers: { Authorization: `Bearer ${token}` } }),
                apiFetch(`${API_BASE}/sales`, { headers: { Authorization: `Bearer ${token}` } }),
                apiFetch(`${API_BASE}/sales/workbench`, { headers: { Authorization: `Bearer ${token}` } }),
            ]);

            const inventoryData = await inventoryRes.json();
            const salesData = await salesRes.json();
            const workbenchData = await workbenchRes.json();

            if (!inventoryRes.ok) throw new Error(inventoryData.message || "Failed to load inventory");
            if (!salesRes.ok) throw new Error(salesData.message || "Failed to load sales");
            if (!workbenchRes.ok) throw new Error(workbenchData.message || "Failed to load POS workbench");

            const workbench = workbenchData.data || {};
            setInventory(inventoryData.data || []);
            setSalesHistory(salesData.data || []);
            setCustomers(workbench.customers || []);
            setSalespeople(workbench.salespeople || []);
            setHeldBills(workbench.holds || []);
            setActiveSession(workbench.activeSession || null);
            setPermissionRules(workbench.permissionRules || DEFAULT_RULES);
            setWhatsappStatus(workbench.whatsapp || { enabled: false, message: "" });
            const recoveryDraft = loadRecoverySnapshot();
            const selectedDraft = hasRecoverableBillState(workbench.draft) ? workbench.draft : (hasRecoverableBillState(recoveryDraft) ? recoveryDraft : null);
            hydrateFromDraft(selectedDraft, workbench.nextBillNo || "");
            setStatusMessage("");
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to load POS");
        } finally {
            draftReadyRef.current = true;
            setLoading(false);
            scheduleBarcodeFocus();
        }
    }, [hydrateFromDraft, scheduleBarcodeFocus, token]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    useEffect(() => {
        if (loading) {
            return;
        }

        fetchNextBillNo(billingMode)
            .then((nextBillNo) => setBillNo(nextBillNo))
            .catch((error) => toast.error(error.message || "Failed to fetch mode bill number"));
    }, [billingMode, fetchNextBillNo, loading]);

    useEffect(() => {
        const editSale = location.state?.editSale;
        if (!editSale) {
            return;
        }

        hydrateFromDraft({
            ...editSale,
            items: editSale.items || [],
            paymentBreakdown: editSale.paymentBreakdown || [],
            exchangeItems: editSale.exchangeItems || [],
        }, editSale.billNo || editSale.invoiceNo || billNo);
        setStatusMessage(`Editing invoice ${editSale.invoiceNo || editSale.billNo || ""}.`);
        navigate(location.pathname, { replace: true, state: null });
    }, [billNo, hydrateFromDraft, location.pathname, location.state, navigate]);

    const refreshSalesmen = useCallback(async (selectedId = "") => {
        const response = await apiFetch(`${API_BASE}/parties?type=salesman`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || "Failed to load salesmen");
        }

        const nextSalesmen = data.data || [];
        setSalespeople(nextSalesmen);
        if (selectedId) {
            const selected = nextSalesmen.find((person) => person._id === selectedId);
            if (selected) {
                setSalespersonId(selected._id);
                setSalesman(selected.name || "");
                setSalesmanCodeInput(String(selected.salesmanCode || ""));
                setSalesmanLookupInput([selected.salesmanCode || "", selected.name || ""].filter(Boolean).join(" - "));
            }
        }
        return nextSalesmen;
    }, [token]);

    const applySalesmanCode = useCallback((value) => {
        const normalizedCode = String(value || "").replace(/\D/g, "");
        setSalesmanCodeInput(normalizedCode);
        setSalesmanLookupInput(normalizedCode);

        if (!normalizedCode) {
            setSalespersonId("");
            setSalesman("");
            return;
        }

        const selected = salespeople.find((person) => String(person.salesmanCode || "") === normalizedCode);
        if (selected) {
            setSalespersonId(selected._id || "");
            setSalesman(selected.name || "");
            setSalesmanLookupInput([selected.salesmanCode || "", selected.name || ""].filter(Boolean).join(" - "));
        } else {
            setSalespersonId("");
            setSalesman("");
        }
    }, [salespeople]);

    const applySalesmanLookup = useCallback((value) => {
        const nextValue = String(value || "");
        setSalesmanLookupInput(nextValue);

        const trimmed = nextValue.trim();
        if (!trimmed) {
            setSalespersonId("");
            setSalesman("");
            setSalesmanCodeInput("");
            return;
        }

        const numericPart = trimmed.replace(/\D/g, "");
        const lowered = trimmed.toLowerCase();
        const selected = salespeople.find((person) => {
            const code = String(person.salesmanCode || "");
            const name = String(person.name || "");
            return code === numericPart || name.toLowerCase() === lowered || `${code} - ${name}`.toLowerCase() === lowered;
        });

        if (selected) {
            setSalespersonId(selected._id || "");
            setSalesman(selected.name || "");
            setSalesmanCodeInput(String(selected.salesmanCode || ""));
            setSalesmanLookupInput([selected.salesmanCode || "", selected.name || ""].filter(Boolean).join(" - "));
            return;
        }

        if (/^\d+$/.test(trimmed)) {
            applySalesmanCode(trimmed);
        }
    }, [applySalesmanCode, salespeople]);

    const fetchNextSalesmanCode = useCallback(async () => {
        const response = await apiFetch(`${API_BASE}/parties/next-code?type=salesman`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || "Failed to load next salesman ID");
        }
        return String(data.data?.nextCode || "1");
    }, [token]);

    useEffect(() => {
        if (!salesmanModalOpen || salesmanFormOpen) {
            return;
        }

        refreshSalesmen().catch((error) => {
            console.error(error);
        });
    }, [refreshSalesmen, salesmanFormOpen, salesmanModalOpen]);

    useEffect(() => {
        if (!salespersonId || salesmanCodeInput) {
            return;
        }

        const selected = salespeople.find((person) => person._id === salespersonId);
        if (selected) {
            setSalesmanCodeInput(String(selected.salesmanCode || ""));
            setSalesman(selected.name || "");
            setSalesmanLookupInput([selected.salesmanCode || "", selected.name || ""].filter(Boolean).join(" - "));
        }
    }, [salesmanCodeInput, salespeople, salespersonId]);

    useEffect(() => {
        if (!customerModalOpen || customerFormOpen) {
            return;
        }

        refreshCustomers(customerSearch).catch((error) => {
            console.error(error);
        });
    }, [customerFormOpen, customerModalOpen, customerSearch, refreshCustomers]);

    useEffect(() => {
        if (!draftReadyRef.current || loading) {
            return undefined;
        }

        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = setTimeout(async () => {
            try {
                const snapshot = buildDraftPayload();
                saveRecoverySnapshot(snapshot);
                await apiFetch(`${API_BASE}/sales/draft`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(snapshot),
                });
            } catch (error) {
                console.error("Draft autosave failed", error);
            }
        }, 850);

        return () => clearTimeout(autosaveTimerRef.current);
    }, [
        buildDraftPayload,
        linesSignature,
        loading,
        paymentRowsSignature,
        exchangeSignature,
        token,
    ]);

    useEffect(() => {
        if (activeMode === "cashpay") {
            setPaymentRows([createPaymentRow("Cash", tenderPayableAmount)]);
            setManualAdvanceAmount(0);
        }
        if (activeMode === "card-upi" && paymentRows.length === 0) {
            setPaymentRows([createPaymentRow("Card", 0), createPaymentRow("UPI", 0)]);
        }
    }, [activeMode, paymentRows.length, tenderPayableAmount]);

    useEffect(() => {
        if (activeMode !== "advance") {
            return;
        }

        const nextAdvance = Math.min(tenderPayableAmount, Math.max(0, clampNumber(manualAdvanceAmount)));
        setPaymentRows(nextAdvance > 0 ? [createPaymentRow("Cash", nextAdvance)] : []);
    }, [activeMode, manualAdvanceAmount, tenderPayableAmount]);

    useEffect(() => {
        const lookupKey = customerPhone || customerId;
        if (!lookupKey) {
            setLoyaltySummary({ earned: 0, redeemed: 0, balance: 0, history: [] });
            setLoyaltyRedeemPoints("");
            return undefined;
        }

        let cancelled = false;
        const fetchLoyaltySummary = async () => {
            try {
                const phonePath = encodeURIComponent(customerPhone || "by-id");
                const query = customerId ? `?customerId=${encodeURIComponent(customerId)}` : "";
                const response = await apiFetch(`${API_BASE}/sales/loyalty/${phonePath}${query}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await response.json();
                if (!cancelled && response.ok && data.success) {
                    setLoyaltySummary(data.data || { earned: 0, redeemed: 0, balance: 0, history: [] });
                }
            } catch {
                if (!cancelled) {
                    setLoyaltySummary({ earned: 0, redeemed: 0, balance: 0, history: [] });
                }
            }
        };

        fetchLoyaltySummary();
        return () => {
            cancelled = true;
        };
    }, [customerId, customerPhone, token]);

    useEffect(() => {
        if (!isLoyaltyMember && loyaltyRedeemPoints) {
            setLoyaltyRedeemPoints("");
        }
    }, [isLoyaltyMember, loyaltyRedeemPoints]);

    const focusLineMeasureInput = useCallback((lineId) => {
        const tryFocus = () => {
            const line = lines.find((entry) => entry.id === lineId);
            const meterItem = isMeterUnit(line?.unit);
            const mappedInput = meterItem
                ? meterInputRefs.current.get(lineId)
                : qtyInputRefs.current.get(lineId);
            const queriedInput = typeof document !== "undefined"
                ? document.querySelector(
                    meterItem
                        ? `[data-mtr-line-id="${lineId}"]`
                        : `[data-qty-line-id="${lineId}"]`
                )
                : null;
            const input = mappedInput || queriedInput;
            if (input) {
                input.focus();
                input.select?.();
                return true;
            }
            return false;
        };

        if (tryFocus()) {
            return;
        }

        requestAnimationFrame(() => {
            if (tryFocus()) {
                return;
            }
            setTimeout(() => {
                tryFocus();
            }, 40);
        });
    }, [lines]);

    useLayoutEffect(() => {
        if (!pendingQtyFocusLineId) {
            return;
        }

        const lineExists = lines.some((line) => line.id === pendingQtyFocusLineId);
        if (!lineExists) {
            setPendingQtyFocusLineId("");
            return;
        }

        let attempts = 0;
        const tryFocus = () => {
            const line = lines.find((entry) => entry.id === pendingQtyFocusLineId);
            const input = isMeterUnit(line?.unit)
                ? meterInputRefs.current.get(pendingQtyFocusLineId)
                : qtyInputRefs.current.get(pendingQtyFocusLineId);
            if (input) {
                input.focus();
                input.select?.();
                barcodeFocusLockRef.current = false;
                setPendingQtyFocusLineId("");
                return;
            }

            attempts += 1;
            if (attempts < 6) {
                requestAnimationFrame(tryFocus);
            } else {
                barcodeFocusLockRef.current = false;
                setPendingQtyFocusLineId("");
            }
        };

        requestAnimationFrame(tryFocus);
    }, [lines, pendingQtyFocusLineId]);

    const findProductByBarcode = useCallback(async (rawCode) => {
        const candidates = getBarcodeCandidates(rawCode);
        if (candidates.length === 0) {
            return null;
        }

        const product = inventory.find((item) => {
            const itemCandidates = getBarcodeCandidates(item.barcode || "");
            return candidates.some((candidate) => itemCandidates.includes(candidate));
        });

        if (product) {
            return product;
        }

        const lookupCode = encodeURIComponent(candidates[0]);
        const response = await apiFetch(`${API_BASE}/inventory/lookup/${lookupCode}`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            return null;
        }

        const lookedUpProduct = data.data || null;
        if (!lookedUpProduct) {
            return null;
        }

        setInventory((current) => {
            const exists = current.some((item) => String(item._id || "") === String(lookedUpProduct._id || ""));
            if (exists) {
                return current.map((item) => (
                    String(item._id || "") === String(lookedUpProduct._id || "")
                        ? { ...item, ...lookedUpProduct }
                        : item
                ));
            }
            return [lookedUpProduct, ...current];
        });

        return lookedUpProduct;
    }, [inventory, token]);

    async function submitScannedCode(rawCode, options = {}) {
        const code = normalizeBarcodeValue(rawCode);
        if (!code) return false;

        if (options.fromScanner && scannerLookupInFlightRef.current) {
            return false;
        }

        scannerLookupInFlightRef.current = true;
        try {
            const product = await findProductByBarcode(code);
            if (!product) {
                const now = Date.now();
                const shouldUpdateMessage =
                    scannerMissRef.current.code !== code || now - scannerMissRef.current.timestamp > 1500;
                scannerMissRef.current = { code, timestamp: now };

                if (shouldUpdateMessage) {
                    if (options.fromScanner) {
                        setScannerStatus(`Barcode ${code} was not found in inventory.`);
                    } else {
                        setStatusMessage(`Barcode ${code} was not found in inventory.`);
                    }
                }
                scheduleBarcodeFocus();
                return false;
            }

            scannerMissRef.current = { code: "", timestamp: 0 };
            setScannerStatus("");
            setStatusMessage("");
            const addResult = addProductToBill(product);
            return { product, ...(addResult || {}) };
        } finally {
            scannerLookupInFlightRef.current = false;
        }
    }

    const stopScanner = useCallback(async () => {
        if (scannerFrameRef.current) {
            cancelAnimationFrame(scannerFrameRef.current);
            scannerFrameRef.current = null;
        }
        if (html5QrCodeRef.current) {
            const html5Instance = html5QrCodeRef.current;
            html5QrCodeRef.current = null;
            await html5Instance.stop?.().catch(() => { });
            await html5Instance.clear?.().catch(() => { });
        }
        if (scannerStreamRef.current) {
            scannerStreamRef.current.getTracks().forEach((track) => track.stop());
            scannerStreamRef.current = null;
        }
        if (scannerVideoRef.current) {
            scannerVideoRef.current.srcObject = null;
        }
        const scannerMount = document.getElementById("sales-pos-html5-scanner");
        if (scannerMount) {
            scannerMount.innerHTML = "";
        }
        scannerLookupInFlightRef.current = false;
        scannerClosingRef.current = false;
    }, []);

    const closeScannerModal = useCallback(async () => {
        setScannerModalOpen(false);
        setScannerStatus("");
        setScannerMode("native");
        setScannerCanUpload(false);
        scannerMissRef.current = { code: "", timestamp: 0 };
        scannerClosingRef.current = true;
        scheduleBarcodeFocus();
        await stopScanner();
    }, [scheduleBarcodeFocus, stopScanner]);

    const loadHtml5QrcodeScript = useCallback(async () => {
        if (window.Html5Qrcode) {
            return window.Html5Qrcode;
        }

        await new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-html5-qrcode="true"]');
            if (existing) {
                existing.addEventListener("load", resolve, { once: true });
                existing.addEventListener("error", reject, { once: true });
                return;
            }

            const script = document.createElement("script");
            script.src = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
            script.async = true;
            script.dataset.html5Qrcode = "true";
            script.onload = resolve;
            script.onerror = () => reject(new Error("Failed to load scanner library"));
            document.body.appendChild(script);
        });

        if (!window.Html5Qrcode) {
            throw new Error("Scanner library did not initialize");
        }

        return window.Html5Qrcode;
    }, []);

    const ensureScannerMount = useCallback(async () => {
        for (let attempt = 0; attempt < 8; attempt += 1) {
            const mountNode = document.getElementById("sales-pos-html5-scanner");
            if (mountNode) {
                return mountNode;
            }
            await nextFrame();
        }

        throw new Error("Scanner mount element not ready");
    }, []);

    const createScanFileReader = useCallback(async () => {
        const Html5Qrcode = await loadHtml5QrcodeScript();
        const tempId = `sales-pos-html5-file-${Date.now()}`;
        const tempNode = document.createElement("div");
        tempNode.id = tempId;
        tempNode.style.display = "none";
        document.body.appendChild(tempNode);

        const reader = new Html5Qrcode(tempId);
        return {
            reader,
            dispose: async () => {
                await reader.clear?.().catch(() => { });
                if (document.body.contains(tempNode)) {
                    document.body.removeChild(tempNode);
                }
            },
        };
    }, [loadHtml5QrcodeScript]);

    const startHtml5Scanner = useCallback(async () => {
        setScannerCanUpload(true);
        setScannerMode("html5");
        setScannerStatus("Starting iPhone-compatible scanner...");

        await nextFrame();
        await ensureScannerMount();

        const Html5Qrcode = await loadHtml5QrcodeScript();
        const html5QrCode = new Html5Qrcode("sales-pos-html5-scanner");
        html5QrCodeRef.current = html5QrCode;

        const cameraConfigCandidates = [
            { facingMode: "environment" },
            { facingMode: { ideal: "environment" } },
            undefined,
        ];

        let lastError = null;

        for (const cameraConfig of cameraConfigCandidates) {
            try {
                await html5QrCode.start(
                    cameraConfig,
                    {
                        fps: 10,
                        qrbox: { width: 220, height: 220 },
                        aspectRatio: 1.333334,
                    },
                    async (decodedText) => {
                        setBarcodeInput(String(decodedText));
                        const found = await submitScannedCode(decodedText, { fromScanner: true });
                        if (found) {
                            await closeScannerModal();
                        }
                    },
                    () => { },
                );

                setScannerStatus("Point the camera at a QR code or barcode.");
                return;
            } catch (error) {
                lastError = error;
                await html5QrCode.stop?.().catch(() => { });
                await html5QrCode.clear?.().catch(() => { });
            }
        }

        html5QrCodeRef.current = null;
        throw lastError || new Error("Unable to start camera scanner.");
    }, [closeScannerModal, ensureScannerMount, loadHtml5QrcodeScript]);

    const startScanner = useCallback(async () => {
        if (!scannerModalOpen || scannerClosingRef.current) {
            return;
        }

        await stopScanner();
        scannerMissRef.current = { code: "", timestamp: 0 };
        setScannerStatus("Preparing camera...");

        if (window.isSecureContext === false) {
            setScannerCanUpload(true);
            setScannerMode("html5");
            setScannerStatus("Live camera scanning requires HTTPS on iPhone. Open the secure HTTPS address for this app.");
            return;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            setScannerCanUpload(true);
            setScannerMode("html5");
            setScannerStatus(
                window.isSecureContext === false
                    ? "Live camera is blocked on iPhone over this HTTP/LAN address. Use Camera/Photo fallback below or open the app on HTTPS."
                    : "Live camera scanning is not available here. Use the Camera/Photo fallback below."
            );
            return;
        }

        try {
            if (isAppleMobileBrowser() || !("BarcodeDetector" in window)) {
                await startHtml5Scanner();
                return;
            }

            setScannerCanUpload(false);
            setScannerMode("native");
            const BarcodeDetectorCtor = window.BarcodeDetector;
            const formats = await BarcodeDetectorCtor.getSupportedFormats?.();
            const detector = new BarcodeDetectorCtor({
                formats: (formats || ["qr_code", "code_128", "ean_13", "ean_8"]).filter(Boolean),
            });
            let stream;

            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: "environment",
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                });
            } catch (primaryError) {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false,
                });
            }

            scannerStreamRef.current = stream;
            if (scannerVideoRef.current) {
                scannerVideoRef.current.srcObject = stream;
                scannerVideoRef.current.setAttribute("playsinline", "true");
                scannerVideoRef.current.setAttribute("muted", "true");
                await scannerVideoRef.current.play();
            }
            setScannerStatus("Point the camera at a QR code or barcode.");

            const scanFrame = async () => {
                const video = scannerVideoRef.current;
                if (!video || video.readyState < 2) {
                    scannerFrameRef.current = requestAnimationFrame(scanFrame);
                    return;
                }

                try {
                    const results = await detector.detect(video);
                    const match = results.find((entry) => entry.rawValue);
                    if (match?.rawValue) {
                        setBarcodeInput(String(match.rawValue));
                        const found = await submitScannedCode(match.rawValue, { fromScanner: true });
                        if (found) {
                            await closeScannerModal();
                            return;
                        }
                    }
                } catch (error) {
                    console.error("Scanner detect failed", error);
                }

                scannerFrameRef.current = requestAnimationFrame(scanFrame);
            };

            scannerFrameRef.current = requestAnimationFrame(scanFrame);
        } catch (error) {
            console.error(error);
            setScannerCanUpload(true);
            setScannerMode("html5");
            setScannerStatus(normalizeScannerError(error));
        }
    }, [closeScannerModal, scannerModalOpen, startHtml5Scanner, stopScanner]);

    useEffect(() => {
        if (!scannerModalOpen) {
            void stopScanner();
            return undefined;
        }

        void startScanner();
        return () => {
            void stopScanner();
        };
    }, [scannerModalOpen, startScanner, stopScanner]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!scannerModalOpen || scannerClosingRef.current) {
                return;
            }

            if (document.visibilityState === "hidden") {
                void stopScanner();
                return;
            }

            void startScanner();
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("pagehide", stopScanner);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("pagehide", stopScanner);
        };
    }, [scannerModalOpen, startScanner, stopScanner]);

    const handleScannerFilePick = useCallback(async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        let scanFileSession = null;
        try {
            setScannerStatus("Reading selected image...");
            scanFileSession = await createScanFileReader();
            const decodedText = await scanFileSession.reader.scanFile(file, true);

            setBarcodeInput(String(decodedText));
            const found = await submitScannedCode(decodedText, { fromScanner: true });
            if (found) {
                await closeScannerModal();
                return;
            }

            setScannerStatus("Code was read, but no matching product barcode was found.");
        } catch (error) {
            console.error(error);
            setScannerStatus("Could not read a QR/barcode from that image. Try again with a clearer photo.");
        } finally {
            await scanFileSession?.dispose?.().catch(() => { });
            if (event.target) {
                event.target.value = "";
            }
        }
    }, [closeScannerModal, createScanFileReader]);

    const addProductToBill = (product) => {
        if (clampNumber(product.stock) <= 0) {
            toast.error("This item is out of stock.");
            return null;
        }

        const meterItem = isMeterUnit(product.unit);
        const existing = lines.find((line) => line.inventoryId === product._id);
        let nextLines = lines;
        let focusLineId = "";

        if (existing) {
            const defaultQty = getBarcodeDefaultQty(product);
            const currentQty = clampNumber(existing.qty, 1);
            const currentBillableQty = getLineBillableQty(existing);
            const nextQty = meterItem ? currentQty + 1 : currentQty + defaultQty;
            const nextBillableQty = meterItem ? currentBillableQty + defaultQty : nextQty;
            if (nextBillableQty > clampNumber(existing.stock)) {
                toast.error("Not enough stock for this item.");
                return null;
            }

            nextLines = lines.map((line) => line.inventoryId === product._id
                ? recalculateLine({
                    ...line,
                    qty: nextQty,
                    mtrQty: meterItem ? nextBillableQty : line.mtrQty,
                })
                : line);

            if (meterItem) {
                focusLineId = existing.id;
            }
        } else {
            const nextLine = createLineItem(product, salesmanCodeInput);
            nextLines = [...lines, nextLine];
            if (meterItem) {
                focusLineId = nextLine.id;
            }
        }

        setLines(nextLines);
        setBarcodeInput("");
        setSearchModalOpen(false);
        if (meterItem && focusLineId) {
            reserveQtyFocus(focusLineId);
            requestAnimationFrame(() => {
                focusLineMeasureInput(focusLineId);
            });
        } else {
            barcodeFocusLockRef.current = false;
            scheduleBarcodeFocus();
        }

        return { meterItem, focusLineId };
    };

    const handleBarcodeSubmit = async (event) => {
        event?.preventDefault?.();
        const result = await submitScannedCode(barcodeInput);
        if (result?.meterItem && result?.focusLineId) {
            reserveQtyFocus(result.focusLineId);
            setTimeout(() => {
                focusLineMeasureInput(result.focusLineId);
            }, 0);
        }
    };

    const handleBarcodeInputEnter = async (event) => {
        if (event.key !== "Enter") {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const result = await submitScannedCode(event.currentTarget.value);
        if (result?.meterItem && result?.focusLineId) {
            reserveQtyFocus(result.focusLineId);
            setTimeout(() => {
                focusLineMeasureInput(result.focusLineId);
            }, 0);
        }
    };

    const updateLine = (id, field, value) => {
        const targetField = field === "mtr" ? "mtrQty" : field;
        if (["qty", "mtrQty", "saleRate", "mrp"].includes(targetField) && !DECIMAL_INPUT_PATTERN.test(String(value ?? ""))) {
            return;
        }
        setLines((current) => current.map((line) => {
            if (line.id !== id) return line;
            const guardMessage = getLineUpdateGuard({
                field: targetField === "mtrQty" ? "qty" : targetField,
                value,
                permissionRules,
                line,
                role,
            });
            if (guardMessage) {
                toast.error(guardMessage);
                return line;
            }
            const next = { ...line, [targetField]: value };
            return recalculateLine(next);
        }));
    };

    const removeLine = (id) => {
        setLines((current) => current.filter((line) => line.id !== id));
    };

    const updatePaymentRow = (id, field, value) => {
        setPaymentRows((current) => current.map((row) => row.id === id
            ? { ...row, [field]: field === "amount" ? clampNumber(value) : value }
            : row));
    };

    const addPaymentRow = () => {
        setPaymentRows((current) => [...current, createPaymentRow("UPI", 0)]);
    };

    const removePaymentRow = (id) => {
        setPaymentRows((current) => current.length === 1 ? current : current.filter((row) => row.id !== id));
    };

    const selectCustomer = (customer) => {
        setCustomerId(customer._id);
        setCustomerName(customer.name || "");
        setCustomerPhone(customer.phone || "");
        setCustomerLocation(customer.location || customer.area || "");
        setCustomerDob(customer.dateOfBirth ? String(customer.dateOfBirth).slice(0, 10) : "");
        setCustomerAnniversary(customer.anniversary ? String(customer.anniversary).slice(0, 10) : "");
        setLoyaltyRedeemPoints("");
        setDeliveryInfo(customer.addressLine1 || deliveryInfo);
        setCustomerModalOpen(false);
        setCustomerFormOpen(false);
    };

    const openAddCustomerForm = () => {
        setCustomerForm({
            ...EMPTY_CUSTOMER_FORM,
            name: customerSearch.trim() && !customerSearch.includes(" ") ? "" : customerSearch.trim(),
            phone: /^\d+$/.test(customerSearch.trim()) ? customerSearch.trim() : "",
        });
        setCustomerFormOpen(true);
    };

    const openEditCustomerForm = (customer) => {
        setCustomerForm({
            ...EMPTY_CUSTOMER_FORM,
            recordId: customer._id || "",
            name: customer.name || "",
            phone: customer.phone || "",
            customerCode: customer.customerCode || "",
            customerType: customer.customerType || "retail",
            creditLimit: customer.creditLimit ?? "",
            segmentTags: (customer.segmentTags || []).join(", "),
            loyaltyCardNo: customer.loyaltyCardNo || "",
            applyLoyalty: false,
            area: customer.location || "",
            dateOfBirth: customer.dateOfBirth ? String(customer.dateOfBirth).slice(0, 10) : "",
            anniversary: customer.anniversary ? String(customer.anniversary).slice(0, 10) : "",
            deliveryInfo: customer.addressLine1 || "",
            note: customer.notes || "",
            gstin: customer.gstNo || "",
            tradeName: customer.tradeName || customer.name || "",
            legalName: customer.legalName || customer.name || "",
            address: customer.addressLine1 || "",
            city: customer.city || "",
            pincode: customer.pincode || "",
        });
        setCustomerFormOpen(true);
    };

    const createCustomer = async (forceCreate = false) => {
        try {
            const isEditing = Boolean(customerForm.recordId) && !forceCreate;
            const response = await apiFetch(`${API_BASE}/sales/customers${isEditing ? `/${customerForm.recordId}` : ""}`, {
                method: isEditing ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: customerForm.name,
                    customer: customerForm.name,
                    phone: customerForm.phone,
                    customerPhone: customerForm.phone,
                    location: customerForm.area || customerForm.city,
                    customerType: customerForm.customerType,
                    creditLimit: Number(customerForm.creditLimit || 0),
                    segmentTags: String(customerForm.segmentTags || "").split(",").map((tag) => tag.trim()).filter(Boolean),
                    applyLoyalty: Boolean(customerForm.applyLoyalty),
                    dateOfBirth: customerForm.dateOfBirth,
                    anniversary: customerForm.anniversary,
                    deliveryInfo: customerForm.deliveryInfo || customerForm.address,
                    note: customerForm.note,
                    city: customerForm.city,
                    pincode: customerForm.pincode,
                    gstin: customerForm.gstin,
                    addressLine1: customerForm.address,
                }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Failed to save customer");

            setCustomers((current) => [data.data, ...current.filter((item) => item._id !== data.data._id)]);
            selectCustomer(data.data);
            setCustomerForm(EMPTY_CUSTOMER_FORM);
            setStatusMessage(isEditing ? "Customer updated." : "Customer saved to master.");
            toast.success(isEditing ? "Customer updated." : "Customer saved.");
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to create customer");
        }
    };

    const deleteCustomer = async () => {
        if (!customerForm.recordId) {
            toast.error("Open a saved customer first to delete it.");
            return;
        }

        try {
            const response = await apiFetch(`${API_BASE}/sales/customers/${customerForm.recordId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to delete customer");
            }

            setCustomers((current) => current.filter((item) => item._id !== customerForm.recordId));
            if (customerId === customerForm.recordId) {
                setCustomerId("");
                setCustomerName("");
                setCustomerPhone("");
                setCustomerLocation("");
                setCustomerDob("");
                setCustomerAnniversary("");
                setDeliveryInfo("");
            }
            setCustomerForm(EMPTY_CUSTOMER_FORM);
            setCustomerFormOpen(false);
            setStatusMessage("Customer deleted.");
            toast.success("Customer deleted.");
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to delete customer");
        }
    };

    const openAddSalesmanForm = async () => {
        try {
            const nextCode = await fetchNextSalesmanCode();
            setSalesmanForm({
                ...EMPTY_SALESMAN_FORM,
                salesmanCode: nextCode,
                name: salesmanSearch.trim(),
            });
            setSalesmanFormOpen(true);
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to open salesman form");
        }
    };

    const openEditSalesmanForm = (person) => {
        setSalesmanForm({
            recordId: person._id || "",
            salesmanCode: String(person.salesmanCode || ""),
            name: person.name || "",
            phone: person.phone || "",
            location: person.location || "",
            notes: person.notes || "",
        });
        setSalesmanFormOpen(true);
    };

    const selectSalesman = (person) => {
        setSalespersonId(person._id || "");
        setSalesman(person.name || "");
        setSalesmanCodeInput(String(person.salesmanCode || ""));
        setSalesmanLookupInput([person.salesmanCode || "", person.name || ""].filter(Boolean).join(" - "));
        setSalesmanModalOpen(false);
        setSalesmanFormOpen(false);
    };

    const saveSalesman = async () => {
        try {
            if (!salesmanForm.name.trim()) {
                toast.error("Salesman name is required.");
                return;
            }

            const isEditing = Boolean(salesmanForm.recordId);
            const response = await apiFetch(`${API_BASE}/parties${isEditing ? `/${salesmanForm.recordId}` : ""}`, {
                method: isEditing ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    partyType: "salesman",
                    salesmanCode: Number(salesmanForm.salesmanCode || 1),
                    name: salesmanForm.name,
                    phone: salesmanForm.phone,
                    location: salesmanForm.location,
                    notes: salesmanForm.notes,
                }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to save salesman");
            }

            await refreshSalesmen(data.data?._id);
            setSalesmanForm(EMPTY_SALESMAN_FORM);
            setSalesmanFormOpen(false);
            setStatusMessage(isEditing ? "Salesman updated." : `Salesman ${data.data?.salesmanCode || ""} created.`);
            if (data.data) {
                selectSalesman(data.data);
            }
            toast.success(isEditing ? "Salesman updated." : "Salesman saved.");
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to save salesman");
        }
    };

    const deleteSalesman = async () => {
        if (!salesmanForm.recordId) {
            toast.error("Open a saved salesman first to delete.");
            return;
        }

        try {
            const response = await apiFetch(`${API_BASE}/parties/${salesmanForm.recordId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to delete salesman");
            }

            await refreshSalesmen();
            if (salespersonId === salesmanForm.recordId) {
                setSalespersonId("");
                setSalesman("");
                setSalesmanCodeInput("");
            }
            setSalesmanForm(EMPTY_SALESMAN_FORM);
            setSalesmanFormOpen(false);
            setStatusMessage("Salesman deleted.");
            toast.success("Salesman deleted.");
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to delete salesman");
        }
    };

    const handleSalesmanFormAction = (action) => {
        if (action === "save" || action === "edit") {
            saveSalesman();
            return;
        }

        if (action === "add") {
            setSalesmanForm((current) => ({ ...current, recordId: "" }));
            saveSalesman();
            return;
        }

        if (action === "delete") {
            deleteSalesman();
            return;
        }

        if (action === "search" || action === "list") {
            refreshSalesmen(salesmanSearch).catch((error) => {
                console.error(error);
            });
            setSalesmanFormOpen(false);
            setSalesmanModalOpen(true);
            return;
        }

        if (action === "exit") {
            setSalesmanFormOpen(false);
            setSalesmanModalOpen(false);
        }
    };

    const handleCustomerFormAction = (action) => {
        if (action === "save") {
            createCustomer(false);
            return;
        }

        if (action === "add") {
            createCustomer(true);
            return;
        }

        if (action === "edit") {
            createCustomer(false);
            return;
        }

        if (action === "cancel") {
            setCustomerForm(EMPTY_CUSTOMER_FORM);
            setCustomerFormOpen(false);
            return;
        }

        if (action === "search") {
            setCustomerForm(EMPTY_CUSTOMER_FORM);
            setCustomerFormOpen(false);
            return;
        }

        if (action === "delete") {
            deleteCustomer();
            return;
        }

        if (action === "list") {
            refreshCustomers(customerSearch).catch((error) => {
                console.error(error);
            });
            setCustomerFormOpen(false);
            return;
        }

        if (action === "exit") {
            setCustomerModalOpen(false);
            setCustomerFormOpen(false);
            return;
        }

        if (action === "export full list") {
            exportRowsAsCsv(
                [
                    ["Name", "Phone", "Area", "City", "DOB", "Anniversary"],
                    ...filteredCustomers.map((customer) => [
                        customer.name || "",
                        customer.phone || "",
                        customer.location || "",
                        customer.city || "",
                        customer.dateOfBirth ? String(customer.dateOfBirth).slice(0, 10) : "",
                        customer.anniversary ? String(customer.anniversary).slice(0, 10) : "",
                    ]),
                ],
                "customers-full-list.csv"
            );
            setStatusMessage("Customer full list exported.");
            return;
        }

        if (action === "export by date" || action === "by date") {
            const datedCustomers = filteredCustomers
                .filter((customer) => customer.dateOfBirth || customer.anniversary)
                .sort((left, right) => String(left.dateOfBirth || left.anniversary || "").localeCompare(String(right.dateOfBirth || right.anniversary || "")));
            exportRowsAsCsv(
                [
                    ["Name", "Phone", "DOB", "Anniversary"],
                    ...datedCustomers.map((customer) => [
                        customer.name || "",
                        customer.phone || "",
                        customer.dateOfBirth ? String(customer.dateOfBirth).slice(0, 10) : "",
                        customer.anniversary ? String(customer.anniversary).slice(0, 10) : "",
                    ]),
                ],
                "customers-by-date.csv"
            );
            setStatusMessage("Customer date export prepared.");
            return;
        }

        if (action === "plain") {
            setCustomerForm((current) => ({
                ...current,
                gstin: "",
                tradeName: "",
                legalName: "",
                address: "",
                city: "",
                pincode: "",
            }));
            setStatusMessage("B2B fields cleared.");
            return;
        }

        if (action === "contact") {
            const contactText = filteredCustomers
                .map((customer) => `${customer.name || "Customer"} - ${customer.phone || "-"}`)
                .join("\n");
            if (navigator.clipboard && contactText) {
                navigator.clipboard.writeText(contactText).catch(() => { });
            }
            setStatusMessage(contactText ? "Customer contacts copied." : "No customer contacts available to copy.");
        }
    };

    const closeConfirmationModal = useCallback(() => {
        setConfirmationState(EMPTY_CONFIRMATION);
    }, []);

    const openConfirmationModal = useCallback((config) => {
        setConfirmationState({
            ...EMPTY_CONFIRMATION,
            ...config,
            open: true,
        });
    }, []);

    const confirmModalAction = useCallback(async () => {
        const action = confirmationState.onConfirm;
        closeConfirmationModal();
        if (typeof action === "function") {
            await action();
        }
    }, [closeConfirmationModal, confirmationState.onConfirm]);

    const declineConfirmationModal = useCallback(async () => {
        const action = confirmationState.onNo;
        closeConfirmationModal();
        if (typeof action === "function") {
            await action();
        }
    }, [closeConfirmationModal, confirmationState.onNo]);

    const cancelConfirmationModal = useCallback(async () => {
        const action = confirmationState.onCancel;
        closeConfirmationModal();
        if (typeof action === "function") {
            await action();
        }
    }, [closeConfirmationModal, confirmationState.onCancel]);

    const fetchCustomerGstinDetails = async () => {
        if (!customerForm.gstin?.trim()) {
            setStatusMessage("Enter GSTIN first.");
            return;
        }

        try {
            const response = await apiFetch(`${API_BASE}/parties/gst/${encodeURIComponent(customerForm.gstin.trim())}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (!response.ok || data.success === false) {
                throw new Error(data.message || "Failed to fetch GSTIN details");
            }

            const details = data.data || {};
            setCustomerForm((current) => ({
                ...current,
                tradeName: details.tradeName || current.tradeName,
                legalName: details.legalName || current.legalName,
                address: [details.addressLine1, details.addressLine2].filter(Boolean).join(", ") || current.address,
                city: details.city || current.city,
                pincode: details.pincode || current.pincode,
            }));
            setStatusMessage(data.message || "GST details loaded.");
        } catch (error) {
            console.error(error);
            setStatusMessage(error.message || "Failed to fetch GST details.");
        }
    };

    const openSalesmanModalForCreate = async () => {
        setSalesmanModalOpen(true);
        await openAddSalesmanForm();
    };

    const applyBillDiscount = (value) => {
        if (clampNumber(value) > permissionRules.maxBillDiscountPercent) {
            toast.error(`Discount limit is ${permissionRules.maxBillDiscountPercent}% for your role.`);
        }
        const nextValue = Math.min(permissionRules.maxBillDiscountPercent, Math.max(0, clampNumber(value)));
        setDiscountPercent(nextValue);
        setDiscountModalOpen(false);
    };

    const applyItemDiscountPercent = (value) => {
        const requestedDiscountPercent = Math.max(0, clampNumber(value));
        if (!lines.length) {
            toast.error("Add items before applying discount.");
            return;
        }

        const originalRates = lines.map((line) => round2(line.originalSaleRate || line.saleRate || 0)).filter((rate) => rate > 0);
        if (originalRates.length === 0) {
            toast.error("Discount cannot be applied to zero amount items.");
            return;
        }

        const lineDiscountLimit = Number(permissionRules.maxLineDiscountPercent ?? 100);
        if (requestedDiscountPercent > lineDiscountLimit) {
            toast.error(`Discount limit is ${lineDiscountLimit}% for your role.`);
            return;
        }

        setDiscountPercent(0);
        setLines((current) => applyDiscountPercentToLines(current, requestedDiscountPercent));
        setDiscountPercentInput(requestedDiscountPercent ? String(requestedDiscountPercent) : "");
        toast.success("Discount percentage applied to item sale rates.");
    };

    const toggleExchangeItem = (sale, item) => {
        const key = `${sale._id}-${item._id}`;
        const remainingQty = Math.max(0, clampNumber(item.remainingQty ?? (item.qty - (item.returnedQty || 0))));
        if (remainingQty <= 0) {
            return;
        }

        setSelectedExchangeItems((current) => {
            const exists = current.some((entry) => entry.key === key);
            if (exists) {
                return current.filter((entry) => entry.key !== key);
            }

            return [...current, {
                key,
                saleId: sale._id,
                saleItemId: item._id,
                billNo: sale.billNo || sale.invoiceNo,
                itemName: item.itemName || item.itemId?.name || "Item",
                barcode: item.barcode || "",
                qty: 1,
                remainingQty,
                amount: round2(item.sellingRate || item.saleRate || 0),
            }];
        });
    };

    const updateExchangeQty = (key, value) => {
        setSelectedExchangeItems((current) => current.map((item) => {
            if (item.key !== key) return item;
            const nextQty = Math.max(1, Math.min(item.remainingQty || 1, clampNumber(value, 1)));
            const unitAmount = round2((item.amount || 0) / Math.max(1, clampNumber(item.qty, 1)));
            return {
                ...item,
                qty: nextQty,
                amount: round2(unitAmount * nextQty),
            };
        }));
    };

    const validateBeforeSave = () => {
        const redeemPoints = Math.max(0, Math.floor(clampNumber(loyaltyRedeemPoints)));
        if (redeemPoints > Number(loyaltySummary.balance || 0)) {
            return `Only ${Number(loyaltySummary.balance || 0)} loyalty points are available.`;
        }
        const minRedeem = Math.max(0, clampNumber(appSettings.loyalty?.minRedeemPoints));
        if (redeemPoints > 0 && redeemPoints < minRedeem) {
            return `Minimum ${minRedeem} loyalty points required to redeem.`;
        }
        const maxRedeemAmount = round2((payableAmount * Math.min(100, Math.max(0, clampNumber(appSettings.loyalty?.maxRedeemPercent, 20)))) / 100);
        if (loyaltyRedeemAmount > maxRedeemAmount) {
            return `Loyalty redemption cannot exceed Rs. ${maxRedeemAmount.toFixed(2)} for this bill.`;
        }
        return validateSaleBeforeSave({
            lines,
            stockWarnings,
            discountPercent,
            permissionRules,
            salesSettings: { ...salesSettings, paymentRows },
            salesman,
            activeMode,
            paidAmount,
            advanceAmount,
            payableAmount,
            customerName,
        });
    };

    const completeSale = async () => {
        const validationMessage = validateBeforeSave();
        if (validationMessage) {
            toast.error(validationMessage);
            return;
        }

        try {
            setSaving(true);
            const payload = {
                saleDate: activeSession?.businessDate ? new Date(activeSession.businessDate).toISOString() : new Date().toISOString(),
                customerId,
                customer: customerName,
                customerPhone,
                location: customerLocation,
                customerType: selectedCustomerRecord?.customerType,
                creditLimit: selectedCustomerRecord?.creditLimit,
                segmentTags: selectedCustomerRecord?.segmentTags || [],
                loyaltyCardNo: selectedCustomerRecord?.loyaltyCardNo,
                dateOfBirth: customerDob,
                anniversary: customerAnniversary,
                salespersonId,
                salesman,
                counterName: appSettings.billingCounter || "Main Counter",
                billType: activeMode,
                billingMode,
                note,
                deliveryInfo,
                referenceNo,
                discountPercent,
                discountAmount,
                exchangeAmount,
                advanceAmount,
                creditDue,
                advanceDetails: {
                    advanceAmount,
                    remainingAmount: creditDue,
                    deliveryStatus: "DELIVERED",
                    expectedDeliveryDate: advanceExpectedDeliveryDate,
                },
                creditDetails: {
                    creditAmount: creditDue,
                    dueDate: creditDueDate,
                },
                loyaltyPointsRedeemed: Math.max(0, Math.floor(clampNumber(loyaltyRedeemPoints))),
                loyaltyRedeemedAmount: loyaltyRedeemAmount,
                paymentBreakdown: paymentRows.map((row) => ({
                    mode: row.mode,
                    amount: clampNumber(row.amount),
                    reference: row.reference,
                })),
                exchangeItems: selectedExchangeItems.map((item) => ({
                    saleId: item.saleId,
                    saleItemId: item.saleItemId,
                    billNo: item.billNo,
                    itemName: item.itemName,
                    barcode: item.barcode,
                    qty: item.qty,
                    amount: item.amount,
                })),
                subtotal,
                gstRate: 0,
                gstAmount: 0,
                totalAmount: payableAmount,
                items: lines.map((line) => ({
                    inventoryId: line.inventoryId,
                    itemId: line.itemId,
                    itemName: line.itemName,
                    salesmanNumber: line.salesmanNumber,
                    category: line.category || undefined,
                    categoryName: line.categoryName,
                    brand: line.brand || undefined,
                    brandName: line.brandName,
                    barcode: line.barcode,
                    qty: getLineBillableQty(line),
                    displayQty: clampNumber(line.qty),
                    mtrQty: isMeterUnit(line.unit) ? clampNumber(line.mtrQty) : undefined,
                    unit: line.unit,
                    mrp: round2(line.mrp),
                    sellingRate: round2(line.saleRate),
                    originalSaleRate: round2(line.originalSaleRate || line.saleRate),
                    lineDiscountPercent: round2(line.lineDiscountPercent),
                    total: round2(line.lineTotal),
                })),
            };

            const response = await apiFetch(`${API_BASE}/sales`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to save sale");
            }

            setLastCompletedSale(data.data);
            setPrintModalOpen(true);
            setSalesHistory((current) => [data.data, ...current]);
            setInventory((current) => current.map((item) => {
                const soldLine = lines.find((line) => line.inventoryId === item._id);
                if (!soldLine) return item;
                return { ...item, stock: Math.max(0, clampNumber(item.stock) - getLineBillableQty(soldLine)) };
            }));

            const nextBillRes = await apiFetch(`${API_BASE}/sales/next-bill-no?mode=CASH`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const nextBillData = await nextBillRes.json();
            resetBill(nextBillData?.data?.billNo || "");
            clearRecoverySnapshot();
            setStatusMessage(data.message || "Sale saved successfully.");
            toast.success(data.message || "Bill saved successfully.");
            scheduleBarcodeFocus();
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to complete sale");
        } finally {
            setSaving(false);
        }
    };

    const holdCurrentBill = async () => {
        if (lines.length === 0) {
            toast.error("There is no active bill to hold.");
            return;
        }

        try {
            const response = await apiFetch(`${API_BASE}/sales/hold`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(buildDraftPayload()),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Failed to hold bill");

            setHeldBills((current) => [data.data, ...current]);
            const nextBillRes = await apiFetch(`${API_BASE}/sales/next-bill-no?mode=CASH`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const nextBillData = await nextBillRes.json();
            resetBill(nextBillData?.data?.billNo || "");
            clearRecoverySnapshot();
            setStatusMessage("Bill placed on hold.");
            toast.success("Bill placed on hold.");
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to hold bill");
        }
    };

    const openSession = async () => {
        if (!salesSettings.useDayEnd) {
            setStatusMessage("Day-end session control is disabled in settings.");
            return;
        }
        try {
            const response = await apiFetch(`${API_BASE}/sales/session/open`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    openingCash: clampNumber(sessionForm.openingCash),
                }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to open session");
            }
            setActiveSession(data.data || null);
            setSessionModalOpen(false);
            setStatusMessage(data.message || "POS session opened.");
            toast.success(data.message || "POS session opened.");
        } catch (error) {
            toast.error(error.message || "Failed to open session");
        }
    };

    const closeSession = async () => {
        if (!salesSettings.useDayEnd) {
            setStatusMessage("Day-end session control is disabled in settings.");
            return;
        }
        if (!permissionRules.canCloseSession) {
            toast.error("Your role cannot close POS sessions.");
            return;
        }
        try {
            const response = await apiFetch(`${API_BASE}/sales/session/close`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    closingCash: clampNumber(sessionForm.closingCash),
                    expenseAmount: clampNumber(sessionForm.expenseAmount),
                    expenseNote: sessionForm.expenseNote,
                }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to close session");
            }
            setActiveSession(null);
            setSessionModalOpen(false);
            setSessionForm({ openingCash: 0, closingCash: 0, expenseAmount: 0, expenseNote: "" });
            setStatusMessage(data.message || "POS session closed.");
            toast.success(data.message || "POS session closed.");
        } catch (error) {
            toast.error(error.message || "Failed to close session");
        }
    };

    const recallHeldBill = async (heldBillId) => {
        try {
            const response = await apiFetch(`${API_BASE}/sales/recall/${heldBillId}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Failed to recall bill");

            hydrateFromDraft(data.data, data.data?.billNo || "");
            setHeldBills((current) => current.filter((bill) => bill._id !== heldBillId));
            setHoldModalOpen(false);
            setStatusMessage("Held bill recalled.");
            toast.success("Held bill recalled.");
            scheduleBarcodeFocus();
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to recall bill");
        }
    };

    const handleSearchModalKeyDown = useCallback((event) => {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveSearchIndex((current) => moveActiveIndex(current, filteredInventory.length, 1));
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveSearchIndex((current) => moveActiveIndex(current, filteredInventory.length, -1));
            return;
        }

        if (event.key === "Enter" && activeSearchIndex >= 0 && filteredInventory[activeSearchIndex]) {
            event.preventDefault();
            addProductToBill(filteredInventory[activeSearchIndex]);
        }
    }, [activeSearchIndex, filteredInventory]);

    const handleCustomerModalKeyDown = useCallback((event) => {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || customerFormOpen) {
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveCustomerIndex((current) => moveActiveIndex(current, filteredCustomers.length, 1));
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveCustomerIndex((current) => moveActiveIndex(current, filteredCustomers.length, -1));
            return;
        }

        if (event.key === "Enter" && activeCustomerIndex >= 0 && filteredCustomers[activeCustomerIndex]) {
            event.preventDefault();
            selectCustomer(filteredCustomers[activeCustomerIndex]);
        }
    }, [activeCustomerIndex, customerFormOpen, filteredCustomers]);

    const handleSalesmanModalKeyDown = useCallback((event) => {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || salesmanFormOpen) {
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveSalesmanIndex((current) => moveActiveIndex(current, filteredSalespeople.length, 1));
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveSalesmanIndex((current) => moveActiveIndex(current, filteredSalespeople.length, -1));
            return;
        }

        if (event.key === "Enter" && activeSalesmanIndex >= 0 && filteredSalespeople[activeSalesmanIndex]) {
            event.preventDefault();
            selectSalesman(filteredSalespeople[activeSalesmanIndex]);
        }
    }, [activeSalesmanIndex, filteredSalespeople, salesmanFormOpen]);

    const handleHeldBillModalKeyDown = useCallback((event) => {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveHeldBillIndex((current) => moveActiveIndex(current, heldBills.length, 1));
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveHeldBillIndex((current) => moveActiveIndex(current, heldBills.length, -1));
            return;
        }

        if (event.key === "Enter" && activeHeldBillIndex >= 0 && heldBills[activeHeldBillIndex] && permissionRules.canRecallHoldBill) {
            event.preventDefault();
            recallHeldBill(heldBills[activeHeldBillIndex]._id);
        }
    }, [activeHeldBillIndex, heldBills, permissionRules.canRecallHoldBill, recallHeldBill]);

    const sendWhatsAppBill = async () => {
        if (!lastCompletedSale?._id) {
            return;
        }

        try {
            setSendingWhatsApp(true);

            if (!whatsappStatus.enabled) {
                const connectRes = await apiFetch(`${API_BASE}/whatsapp/connect`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                });
                const connectData = await connectRes.json();
                if (!connectRes.ok || !connectData.success) {
                    throw new Error(connectData.message || "Failed to initialize WhatsApp");
                }

                setWhatsappStatus(connectData.data || {});
                toast("WhatsApp initialization started. Scan the QR shown in the server terminal, then try Send WhatsApp again.");
                return;
            }

            const response = await apiFetch(`${API_BASE}/whatsapp/send-bill/${lastCompletedSale._id}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ phone: lastCompletedSale.customerPhone || customerPhone }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to send bill on WhatsApp");
            }

            setStatusMessage(data.message || "Bill sent on WhatsApp.");
            toast.success(data.message || "Bill sent on WhatsApp.");
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to send bill on WhatsApp");
        } finally {
            setSendingWhatsApp(false);
        }
    };

    const printDocument = (mode = "invoice") => {
        if (!lastCompletedSale) return;

        const popup = window.open("", "_blank", "width=900,height=800");
        if (!popup) return;
        mode = "invoice";

        const finalizePrintModal = () => {
            setPrintModalOpen(false);
            scheduleBarcodeFocus(120);
        };

        const paymentSummary = (lastCompletedSale.paymentBreakdown || [])
            .filter((row) => Number(row.amount || 0) > 0)
            .map((row) => `
                <div class="summary-row">
                    <span>${escapePrintHtml(row.mode || "Payment")}</span>
                    <strong>${formatPrintMoney(row.amount)}</strong>
                </div>
            `)
            .join("");

        const itemRows = (lastCompletedSale.items || []).map((item, index) => `
            <tr>
                <td class="center">${index + 1}</td>
                <td class="center">${escapePrintHtml(item.barcode || "-")}</td>
                <td class="center">${escapePrintHtml(item.salesmanNumber || "-")}</td>
                <td class="description-cell">
                    <div class="item-name">${escapePrintHtml(item.itemName || "-")}</div>
                    <div class="item-meta">${escapePrintHtml(item.brandName || item.brand || "")}${item.categoryName ? ` | ${escapePrintHtml(item.categoryName)}` : ""}</div>
                </td>
                <td class="center">${item.qty || 0}</td>
                <td class="center">${escapePrintHtml(item.unit || "Pcs")}</td>
                <td class="right">${formatPrintMoney(item.mrp)}</td>
                <td class="right">${formatPrintMoney(item.sellingRate)}</td>
                <td class="right">${formatPrintMoney(item.total)}</td>
            </tr>
        `).join("");

        const companyName = appSettings.companyName || "POS Invoice";
        const counterName = appSettings.companyTagline || "Fashion & Tradition";
        const saleDate = new Date(lastCompletedSale.saleDate || Date.now());
        const saleDateText = saleDate.toLocaleDateString("en-GB");
        const saleTimeText = saleDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();
        const invoiceMoney = (value) => Number(value || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        const invoiceNumber = (value) => Number(value || 0).toLocaleString("en-IN", {
            maximumFractionDigits: 2,
        });
        const customerNameText = lastCompletedSale.customer || "Walk-in";
        const customerPhoneText = lastCompletedSale.customerPhone || "-";
        const salespersonText = lastCompletedSale.salesman || "-";
        const deliveryInfoText = lastCompletedSale.deliveryInfo || "-";
        const referenceText = lastCompletedSale.referenceNo || "-";
        const amountWordsText = amountToWords(lastCompletedSale.totalAmount || 0);
        const completedBillingMode = lastCompletedSale.billingMode || "CASH";
        const invoiceTitle = completedBillingMode === "ADVANCE"
            ? "ADVANCE BILL / TAX INVOICE"
            : completedBillingMode === "CREDIT"
                ? "CREDIT BILL / TAX INVOICE"
                : "TAX INVOICE";
        const completedBillNo = lastCompletedSale.displayBillNo || lastCompletedSale.billNo || "-";
        const qrMarkup = renderToStaticMarkup(
            <QRCodeSVG
                value={JSON.stringify({
                    billNo: lastCompletedSale.billNo || "-",
                    invoiceNo: lastCompletedSale.invoiceNo || "-",
                    customer: customerNameText,
                    totalAmount: formatPrintMoney(lastCompletedSale.totalAmount || 0),
                    date: saleDate.toISOString(),
                })}
                size={108}
                bgColor="#ffffff"
                fgColor="#111111"
                level="M"
            />,
        );
        const activePayments = paymentSummary || `
            <div class="summary-row">
                <span>Paid</span>
                <strong>${formatPrintMoney(lastCompletedSale.paidAmount || 0)}</strong>
            </div>
        `;
        const printableInvoiceItems = (lastCompletedSale.items || []).filter((item) => (
            item?.barcode
            || item?.itemName
            || Number(item?.qty || 0) > 0
            || Number(item?.displayQty || 0) > 0
            || Number(item?.mtrQty || 0) > 0
            || Number(item?.total || 0) > 0
        ));
        const totalQty = printableInvoiceItems.reduce((sum, item) => sum + Number(item.displayQty || item.qty || 0), 0);
        const invoiceItemRows = printableInvoiceItems.map((item, index) => {
            const meterItem = isMeterUnit(item.unit);
            const pcsQty = Number(item.displayQty || (meterItem ? 0 : item.qty) || 0);
            const mtrQty = meterItem ? Number(item.mtrQty || item.qty || 0) : 0;
            return `
            <tr>
                <td class="center">${index + 1}</td>
                <td class="center">${escapePrintHtml(item.barcode || "-")}</td>
                <td class="description-cell">${escapePrintHtml(item.itemName || "-")}</td>
                <td class="center">${pcsQty ? invoiceNumber(pcsQty) : ""}</td>
                <td class="center">${mtrQty ? invoiceNumber(mtrQty) : ""}</td>
                <td class="right">${invoiceNumber(item.mrp)}</td>
                <td class="right">${invoiceNumber(item.sellingRate)}</td>
                <td class="right">${invoiceMoney(item.total)}</td>
            </tr>
        `;
        }).join("");
        const companyAddress = appSettings.companyAddress || "26/A SHANIWAR PETH KARAD.";
        const companyPhone = appSettings.companyPhone || "7020447205, 9604249177, 8208442643";
        const gstinText = appSettings.gstin || appSettings.gstNo || "27AAFFL3196B1ZF";
        const gstRateValue = Number(lastCompletedSale.gstRate || 0);
        const halfGstRate = gstRateValue ? formatPrintMoney(gstRateValue / 2).replace(/\.00$/, "") : "0";
        const halfGstAmount = formatPrintMoney((lastCompletedSale.gstAmount || 0) / 2);

        if (mode === "invoice") {
            popup.document.write(`
            <html>
            <head>
                <title>${lastCompletedSale.billNo}</title>
                <style>
                    * { box-sizing: border-box; }
                    body {
                        margin: 0;
                        background: #ffffff;
                        color: #020d28;
                        font-family: Arial, Helvetica, sans-serif;
                        padding: 12px;
                    }
                    .bill-sheet {
                        width: 820px;
                        margin: 0 auto;
                        border: 1.5px solid #061735;
                        border-radius: 17px;
                        padding: 12px;
                        background: #fff;
                        overflow: hidden;
                    }
                    .invoice-head {
                        display: grid;
                        grid-template-columns: 270px 1fr 146px;
                        gap: 16px;
                        align-items: start;
                    }
                    .brand-lockup {
                        display: grid;
                        grid-template-columns: 62px 1fr;
                        gap: 8px;
                        align-items: center;
                    }
                    .lotus svg { width: 62px; height: 62px; }
                    .brand-name {
                        font-size: 26px;
                        font-weight: 900;
                        text-transform: uppercase;
                        letter-spacing: -.01em;
                        line-height: 1;
                    }
                    .brand-sub {
                        color: #d08200;
                        font-size: 10px;
                        font-weight: 800;
                        letter-spacing: .13em;
                        text-transform: uppercase;
                        margin-top: 6px;
                    }
                    .title-block { text-align: center; padding-top: 10px; }
                    .invoice-title {
                        font-size: 36px;
                        font-weight: 900;
                        letter-spacing: .02em;
                        line-height: 1;
                    }
                    .title-rule {
                        margin: 13px auto 0;
                        width: 200px;
                        height: 2px;
                        background: #d08200;
                        position: relative;
                    }
                    .title-rule:before {
                        content: "";
                        width: 15px;
                        height: 15px;
                        border: 3px solid #d08200;
                        border-radius: 50%;
                        position: absolute;
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%);
                        background: #fff;
                    }
                    .bill-card {
                        background: linear-gradient(135deg, #020d28, #08204c);
                        color: #fff;
                        border-radius: 8px;
                        padding: 10px 8px 11px;
                        text-align: center;
                        box-shadow: inset 0 0 0 1px rgba(255,255,255,.12);
                    }
                    .bill-card span {
                        display: block;
                        font-size: 15px;
                        font-weight: 800;
                        text-transform: uppercase;
                    }
                    .bill-card strong {
                        display: block;
                        margin-top: 4px;
                        font-size: 34px;
                        line-height: 1;
                    }
                    .info-grid {
                        margin-top: 24px;
                        display: grid;
                        grid-template-columns: 1fr 156px;
                        gap: 16px;
                    }
                    .shop-lines {
                        display: grid;
                        gap: 14px;
                        font-size: 16px;
                    }
                    .icon-line {
                        display: grid;
                        grid-template-columns: 28px 1fr;
                        align-items: center;
                        gap: 9px;
                    }
                    .icon {
                        width: 23px;
                        height: 23px;
                        display: inline-grid;
                        place-items: center;
                    }
                    .icon svg { width: 23px; height: 23px; fill: #020d28; }
                    .date-stack {
                        display: grid;
                        gap: 22px;
                        font-size: 15px;
                    }
                    .date-line {
                        display: grid;
                        grid-template-columns: 28px 1fr;
                        gap: 9px;
                        align-items: start;
                    }
                    .date-line strong {
                        display: block;
                        font-size: 18px;
                        margin-top: 2px;
                    }
                    .customer-line {
                        margin: 27px 0 16px;
                        display: grid;
                        grid-template-columns: 34px 96px 1fr;
                        align-items: end;
                        gap: 8px;
                        font-size: 16px;
                        font-weight: 800;
                    }
                    .customer-rule {
                        border-bottom: 2px solid #1a2742;
                        min-height: 20px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        overflow: hidden;
                    }
                    .invoice-items-frame {
                        min-height: 568px;
                        border-left: 1px solid #d8dde5;
                        border-right: 1px solid #d8dde5;
                    }
                    .invoice-items-frame table {
                        border-left: 0;
                        border-right: 0;
                    }
                    thead th {
                        background: linear-gradient(135deg, #020d28, #08204c);
                        color: #fff;
                        padding: 11px 8px;
                        font-size: 14px;
                        text-align: center;
                        border-right: 1px solid rgba(255,255,255,.38);
                        line-height: 1.15;
                    }
                    thead th:first-child { border-top-left-radius: 7px; }
                    thead th:last-child {
                        border-top-right-radius: 7px;
                        border-right: none;
                    }
                    td {
                        border: 1px solid #d8dde5;
                        border-top: none;
                        padding: 9px 10px;
                        font-size: 14px;
                        height: 35px;
                        vertical-align: middle;
                    }
                    .invoice-items-frame tbody tr:last-child td {
                        border-bottom: 1px solid #d8dde5;
                    }
                    .center { text-align: center; }
                    .right { text-align: right; }
                    .description-cell {
                        text-transform: uppercase;
                        font-weight: 500;
                    }
                    .total-band {
                        display: grid;
                        grid-template-columns: 1fr 1.1fr 1.24fr;
                    }
                    .total-box {
                        min-height: 79px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 16px;
                        padding: 10px;
                        border: 1px solid #d8dde5;
                        border-top: none;
                    }
                    .total-box.dark {
                        background: linear-gradient(135deg, #020d28, #08204c);
                        color: #fff;
                        justify-content: flex-start;
                        padding-left: 22px;
                    }
                    .total-box.teal {
                        background: linear-gradient(135deg, #087b73, #119985);
                        color: #fff;
                        justify-content: flex-start;
                        padding-left: 22px;
                    }
                    .total-icon {
                        width: 48px;
                        height: 48px;
                        border: 2px solid currentColor;
                        border-radius: 50%;
                        display: grid;
                        place-items: center;
                        font-size: 25px;
                        font-weight: 900;
                    }
                    .total-label {
                        font-size: 13px;
                        font-weight: 900;
                        text-transform: uppercase;
                    }
                    .total-value {
                        margin-top: 7px;
                        font-size: 27px;
                        font-weight: 900;
                        letter-spacing: .03em;
                    }
                    .gst-box {
                        text-align: center;
                        font-size: 14px;
                        line-height: 1.8;
                    }
                    .meta-band {
                        display: grid;
                        grid-template-columns: 238px 1fr 164px;
                        border: 1px solid #d8dde5;
                        border-top: none;
                        min-height: 83px;
                        border-radius: 0 0 7px 7px;
                        overflow: hidden;
                    }
                    .meta-panel {
                        padding: 12px 18px;
                        display: flex;
                        gap: 14px;
                        align-items: center;
                    }
                    .meta-panel + .meta-panel {
                        border-left: 1px solid #d8dde5;
                    }
                    .meta-title {
                        font-size: 14px;
                        font-weight: 900;
                        text-transform: uppercase;
                    }
                    .meta-big {
                        margin-top: 6px;
                        font-size: 25px;
                        font-weight: 900;
                    }
                    .amount-words {
                        font-size: 16px;
                        line-height: 1.45;
                        text-transform: uppercase;
                    }
                    .qr-panel {
                        flex-direction: column;
                        justify-content: center;
                        text-align: center;
                        gap: 4px;
                    }
                    .bottom-note {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 16px;
                        padding: 12px 10px 9px;
                        font-size: 16px;
                        font-weight: 900;
                        border-bottom: 1px solid #d8dde5;
                    }
                    .powered strong { color: #087b73; }
                    .quote-box {
                        display: grid;
                        grid-template-columns: 42px 1fr 42px;
                        align-items: center;
                        gap: 10px;
                        border: 1px solid #8abac4;
                        border-radius: 10px;
                        padding: 11px 14px;
                        font-size: 16px;
                        text-align: center;
                        color: #020d28;
                    }
                    .quote-mark {
                        color: #087b73;
                        font-size: 36px;
                        font-weight: 900;
                        line-height: 1;
                    }
                    @media print {
                        body { background: #fff; padding: 0; }
                        .bill-sheet { width: 100%; border-radius: 12px; }
                    }
                </style>
            </head>
            <body>
                <div class="bill-sheet">
                    <div class="invoice-head">
                        <div class="brand-lockup">
                            <div class="lotus">
                                <svg viewBox="0 0 100 100" aria-hidden="true">
                                    <g fill="none" stroke="#d08200" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M50 11c12 17 12 30 0 45-12-15-12-28 0-45z"/>
                                        <path d="M31 21c15 9 23 20 19 35-16-6-23-18-19-35z"/>
                                        <path d="M69 21c-15 9-23 20-19 35 16-6 23-18 19-35z"/>
                                        <path d="M18 38c18 1 29 8 32 24-17 1-28-8-32-24z"/>
                                        <path d="M82 38c-18 1-29 8-32 24 17 1 28-8 32-24z"/>
                                        <path d="M14 62c21-3 34 1 36 16-19 6-31 1-36-16z"/>
                                        <path d="M86 62c-21-3-34 1-36 16 19 6 31 1 36-16z"/>
                                        <path d="M24 83h52"/>
                                    </g>
                                </svg>
                            </div>
                            <div>
                                <div class="brand-name">${escapePrintHtml(companyName)}</div>
                                <div class="brand-sub">${escapePrintHtml(counterName || "Fashion & Tradition")}</div>
                            </div>
                        </div>
                        <div class="title-block">
                            <div class="invoice-title">${escapePrintHtml(invoiceTitle)}</div>
                            <div class="title-rule"></div>
                        </div>
                        <div class="bill-card"><span>${escapePrintHtml(completedBillingMode)}</span><strong>${escapePrintHtml(completedBillNo)}</strong></div>
                    </div>

                    <div class="info-grid">
                        <div class="shop-lines">
                            <div class="icon-line"><span class="icon"><svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg></span><span>${escapePrintHtml(companyAddress)}</span></div>
                            <div class="icon-line"><span class="icon"><svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.61 21 3 13.39 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.24.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg></span><span>M: ${escapePrintHtml(companyPhone)}</span></div>
                            <div class="icon-line"><span class="icon"><svg viewBox="0 0 24 24"><path d="M20 8h-3V4H7v4H4l-2 4 2 8h16l2-8-2-4zM9 6h6v2H9V6zm7 10h-3v3h-2v-3H8v-2h3v-3h2v3h3v2z"/></svg></span><span>GSTIN: ${escapePrintHtml(gstinText)}</span></div>
                        </div>
                        <div class="date-stack">
                            <div class="date-line"><span class="icon"><svg viewBox="0 0 24 24"><path d="M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2L2 6a2 2 0 0 1 2-2h3V2zm13 8H4v10h16V10z"/></svg></span><span>Date<strong>${escapePrintHtml(saleDateText)}</strong></span></div>
                            <div class="date-line"><span class="icon"><svg viewBox="0 0 24 24"><path d="M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22zm1 11h5v2h-7V6h2v6z"/></svg></span><span>Time<strong>${escapePrintHtml(saleTimeText)}</strong></span></div>
                        </div>
                    </div>

                    <div class="customer-line">
                        <span class="icon"><svg viewBox="0 0 24 24"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5C21 16.5 17 14 12 14z"/></svg></span>
                        <span>Customer :</span>
                        <span class="customer-rule">${escapePrintHtml(customerNameText === "Walk-in" ? "" : customerNameText)}</span>
                    </div>

                    <div class="invoice-items-frame">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width:58px;">Sr</th>
                                    <th style="width:92px;">Barcode</th>
                                    <th>SL Description</th>
                                    <th style="width:64px;">Qty</th>
                                    <th style="width:74px;">Mtrs</th>
                                    <th style="width:88px;">MRP</th>
                                    <th style="width:88px;">Rate</th>
                                    <th style="width:108px;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>${invoiceItemRows}</tbody>
                        </table>
                    </div>

                    <div class="total-band">
                        <div class="total-box dark">
                            <div class="total-icon">▤</div>
                            <div><div class="total-label">Total Amount</div><div class="total-value">₹ ${invoiceMoney(lastCompletedSale.subtotal || lastCompletedSale.totalAmount || 0)}</div></div>
                        </div>
                        <div class="total-box gst-box">
                            <div><strong>GST ${escapePrintHtml(String(lastCompletedSale.gstRate || 0))}%</strong><br>(CGST @ ${halfGstRate}%: ₹${invoiceMoney((lastCompletedSale.gstAmount || 0) / 2)})<br>(SGST @ ${halfGstRate}%: ₹${invoiceMoney((lastCompletedSale.gstAmount || 0) / 2)})</div>
                        </div>
                        <div class="total-box teal">
                            <div class="total-icon">₹</div>
                            <div><div class="total-label">Net Amount</div><div class="total-value">₹ ${invoiceMoney(lastCompletedSale.totalAmount || 0)}</div></div>
                        </div>
                    </div>

                    <div class="meta-band">
                        <div class="meta-panel">
                            <span class="icon"><svg viewBox="0 0 24 24"><path d="M7 6V4a5 5 0 0 1 10 0v2h3v16H4V6h3zm2 0h6V4a3 3 0 0 0-6 0v2z"/></svg></span>
                            <div><div class="meta-title">Total Qty</div><div class="meta-big">${invoiceNumber(totalQty)}</div></div>
                        </div>
                        <div class="meta-panel">
                            <div><div class="meta-title">Amount In Words</div><div class="amount-words">${escapePrintHtml(amountWordsText).toUpperCase()}</div></div>
                        </div>
                        <div class="meta-panel qr-panel">
                            <div class="meta-title">Scan To Pay</div>
                            ${qrMarkup}
                        </div>
                    </div>
                    <div class="bottom-note">
                        <span><span class="icon"><svg viewBox="0 0 24 24"><path d="M3 5h14v10H3V5zm16 4h2v10H7v-2h12V9z"/></svg></span> NO EXCHANGE NO RETURN</span>
                        <span class="powered">Powered by <strong>LVVendora</strong></span>
                    </div>
                    <div class="quote-box">
                        <span class="quote-mark">“</span>
                        <span>ekda ivaklaolaa maala prt Gaotlaa jaaNaar naahl.<br>AapNa Gaotlaolyaa maalavar Aamhl ksalahI ga^rnTI doj Sakt naahl</span>
                        <span class="quote-mark">”</span>
                    </div>
                </div>
                <script>window.print();</script>
            </body>
            </html>
        `);
            popup.document.close();
            popup.onafterprint = () => popup.close?.();
            finalizePrintModal();
            return;
        }

        popup.document.write(`
            <html>
            <head>
                <title>${lastCompletedSale.billNo}</title>
                <style>
                    * { box-sizing: border-box; }
                    body {
                        margin: 0;
                        font-family: Arial, sans-serif;
                        padding: ${mode === "thermal" ? "12px" : "24px"};
                        color: var(--text-main);
                        background: var(--surface);
                    }
                    .wrap {
                        width: ${mode === "thermal" ? "302px" : "100%"};
                        max-width: ${mode === "thermal" ? "302px" : "980px"};
                        margin: 0 auto;
                    }
                    .header {
                        border: 2px solid var(--text-main);
                        padding: ${mode === "thermal" ? "10px" : "16px 18px"};
                    }
                    .header-top {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        gap: 16px;
                    }
                    .company {
                        font-size: ${mode === "thermal" ? "18px" : "30px"};
                        line-height: 1;
                        font-weight: 900;
                        text-transform: uppercase;
                        margin: 0;
                    }
                    .counter {
                        margin-top: 6px;
                        font-size: ${mode === "thermal" ? "11px" : "13px"};
                        color: var(--text-soft);
                        text-transform: uppercase;
                        letter-spacing: 0.08em;
                    }
                    .doc-badge {
                        border: 2px solid var(--text-main);
                        padding: ${mode === "thermal" ? "6px 8px" : "10px 14px"};
                        min-width: ${mode === "thermal" ? "110px" : "160px"};
                        text-align: right;
                    }
                    .doc-badge .caption {
                        font-size: ${mode === "thermal" ? "10px" : "12px"};
                        text-transform: uppercase;
                    }
                    .doc-badge .value {
                        font-size: ${mode === "thermal" ? "16px" : "24px"};
                        font-weight: 900;
                        margin-top: 4px;
                    }
                    .meta-grid {
                        display: grid;
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 8px 20px;
                        margin-top: 14px;
                        font-size: ${mode === "thermal" ? "11px" : "13px"};
                    }
                    .meta-row,
                    .summary-row {
                        display: flex;
                        justify-content: space-between;
                        gap: 12px;
                        align-items: flex-start;
                    }
                    .meta-row span:first-child,
                    .summary-row span:first-child {
                        color: var(--text-soft);
                    }
                    .section-title {
                        margin: 14px 0 8px;
                        font-size: ${mode === "thermal" ? "11px" : "13px"};
                        text-transform: uppercase;
                        letter-spacing: 0.08em;
                        font-weight: 800;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 8px;
                    }
                    th, td {
                        border: 1px solid var(--text-main);
                        padding: ${mode === "thermal" ? "5px 4px" : "7px 6px"};
                        font-size: ${mode === "thermal" ? "10px" : "12px"};
                        text-align: left;
                        vertical-align: top;
                    }
                    th {
                        background: var(--surface-soft);
                        text-transform: uppercase;
                        letter-spacing: 0.04em;
                    }
                    .center { text-align: center; }
                    .right { text-align: right; }
                    .item-name { font-weight: 700; }
                    .item-meta { margin-top: 2px; color: var(--text-soft); font-size: ${mode === "thermal" ? "9px" : "11px"}; }
                    .footer-grid {
                        display: grid;
                        grid-template-columns: ${mode === "thermal" ? "1fr" : "minmax(0, 1.2fr) minmax(280px, 0.8fr)"};
                        gap: 14px;
                        margin-top: 14px;
                    }
                    .summary-card {
                        border: 2px solid var(--text-main);
                        padding: ${mode === "thermal" ? "8px" : "12px 14px"};
                        display: grid;
                        gap: 8px;
                    }
                    .summary-card.total-card {
                        background: var(--surface-soft);
                    }
                    .grand-total {
                        border-top: 2px solid var(--text-main);
                        padding-top: 8px;
                        font-size: ${mode === "thermal" ? "12px" : "16px"};
                        font-weight: 900;
                    }
                    .footer-note {
                        margin-top: 14px;
                        text-align: center;
                        font-size: ${mode === "thermal" ? "10px" : "12px"};
                        color: var(--text-soft);
                    }
                </style>
            </head>
            <body>
                <div class="wrap">
                    <div class="header">
                        <div class="header-top">
                            <div>
                                <h1 class="company">${escapePrintHtml(companyName)}</h1>
                                <div class="counter">${escapePrintHtml(counterName)}</div>
                            </div>
                            <div class="doc-badge">
                                <div class="caption">${escapePrintHtml(completedBillingMode)}</div>
                                <div class="value">${escapePrintHtml(completedBillNo)}</div>
                            </div>
                        </div>
                        <div class="meta-grid">
                            <div class="meta-row"><span>Invoice No</span><strong>${escapePrintHtml(lastCompletedSale.invoiceNo || "-")}</strong></div>
                            <div class="meta-row"><span>Mode</span><strong>${escapePrintHtml(completedBillingMode)}</strong></div>
                            <div class="meta-row"><span>Date</span><strong>${escapePrintHtml(saleDateText)}</strong></div>
                            <div class="meta-row"><span>Time</span><strong>${escapePrintHtml(saleTimeText)}</strong></div>
                            <div class="meta-row"><span>Customer</span><strong>${escapePrintHtml(customerNameText)}</strong></div>
                            <div class="meta-row"><span>Phone</span><strong>${escapePrintHtml(customerPhoneText)}</strong></div>
                            <div class="meta-row"><span>Salesman</span><strong>${escapePrintHtml(salespersonText)}</strong></div>
                            <div class="meta-row"><span>Reference</span><strong>${escapePrintHtml(referenceText)}</strong></div>
                            <div class="meta-row"><span>Delivery</span><strong>${escapePrintHtml(deliveryInfoText)}</strong></div>
                            <div class="meta-row"><span>Items</span><strong>${(lastCompletedSale.items || []).length}</strong></div>
                        </div>
                    </div>

                    <div class="section-title">Invoice Items</div>
                    <table>
                        <thead>
                            <tr>
                                <th>SL</th>
                                <th>Barcode</th>
                                <th>Category</th>
                                <th>Item Name</th>
                                <th>Unit</th>
                                <th>Qty</th>
                                <th>MRP</th>
                                <th>Sale Rate</th>
                                <th>Amount</th>
                            </tr>
                        </thead>
                        <tbody>${itemRows}</tbody>
                    </table>

                    <div class="footer-grid">
                        <div class="summary-card">
                            <div class="section-title" style="margin:0;">Payment Summary</div>
                            ${activePayments}
                            <div class="summary-row"><span>Advance</span><strong>${formatPrintMoney(lastCompletedSale.advanceAmount || 0)}</strong></div>
                            <div class="summary-row"><span>Exchange</span><strong>${formatPrintMoney(lastCompletedSale.exchangeAmount || 0)}</strong></div>
                            <div class="summary-row"><span>Credit Due</span><strong>${formatPrintMoney(lastCompletedSale.creditDue || 0)}</strong></div>
                        </div>
                        <div class="summary-card total-card">
                            <div class="section-title" style="margin:0;">Bill Totals</div>
                            <div class="summary-row"><span>Total Amount</span><strong>${formatPrintMoney(lastCompletedSale.subtotal || 0)}</strong></div>
                            <div class="summary-row"><span>Discount</span><strong>${formatPrintMoney(lastCompletedSale.discountAmount || lastCompletedSale.discount || 0)}</strong></div>
                            <div class="summary-row"><span>GST</span><strong>${formatPrintMoney(lastCompletedSale.gstAmount || 0)}</strong></div>
                            <div class="summary-row"><span>Round</span><strong>${formatPrintMoney(lastCompletedSale.roundAmount || 0)}</strong></div>
                            <div class="summary-row"><span>Paid</span><strong>${formatPrintMoney(lastCompletedSale.paidAmount || 0)}</strong></div>
                            <div class="summary-row grand-total"><span>Net Amount</span><strong>${formatPrintMoney(lastCompletedSale.totalAmount || 0)}</strong></div>
                        </div>
                    </div>

                    <div class="footer-note">Thank you for shopping with ${escapePrintHtml(companyName)}.</div>
                </div>
                <script>window.print();</script>
            </body>
            </html>
        `);
        popup.document.close();
        popup.onafterprint = () => popup.close?.();
        finalizePrintModal();
    };

    const sendBroadcast = async () => {
        if (!broadcastMessage.trim()) {
            toast.error("Enter a broadcast message first.");
            return;
        }

        try {
            setSendingBroadcast(true);
            const response = await apiFetch(`${API_BASE}/whatsapp/broadcast`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    message: broadcastMessage,
                    onlyOptedIn: true,
                }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to send broadcast");
            }

            setStatusMessage(`Broadcast processed for ${data.data?.total || 0} customers.`);
            setBroadcastModalOpen(false);
            setBroadcastMessage("");
            toast.success(`Broadcast processed for ${data.data?.total || 0} customers.`);
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to send broadcast");
        } finally {
            setSendingBroadcast(false);
        }
    };

    const handleEnterNavigation = (event) => {
        if (isAnyModalOpen) {
            return;
        }

        if (
            event.key === "Escape"
            && !customerModalOpen
            && !salesmanModalOpen
            && !searchModalOpen
            && !exchangeModalOpen
            && !holdModalOpen
            && !discountModalOpen
            && !sessionModalOpen
            && !printModalOpen
            && !scannerModalOpen
            && !broadcastModalOpen
        ) {
            event.preventDefault();
            const deleteGuard = getBillActionGuard({ action: "delete", permissionRules });
            if (deleteGuard) {
                toast.error(deleteGuard);
                return;
            }
            if (lines.length > 0 || customerName || customerPhone || note || deliveryInfo || referenceNo) {
                openConfirmationModal({
                    title: "Delete Current Bill",
                    message: "Pressing Escape will delete the current bill. Do you want to continue?",
                    confirmLabel: "Delete Bill",
                    tone: "danger",
                    onConfirm: resetCurrentBill,
                });
                return;
            }
            resetCurrentBill();
            return;
        }

        if (event.key !== "Enter") {
            return;
        }

        if (event.target === barcodeInputRef.current) {
            return;
        }

        if (event.target.dataset.enterNav !== "true") {
            return;
        }

        event.preventDefault();
        const fields = Array.from(document.querySelectorAll('[data-enter-nav="true"]'))
            .filter((element) => !element.disabled && element.offsetParent !== null);
        const currentIndex = fields.indexOf(event.target);
        if (currentIndex >= 0 && currentIndex < fields.length - 1) {
            fields[currentIndex + 1].focus();
        }
    };

    const closeBillingFlow = useCallback(() => {
        setBillingActionModal(null);
        setPaymentModalOpen(false);
    }, []);

    const runCashBillingFlow = useCallback(async () => {
        setBillingMode("CASH");
        setActiveMode("cashpay");
        setPaymentRows([createPaymentRow("Cash", tenderPayableAmount)]);
        setBillingActionModal(null);
        setPaymentModalOpen(false);
        await completeSale();
    }, [completeSale, tenderPayableAmount]);

    const runCardUpiBillingFlow = useCallback(async () => {
        const totals = getCardUpiTotals(paymentRows);
        if (round2(totals.cash + totals.cardUpi) !== round2(tenderPayableAmount)) {
            toast.error("Cash and Card / UPI total must match the net receivable.");
            return;
        }

        setBillingMode("CASH");
        setActiveMode("card-upi");
        setPaymentModalOpen(false);
        await completeSale();
    }, [completeSale, paymentRows, tenderPayableAmount]);

    const openPaymentOptions = useCallback((method = "Card") => {
        setSelectedPaymentMode(method);
        setPaymentModalOpen(true);
    }, []);

    const switchBillingMode = useCallback((nextMode) => {
        const nextBillingMode = getBillingModeFromPosMode(nextMode);
        setBillingMode(nextBillingMode);
        setActiveMode(nextMode);
        setBillingActionModal(null);
        setPaymentModalOpen(false);
        if (nextMode === "credit") {
            setPaymentRows([]);
            setManualAdvanceAmount(0);
        }
        if (nextMode === "advance") {
            setManualAdvanceAmount("");
            setPaymentRows([]);
        }
        if (nextMode === "cashpay") {
            setPaymentRows([createPaymentRow("Cash", tenderPayableAmount)]);
            setManualAdvanceAmount(0);
        }
    }, [tenderPayableAmount]);

    const openPrimaryPayFlow = useCallback(() => {
        if (lines.length === 0) {
            if (activeMode === "credit" || activeMode === "advance") {
                switchBillingMode("cashpay");
                return;
            }
            toast.error("Add items to bill first");
            return;
        }

        if (activeMode === "credit" || activeMode === "advance") {
            setSelectedPaymentMode("Cash");
            setBillingActionModal(null);
            setPaymentModalOpen(true);
            return;
        }

        if (activeMode === "card-upi") {
            setSelectedPaymentMode("Card");
            setBillingActionModal("card-upi");
            setPaymentModalOpen(false);
            return;
        }

        setSelectedPaymentMode("Cash");
        setBillingActionModal("cash");
        setPaymentModalOpen(false);
    }, [activeMode, lines.length, switchBillingMode]);

    const openSecondaryPayFlow = useCallback(() => {
        if (lines.length === 0) {
            toast.error("Add items to bill first");
            return;
        }

        if (activeMode === "credit" || activeMode === "advance") {
            setSelectedPaymentMode("Card");
            setBillingActionModal(null);
            setPaymentModalOpen(true);
            return;
        }

        if (activeMode !== "card-upi") {
            switchBillingMode("card-upi");
        }
        setSelectedPaymentMode("Card");
        setBillingActionModal("card-upi");
        setPaymentModalOpen(false);
    }, [activeMode, lines.length, switchBillingMode]);

    const triggerBillingShortcut = useCallback((mode) => {
        switchBillingMode(mode);
    }, [switchBillingMode]);

    const handleShortcutAction = useCallback((shortcut) => {
        if (shortcut.action === "mode" && shortcut.mode) {
            if (shortcut.key === "F1") {
                openPrimaryPayFlow();
                return;
            }

            if (shortcut.key === "F3") {
                openSecondaryPayFlow();
                return;
            }

            switchBillingMode(shortcut.mode);
            return;
        }

        if (shortcut.action === "billing-mode" && shortcut.mode) {
            switchBillingMode(shortcut.mode);
            return;
        }

        if (shortcut.action === "exchange") {
            setActiveMode("exchange");
            setExchangeModalOpen(true);
            return;
        }

        if (shortcut.action === "holds") {
            const recallGuard = getBillActionGuard({ action: "recall", permissionRules });
            if (recallGuard) {
                toast.error(recallGuard);
                return;
            }
            setHoldModalOpen(true);
            return;
        }

        if (shortcut.action === "hold") {
            openConfirmationModal({
                title: "Put Bill On Hold",
                message: "This bill will be moved to held bills so you can recall it later. Continue?",
                confirmLabel: "Put On Hold",
                onConfirm: holdCurrentBill,
            });
            return;
        }

        if (shortcut.action === "add-customer") {
            setCustomerModalOpen(true);
            setCustomerFormOpen(true);
            return;
        }

        if (shortcut.action === "reset") {
            const deleteGuard = getBillActionGuard({ action: "delete", permissionRules });
            if (deleteGuard) {
                toast.error(deleteGuard);
                return;
            }
            openConfirmationModal({
                title: "Reset Bill",
                message: "Clear current bill lines and reload the next bill number.",
                confirmLabel: "Reset Bill",
                tone: "danger",
                onConfirm: resetCurrentBill,
            });
            return;
        }

        if (shortcut.action === "route" && shortcut.route) {
            navigate(shortcut.route);
            return;
        }

        if (shortcut.action === "payment-options") {
            if (lines.length === 0) {
                toast.error("Add items to bill first");
                return;
            }
            openPrimaryPayFlow();
            return;
        }

        if (shortcut.action === "print") {
            const printGuard = getBillActionGuard({ action: "reprint", permissionRules });
            if (printGuard) {
                toast.error(printGuard);
                return;
            }
            if (lastCompletedSale) {
                printDocument("invoice");
                return;
            }

            toast.error("No completed bill available to print yet.");
        }
    }, [customerName, customerPhone, deliveryInfo, holdCurrentBill, lastCompletedSale, lines.length, navigate, note, openPrimaryPayFlow, openSecondaryPayFlow, openConfirmationModal, permissionRules, printDocument, referenceNo, resetCurrentBill, switchBillingMode]);

    useEffect(() => {
        const handleGlobalShortcut = (event) => {
            if (isAnyModalOpen) {
                return;
            }

            if (event.code === "F1") {
                event.preventDefault();
                openPrimaryPayFlow();
                return;
            }

            if (event.code === "F3") {
                event.preventDefault();
                openSecondaryPayFlow();
                return;
            }

            if (event.code === "F7") {
                event.preventDefault();
                switchBillingMode("cashpay");
                return;
            }

            if (event.code === "F8") {
                event.preventDefault();
                switchBillingMode("credit");
                return;
            }

            if (event.code === "F9") {
                event.preventDefault();
                switchBillingMode("advance");
                return;
            }

            if (event.ctrlKey && event.key === "Enter") {
                event.preventDefault();
                openConfirmationModal({
                    title: "Complete Bill",
                    message: `Save bill ${billNo || ""} for Rs. ${payableAmount.toFixed(2)}?`,
                    confirmLabel: saving ? "Saving..." : "Complete Bill",
                    onConfirm: completeSale,
                });
                return;
            }
            if (event.altKey && event.key.toLowerCase() === "h") {
                event.preventDefault();
                handleShortcutAction({ action: "hold" });
                return;
            }
            if (event.altKey && event.key.toLowerCase() === "b") {
                event.preventDefault();
                barcodeInputRef.current?.focus();
            }
        };

        window.addEventListener("keydown", handleGlobalShortcut);
        return () => window.removeEventListener("keydown", handleGlobalShortcut);
    }, [billNo, completeSale, handleShortcutAction, isAnyModalOpen, openConfirmationModal, openPrimaryPayFlow, openSecondaryPayFlow, payableAmount, saving, switchBillingMode]);

    const handleMobileShortcutSelect = useCallback((value) => {
        setMobileShortcutChoice(value);
        if (!value) return;
        const shortcut = activeShortcutLabels.find((entry) => `${entry.key}-${entry.label}` === value);
        if (shortcut) {
            handleShortcutAction(shortcut);
        }
        setTimeout(() => setMobileShortcutChoice(""), 0);
    }, [activeShortcutLabels, handleShortcutAction]);

    if (loading) {
        return <div style={{ padding: 24 }}>Loading POS billing desk...</div>;
    }

    return (
        <div className="container-fluid p-0 flex-grow-1 sales-pos-page" onKeyDown={handleEnterNavigation}>
            <div className="page-header card">
                <div className="card-body">
                    <div>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-2">
                                <li className="breadcrumb-item"><a href="/">Home</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Sales</li>
                            </ol>
                        </nav>
                        <p className="section-label">Sales</p>
                        <h1>POS Billing</h1>
                        <p className="mb-0 text-muted">Scan items, build the customer cart, collect payments, and complete retail billing quickly.</p>
                    </div>
                    <div className="page-header-actions">
                        {[
                            ["cashpay", "Cash"],
                            ["advance", "Advance"],
                            ["credit", "Credit"],
                        ].map(([mode, label]) => (
                            <button
                                key={mode}
                                className={`btn btn_style ${activeMode === mode ? "" : "inActive"}`}
                                type="button"
                                onClick={() => switchBillingMode(mode)}
                            >
                                <span>{label}</span>
                            </button>
                        ))}
                        <span className="metric-pill"><i className="bx bx-check-circle"></i> Ready</span>
                        <button className="btn btn_style" type="button" onClick={() => triggerBillingShortcut("cashpay")}>
                            <i className="bx bx-plus"></i><span>New</span>
                        </button>
                    </div>
                </div>
            </div>

            {statusMessage ? <div style={styles.statusMessage}>{statusMessage}</div> : null}

            <div className="pos-billing-page">
                <div className="pos-workspace-grid pos-lines-full">
                    <div className="sales-pos__desk">
                        <PosBillHeader
                            styles={styles}
                            customerName={customerName}
                            setCustomerModalOpen={setCustomerModalOpen}
                            currentDateLabel={currentDateLabel}
                            billNo={billNo}
                            setBillNo={setBillNo}
                            lastBillAmount={lastBillAmount}
                            salesmanLookupInput={salesmanLookupInput}
                            selectedSalesmanSummary={selectedSalesmanSummary}
                            applySalesmanLookup={applySalesmanLookup}
                            openSalesmanModalForCreate={openSalesmanModalForCreate}
                            setSalesmanModalOpen={setSalesmanModalOpen}
                            setSalesmanFormOpen={setSalesmanFormOpen}
                            lines={lines}
                            note={note}
                            setNote={setNote}
                            discountPercentInput={discountPercentInput}
                            setDiscountPercentInput={setDiscountPercentInput}
                            applyItemDiscountPercent={applyItemDiscountPercent}
                            barcodeInputRef={barcodeInputRef}
                            barcodeInput={barcodeInput}
                            setBarcodeInput={setBarcodeInput}
                            handleBarcodeSubmit={handleBarcodeSubmit}
                            handleBarcodeInputEnter={handleBarcodeInputEnter}
                            setSearchModalOpen={setSearchModalOpen}
                            setScannerStatus={setScannerStatus}
                            setScannerSessionKey={setScannerSessionKey}
                            setScannerModalOpen={setScannerModalOpen}
                            BILL_MODES={BILL_MODES}
                            activeMode={activeMode}
                            billingMode={billingMode}
                            permissionRules={permissionRules}
                            salesSettings={salesSettings}
                            activeSession={activeSession}
                            mobileShortcutChoice={mobileShortcutChoice}
                            handleMobileShortcutSelect={handleMobileShortcutSelect}
                            POS_SHORTCUTS={activeShortcutLabels}
                        />

                        <PosLineItemsTable
                            styles={styles}
                            lines={lines}
                            clampNumber={clampNumber}
                            BILL_MODES={BILL_MODES}
                            activeMode={activeMode}
                            updateLine={updateLine}
                            removeLine={removeLine}
                            isMeterUnit={isMeterUnit}
                            qtyInputRefs={qtyInputRefs}
                            meterInputRefs={meterInputRefs}
                            round2={round2}
                            stockWarnings={stockWarnings}
                            pendingQtyFocusLineId={pendingQtyFocusLineId}
                        />
                    </div>
                </div>

                <div className="pos-billing-bottom-grid">
                    <PosPaymentPanel
                        styles={styles}
                        activeMode={activeMode}
                        selectedExchangeItems={selectedExchangeItems}
                        round2={round2}
                        subtotal={subtotal}
                        discountPercent={discountPercent}
                        discountAmount={discountAmount}
                        itemDiscountAmount={itemDiscountAmount}
                        exchangeAmount={exchangeAmount}
                        paidAmount={paidAmount}
                        advanceAmount={advanceAmount}
                        payableAmount={payableAmount}
                        creditDue={creditDue}
                        loyaltySummary={loyaltySummary}
                        loyaltyRedeemPoints={loyaltyRedeemPoints}
                        setLoyaltyRedeemPoints={setLoyaltyRedeemPoints}
                        loyaltyRedeemAmount={loyaltyRedeemAmount}
                        loyaltySettings={appSettings.loyalty}
                        isLoyaltyMember={isLoyaltyMember}
                        openConfirmationModal={openConfirmationModal}
                        billNo={billNo}
                        saving={saving}
                        completeSale={completeSale}
                    />

                    <section className="card app-card pos-shortcut-rail">
                        <div className="card-body">
                            <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
                                <div><p className="section-label mb-1">Shortcuts</p><h2 className="h6 mb-0">Billing Actions</h2></div>
                                <div className="d-flex flex-wrap gap-2">
                                    <span className="text-muted">Customer: {customerName || "Walk-in"}</span>
                                    <span className="text-muted">Paid: Rs. {paidAmount.toFixed(2)}</span>
                                    <span className="text-muted">Due: Rs. {creditDue.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="pos-shortcut-grid">
                                {activeShortcutLabels.map((shortcut) => (
                                    <button
                                        key={`${shortcut.key}-${shortcut.label}`}
                                        className="quick-action pos-shortcut"
                                        type="button"
                                        onClick={() => handleShortcutAction(shortcut)}
                                    >
                                        <span className="status-badge status-primary">{shortcut.key}</span>
                                        <strong>{shortcut.label}</strong>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            <CashBillingModal
                isOpen={billingActionModal === "cash"}
                onClose={closeBillingFlow}
                payableAmount={tenderPayableAmount}
                lines={lines}
                onConfirm={runCashBillingFlow}
            />

            <CardUpiBillingModal
                isOpen={billingActionModal === "card-upi"}
                onClose={closeBillingFlow}
                payableAmount={tenderPayableAmount}
                paymentRows={paymentRows}
                onOpenPaymentOptions={() => openPaymentOptions("Card")}
                onConfirm={runCardUpiBillingFlow}
            />

            <PaymentModal
                key={selectedPaymentMode}
                isOpen={paymentModalOpen}
                onClose={() => setPaymentModalOpen(false)}
                paymentMethod={selectedPaymentMode}
                payableAmount={tenderPayableAmount}
                lines={lines}
                createPaymentRow={createPaymentRow}
                setActiveMode={setActiveMode}
                activeMode={activeMode}
                billingMode={billingMode}
                paymentRows={paymentRows}
                setPaymentRows={setPaymentRows}
                setManualAdvanceAmount={setManualAdvanceAmount}
                expectedDeliveryDate={advanceExpectedDeliveryDate}
                setExpectedDeliveryDate={setAdvanceExpectedDeliveryDate}
                creditDueDate={creditDueDate}
                setCreditDueDate={setCreditDueDate}
                onConfirm={completeSale}
                saving={saving}
            />

            {searchModalOpen ? (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div
                        className="modal fade show d-block"
                        id="posSearchItemModal"
                        tabIndex="-1"
                        role="dialog"
                        aria-modal="true"
                        aria-hidden="false"
                        onClick={() => setSearchModalOpen(false)}
                        onKeyDown={handleSearchModalKeyDown}
                    >
                        <div
                            className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title">Search Item</h5>
                                    <button type="button" className="btn-close" onClick={() => setSearchModalOpen(false)} aria-label="Close"></button>
                                </div>
                                <div className="modal-body">
                                    <form className="row g-3 mb-3" onSubmit={(event) => event.preventDefault()}>
                                        <div className="col-12 col-sm-6 col-xl-3">
                                            <label className="form-label">Item Name</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={searchFilters.itemName}
                                                onChange={(event) => setSearchFilters((current) => ({ ...current, itemName: event.target.value }))}
                                                placeholder="Enter Item Name"
                                            />
                                        </div>
                                        <div className="col-12 col-sm-6 col-xl-3">
                                            <label className="form-label">Category</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={searchFilters.category}
                                                onChange={(event) => setSearchFilters((current) => ({ ...current, category: event.target.value }))}
                                                placeholder="Enter Category"
                                            />
                                        </div>
                                        <div className="col-12 col-sm-6 col-xl-3">
                                            <label className="form-label">Brand</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={searchFilters.brand}
                                                onChange={(event) => setSearchFilters((current) => ({ ...current, brand: event.target.value }))}
                                                placeholder="Enter Brand"
                                            />
                                        </div>
                                        <div className="col-12 col-sm-6 col-xl-3">
                                            <label className="form-label">MRP</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={searchFilters.mrp}
                                                onChange={(event) => setSearchFilters((current) => ({ ...current, mrp: event.target.value }))}
                                                placeholder="Enter MRP"
                                            />
                                        </div>
                                        <div className="col-12 col-sm-6 col-xl-3">
                                            <label className="form-label">Sale Rate</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={searchFilters.saleRate}
                                                onChange={(event) => setSearchFilters((current) => ({ ...current, saleRate: event.target.value }))}
                                                placeholder="Enter Sale Rate"
                                            />
                                        </div>
                                    </form>
                                    <div className="table-responsive app-table-wrap">
                                        <table className="table app-table align-middle">
                                            <thead>
                                                <tr>
                                                    <th>Barcode</th>
                                                    <th>Item</th>
                                                    <th>Category</th>
                                                    <th>Brand</th>
                                                    <th>Stock</th>
                                                    <th>MRP</th>
                                                    <th>Sale Rate</th>
                                                    <th></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredInventory.length > 0 ? filteredInventory.map((item, index) => (
                                                    <tr
                                                        key={item._id}
                                                        ref={(node) => {
                                                            if (node) searchRowRefs.current.set(index, node);
                                                            else searchRowRefs.current.delete(index);
                                                        }}
                                                        className={activeSearchIndex === index ? "table-active" : ""}
                                                        onMouseEnter={() => setActiveSearchIndex(index)}
                                                    >
                                                        <td>{item.barcode || "-"}</td>
                                                        <td>{item.name}</td>
                                                        <td>{item.category?.name || "-"}</td>
                                                        <td>{item.brand?.name || "-"}</td>
                                                        <td>{item.stock}</td>
                                                        <td>{round2(item.mrp).toFixed(2)}</td>
                                                        <td>{round2(item.sellingRate).toFixed(2)}</td>
                                                        <td><button className="btn btn_style" type="button" onClick={() => addProductToBill(item)}>Add</button></td>
                                                    </tr>
                                                )) : (
                                                    <tr><td colSpan="8" className="text-center text-muted py-4">No items found.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}

            {scannerModalOpen ? (
                <Modal title="Scan QR / Barcode" onClose={closeScannerModal} width={560}>
                    <div style={styles.scannerBody}>
                        {scannerMode === "html5" ? (
                            <div key={`html5-${scannerSessionKey}`} id="sales-pos-html5-scanner" style={styles.scannerMount} />
                        ) : (
                            <video
                                key={`video-${scannerSessionKey}`}
                                ref={scannerVideoRef}
                                autoPlay
                                muted
                                playsInline
                                style={styles.scannerVideo}
                            />
                        )}
                        <div style={styles.scannerHint}>
                            {scannerStatus || "Opening camera..."}
                        </div>
                        {scannerCanUpload ? (
                            <div style={styles.scannerFallbackCard}>
                                <input
                                    ref={scannerFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handleScannerFilePick}
                                    style={{ display: "none" }}
                                />
                                <button
                                    type="button"
                                    style={styles.secondaryButton}
                                    onClick={() => scannerFileInputRef.current?.click()}
                                >
                                    Use Camera / Photo
                                </button>
                                <div style={styles.smallMuted}>
                                    On iPhone over local IP, live camera can be blocked unless the site is opened on HTTPS.
                                </div>
                            </div>
                        ) : null}
                        <div style={styles.summaryActions}>
                            <button type="button" style={styles.secondaryButton} onClick={closeScannerModal}>Close</button>
                        </div>
                    </div>
                </Modal>
            ) : null}

            {customerModalOpen && !customerFormOpen ? (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div
                        className="modal fade show d-block"
                        id="posCustomerModal"
                        tabIndex="-1"
                        role="dialog"
                        aria-modal="true"
                        aria-hidden="false"
                        onClick={() => setCustomerModalOpen(false)}
                        onKeyDown={handleCustomerModalKeyDown}
                    >
                        <div
                            className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title">Cash Customer Master</h5>
                                    <button type="button" className="btn-close" onClick={() => setCustomerModalOpen(false)} aria-label="Close"></button>
                                </div>
                                <div className="modal-body">
                                    <div className="customer-search-panel mb-3">
                                        <div className="row g-3 align-items-end">
                                            <div className="col-12 col-xl-7">
                                                <p className="section-label">Search Customer</p>
                                                <h6 className="customer-search-title">Find by phone number or name</h6>
                                            </div>
                                            <div className="col-12 col-xl-5">
                                                <div className="customer-action-toolbar">
                                                    <button className="btn btn_style" type="button" onClick={openAddCustomerForm}>
                                                        <i className="bx bx-user-plus"></i><span>Add Customer</span>
                                                    </button>
                                                    <button type="button" className="btn btn_style inActive" onClick={() => {
                                                        setCustomerId("");
                                                        setCustomerName("Cash Customer");
                                                        setCustomerPhone("");
                                                        setCustomerLocation("");
                                                        setCustomerDob("");
                                                        setCustomerAnniversary("");
                                                        setDeliveryInfo("");
                                                        setCustomerModalOpen(false);
                                                        setCustomerFormOpen(false);
                                                    }}>
                                                        <i className="bx bx-user-check"></i><span>Cash Customer</span>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="col-12">
                                                <div className="table-search w-100">
                                                    <i className="bx bx-search"></i>
                                                    <input
                                                        autoFocus
                                                        value={customerSearch}
                                                        onChange={(event) => setCustomerSearch(event.target.value)}
                                                        placeholder="Search by customer name or phone number"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="table-responsive app-table-wrap">
                                        <table className="table app-table align-middle customer-master-table mb-0">
                                            <thead>
                                                <tr>
                                                    <th>Customer Name</th>
                                                    <th>Phone</th>
                                                    <th>Location</th>
                                                    <th>Ledger</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredCustomers.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="5">No customers found for this search.</td>
                                                    </tr>
                                                ) : filteredCustomers.map((customer, index) => (
                                                    <tr
                                                        key={customer._id}
                                                        ref={(node) => {
                                                            if (node) customerRowRefs.current.set(index, node);
                                                            else customerRowRefs.current.delete(index);
                                                        }}
                                                        className={activeCustomerIndex === index ? "table-active" : ""}
                                                        onMouseEnter={() => setActiveCustomerIndex(index)}
                                                    >
                                                        <td>{customer.name || "-"}</td>
                                                        <td>{customer.phone || "-"}</td>
                                                        <td>{customer.location || "-"}</td>
                                                        <td>Rs. {round2(customer.ledgerBalance).toFixed(2)}</td>
                                                        <td>
                                                            <div className="d-flex flex-wrap gap-2">
                                                                <button type="button" className="btn btn_style" onClick={() => selectCustomer(customer)}>
                                                                    Select
                                                                </button>
                                                                <button type="button" className="btn btn_style inActive" onClick={() => openEditCustomerForm(customer)}>
                                                                    Edit
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}

            {customerFormOpen ? (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div
                        className="modal fade show d-block"
                        id="posAddCustomerModal"
                        tabIndex="-1"
                        role="dialog"
                        aria-modal="true"
                        aria-hidden="false"
                        onClick={() => setCustomerFormOpen(false)}
                    >
                        <div
                            className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title">Add Cash Customer</h5>
                                    <button type="button" className="btn-close" onClick={() => setCustomerFormOpen(false)} aria-label="Close"></button>
                                </div>
                                <div className="modal-body">
                                    <div className="customer-entry-panel">
                                        <div className="customer-entry-section">
                                            <h6 className="customer-entry-section-title">Customer Details</h6>
                                            <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                                                <div className="col-12 col-sm-6 col-xl-3">
                                                    <label className="form-label">Mobile No</label>
                                                    <input className="form-control" value={customerForm.phone} onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Enter Mobile No" />
                                                </div>
                                                <div className="col-12 col-sm-6 col-xl-3">
                                                    <label className="form-label">Cust ID</label>
                                                    <input className="form-control" value={customerForm.customerCode || "Auto"} readOnly placeholder="Auto" />
                                                </div>
                                                <div className="col-12 col-sm-6 col-xl-3">
                                                    <label className="form-label">Loyalty Card No</label>
                                                    <input className="form-control" value={customerForm.loyaltyCardNo || (customerForm.applyLoyalty ? "Auto on save" : "")} readOnly placeholder="Auto on apply" />
                                                </div>
                                                <div className="col-12 col-sm-6 col-xl-3">
                                                    <label className="form-label">Apply Loyalty</label>
                                                    <label className="form-check d-flex align-items-center gap-2 mt-2">
                                                        <input className="form-check-input" type="checkbox" checked={Boolean(customerForm.applyLoyalty)} onChange={(event) => setCustomerForm((current) => ({ ...current, applyLoyalty: event.target.checked }))} disabled={Boolean(customerForm.loyaltyCardNo)} />
                                                        <span className="form-check-label">Fee Rs. {Number(appSettings.loyalty?.enrollmentFee || 0).toFixed(2)}, +{Number(appSettings.loyalty?.enrollmentBonusPoints || 0)} pts</span>
                                                    </label>
                                                </div>
                                                <div className="col-12 col-sm-6 col-xl-3">
                                                    <label className="form-label">Customer Type</label>
                                                    <select className="form-select" value={customerForm.customerType} onChange={(event) => setCustomerForm((current) => ({ ...current, customerType: event.target.value }))}>
                                                        <option value="retail">Retail</option>
                                                        <option value="wholesale">Wholesale</option>
                                                        <option value="vip">VIP</option>
                                                    </select>
                                                </div>
                                                <div className="col-12 col-sm-6 col-xl-3">
                                                    <label className="form-label">Name</label>
                                                    <input className="form-control" value={customerForm.name} onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))} placeholder="Enter Name" />
                                                </div>
                                                <div className="col-12 col-sm-6 col-xl-3">
                                                    <label className="form-label">Credit Limit</label>
                                                    <input type="number" className="form-control" value={customerForm.creditLimit} onChange={(event) => setCustomerForm((current) => ({ ...current, creditLimit: event.target.value }))} placeholder="Enter Credit Limit" />
                                                </div>
                                                <div className="col-12 col-sm-6 col-xl-3">
                                                    <label className="form-label">Segments</label>
                                                    <input className="form-control" value={customerForm.segmentTags} onChange={(event) => setCustomerForm((current) => ({ ...current, segmentTags: event.target.value }))} placeholder="VIP, Birthday" />
                                                </div>
                                                <div className="col-12 col-sm-6 col-xl-3">
                                                    <label className="form-label">Area</label>
                                                    <input className="form-control" value={customerForm.area} onChange={(event) => setCustomerForm((current) => ({ ...current, area: event.target.value }))} placeholder="Enter Area" />
                                                </div>
                                                <div className="col-12 col-sm-6 col-xl-3">
                                                    <label className="form-label">Birth Date</label>
                                                    <input type="date" className="form-control" value={customerForm.dateOfBirth} onChange={(event) => setCustomerForm((current) => ({ ...current, dateOfBirth: event.target.value }))} />
                                                </div>
                                                <div className="col-12 col-sm-6 col-xl-3">
                                                    <label className="form-label">Anniversary</label>
                                                    <input type="date" className="form-control" value={customerForm.anniversary} onChange={(event) => setCustomerForm((current) => ({ ...current, anniversary: event.target.value }))} />
                                                </div>
                                            </form>
                                        </div>
                                        <div className="customer-entry-section mt-3">
                                            <h6 className="customer-entry-section-title">B2B Details</h6>
                                            <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                                                <div className="col-12 col-sm-6 col-xl-3">
                                                    <label className="form-label">GSTIN</label>
                                                    <input className="form-control" value={customerForm.gstin} onChange={(event) => setCustomerForm((current) => ({ ...current, gstin: event.target.value }))} placeholder="Enter GSTIN" />
                                                </div>
                                                <div className="col-12 col-lg-4 d-flex align-items-end">
                                                    <button className="btn btn_style w-100" type="button" onClick={fetchCustomerGstinDetails}>
                                                        <i className="bx bx-search-alt"></i><span>Get Details By GSTIN</span>
                                                    </button>
                                                </div>
                                                <div className="col-12 col-sm-6 col-xl-3">
                                                    <label className="form-label">Trade Name</label>
                                                    <input className="form-control" value={customerForm.tradeName} onChange={(event) => setCustomerForm((current) => ({ ...current, tradeName: event.target.value }))} placeholder="Enter Trade Name" />
                                                </div>
                                                <div className="col-12 col-sm-6 col-xl-3">
                                                    <label className="form-label">Legal Name</label>
                                                    <input className="form-control" value={customerForm.legalName} onChange={(event) => setCustomerForm((current) => ({ ...current, legalName: event.target.value }))} placeholder="Enter Legal Name" />
                                                </div>
                                                <div className="col-12 col-sm-6 col-xl-3">
                                                    <label className="form-label">Address</label>
                                                    <input className="form-control" value={customerForm.address} onChange={(event) => setCustomerForm((current) => ({ ...current, address: event.target.value }))} placeholder="Enter Address" />
                                                </div>
                                                <div className="col-12 col-sm-6 col-xl-3">
                                                    <label className="form-label">City</label>
                                                    <input className="form-control" value={customerForm.city} onChange={(event) => setCustomerForm((current) => ({ ...current, city: event.target.value }))} placeholder="Enter City" />
                                                </div>
                                                <div className="col-12 col-sm-6 col-xl-3">
                                                    <label className="form-label">Pin Code</label>
                                                    <input className="form-control" value={customerForm.pincode} onChange={(event) => setCustomerForm((current) => ({ ...current, pincode: event.target.value }))} placeholder="Enter Pin Code" />
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                    {/* <div className="customer-entry-actions mt-3">
                                        <button type="button" className="btn btn_style inActive" onClick={() => handleCustomerFormAction("save")}>Save</button>
                                        <button type="button" className="btn btn_style" onClick={() => handleCustomerFormAction("add")}>Add</button>
                                        <button type="button" className="btn btn_style inActive" onClick={() => handleCustomerFormAction("edit")}>Edit</button>
                                        <button type="button" className="btn btn_style inActive" onClick={() => handleCustomerFormAction("cancel")}>Cancel</button>
                                        <button type="button" className="btn btn_style" onClick={() => handleCustomerFormAction("search")}>Search</button>
                                        <button type="button" className="btn btn_style inActive" onClick={() => handleCustomerFormAction("delete")}>Delete</button>
                                        <button type="button" className="btn btn_style" onClick={() => handleCustomerFormAction("exit")}>Exit</button>
                                        <button type="button" className="btn btn_style inActive" onClick={() => handleCustomerFormAction("list")}>List</button>
                                        <button type="button" className="btn btn_style inActive" onClick={() => handleCustomerFormAction("export full list")}><i className="bx bx-export"></i><span>Export Full List</span></button>
                                        <button type="button" className="btn btn_style inActive" onClick={() => handleCustomerFormAction("export by date")}><i className="bx bx-export"></i><span>Export By Date</span></button>
                                        <button type="button" className="btn btn_style inActive" onClick={() => handleCustomerFormAction("plain")}><i className="bx bx-export"></i><span>Plain</span></button>
                                        <button type="button" className="btn btn_style inActive" onClick={() => handleCustomerFormAction("contact")}><i className="bx bx-id-card"></i><span>Contact</span></button>
                                        <button type="button" className="btn btn_style inActive" onClick={() => handleCustomerFormAction("by date")}><i className="bx bx-calendar"></i><span>By Date</span></button>
                                    </div> */}
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn_style inActive" onClick={() => setCustomerFormOpen(false)}>Back to Customer Search</button>
                                    <button type="button" className="btn btn_style" onClick={() => handleCustomerFormAction("save")}><i className="bx bx-save"></i><span>Save Customer</span></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}

            {salesmanModalOpen && !salesmanFormOpen ? (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div
                        className="modal fade show d-block"
                        id="posSalesmanModal"
                        tabIndex="-1"
                        role="dialog"
                        aria-modal="true"
                        aria-hidden="false"
                        onClick={() => setSalesmanModalOpen(false)}
                        onKeyDown={handleSalesmanModalKeyDown}
                    >
                        <div
                            className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title">Salesman Master</h5>
                                    <button type="button" className="btn-close" onClick={() => setSalesmanModalOpen(false)} aria-label="Close"></button>
                                </div>
                                <div className="modal-body">
                                    <div className="salesman-search-panel mb-3">
                                        <div className="row g-3 align-items-end">
                                            <div className="col-12 col-xl-8">
                                                <p className="section-label">Search Salesman</p>
                                                <h6 className="salesman-search-title">Find by ID, name, or phone</h6>
                                            </div>
                                            <div className="col-12 col-xl-4">
                                                <div className="salesman-action-toolbar">
                                                    <button className="btn btn_style" type="button" onClick={openAddSalesmanForm}>
                                                        <i className="bx bx-user-plus"></i><span>Add Salesman</span>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="col-12">
                                                <div className="table-search w-100">
                                                    <i className="bx bx-search"></i>
                                                    <input
                                                        autoFocus
                                                        value={salesmanSearch}
                                                        onChange={(event) => setSalesmanSearch(event.target.value)}
                                                        placeholder="Search by salesman ID, name, or phone"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="table-responsive app-table-wrap">
                                        <table className="table app-table align-middle salesman-list-table mb-0">
                                            <thead>
                                                <tr>
                                                    <th>ID</th>
                                                    <th>Name</th>
                                                    <th>Phone</th>
                                                    <th>Area</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredSalespeople.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="5">No salesmen found for this search.</td>
                                                    </tr>
                                                ) : filteredSalespeople.map((person, index) => (
                                                    <tr
                                                        key={person._id}
                                                        ref={(node) => {
                                                            if (node) salesmanRowRefs.current.set(index, node);
                                                            else salesmanRowRefs.current.delete(index);
                                                        }}
                                                        className={activeSalesmanIndex === index ? "table-active" : ""}
                                                        onMouseEnter={() => setActiveSalesmanIndex(index)}
                                                    >
                                                        <td>{person.salesmanCode || person.code || index + 1}</td>
                                                        <td>{person.name || "-"}</td>
                                                        <td>{person.phone || "-"}</td>
                                                        <td>{person.location || person.area || "-"}</td>
                                                        <td>
                                                            <div className="d-flex flex-wrap gap-2">
                                                                <button type="button" className="btn btn_style" onClick={() => selectSalesman(person)}>
                                                                    Select
                                                                </button>
                                                                <button type="button" className="btn btn_style inActive" onClick={() => openEditSalesmanForm(person)}>
                                                                    Edit
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}

            {salesmanFormOpen ? (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div
                        className="modal fade show d-block"
                        id="posAddSalesmanModal"
                        tabIndex="-1"
                        role="dialog"
                        aria-modal="true"
                        aria-hidden="false"
                        onClick={() => setSalesmanFormOpen(false)}
                    >
                        <div
                            className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title">Salesman Master</h5>
                                    <button type="button" className="btn-close" onClick={() => setSalesmanFormOpen(false)} aria-label="Close"></button>
                                </div>
                                <div className="modal-body">
                                    <div className="card app-card">
                                        <div className="card-body">
                                            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                                                <div>
                                                    <p className="section-label mb-1">Salesman Form</p>
                                                    <h6 className="salesman-search-title">Salesman Master</h6>
                                                </div>
                                                <button className="btn btn_style inActive" type="button" onClick={() => setSalesmanFormOpen(false)}>
                                                    Back To Search
                                                </button>
                                            </div>
                                            <div className="salesman-form-card">
                                                <form className="row g-3 align-items-end" onSubmit={(event) => event.preventDefault()}>
                                                    <div className="col-12 col-sm-6 col-xl-3">
                                                        <label className="form-label">Salesman ID</label>
                                                        <input
                                                            className="form-control"
                                                            value={salesmanForm.salesmanCode}
                                                            onChange={(event) => setSalesmanForm((current) => ({ ...current, salesmanCode: event.target.value }))}
                                                            placeholder="Enter Salesman ID"
                                                        />
                                                    </div>
                                                    <div className="col-12 col-sm-6 col-xl-3">
                                                        <label className="form-label">Name</label>
                                                        <input
                                                            className="form-control"
                                                            value={salesmanForm.name}
                                                            onChange={(event) => setSalesmanForm((current) => ({ ...current, name: event.target.value }))}
                                                            placeholder="Enter Name"
                                                        />
                                                    </div>
                                                    <div className="col-12 col-sm-6 col-xl-3">
                                                        <label className="form-label">Mobile No</label>
                                                        <input
                                                            className="form-control"
                                                            value={salesmanForm.phone}
                                                            onChange={(event) => setSalesmanForm((current) => ({ ...current, phone: event.target.value }))}
                                                            placeholder="Enter Mobile No"
                                                        />
                                                    </div>
                                                    <div className="col-12 col-sm-6 col-xl-3">
                                                        <label className="form-label">Area</label>
                                                        <input
                                                            className="form-control"
                                                            value={salesmanForm.location}
                                                            onChange={(event) => setSalesmanForm((current) => ({ ...current, location: event.target.value }))}
                                                            placeholder="Enter Area"
                                                        />
                                                    </div>
                                                    <div className="col-12 col-sm-6 col-xl-3">
                                                        <label className="form-label">Note</label>
                                                        <input
                                                            className="form-control"
                                                            value={salesmanForm.notes}
                                                            onChange={(event) => setSalesmanForm((current) => ({ ...current, notes: event.target.value }))}
                                                            placeholder="Enter Note"
                                                        />
                                                    </div>
                                                </form>
                                                <div className="salesman-form-actions mt-3">
                                                    <button type="button" className="btn btn_style" onClick={() => handleSalesmanFormAction("save")}>Save</button>
                                                    <button type="button" className="btn btn_style" onClick={() => handleSalesmanFormAction("add")}>Add</button>
                                                    <button type="button" className="btn btn_style inActive" onClick={() => handleSalesmanFormAction("edit")}>Edit</button>
                                                    <button type="button" className="btn btn_style inActive" onClick={() => handleSalesmanFormAction("search")}>Search</button>
                                                    <button type="button" className="btn btn_style inActive" onClick={() => handleSalesmanFormAction("delete")}>Delete</button>
                                                    <button type="button" className="btn btn_style inActive" onClick={() => handleSalesmanFormAction("list")}>List</button>
                                                    <button type="button" className="btn btn_style" onClick={() => handleSalesmanFormAction("exit")}>Exit</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}

            {exchangeModalOpen ? (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div
                        className="modal fade show d-block"
                        id="posExchangeModal"
                        tabIndex="-1"
                        role="dialog"
                        aria-modal="true"
                        aria-hidden="false"
                        onClick={() => setExchangeModalOpen(false)}
                    >
                        <div
                            className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title">Exchange Lookup</h5>
                                    <button type="button" className="btn-close" onClick={() => setExchangeModalOpen(false)} aria-label="Close"></button>
                                </div>
                                <div className="modal-body">
                                    <form className="row g-3 mb-3" onSubmit={(event) => event.preventDefault()}>
                                        <div className="col-12 col-sm-6 col-xl-3">
                                            <label className="form-label">Bill No</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={exchangeFilters.billNo}
                                                onChange={(event) => setExchangeFilters((current) => ({ ...current, billNo: event.target.value }))}
                                                placeholder="Enter Bill No"
                                            />
                                        </div>
                                        <div className="col-12 col-sm-6 col-xl-3">
                                            <label className="form-label">Customer</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={exchangeFilters.customer}
                                                onChange={(event) => setExchangeFilters((current) => ({ ...current, customer: event.target.value }))}
                                                placeholder="Enter Customer"
                                            />
                                        </div>
                                        <div className="col-12 col-sm-6 col-xl-3">
                                            <label className="form-label">Barcode</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={exchangeFilters.barcode}
                                                onChange={(event) => setExchangeFilters((current) => ({ ...current, barcode: event.target.value }))}
                                                placeholder="Enter Barcode"
                                            />
                                        </div>
                                        <div className="col-12 col-sm-6 col-xl-3">
                                            <label className="form-label">Item Name</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={exchangeFilters.itemName}
                                                onChange={(event) => setExchangeFilters((current) => ({ ...current, itemName: event.target.value }))}
                                                placeholder="Enter Item Name"
                                            />
                                        </div>
                                    </form>
                                    <div className="table-responsive app-table-wrap">
                                        <table className="table app-table align-middle">
                                            <thead>
                                                <tr>
                                                    <th>Bill</th>
                                                    <th>Customer</th>
                                                    <th>Item</th>
                                                    <th>Barcode</th>
                                                    <th>Remaining</th>
                                                    <th>Rate</th>
                                                    <th></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredExchangeSales.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="7" className="text-center text-muted py-4">No exchange items found.</td>
                                                    </tr>
                                                ) : filteredExchangeSales.flatMap((sale) =>
                                                    (sale.items || [])
                                                        .filter((item) => clampNumber(item.remainingQty ?? (item.qty - (item.returnedQty || 0))) > 0)
                                                        .map((item) => {
                                                            const key = `${sale._id}-${item._id}`;
                                                            const selected = selectedExchangeItems.find((entry) => entry.key === key);
                                                            const remainingQty = clampNumber(item.remainingQty ?? (item.qty - (item.returnedQty || 0)));

                                                            return (
                                                                <tr key={key}>
                                                                    <td>{sale.billNo || sale.invoiceNo || "-"}</td>
                                                                    <td>{sale.customer || "Walk-in"}</td>
                                                                    <td>{item.itemName || item.itemId?.name || "-"}</td>
                                                                    <td>{item.barcode || "-"}</td>
                                                                    <td>{remainingQty}</td>
                                                                    <td>{round2(item.sellingRate).toFixed(2)}</td>
                                                                    <td>
                                                                        {selected ? (
                                                                            <div className="d-flex flex-wrap gap-2 align-items-center">
                                                                                <input
                                                                                    type="text"
                                                                                    inputMode="decimal"
                                                                                    className="form-control form-control-sm"
                                                                                    value={selected.qty}
                                                                                    onChange={(event) => updateExchangeQty(key, event.target.value)}
                                                                                    style={{ width: 72 }}
                                                                                />
                                                                                <button type="button" className="btn btn_style inActive" onClick={() => toggleExchangeItem(sale, item)}>Remove</button>
                                                                            </div>
                                                                        ) : (
                                                                            <button type="button" className="btn btn_style" onClick={() => toggleExchangeItem(sale, item)}>Select</button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}

            {holdModalOpen ? (
                <>
                    <div className="modal-backdrop fade show"></div>

                    <div
                        className="modal fade show d-block"
                        id="posHeldBillsModal"
                        tabIndex="-1"
                        role="dialog"
                        aria-modal="true"
                        aria-hidden="false"
                        onClick={() => setHoldModalOpen(false)}
                    >
                        <div
                            className="modal-dialog modal-lg modal-dialog-centered"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title">Held Bills</h5>
                                    <button
                                        type="button"
                                        className="btn-close"
                                        onClick={() => setHoldModalOpen(false)}
                                        aria-label="Close"
                                    ></button>
                                </div>

                                <div className="modal-body quick-action-list">
                                    {heldBills.length > 0 ? (
                                        heldBills.map((bill, index) => (
                                            <div
                                                className={`quick-action justify-content-between ${activeHeldBillIndex === index ? "active" : ""
                                                    }`}
                                                key={bill._id || bill.id || index}
                                                ref={(node) => {
                                                    if (node) heldBillRefs.current.set(index, node);
                                                    else heldBillRefs.current.delete(index);
                                                }}
                                                onMouseEnter={() => setActiveHeldBillIndex(index)}
                                            >
                                                <span>
                                                    <strong>{bill.billNo || bill.holdNo || `Hold ${index + 1}`}</strong>
                                                    <small className="d-block text-muted">
                                                        {bill.customer || "Walk-in"} - {(bill.items || []).length} items
                                                    </small>
                                                </span>

                                                <button
                                                    className="btn btn_style"
                                                    type="button"
                                                    onClick={() => recallHeldBill(bill)}
                                                >
                                                    Recall
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-muted mb-0">No held bills found.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}

            {discountModalOpen ? (
                <Modal title="Discount Controls" onClose={() => setDiscountModalOpen(false)} width={520}>
                    <div style={{ display: "grid", gap: 12 }}>
                        <div style={styles.discountInfo}>Bill-level discount up to {permissionRules.maxBillDiscountPercent}% for role `{role}`.</div>
                        <Field label="Bill Discount %" type="number" value={discountPercent} onChange={setDiscountPercent} />
                        <button type="button" style={styles.primaryButton} onClick={() => applyBillDiscount(discountPercent)}>Apply Bill Discount</button>
                    </div>
                </Modal>
            ) : null}

            {sessionModalOpen && salesSettings.useDayEnd ? (
                <Modal title={activeSession ? "Close POS Session" : "Open POS Session"} onClose={() => setSessionModalOpen(false)} width={620}>
                    <div style={{ display: "grid", gap: 14 }}>
                        {activeSession ? (
                            <>
                                <div style={styles.summaryPreview}>
                                    <SummaryLine label="Session" value={activeSession.sessionNo} />
                                    <SummaryLine label="Opened At" value={new Date(activeSession.openedAt).toLocaleString()} />
                                    <SummaryLine label="Opening Cash" value={`Rs. ${round2(activeSession.openingCash).toFixed(2)}`} />
                                </div>
                                <Field label="Closing Cash" type="number" value={sessionForm.closingCash} onChange={(value) => setSessionForm((current) => ({ ...current, closingCash: value }))} />
                                <Field label="Expenses" type="number" value={sessionForm.expenseAmount} onChange={(value) => setSessionForm((current) => ({ ...current, expenseAmount: value }))} />
                                <Field label="Expense Note" value={sessionForm.expenseNote} onChange={(value) => setSessionForm((current) => ({ ...current, expenseNote: value }))} as="textarea" />
                                <div style={styles.summaryActions}>
                                    <button type="button" style={styles.primaryButton} onClick={closeSession} disabled={!permissionRules.canCloseSession}>Close Session</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <Field label="Opening Cash" type="number" value={sessionForm.openingCash} onChange={(value) => setSessionForm((current) => ({ ...current, openingCash: value }))} />
                                <div style={styles.summaryActions}>
                                    <button type="button" style={styles.primaryButton} onClick={openSession}>Open Session</button>
                                </div>
                            </>
                        )}
                    </div>
                </Modal>
            ) : null}

            {printModalOpen && lastCompletedSale ? (
                <Modal
                    title="Invoice Saved"
                    onClose={() => setPrintModalOpen(false)}
                    width={760}
                    initialFocusSelector='button[data-print-invoice-primary="true"]'
                    returnFocusRef={barcodeInputRef}
                >
                    <div style={{ display: "grid", gap: 18 }}>
                        <div style={styles.summaryPreview}>
                            <SummaryLine label="Mode" value={lastCompletedSale.billingMode || "CASH"} />
                            <SummaryLine label="Bill No" value={lastCompletedSale.displayBillNo || lastCompletedSale.billNo || "-"} />
                            <SummaryLine label="Customer" value={lastCompletedSale.customer || "Walk-in"} />
                            <SummaryLine label="Phone" value={lastCompletedSale.customerPhone || "-"} />
                            <SummaryLine label="Net Amount" value={`Rs. ${round2(lastCompletedSale.totalAmount).toFixed(2)}`} />
                        </div>
                        <div style={styles.summaryActions}>
                            <button type="button" data-print-invoice-primary="true" style={styles.secondaryButton} onClick={() => printDocument("invoice")} disabled={!permissionRules.canReprintBill}>Print Invoice</button>
                            <button type="button" style={styles.secondaryButton} onClick={() => printDocument("invoice")} disabled={!permissionRules.canReprintBill}>Print Bill</button>
                            <button type="button" style={styles.primaryButton} onClick={sendWhatsAppBill} disabled={sendingWhatsApp}>
                                {sendingWhatsApp ? "Sending..." : "Send WhatsApp"}
                            </button>
                        </div>
                        {!whatsappStatus.enabled && whatsappStatus.message ? <div style={styles.smallMuted}>{whatsappStatus.message}</div> : null}
                    </div>
                </Modal>
            ) : null}

            {confirmationState.open ? (
                <Modal
                    title={confirmationState.title}
                    onClose={cancelConfirmationModal}
                    width={520}
                    initialFocusSelector='button[data-confirm-yes="true"]'
                    returnFocusRef={barcodeInputRef}
                    onKeyDown={(event) => {
                        if (event.altKey || event.ctrlKey || event.metaKey) {
                            return;
                        }

                        if (event.key === "y" || event.key === "Y") {
                            event.preventDefault();
                            void confirmModalAction();
                            return;
                        }

                        if (event.key === "n" || event.key === "N") {
                            event.preventDefault();
                            void declineConfirmationModal();
                        }
                    }}
                >
                    <div style={{ display: "grid", gap: 16 }}>
                        <div style={styles.smallMuted}>{confirmationState.message}</div>
                        <div style={styles.summaryActions}>
                            <button type="button" style={styles.secondaryButton} onClick={cancelConfirmationModal}>
                                {confirmationState.cancelLabel || "Cancel"}
                            </button>
                            <button type="button" style={styles.secondaryButton} onClick={declineConfirmationModal}>
                                {confirmationState.noLabel || "No"}
                            </button>
                            <button
                                type="button"
                                data-confirm-yes="true"
                                style={confirmationState.tone === "danger" ? styles.dangerButton : styles.primaryButton}
                                onClick={confirmModalAction}
                            >
                                {confirmationState.confirmLabel}
                            </button>
                        </div>
                    </div>
                </Modal>
            ) : null}

            {broadcastModalOpen ? (
                <Modal title="WhatsApp Broadcast" onClose={() => setBroadcastModalOpen(false)} width={760}>
                    <div style={{ display: "grid", gap: 16 }}>
                        <div style={styles.smallMuted}>This sends the same message to opted-in customer numbers available in the customer master.</div>
                        <Field label="Broadcast Message" value={broadcastMessage} onChange={setBroadcastMessage} as="textarea" />
                        <div style={styles.summaryActions}>
                            <button type="button" style={styles.secondaryButton} onClick={() => setBroadcastModalOpen(false)}>Cancel</button>
                            <button type="button" style={styles.primaryButton} onClick={sendBroadcast} disabled={sendingBroadcast}>
                                {sendingBroadcast ? "Sending..." : "Send Broadcast"}
                            </button>
                        </div>
                    </div>
                </Modal>
            ) : null}
        </div>
    );
};

// const modeTab = (active) => ({
//     border: "none",
//     borderRadius: 999,
//     padding: "12px 16px",
//     background: active ? "linear-gradient(135deg, #16281f 0%, #2f4d3d 100%)" : "#f3f5f2",
//     color: active ? "#fff" : "var(--text-main)",
//     fontWeight: 800,
//     cursor: "pointer",
// });

export default SalesPOS;
