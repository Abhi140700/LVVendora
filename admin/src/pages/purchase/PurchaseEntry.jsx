import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import useAppSettings from "../../hooks/useAppSettings";
import { getCompanyName } from "../../utils/appSettings";
import { notifyError, notifyInfo, notifySuccess } from "../../utils/notify";
import { ROLE_GROUPS, getCurrentRole, hasRole } from "../../utils/permissions";
import { UNIT_OPTIONS, normalizeUnit } from "../../utils/unit";
import {
    API_BASE,
    COMPANY_STATE_CODE,
    COMPANY_STATE_NAME,
    DECIMAL_INPUT_PATTERN,
    DETAILED_ENTITY_TYPES,
    ENTITY_LABELS,
    GST_ENABLED_ENTITY_TYPES,
    GST_OPTIONS,
    PURCHASE_DRAFT_KEY,
    buildRowErrors,
    createEmptyItem,
    emptyInsight,
    fetchWithAuth,
    findByName,
    getEditableNumericValue,
    getInputMode,
    hasMeaningfulItemContent,
    initialModalState,
    initialSaveConfirmState,
    isMeterCategory,
    normalizeInputType,
    normalizeName,
    parseNumericValue,
    recalculateItem,
    round2,
} from "./purchaseEntryUtils";

import styles from "./purchaseEntryStyles";
const PurchaseEntry = () => {
    const currentRole = getCurrentRole();
    const canDeletePurchase = hasRole(currentRole, ROLE_GROUPS.adminOnly);
    const navigate = useNavigate();
    const { id: purchaseId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const appSettings = useAppSettings();
    const companyName = appSettings.companyName || getCompanyName();
    const purchaseSettings = appSettings.purchase || {};
    const defaultPurchaseGstRate = purchaseSettings.defaultGst ? 5 : 0;
    const today = new Date().toISOString().split("T")[0];
    const emptyDuplicateBillCheck = {
        loading: false,
        checked: false,
        duplicate: false,
        record: null,
        message: "",
    };
    const refs = useRef({});
    const billScanInputRef = useRef(null);
    const saveConfirmYesRef = useRef(null);
    const [grnNo, setGrnNo] = useState("");

    const [receiveDate, setReceiveDate] = useState(today);
    const [lrId, setLrId] = useState("");
    const [lrNo, setLrNo] = useState("");
    const [bale, setBale] = useState("");
    const [transporter, setTransporter] = useState("");
    const [firm, setFirm] = useState(() => companyName);
    const [party, setParty] = useState("");
    const [selectedParty, setSelectedParty] = useState(null);
    const [partyStateCode, setPartyStateCode] = useState(COMPANY_STATE_CODE);
    const [supplierAgent, setSupplierAgent] = useState("");
    const [transporterId, setTransporterId] = useState("");
    const [firmId, setFirmId] = useState("");
    const [partyId, setPartyId] = useState("");
    const [supplierAgentId, setSupplierAgentId] = useState("");
    const [billDate, setBillDate] = useState(today);
    const [billNo, setBillNo] = useState("");
    const [billAmount, setBillAmount] = useState("");
    const [gstOn, setGstOn] = useState("Bill Total");
    const [godown, setGodown] = useState("");
    const [inwardDate, setInwardDate] = useState(today);
    const [hundekari, setHundekari] = useState("");
    const [transportCharges, setTransportCharges] = useState(0);
    const [hamaliCharges, setHamaliCharges] = useState(0);
    const [narration, setNarration] = useState("");

    const [items, setItems] = useState([createEmptyItem()]);
    const [discountTotal, setDiscountTotal] = useState(0);
    const [addCharges, setAddCharges] = useState(0);
    const [gstRate, setGstRate] = useState(defaultPurchaseGstRate);
    const [commission, setCommission] = useState(0);
    const [packingRoundoff, setPackingRoundoff] = useState(0);

    const [parties, setParties] = useState([]);
    const [transporters, setTransporters] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [firms, setFirms] = useState([]);
    const [categories, setCategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [itemMasters, setItemMasters] = useState([]);

    const [activeCreateTarget, setActiveCreateTarget] = useState({ type: "party", rowId: null });
    const [modalState, setModalState] = useState(initialModalState);
    const [saveConfirmState, setSaveConfirmState] = useState(initialSaveConfirmState);
    const [loadingMasters, setLoadingMasters] = useState(false);
    const [savingPurchase, setSavingPurchase] = useState(false);
    const [loadingPurchase, setLoadingPurchase] = useState(false);
    const [partyInsights, setPartyInsights] = useState(emptyInsight);
    const [duplicateBillCheck, setDuplicateBillCheck] = useState(emptyDuplicateBillCheck);
    const [allowBillVariance, setAllowBillVariance] = useState(false);
    const [pasteModalOpen, setPasteModalOpen] = useState(false);
    const [pasteValue, setPasteValue] = useState("");
    const [attachments, setAttachments] = useState([]);
    const [billScanText, setBillScanText] = useState("");
    const [billScanPreview, setBillScanPreview] = useState(null);
    const [billScanLoading, setBillScanLoading] = useState(false);
    const [purchaseHistoryRecords, setPurchaseHistoryRecords] = useState([]);
    const [activeHistoryRowId, setActiveHistoryRowId] = useState(null);
    const [statusMessage, setStatusMessage] = useState("");
    const [showMrpPreview, setShowMrpPreview] = useState(false);
    const [draftHydrated, setDraftHydrated] = useState(Boolean(purchaseId));
    const pendingLrIdFromQuery = searchParams.get("lrId") || "";
    const sortByName = useCallback((rows = []) => [...rows].sort((a, b) => normalizeName(a.name).localeCompare(normalizeName(b.name))), []);

    const subtotal = useMemo(
        () => items.reduce((sum, item) => sum + (Number(item.total) || 0), 0),
        [items]
    );
    const taxableAmount = subtotal - Number(discountTotal || 0);

    const isIntraState = partyStateCode === COMPANY_STATE_CODE;
    const cgst = isIntraState ? (taxableAmount * Number(gstRate || 0)) / 200 : 0;
    const sgst = isIntraState ? (taxableAmount * Number(gstRate || 0)) / 200 : 0;
    const igst = isIntraState ? 0 : (taxableAmount * Number(gstRate || 0)) / 100;
    const totalGst = cgst + sgst + igst;
    const gstDisplayLabel = isIntraState ? "CGST+SGST" : "IGST";
    const gstDisplayValue = isIntraState ? cgst + sgst : igst;
    const totalBeforeRoundoff = taxableAmount
        + totalGst
        + Number(addCharges || 0)
        + Number(commission || 0)
        + Number(hamaliCharges || 0);
    const computedPackingRoundoff = round2(Math.round(totalBeforeRoundoff) - totalBeforeRoundoff);
    const finalTotal = totalBeforeRoundoff + computedPackingRoundoff;
    const netQty = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    const billVariance = Number(billAmount || 0) - Number(finalTotal || 0);
    const rowsForValidation = useMemo(
        () => items.filter((item) => hasMeaningfulItemContent(item)),
        [items]
    );
    const rowErrors = useMemo(
        () => items.map((item) => buildRowErrors(item, purchaseSettings.hsnMandatory)),
        [items, purchaseSettings.hsnMandatory]
    );
    const rowErrorById = useMemo(
        () => new Map(items.map((item, index) => [item.id, rowErrors[index] || {}])),
        [items, rowErrors]
    );

    useEffect(() => {
        setPackingRoundoff((current) => (
            round2(current) === computedPackingRoundoff ? current : computedPackingRoundoff
        ));
    }, [computedPackingRoundoff]);

    const renderMobileItemCard = (item, index) => {
        const itemError = rowErrorById.get(item.id) || {};

        return (
            <article key={`mobile-${item.id}`} style={styles.mobileItemCard} className="app-card">
                <div style={styles.mobileItemCardHeader}>
                    <div>
                        <div style={styles.mobileItemIndex}>Item {index + 1}</div>
                        <div style={styles.subtleText}>{item.name || "New line item"}</div>
                    </div>
                    <button type="button" onClick={() => removeItem(item.id)} style={styles.rowDeleteButton}>
                        X
                    </button>
                </div>

                <div style={styles.mobileItemGrid} className="purchase-entry__mobile-item-grid">
                    <label style={styles.detailField}>
                        <span style={styles.detailLabel}>Category *</span>
                        <div style={styles.inlineField}>
                            <input
                                value={item.category}
                                list="categories-list"
                                ref={(el) => { refs.current[`${item.id}-category-mobile`] = el; }}
                                onFocus={() => {
                                    setActiveCreateTarget({ type: "category", rowId: item.id });
                                    setActiveHistoryRowId(item.id);
                                }}
                                onChange={(e) => updateItem(item.id, "category", e.target.value)}
                                onBlur={(e) => updateItem(item.id, "category", e.target.value)}
                                onKeyDown={(e) => handleItemKeyDown(e, item.id, "category", "-mobile")}
                                placeholder="Category"
                                style={itemError.category ? styles.errorCellInput : styles.detailInput}
                            />
                            <button type="button" onClick={() => openCreateModal("category", item.id)} style={styles.plusButton}>+</button>
                        </div>
                    </label>

                    <label style={styles.detailField}>
                        <span style={styles.detailLabel}>HSN Code</span>
                        <input
                            value={item.hsn}
                            ref={(el) => { refs.current[`${item.id}-hsn-mobile`] = el; }}
                            onFocus={() => setActiveHistoryRowId(item.id)}
                            onChange={(e) => updateItem(item.id, "hsn", e.target.value)}
                            onKeyDown={(e) => handleItemKeyDown(e, item.id, "hsn", "-mobile")}
                            style={itemError.hsn ? styles.errorDetailInput : styles.detailInput}
                        />
                    </label>

                    <label style={styles.detailField}>
                        <span style={styles.detailLabel}>Brand *</span>
                        <div style={styles.inlineField}>
                            <input
                                value={item.brand}
                                list="brands-list"
                                ref={(el) => { refs.current[`${item.id}-brand-mobile`] = el; }}
                                onFocus={() => {
                                    setActiveCreateTarget({ type: "brand", rowId: item.id });
                                    setActiveHistoryRowId(item.id);
                                }}
                                onChange={(e) => updateItem(item.id, "brand", e.target.value)}
                                onBlur={(e) => updateItem(item.id, "brand", e.target.value)}
                                onKeyDown={(e) => handleItemKeyDown(e, item.id, "brand", "-mobile")}
                                placeholder="Brand"
                                style={styles.detailInput}
                            />
                            <button type="button" onClick={() => openCreateModal("brand", item.id)} style={styles.plusButton}>+</button>
                        </div>
                    </label>

                    <label style={styles.detailField}>
                        <span style={styles.detailLabel}>Size</span>
                        <input
                            value={item.size}
                            ref={(el) => { refs.current[`${item.id}-size-mobile`] = el; }}
                            onFocus={() => setActiveHistoryRowId(item.id)}
                            onChange={(e) => updateItem(item.id, "size", e.target.value)}
                            onKeyDown={(e) => handleItemKeyDown(e, item.id, "size", "-mobile")}
                            style={styles.detailInput}
                        />
                    </label>

                    <label style={{ ...styles.detailField, gridColumn: "1 / -1" }}>
                        <span style={styles.detailLabel}>Item Name *</span>
                        <input
                            value={item.name}
                            list={`items-list-${item.id}`}
                            ref={(el) => { refs.current[`${item.id}-name-mobile`] = el; }}
                            onFocus={() => setActiveHistoryRowId(item.id)}
                            onChange={(e) => updateItem(item.id, "name", e.target.value)}
                            onBlur={(e) => applyItemLookup(item.id, e.target.value)}
                            onKeyDown={(e) => handleItemKeyDown(e, item.id, "name", "-mobile")}
                            style={itemError.name ? styles.errorDetailInput : styles.detailInput}
                        />
                    </label>

                    <label style={styles.detailField}>
                        <span style={styles.detailLabel}>Qty</span>
                        <input
                            value={item.qty}
                            ref={(el) => { refs.current[`${item.id}-qty-mobile`] = el; }}
                            inputMode="decimal"
                            onFocus={() => setActiveHistoryRowId(item.id)}
                            onChange={(e) => updateItem(item.id, "qty", e.target.value)}
                            onKeyDown={(e) => handleItemKeyDown(e, item.id, "qty", "-mobile")}
                            style={itemError.qty ? styles.errorDetailInput : styles.detailInput}
                        />
                    </label>

                    <label style={styles.detailField}>
                        <span style={styles.detailLabel}>Unit</span>
                        <select
                            value={item.unit}
                            ref={(el) => { refs.current[`${item.id}-unit-mobile`] = el; }}
                            onFocus={() => setActiveHistoryRowId(item.id)}
                            onChange={(e) => updateItem(item.id, "unit", e.target.value)}
                            onKeyDown={(e) => handleItemKeyDown(e, item.id, "unit", "-mobile")}
                            style={styles.detailInput}
                        >
                            {UNIT_OPTIONS.map((unitOption) => (
                                <option key={unitOption} value={unitOption}>{unitOption}</option>
                            ))}
                        </select>
                    </label>

                    <label style={styles.detailField}>
                        <span style={styles.detailLabel}>Pur Rate</span>
                        <input
                            value={item.purchaseRate}
                            ref={(el) => { refs.current[`${item.id}-purchaseRate-mobile`] = el; }}
                            inputMode="decimal"
                            onFocus={() => setActiveHistoryRowId(item.id)}
                            onChange={(e) => updateItem(item.id, "purchaseRate", e.target.value)}
                            onKeyDown={(e) => handleItemKeyDown(e, item.id, "purchaseRate", "-mobile")}
                            style={itemError.purchaseRate ? styles.errorDetailInput : styles.detailInput}
                        />
                    </label>

                    <label style={styles.detailField}>
                        <span style={styles.detailLabel}>Disc</span>
                        <input
                            value={item.discount}
                            ref={(el) => { refs.current[`${item.id}-discount-mobile`] = el; }}
                            inputMode="decimal"
                            onFocus={() => setActiveHistoryRowId(item.id)}
                            onChange={(e) => updateItem(item.id, "discount", e.target.value)}
                            onKeyDown={(e) => handleItemKeyDown(e, item.id, "discount", "-mobile")}
                            style={styles.detailInput}
                        />
                    </label>

                    <label style={styles.detailField}>
                        <span style={styles.detailLabel}>Net Rate</span>
                        <input value={item.netRate.toFixed(2)} readOnly style={styles.readonlyCell} />
                    </label>

                    <label style={styles.detailField}>
                        <span style={styles.detailLabel}>Total Amt</span>
                        <input value={item.total.toFixed(2)} readOnly style={styles.readonlyCell} />
                    </label>
                </div>
            </article>
        );
    };
    useEffect(() => {
        if (!firmId && (!firm || firm === getCompanyName())) {
            setFirm(companyName);
        }
    }, [companyName, firm, firmId]);

    useEffect(() => {
        if (!purchaseId && !pendingLrIdFromQuery) {
            setGstRate((current) => (current === 5 || current === 0 ? defaultPurchaseGstRate : current));
        }
    }, [defaultPurchaseGstRate, pendingLrIdFromQuery, purchaseId]);
    const activeHistoryItem = useMemo(() => {
        return items.find((item) => item.id === activeHistoryRowId)
            || items.find((item) => normalizeName(item.name))
            || items[0]
            || null;
    }, [activeHistoryRowId, items]);
    const similarItemHistory = useMemo(() => {
        const activeName = normalizeName(activeHistoryItem?.name).toLowerCase();
        const activeCategory = normalizeName(activeHistoryItem?.category).toLowerCase();
        const activeBrand = normalizeName(activeHistoryItem?.brand).toLowerCase();

        if (!activeName && !activeCategory && !activeBrand) {
            return [];
        }

        const historyRows = purchaseHistoryRecords.flatMap((purchase) =>
            (purchase.items || []).map((historyItem) => {
                const historyItemId = typeof historyItem.itemId === "object" ? historyItem.itemId?._id : historyItem.itemId;
                const historyPartyName = purchase.party?.name || purchase.partyName || purchase.party || "-";
                const historyName = normalizeName(historyItem?.name).toLowerCase();
                const historyCategory = normalizeName(historyItem?.category?.name || historyItem?.category).toLowerCase();
                const historyBrand = normalizeName(historyItem?.brand?.name || historyItem?.brand).toLowerCase();
                const nameMatch = activeName && (historyName === activeName || historyName.includes(activeName) || activeName.includes(historyName));
                const categoryMatch = activeCategory && historyCategory === activeCategory;
                const brandMatch = !activeBrand || historyBrand === activeBrand;

                if (!nameMatch && !(categoryMatch && brandMatch)) {
                    return null;
                }

                return {
                    id: `${purchase._id}-${historyItem._id || historyItemId || historyItem.name}`,
                    itemId: historyItemId || "",
                    name: historyItem.name || historyItem.itemId?.name || "",
                    category: historyItem.category?.name || historyItem.category || "",
                    categoryId: historyItem.category?._id || "",
                    brand: historyItem.brand?.name || historyItem.brand || "",
                    brandId: historyItem.brand?._id || "",
                    date: purchase.billDate || purchase.receiveDate,
                    grnNo: purchase.grnNo || "-",
                    hsn: historyItem.hsn || "-",
                    unit: normalizeUnit(historyItem.unit || "PCS"),
                    size: historyItem.size || "",
                    color: historyItem.color || "",
                    material: historyItem.material || "",
                    style: historyItem.style || "",
                    designNo: historyItem.designNo || "",
                    purchaseRate: Number(historyItem.purchaseRate || 0).toFixed(2),
                    purchaseRateValue: Number(historyItem.purchaseRate || 0),
                    packOf: historyItem.packOf || "-",
                    packQty: historyItem.packQty || "-",
                    netQty: Number(historyItem.qty || 0),
                    mrp: Number(historyItem.mrp || 0) > 0 ? Number(historyItem.mrp || 0).toFixed(2) : "-",
                    mrpValue: Number(historyItem.mrp || 0),
                    saleRate: Number(historyItem.saleRate || 0) > 0 ? Number(historyItem.saleRate || 0).toFixed(2) : "-",
                    saleRateValue: Number(historyItem.saleRate || 0),
                    discountValue: Number(historyItem.discount || 0),
                    subStyle: historyItem.subStyle || "-",
                    partyName: historyPartyName,
                };
            })
        )
            .filter(Boolean)
            .filter((row) => !purchaseId || !String(row.id).startsWith(`${purchaseId}-`))
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        return historyRows.slice(0, 8);
    }, [activeHistoryItem, purchaseHistoryRecords, purchaseId]);
    const navigationPurchases = useMemo(() => (
        [...purchaseHistoryRecords]
            .sort((left, right) => new Date(left.createdAt || left.billDate || 0) - new Date(right.createdAt || right.billDate || 0))
    ), [purchaseHistoryRecords]);

    const handleEnterNext = (e, nextRefKey) => {
        if (e.key === "Enter" && nextRefKey && refs.current[nextRefKey]) {
            e.preventDefault();
            refs.current[nextRefKey].focus();
        }
    };

    const fetchMasterCollection = async (path, setter, key) => {
        const data = await fetchWithAuth(`${API_BASE}${path}`);
        setter(sortByName(data[key] || data.data || []));
    };

    const fetchNextGrn = useCallback(async () => {
        const data = await fetchWithAuth(`${API_BASE}/purchases/next-grn`);
        setGrnNo(data.data?.grnNo || "");
    }, []);

    const fetchMasters = useCallback(async () => {
        setLoadingMasters(true);
        try {
            await Promise.all([
                fetchMasterCollection("/parties?type=party", setParties, "data"),
                fetchMasterCollection("/parties?type=transporter", setTransporters, "data"),
                fetchMasterCollection("/parties?type=supplierAgent", setSuppliers, "data"),
                fetchMasterCollection("/parties?type=firm", setFirms, "data"),
                fetchMasterCollection("/categories", setCategories, "categories"),
                fetchMasterCollection("/brands", setBrands, "brands"),
                fetchMasterCollection("/items", setItemMasters, "data"),
                fetchNextGrn(),
            ]);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingMasters(false);
        }
    }, [fetchNextGrn, sortByName]);

    const fetchPurchaseHistory = useCallback(async () => {
        try {
            const data = await fetchWithAuth(`${API_BASE}/purchases`);
            setPurchaseHistoryRecords(data.data || []);
        } catch (error) {
            console.error("Failed to fetch purchase history", error);
        }
    }, []);

    const applyLrEntryToForm = useCallback((lrData) => {
        if (!lrData) {
            return;
        }

        const matchedParty = findByName(parties, lrData.partyName || "");
        const matchedTransporter = findByName(transporters, lrData.transporter || "");
        const matchedFirm = findByName(firms, lrData.firmName || "");
        setLrNo(lrData.lrNo || "");
        setBale(lrData.bale || "");
        setGodown(lrData.godown || "");
        setTransporter(lrData.transporter || "");
        setTransporterId(matchedTransporter?._id || "");
        setFirm(lrData.firmName || getCompanyName());
        setFirmId(matchedFirm?._id || "");
        setParty(lrData.partyName || "");
        setSelectedParty(matchedParty);
        setPartyId(matchedParty?._id || "");
        if (matchedParty?.stateCode) {
            setPartyStateCode(matchedParty.stateCode);
        }
        setBillNo((current) => current || lrData.billNo || "");
        setInwardDate(lrData.inwardDate ? String(lrData.inwardDate).slice(0, 10) : today);
        setHundekari(lrData.hundekari || "");
        setTransportCharges(lrData.transportCharges || 0);
        setHamaliCharges(lrData.hamaliCharges || 0);
        setNarration(lrData.narration || "");
    }, [firms, parties, today, transporters]);

    const fetchLrEntry = useCallback(async (value = lrId) => {
        const nextLrId = String(value || "").trim();
        if (!nextLrId) {
            return;
        }

        try {
            const data = await fetchWithAuth(`${API_BASE}/purchases/lr-entry/${encodeURIComponent(nextLrId)}`);
            applyLrEntryToForm(data.data || null);
        } catch (error) {
            console.error(error);
        }
    }, [applyLrEntryToForm, lrId]);

    const loadLrIdIntoPurchase = useCallback(async (value, options = {}) => {
        const nextLrId = String(value || "").trim();
        if (!nextLrId) {
            return;
        }

        setLrId(nextLrId);
        await fetchLrEntry(nextLrId);

        if (options.clearQuery) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete("lrId");
            setSearchParams(nextParams, { replace: true });
        }
    }, [fetchLrEntry, searchParams, setSearchParams]);

    useEffect(() => {
        fetchMasters();
    }, [fetchMasters]);

    useEffect(() => {
        fetchPurchaseHistory();
    }, [fetchPurchaseHistory]);

    useEffect(() => {
        if (lrId && !lrNo) {
            fetchLrEntry(lrId);
        }
    }, [fetchLrEntry, lrId, lrNo]);

    useEffect(() => {
        if (purchaseId || !pendingLrIdFromQuery) {
            return;
        }

        loadLrIdIntoPurchase(pendingLrIdFromQuery, { clearQuery: true });
    }, [loadLrIdIntoPurchase, pendingLrIdFromQuery, purchaseId]);

    useEffect(() => {
        if (!items.some((item) => item.id === activeHistoryRowId)) {
            setActiveHistoryRowId(items[0]?.id || null);
        }
    }, [activeHistoryRowId, items]);

    useEffect(() => {
        if (!purchaseId) {
            const savedDraft = localStorage.getItem(PURCHASE_DRAFT_KEY);
            if (savedDraft) {
                try {
                    const draft = JSON.parse(savedDraft);
                    setGrnNo(draft.grnNo || "");
                    setReceiveDate(draft.receiveDate || today);
                    setLrId(draft.lrId || "");
                    setLrNo(draft.lrNo || "");
                    setBale(draft.bale || "");
                    setTransporter(draft.transporter || "");
                    setTransporterId(draft.transporterId || "");
                    setFirm(draft.firm || companyName);
                    setFirmId(draft.firmId || "");
                    setParty(draft.party || "");
                    setPartyId(draft.partyId || "");
                    setSupplierAgent(draft.supplierAgent || "");
                    setSupplierAgentId(draft.supplierAgentId || "");
                    setBillDate(draft.billDate || today);
                    setBillNo(draft.billNo || "");
                    setBillAmount(draft.billAmount || "");
                    setGstOn(draft.gstOn || "Bill Total");
                    setGodown(draft.godown || "");
                    setInwardDate(draft.inwardDate || today);
                    setHundekari(draft.hundekari || "");
                    setTransportCharges(draft.transportCharges || 0);
                    setHamaliCharges(draft.hamaliCharges || 0);
                    setNarration(draft.narration || "");
                    setItems((draft.items || [createEmptyItem()]).map((item) => recalculateItem(item)));
                    setDiscountTotal(draft.discountTotal || 0);
                    setAddCharges(draft.addCharges || 0);
                    setGstRate(draft.gstRate ?? defaultPurchaseGstRate);
                    setCommission(draft.commission || 0);
                    setPackingRoundoff(draft.packingRoundoff || 0);
                    setAllowBillVariance(Boolean(draft.billVarianceAllowed));
                    setAttachments(draft.attachments || []);
                } catch (error) {
                    console.error("Failed to restore purchase draft", error);
                }
            }
            setDraftHydrated(true);
            return;
        }
        setDraftHydrated(true);

        const fetchPurchaseForEdit = async () => {
            setLoadingPurchase(true);
            try {
                const data = await fetchWithAuth(`${API_BASE}/purchases/detail/${purchaseId}`);
                const purchaseRecord = data.data;
                setGrnNo(purchaseRecord.grnNo || "");
                setReceiveDate(purchaseRecord.receiveDate ? String(purchaseRecord.receiveDate).slice(0, 10) : today);
                setLrId(purchaseRecord.lrId || "");
                setLrNo(purchaseRecord.lrNo || "");
                setBale(purchaseRecord.bale || "");
                setTransporter(purchaseRecord.transporter || "");
                setTransporterId(purchaseRecord.transporterId || "");
                setFirm(purchaseRecord.firm || companyName);
                setFirmId(purchaseRecord.firmId || "");
                setParty(purchaseRecord.party || "");
                setPartyId(purchaseRecord.partyId || "");
                setSupplierAgent(purchaseRecord.supplierAgent || "");
                setSupplierAgentId(purchaseRecord.supplierAgentId || "");
                setBillDate(purchaseRecord.billDate ? String(purchaseRecord.billDate).slice(0, 10) : today);
                setBillNo(purchaseRecord.billNo || "");
                setBillAmount(purchaseRecord.billAmount || "");
                setGstOn(purchaseRecord.gstOn || "Bill Total");
                setGodown(purchaseRecord.godown || "");
                setInwardDate(purchaseRecord.inwardDate ? String(purchaseRecord.inwardDate).slice(0, 10) : today);
                setHundekari(purchaseRecord.hundekari || "");
                setTransportCharges(purchaseRecord.transportCharges || 0);
                setHamaliCharges(purchaseRecord.hamaliCharges || 0);
                setNarration(purchaseRecord.narration || "");
                setItems((purchaseRecord.items || [createEmptyItem()]).map((item) => recalculateItem({
                    ...item,
                    id: item._id || Date.now() + Math.floor(Math.random() * 1000),
                    category: item.category?.name || item.category || "",
                    categoryId: item.category?._id || item.category || "",
                    brand: item.brand?.name || item.brand || "",
                    brandId: item.brand?._id || item.brand || "",
                    color: item.color || "",
                    material: item.material || "",
                    style: item.style || "",
                    subStyle: item.subStyle || "",
                    designNo: item.designNo || "",
                    mrp: Number(item.mrp || 0),
                    saleRate: Number(item.saleRate || 0),
                })));
                setDiscountTotal(purchaseRecord.discountTotal || 0);
                setAddCharges(purchaseRecord.addCharges || 0);
                setGstRate(purchaseRecord.gstRate ?? defaultPurchaseGstRate);
                setCommission(purchaseRecord.commission || 0);
                setPackingRoundoff(purchaseRecord.packingRoundoff || 0);
                setAllowBillVariance(Boolean(purchaseRecord.billVarianceAllowed));
                setAttachments(purchaseRecord.attachments || []);
            } catch (error) {
                notifyError(error.message || "Failed to load purchase");
            } finally {
                setLoadingPurchase(false);
            }
        };

        fetchPurchaseForEdit();
    }, [purchaseId, today]);

    useEffect(() => {
        if (!draftHydrated || loadingPurchase) {
            return undefined;
        }

        const frameId = requestAnimationFrame(() => {
            refs.current.receiveDate?.focus();
            refs.current.receiveDate?.select?.();
        });

        return () => cancelAnimationFrame(frameId);
    }, [draftHydrated, loadingPurchase, purchaseId]);

    useEffect(() => {
        if (purchaseId || !draftHydrated) {
            return;
        }

        const draftPayload = {
            grnNo,
            receiveDate,
            lrId,
            lrNo,
            bale,
            transporter,
            transporterId,
            firm,
            firmId,
            party,
            partyId,
            supplierAgent,
            supplierAgentId,
            billDate,
            billNo,
            billAmount,
            gstOn,
            godown,
            inwardDate,
            hundekari,
            transportCharges,
            hamaliCharges,
            narration,
            items,
            discountTotal,
            addCharges,
            gstRate,
            commission,
            packingRoundoff,
            billVarianceAllowed: allowBillVariance,
            attachments,
        };
        localStorage.setItem(PURCHASE_DRAFT_KEY, JSON.stringify(draftPayload));
    }, [
        addCharges, allowBillVariance, bale, billAmount, billDate, billNo, commission, discountTotal, draftHydrated,
        firm, firmId, godown, grnNo, gstOn, gstRate, hamaliCharges, hundekari, inwardDate, items,
        lrId, lrNo, narration, packingRoundoff, party, partyId, purchaseId, receiveDate, supplierAgent,
        supplierAgentId, transportCharges, transporter, transporterId, attachments
    ]);

    useEffect(() => {
        const fetchInsights = async () => {
            if (!party) {
                setPartyInsights(emptyInsight);
                return;
            }
            try {
                const data = await fetchWithAuth(`${API_BASE}/purchases/party-insights?party=${encodeURIComponent(party)}`);
                setPartyInsights(data.data || emptyInsight);
            } catch (error) {
                console.error(error);
                setPartyInsights(emptyInsight);
            }
        };
        fetchInsights();
    }, [party]);

    useEffect(() => {
        const normalizedParty = normalizeName(party);
        const normalizedBillNo = normalizeName(billNo);
        if (!normalizedParty || !normalizedBillNo || !billDate) {
            setDuplicateBillCheck(emptyDuplicateBillCheck);
            return undefined;
        }

        let cancelled = false;
        setDuplicateBillCheck((current) => ({ ...current, loading: true, checked: false }));
        const timeoutId = setTimeout(async () => {
            try {
                const params = new URLSearchParams({
                    party: normalizedParty,
                    billNo: normalizedBillNo,
                    billDate,
                });
                if (purchaseId) {
                    params.set("excludeId", purchaseId);
                }

                const data = await fetchWithAuth(`${API_BASE}/purchases/duplicate-check?${params.toString()}`);
                if (cancelled) return;
                setDuplicateBillCheck({
                    loading: false,
                    checked: true,
                    duplicate: Boolean(data.data?.duplicate),
                    record: data.data?.record || null,
                    message: data.data?.message || "",
                });
            } catch (error) {
                if (cancelled) return;
                setDuplicateBillCheck({
                    loading: false,
                    checked: false,
                    duplicate: false,
                    record: null,
                    message: error.message || "Failed to check duplicate bill.",
                });
            }
        }, 350);

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [billDate, billNo, party, purchaseId]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            const commandAltC = (e.metaKey || e.ctrlKey) && e.altKey && e.code === "KeyC";
            const altOnlyC = e.altKey && !e.metaKey && !e.ctrlKey && e.code === "KeyC";

            if (!commandAltC && !altOnlyC) {
                return;
            }

            e.preventDefault();
            openCreateModal(activeCreateTarget.type, activeCreateTarget.rowId);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activeCreateTarget]);

    const handlePartySelection = useCallback((value) => {
        setParty(value);
        const matchedParty = findByName(parties, value);
        setSelectedParty(matchedParty);
        setPartyId(matchedParty?._id || "");

        if (matchedParty?.stateCode) {
            setPartyStateCode(matchedParty.stateCode);
        } else if (matchedParty?.gstNo?.length >= 2) {
            setPartyStateCode(matchedParty.gstNo.slice(0, 2));
        } else {
            setPartyStateCode(COMPANY_STATE_CODE);
        }
    }, [parties]);

    const handleNamedFieldSelection = (value, options, setter, idSetter) => {
        const matched = findByName(options, value);
        setter(matched ? matched.name : value);
        if (idSetter) {
            idSetter(matched?._id || "");
        }
    };

    const getCategoryMeta = useCallback((value) => findByName(categories, value), [categories]);

    const getItemSuggestions = useCallback((row) => {
        const selectedCategoryName = normalizeName(row?.category).toLowerCase();
        const selectedBrandName = normalizeName(row?.brand).toLowerCase();

        const matches = itemMasters.filter((item) => {
            const itemCategoryName = normalizeName(item.category?.name || "").toLowerCase();
            const itemBrandName = normalizeName(item.brand?.name || "").toLowerCase();

            if (selectedCategoryName && itemCategoryName && itemCategoryName !== selectedCategoryName) {
                return false;
            }

            if (selectedBrandName && itemBrandName && itemBrandName !== selectedBrandName) {
                return false;
            }

            return true;
        });

        return matches.length > 0 ? matches : itemMasters;
    }, [itemMasters]);

    const applyItemLookup = (rowId, nextName) => {
        const normalized = normalizeName(nextName).toLowerCase();
        if (!normalized) {
            return;
        }

        const currentRow = items.find((item) => item.id === rowId);
        const suggestedItems = getItemSuggestions(currentRow);
        const matchedItem = suggestedItems.find((item) => item.name.toLowerCase() === normalized)
            || itemMasters.find((item) => item.name.toLowerCase() === normalized);
        if (!matchedItem) {
            return;
        }

        setItems((prevItems) => prevItems.map((item) => {
            if (item.id !== rowId) return item;
            return recalculateItem({
                ...item,
                itemId: matchedItem._id,
                name: matchedItem.name,
                category: matchedItem.category?.name || item.category,
                categoryId: matchedItem.category?._id || item.categoryId,
                brand: matchedItem.brand?.name || item.brand,
                brandId: matchedItem.brand?._id || item.brandId,
                hsn: matchedItem.hsn || item.hsn,
                size: matchedItem.size || item.size,
                unit: matchedItem.unit || item.unit,
                purchaseRate: matchedItem.defaultPurchaseRate || item.purchaseRate,
                color: matchedItem.color || item.color,
                material: matchedItem.material || item.material,
                style: matchedItem.style || item.style,
                subStyle: matchedItem.subStyle || item.subStyle,
                designNo: matchedItem.designNo || item.designNo,
                mrp: matchedItem.mrp || item.mrp,
                saleRate: matchedItem.saleRate || item.saleRate,
            });
        }));
    };

    const applyHistoryRowToActiveItem = (historyRow) => {
        const targetRowId = activeHistoryItem?.id || items[0]?.id;
        if (!targetRowId || !historyRow) {
            return;
        }

        setItems((prevItems) => prevItems.map((item) => {
            if (item.id !== targetRowId) return item;

            return recalculateItem({
                ...item,
                itemId: historyRow.itemId || item.itemId,
                category: historyRow.category || item.category,
                categoryId: historyRow.categoryId || item.categoryId,
                hsn: historyRow.hsn && historyRow.hsn !== "-" ? historyRow.hsn : item.hsn,
                brand: historyRow.brand || item.brand,
                brandId: historyRow.brandId || item.brandId,
                size: historyRow.size || item.size,
                name: historyRow.name || item.name,
                unit: normalizeUnit(historyRow.unit || item.unit),
                purchaseRate: historyRow.purchaseRateValue || item.purchaseRate,
                discount: historyRow.discountValue || item.discount,
                mrp: historyRow.mrpValue || item.mrp,
                saleRate: historyRow.saleRateValue || item.saleRate,
                color: historyRow.color || item.color,
                material: historyRow.material || item.material,
                style: historyRow.style || item.style,
                subStyle: historyRow.subStyle && historyRow.subStyle !== "-" ? historyRow.subStyle : item.subStyle,
                designNo: historyRow.designNo || item.designNo,
            });
        }));

        setActiveHistoryRowId(targetRowId);
        setStatusMessage(`Applied purchase history from ${historyRow.partyName || "previous bill"} to the active item row.`);
        notifySuccess("Purchase history applied to active item row.");
        setTimeout(() => {
            refs.current[`${targetRowId}-qty`]?.focus();
            refs.current[`${targetRowId}-qty-mobile`]?.focus();
        }, 0);
    };

    const updateItem = (id, field, value) => {
        if (["qty", "purchaseRate", "discount", "perPercent", "mrp", "saleRate", "extraDiscount", "labelPerPc"].includes(field)) {
            const normalizedValue = String(value ?? "");
            if (!DECIMAL_INPUT_PATTERN.test(normalizedValue)) {
                return;
            }
        }

        setItems((prevItems) =>
            prevItems.map((item) => {
                if (item.id !== id) return item;

                const nextItem = { ...item, [field]: value };

                if (field === "category") {
                    const matchedCategory = getCategoryMeta(value);
                    nextItem.category = matchedCategory ? matchedCategory.name : value;
                    nextItem.categoryId = matchedCategory?._id || "";
                    nextItem.hsn = matchedCategory?.hsn || nextItem.hsn || "";
                    nextItem.unit = normalizeUnit(matchedCategory?.unit || (isMeterCategory(nextItem.category) ? "MTRS" : nextItem.unit));
                }

                if (field === "brand") {
                    const matchedBrand = findByName(brands, value);
                    nextItem.brand = matchedBrand ? matchedBrand.name : value;
                    nextItem.brandId = matchedBrand?._id || "";
                }

                return recalculateItem(nextItem);
            })
        );
    };

    const addItem = () => {
        const newItem = createEmptyItem();
        setItems((prevItems) => [...prevItems, newItem]);
        setTimeout(() => {
            refs.current[`${newItem.id}-category`]?.focus();
            refs.current[`${newItem.id}-category-mobile`]?.focus();
        }, 0);
    };

    const removeItem = (id) => {
        setItems((prevItems) => {
            if (prevItems.length === 1) {
                return [createEmptyItem()];
            }
            return prevItems.filter((item) => item.id !== id);
        });
    };

    const handleItemKeyDown = (e, rowId, field, suffix = "") => {
        if (e.key === "+" || (e.shiftKey && e.key === "=")) {
            e.preventDefault();
            addItem();
            return;
        }

        if (e.shiftKey && e.key === "Delete") {
            e.preventDefault();
            removeItem(rowId);
            return;
        }

        if (e.key !== "Enter") {
            return;
        }

        e.preventDefault();
        const fieldsOrder = [
            "category",
            "hsn",
            "brand",
            "size",
            "name",
            "qty",
            "unit",
            "purchaseRate",
            "discount",
        ];
        const currentIndex = fieldsOrder.indexOf(field);
        const nextField = fieldsOrder[currentIndex + 1];

        if (nextField) {
            refs.current[`${rowId}-${nextField}${suffix}`]?.focus();
            return;
        }

        addItem();
    };

    const openCreateModal = (type, rowId = null) => {
        setModalState({
            ...initialModalState,
            open: true,
            type,
            rowId,
        });
    };

    const closeCreateModal = () => {
        setModalState(initialModalState);
    };

    const focusCreatedField = (type, rowId = null) => {
        const refKeyByType = {
            party: "party",
            transporter: "transporter",
            supplierAgent: "supplier",
            firm: "firm",
            category: rowId ? `${rowId}-category` : "category",
            brand: rowId ? `${rowId}-brand` : "brand",
        };
        const desktopKey = refKeyByType[type];
        const mobileKey = rowId ? `${desktopKey}-mobile` : desktopKey;
        requestAnimationFrame(() => {
            const target = refs.current[desktopKey] || refs.current[mobileKey];
            target?.focus();
            if (target?.select) {
                target.select();
            }
        });
    };

    const updateModalField = (field, value) => {
        setModalState((prev) => ({
            ...prev,
            form: {
                ...prev.form,
                [field]: value,
            },
        }));
    };

    const fetchGstDetails = async () => {
        const gstNo = modalState.form.gstNo.trim().toUpperCase();
        if (!gstNo) {
            notifyError("Enter GST number first");
            return;
        }

        setModalState((prev) => ({ ...prev, loadingGst: true }));
        try {
            const data = await fetchWithAuth(`${API_BASE}/parties/gst/${gstNo}`, {
                headers: { "Content-Type": "application/json" },
            });

            const gstData = data.data || {};
            setModalState((prev) => ({
                ...prev,
                loadingGst: false,
                form: {
                    ...prev.form,
                    name: prev.form.name || gstData.partyName || gstData.tradeName || gstData.legalName || "",
                    contactPerson: gstData.contactPerson || prev.form.contactPerson,
                    phone: gstData.phone || prev.form.phone,
                    email: gstData.email || prev.form.email,
                    addressLine1: gstData.addressLine1 || prev.form.addressLine1,
                    addressLine2: gstData.addressLine2 || prev.form.addressLine2,
                    city: gstData.city || prev.form.city,
                    state: gstData.state || prev.form.state,
                    stateCode: gstData.stateCode || prev.form.stateCode,
                    pincode: gstData.pincode || prev.form.pincode,
                    gstNo: gstData.gstNo || prev.form.gstNo,
                },
            }));

            if (data.message) {
                notifyInfo(data.message);
            }
        } catch (error) {
            setModalState((prev) => ({ ...prev, loadingGst: false }));
            notifyError(error.message || "Failed to fetch GST details");
        }
    };

    const saveEntity = async () => {
        try {
            const entityName = normalizeName(modalState.form.name);
            if (!entityName) {
                notifyError(`${ENTITY_LABELS[modalState.type]} name is required`);
                return;
            }

            if (modalState.type === "category") {
                const response = await fetchWithAuth(`${API_BASE}/categories`, {
                    method: "POST",
                    body: JSON.stringify({ name: entityName, hsn: modalState.form.hsn, unit: modalState.form.unit }),
                });
                const category = response.category || response.data || response;
                setCategories((prev) => sortByName([...prev, category]));
                if (modalState.rowId) {
                    updateItem(modalState.rowId, "category", category.name);
                    setItems((prevItems) => prevItems.map((item) => (
                        item.id === modalState.rowId
                            ? recalculateItem({ ...item, hsn: category.hsn || item.hsn || "", unit: normalizeUnit(category.unit || item.unit) })
                            : item
                    )));
                }
                const { type, rowId } = modalState;
                closeCreateModal();
                focusCreatedField(type, rowId);
                return;
            }

            if (modalState.type === "brand") {
                const response = await fetchWithAuth(`${API_BASE}/brands`, {
                    method: "POST",
                    body: JSON.stringify({ name: entityName }),
                });
                const brand = response.brand || response.data || response;
                setBrands((prev) => sortByName([...prev, brand]));
                if (modalState.rowId) {
                    updateItem(modalState.rowId, "brand", brand.name);
                }
                const { type, rowId } = modalState;
                closeCreateModal();
                focusCreatedField(type, rowId);
                return;
            }

            const entityPayload = modalState.type === "transporter"
                ? {
                    name: entityName,
                    phone: modalState.form.phone,
                    partyType: modalState.type,
                }
                : {
                    ...modalState.form,
                    name: entityName,
                    partyType: modalState.type,
                };

            const response = await fetchWithAuth(`${API_BASE}/parties`, {
                method: "POST",
                body: JSON.stringify(entityPayload),
            });

            const entity = response.data || response;
            const applyEntity = (setter, listSetter) => {
                setter(entity.name);
                listSetter((prev) => sortByName([...prev, entity]));
            };

            if (modalState.type === "party") {
                applyEntity(handlePartySelection, setParties);
                setSelectedParty(entity);
                setPartyId(entity._id || "");
                setPartyStateCode(entity.stateCode || COMPANY_STATE_CODE);
            } else if (modalState.type === "transporter") {
                applyEntity(setTransporter, setTransporters);
                setTransporterId(entity._id || "");
            } else if (modalState.type === "supplierAgent") {
                applyEntity(setSupplierAgent, setSuppliers);
                setSupplierAgentId(entity._id || "");
            } else if (modalState.type === "firm") {
                applyEntity(setFirm, setFirms);
                setFirmId(entity._id || "");
            }

            const { type, rowId } = modalState;
            closeCreateModal();
            focusCreatedField(type, rowId);
            notifySuccess(`${ENTITY_LABELS[modalState.type]} saved successfully.`);
        } catch (error) {
            notifyError(error.message || "Failed to save");
        }
    };

    const resetForm = () => {
        setReceiveDate(today);
        setLrId("");
        setLrNo("");
        setBale("");
        setTransporter("");
        setTransporterId("");
        setFirm(companyName);
        setFirmId("");
        setParty("");
        setPartyId("");
        setSelectedParty(null);
        setPartyStateCode(COMPANY_STATE_CODE);
        setSupplierAgent("");
        setSupplierAgentId("");
        setBillDate(today);
        setBillNo("");
        setBillAmount("");
        setGstOn("Bill Total");
        setGodown("");
        setInwardDate(today);
        setHundekari("");
        setTransportCharges(0);
        setHamaliCharges(0);
        setNarration("");
        setItems([createEmptyItem()]);
        setDiscountTotal(0);
        setAddCharges(0);
        setGstRate(defaultPurchaseGstRate);
        setCommission(0);
        setPackingRoundoff(0);
        setAllowBillVariance(false);
        setAttachments([]);
        setActiveHistoryRowId(null);
        localStorage.removeItem(PURCHASE_DRAFT_KEY);
        fetchNextGrn();
    };

    const importPastedRows = () => {
        const linesToImport = pasteValue.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        if (linesToImport.length === 0) {
            return;
        }

        const parsedRows = linesToImport.map((line) => {
            const [category = "", hsn = "", brand = "", size = "", name = "", qty = "1", unit = "PC", purchaseRate = "0", discount = "0"] = line.split("\t");
            return recalculateItem({
                ...createEmptyItem(),
                category: category.trim(),
                hsn: hsn.trim(),
                brand: brand.trim(),
                size: size.trim(),
                name: name.trim(),
                qty: Number(qty || 1),
                unit: normalizeUnit(unit.trim() || "PCS"),
                purchaseRate: Number(purchaseRate || 0),
                discount: Number(discount || 0),
            });
        });

        setItems(parsedRows.length > 0 ? parsedRows : [createEmptyItem()]);
        setActiveHistoryRowId(parsedRows[0]?.id || null);
        setPasteModalOpen(false);
        setPasteValue("");
    };

    const readFileAsAttachment = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
            id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            mimeType: file.type,
            size: file.size,
            dataUrl: typeof reader.result === "string" ? reader.result : "",
            uploadedAt: new Date().toISOString(),
        });
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const handleAttachmentSelect = async (event) => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) {
            return;
        }

        const nextAttachments = await Promise.all(files.map(readFileAsAttachment));

        setAttachments((current) => [...current, ...nextAttachments]);
        event.target.value = "";
    };

    const runPurchaseBillScan = async (attachment) => {
        if (!attachment) {
            notifyError("Attach a bill image or PDF first.");
            return;
        }

        try {
            setBillScanLoading(true);
            const response = await fetchWithAuth(`${API_BASE}/purchases/bill-scan/preview`, {
                method: "POST",
                body: JSON.stringify({
                    attachment: {
                        name: attachment.name,
                        mimeType: attachment.mimeType,
                        size: attachment.size,
                        dataUrl: attachment.dataUrl,
                    },
                    text: billScanText,
                }),
            });

            setBillScanPreview(response.data || null);
            notifySuccess("Bill scan preview ready. Review before applying.");
        } catch (error) {
            setBillScanPreview(null);
            notifyError(error.message || "Failed to scan purchase bill.");
        } finally {
            setBillScanLoading(false);
        }
    };

    const handleBillScanFileSelect = async (event) => {
        const [file] = Array.from(event.target.files || []);
        if (!file) {
            return;
        }

        try {
            const attachment = await readFileAsAttachment(file);
            setAttachments((current) => [...current, attachment]);
            await runPurchaseBillScan(attachment);
        } catch (error) {
            notifyError(error.message || "Failed to read purchase bill file.");
        } finally {
            event.target.value = "";
        }
    };

    const applyBillScanPreview = () => {
        const extracted = billScanPreview?.extracted || {};
        if (!billScanPreview) {
            notifyError("Run a bill scan first.");
            return;
        }

        if (extracted.party) {
            handlePartySelection(extracted.party);
            setPartyId(extracted.partyId || partyId);
            if (extracted.partyStateCode) {
                setPartyStateCode(extracted.partyStateCode);
            }
        }
        if (extracted.billNo) setBillNo(extracted.billNo);
        if (extracted.billDate) setBillDate(extracted.billDate);
        if (extracted.billAmount) setBillAmount(String(extracted.billAmount));

        if (Array.isArray(extracted.items) && extracted.items.length > 0) {
            const mappedItems = extracted.items.map((row) => {
                const matchedCategory = getCategoryMeta(row.category);
                const matchedBrand = findByName(brands, row.brand);
                const matchedItem = itemMasters.find((item) => (
                    normalizeName(item.name).toLowerCase() === normalizeName(row.name).toLowerCase()
                ));

                return recalculateItem({
                    ...createEmptyItem(),
                    itemId: matchedItem?._id || "",
                    category: matchedCategory?.name || row.category || matchedItem?.category?.name || "",
                    categoryId: matchedCategory?._id || matchedItem?.category?._id || "",
                    hsn: row.hsn || matchedCategory?.hsn || matchedItem?.hsn || "",
                    brand: matchedBrand?.name || row.brand || matchedItem?.brand?.name || "",
                    brandId: matchedBrand?._id || matchedItem?.brand?._id || "",
                    name: matchedItem?.name || row.name || "",
                    qty: row.qty || 1,
                    unit: normalizeUnit(row.unit || matchedCategory?.unit || matchedItem?.unit || "PCS"),
                    purchaseRate: row.purchaseRate || matchedItem?.defaultPurchaseRate || 0,
                    discount: row.discount || 0,
                    mrp: matchedItem?.mrp || 0,
                    saleRate: matchedItem?.saleRate || 0,
                });
            });
            setItems(mappedItems.length ? mappedItems : [createEmptyItem()]);
            setActiveHistoryRowId(mappedItems[0]?.id || null);
        }

        notifySuccess("Bill scan applied to purchase entry. Please review totals before saving.");
    };

    const removeAttachment = (attachmentId) => {
        setAttachments((current) => current.filter((attachment) => (attachment.id || attachment._id) !== attachmentId));
    };

    const savePurchase = async () => {
        try {
            setSavingPurchase(true);
            const itemsToSave = rowsForValidation;
            const payload = {
                grnNo,
                receiveDate,
                lrId,
                lrNo,
                bale: Number(bale || 0),
                transporter,
                transporterId: transporterId || undefined,
                firm,
                firmId: firmId || undefined,
                party,
                partyId: partyId || undefined,
                partyState: partyStateCode,
                supplierAgent,
                supplierAgentId: supplierAgentId || undefined,
                billDate,
                billNo,
                billAmount: Number(billAmount || 0),
                billVarianceAllowed: allowBillVariance,
                varianceAmount: Number(billVariance || 0),
                gstOn,
                godown,
                inwardDate,
                hundekari,
                transportCharges: Number(transportCharges || 0),
                hamaliCharges: Number(hamaliCharges || 0),
                narration,
                attachments: attachments.map((attachment) => ({
                    name: attachment.name,
                    url: attachment.url || "",
                    mimeType: attachment.mimeType || "",
                    size: Number(attachment.size || 0),
                    dataUrl: attachment.dataUrl || "",
                    uploadedAt: attachment.uploadedAt || new Date().toISOString(),
                })),
                items: itemsToSave
                    .map((item) => ({
                        itemId: item.itemId || undefined,
                        name: item.name,
                        category: item.categoryId || item.category,
                        hsn: item.hsn,
                        brand: item.brandId || item.brand,
                        size: item.size,
                        color: item.color,
                        material: item.material,
                        style: item.style,
                        subStyle: item.subStyle,
                        designNo: item.designNo,
                        qty: Number(item.qty),
                        unit: item.unit,
                        purchaseRate: Number(item.purchaseRate),
                        mrp: Number(item.mrp),
                        saleRate: Number(item.saleRate),
                        discount: Number(item.discount),
                        netRate: Number(item.netRate),
                        total: Number(item.total),
                    })),
                discountTotal: Number(discountTotal || 0),
                addCharges: Number(addCharges || 0),
                gstRate: Number(gstRate || 0),
                commission: Number(commission || 0),
                packingRoundoff: Number(packingRoundoff || 0),
                subtotal: Number(subtotal),
                taxableAmount: Number(taxableAmount),
                cgst: Number(cgst),
                sgst: Number(sgst),
                igst: Number(igst),
                totalGst: Number(totalGst),
                finalTotal: Number(finalTotal),
                netQty: Number(netQty),
            };

            if (!payload.party) {
                setStatusMessage("Select or create a party first.");
                notifyError("Select or create a party first.");
                return;
            }

            if (!payload.billNo) {
                setStatusMessage("Bill No is required.");
                notifyError("Bill No is required.");
                return;
            }

            if (duplicateBillCheck.duplicate) {
                const duplicate = duplicateBillCheck.record || {};
                const duplicateDate = duplicate.billDate ? new Date(duplicate.billDate).toLocaleDateString("en-IN") : billDate;
                const message = `Duplicate bill detected: GRN ${duplicate.grnNo || "-"} / Bill ${duplicate.billNo || billNo} / ${duplicateDate}.`;
                setStatusMessage(message);
                notifyError(message);
                return;
            }

            if (purchaseSettings.lrMandatory && !String(payload.lrId || payload.lrNo || "").trim()) {
                setStatusMessage("LR ID or LR No is required before saving purchase.");
                notifyError("LR ID or LR No is required before saving purchase.");
                return;
            }

            if (itemsToSave.length === 0 || payload.items.length === 0) {
                setStatusMessage("Add at least one item before saving.");
                notifyError("Add at least one item before saving.");
                return;
            }

            const invalidRowIndex = items.findIndex((item) => {
                const row = buildRowErrors(item, purchaseSettings.hsnMandatory);
                return row.category || row.hsn || row.name || row.qty || row.purchaseRate;
            });
            const invalidRow = invalidRowIndex >= 0 ? buildRowErrors(items[invalidRowIndex], purchaseSettings.hsnMandatory) : null;
            if (invalidRow) {
                const firstErrorField = ["category", "hsn", "name", "qty", "purchaseRate"].find((field) => invalidRow[field]);
                if (firstErrorField) {
                    refs.current[`${items[invalidRowIndex].id}-${firstErrorField}`]?.focus();
                    refs.current[`${items[invalidRowIndex].id}-${firstErrorField}-mobile`]?.focus();
                }
                const fieldLabels = {
                    category: "Category",
                    hsn: "HSN",
                    name: "Item Name",
                    qty: "Qty",
                    purchaseRate: "Purchase Rate",
                };
                const missingFields = ["category", "hsn", "name", "qty", "purchaseRate"]
                    .filter((field) => invalidRow[field])
                    .map((field) => fieldLabels[field])
                    .join(", ");
                const message = `Fix row ${invalidRowIndex + 1}: ${missingFields} ${missingFields.includes(",") ? "are" : "is"} required.`;
                setStatusMessage(message);
                notifyError(message);
                return;
            }

            await fetchWithAuth(`${API_BASE}/purchases${purchaseId ? `/${purchaseId}` : ""}`, {
                method: purchaseId ? "PUT" : "POST",
                body: JSON.stringify(payload),
            });

            setStatusMessage(`Purchase ${purchaseId ? "updated" : "saved"} successfully.`);
            notifySuccess(`Purchase ${purchaseId ? "updated" : "saved"} successfully.`);
            fetchPurchaseHistory();
            resetForm();
            if (purchaseId) {
                navigate("/purchase");
            }
        } catch (error) {
            setStatusMessage(error.message || "Failed to save purchase.");
            notifyError(error.message || "Failed to save purchase.");
        } finally {
            setSavingPurchase(false);
        }
    };

    const openSaveConfirmModal = () => {
        setSaveConfirmState({
            open: true,
            title: purchaseId ? "Update GRN" : "Save GRN",
            message: `Are you sure? ${purchaseId ? "Update" : "Save"} GRN : ${grnNo || billNo || "-"}`,
        });
    };

    const closeSaveConfirmModal = () => {
        setSaveConfirmState(initialSaveConfirmState);
    };

    useEffect(() => {
        if (!saveConfirmState.open) {
            return undefined;
        }

        const frameId = requestAnimationFrame(() => {
            saveConfirmYesRef.current?.focus();
        });

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                closeSaveConfirmModal();
                return;
            }

            if (event.key.toLowerCase() === "y") {
                event.preventDefault();
                closeSaveConfirmModal();
                savePurchase();
                return;
            }

            if (event.key.toLowerCase() === "n") {
                event.preventDefault();
                closeSaveConfirmModal();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [saveConfirmState.open]);

    const deleteCurrentPurchase = async () => {
        if (!canDeletePurchase) {
            const message = "Only admin users can delete purchase bills.";
            setStatusMessage(message);
            notifyError(message);
            return;
        }

        if (!purchaseId) {
            setStatusMessage("Open a saved purchase first to delete it.");
            notifyError("Open a saved purchase first to delete it.");
            return;
        }
        if (!window.confirm("Delete this purchase bill?")) {
            return;
        }
        try {
            await fetchWithAuth(`${API_BASE}/purchases/${purchaseId}`, { method: "DELETE" });
            setStatusMessage("Purchase deleted successfully.");
            notifySuccess("Purchase deleted successfully.");
            navigate("/purchase");
        } catch (error) {
            setStatusMessage(error.message || "Failed to delete purchase.");
            notifyError(error.message || "Failed to delete purchase.");
        }
    };

    const navigatePurchaseRecord = (direction) => {
        if (!purchaseId) {
            setStatusMessage("Open a saved purchase first to navigate records.");
            notifyError("Open a saved purchase first to navigate records.");
            return;
        }
        const currentIndex = navigationPurchases.findIndex((record) => String(record._id) === String(purchaseId));
        if (currentIndex === -1) {
            setStatusMessage("Current purchase is not available in navigation history.");
            notifyError("Current purchase is not available in navigation history.");
            return;
        }
        const target = navigationPurchases[currentIndex + direction];
        if (!target) {
            setStatusMessage(direction < 0 ? "No previous purchase found." : "No next purchase found.");
            notifyInfo(direction < 0 ? "No previous purchase found." : "No next purchase found.");
            return;
        }
        navigate(`/purchase/edit/${target._id}`);
    };

    const renderHeaderInput = ({
        label,
        value,
        onChange,
        listId,
        options,
        nextRef,
        refKey,
        type = "text",
        onBlur,
        placeholder,
        onFocusTarget,
        extraAction,
    }) => (
        <div>
            <label style={styles.label}>{label}</label>
            <div style={styles.inputWrap}>
                <input
                    type={normalizeInputType(type)}
                    inputMode={getInputMode(type)}
                    value={value}
                    list={listId}
                    ref={(el) => {
                        if (refKey) refs.current[refKey] = el;
                    }}
                    onFocus={() => {
                        if (onFocusTarget) {
                            setActiveCreateTarget(onFocusTarget);
                        }
                    }}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={onBlur}
                    onKeyDown={(e) => handleEnterNext(e, nextRef)}
                    placeholder={placeholder}
                    style={styles.input}
                />
                {extraAction}
            </div>
            {listId ? (
                <datalist id={listId}>
                    {options.map((option) => (
                        <option key={option._id || option.name} value={option.name} />
                    ))}
                </datalist>
            ) : null}
        </div>
    );

    const renderCompactHeaderField = ({
        label,
        value,
        onChange,
        refKey,
        nextRef,
        type = "text",
        readOnly = false,
        disabled = false,
        listId,
        options = [],
        onBlur,
        onFocusTarget,
        placeholder,
        extraAction,
        fieldStyle,
    }) => (
        <label className="purchase-entry__compact-field" style={{ ...styles.compactField, ...(fieldStyle || {}) }}>
            <span className="purchase-entry__compact-label" style={styles.compactLabel}>{label}</span>
            <div className="purchase-entry__compact-control" style={styles.compactControlWrap}>
                <input
                    ref={(el) => {
                        if (refKey) refs.current[refKey] = el;
                    }}
                    type={normalizeInputType(type)}
                    inputMode={getInputMode(type)}
                    value={value}
                    list={listId}
                    readOnly={readOnly}
                    disabled={disabled}
                    placeholder={placeholder}
                    onFocus={() => {
                        if (onFocusTarget) {
                            setActiveCreateTarget(onFocusTarget);
                        }
                    }}
                    onChange={(e) => onChange?.(e.target.value)}
                    onBlur={onBlur}
                    onKeyDown={(e) => handleEnterNext(e, nextRef)}
                    className="purchase-entry__compact-input"
                    style={readOnly || disabled ? styles.compactReadonlyInput : styles.compactInput}
                />
                {extraAction ? <span className="purchase-entry__compact-action">{extraAction}</span> : null}
            </div>
            {listId ? (
                <datalist id={listId}>
                    {options.map((option) => (
                        <option key={option._id || option.name} value={option.name} />
                    ))}
                </datalist>
            ) : null}
        </label>
    );

    return (
        <div className="purchase-entry-page">
            {statusMessage ? <div style={styles.statusBanner}>{statusMessage}</div> : null}
            <div className="page-header card">
                <div className="card-body">
                    <div>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-2">
                                <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
                                <li className="breadcrumb-item active" aria-current="page">Purchase</li>
                            </ol>
                        </nav>
                        <p className="section-label">Purchase</p>
                        <h1>New Purchase</h1>
                        <p className="mb-0 text-muted">
                            Capture GRN details, logistics, supplier bill values, and item rows in one intake flow.
                        </p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-check-circle"></i> Ready</span>
                        <Link to="/purchase/lr-id" className="btn btn_style"><i className="bx bx-search"></i><span>LR ID Lookup</span></Link>
                        {loadingMasters ? <span className="metric-pill">Loading masters...</span> : null}
                        {loadingPurchase ? <span className="metric-pill">Loading purchase...</span> : null}
                        <span className="metric-pill">{isIntraState ? "Intra-state GST" : "Inter-state GST"}</span>
                    </div>
                </div>
            </div>

            <section className="card app-card purchase-entry__section">
                <div className="card-header app-card-header">
                    <div>
                        <h2>GRN Header</h2>
                        <p>Supplier, transport, billing, and GST details for the inward purchase.</p>
                    </div>
                    <span className="text-muted small">Shortcut: `Alt+C` or `Cmd/Ctrl+Alt+C` on focused master field</span>
                </div>
                <div className="card-body pb-5">
                    <form className="row g-3 needs-validation" noValidate onSubmit={(event) => event.preventDefault()}>
                        <div className="col-md-1">
                            <label className="form-label">GRN</label>
                            <input className="form-control" value={grnNo} disabled readOnly />
                        </div>

                        <div className="col-md-2">
                            <label className="form-label">Receive Dt</label>
                            <input
                                className="form-control"
                                type="date"
                                value={receiveDate}
                                ref={(el) => { refs.current.receiveDate = el; }}
                                onChange={(event) => setReceiveDate(event.target.value)}
                                onKeyDown={(event) => handleEnterNext(event, "lrId")}
                            />
                        </div>

                        <div className="col-md-1">
                            <label className="form-label">LR ID</label>
                            <input
                                className="form-control"
                                value={lrId}
                                ref={(el) => { refs.current.lrId = el; }}
                                onChange={(event) => setLrId(event.target.value)}
                                onBlur={(event) => fetchLrEntry(event.target.value)}
                                onKeyDown={(event) => handleEnterNext(event, "lrNo")}
                            />
                        </div>

                        <div className="col-md-1">
                            <label className="form-label">LR No.</label>
                            <input
                                className="form-control"
                                value={lrNo}
                                ref={(el) => { refs.current.lrNo = el; }}
                                onChange={(event) => setLrNo(event.target.value)}
                                onKeyDown={(event) => handleEnterNext(event, "bale")}
                            />
                        </div>

                        <div className="col-md-1">
                            <label className="form-label">Bale</label>
                            <input
                                className="form-control"
                                value={bale}
                                ref={(el) => { refs.current.bale = el; }}
                                onChange={(event) => setBale(event.target.value)}
                                onKeyDown={(event) => handleEnterNext(event, "transporter")}
                            />
                        </div>

                        <div className="col-md-3">
                            <label className="form-label">Transporter</label>
                            <div className="input-group">
                                <input
                                    className="form-control"
                                    value={transporter}
                                    list="transporters-list"
                                    ref={(el) => { refs.current.transporter = el; }}
                                    onFocus={() => setActiveCreateTarget({ type: "transporter", rowId: null })}
                                    onChange={(event) => setTransporter(event.target.value)}
                                    onBlur={() => handleNamedFieldSelection(transporter, transporters, setTransporter, setTransporterId)}
                                    onKeyDown={(event) => handleEnterNext(event, "supplierAgent")}
                                />
                                <button className="btn btn_style" type="button" onClick={() => openCreateModal("transporter")}>
                                    <i className="bx bx-plus"></i><span>Add</span>
                                </button>
                            </div>
                        </div>

                        <div className="col-md-2">
                            <label className="form-label">Agent</label>
                            <div className="input-group">
                                <input
                                    className="form-control"
                                    value={supplierAgent}
                                    list="supplier-list"
                                    ref={(el) => { refs.current.supplier = el; }}
                                    onFocus={() => setActiveCreateTarget({ type: "supplierAgent", rowId: null })}
                                    onChange={(event) => setSupplierAgent(event.target.value)}
                                    onBlur={() => handleNamedFieldSelection(supplierAgent, suppliers, setSupplierAgent, setSupplierAgentId)}
                                    onKeyDown={(event) => handleEnterNext(event, "amount")}
                                />
                                <button className="btn btn_style" type="button" onClick={() => openCreateModal("supplierAgent")}>
                                    <i className="bx bx-plus"></i><span>Add</span>
                                </button>
                            </div>
                        </div>

                        <div className="col-md-1">
                            <label className="form-label">Amount</label>
                            <input
                                className="form-control"
                                type="text"
                                inputMode="decimal"
                                value={transportCharges}
                                ref={(el) => { refs.current.amount = el; }}
                                onChange={(event) => setTransportCharges(event.target.value)}
                                onKeyDown={(event) => handleEnterNext(event, "firm")}
                            />
                        </div>

                        <div className="col-md-3">
                            <label className="form-label">Firm</label>
                            <input
                                className="form-control"
                                value={firm}
                                list="firms-list"
                                ref={(el) => { refs.current.firm = el; }}
                                onChange={(event) => setFirm(event.target.value)}
                                onBlur={() => handleNamedFieldSelection(firm, firms, setFirm, setFirmId)}
                                onKeyDown={(event) => handleEnterNext(event, "party")}
                            />
                        </div>

                        <div className="col-md-3">
                            <label className="form-label">Party</label>
                            <div className="d-flex position-relative">
                                <div className="input-group">
                                    <input
                                        className="form-control"
                                        value={party}
                                        list="party-list"
                                        ref={(el) => { refs.current.party = el; }}
                                        onFocus={() => setActiveCreateTarget({ type: "party", rowId: null })}
                                        onChange={(event) => handlePartySelection(event.target.value)}
                                        onBlur={() => handlePartySelection(party)}
                                        onKeyDown={(event) => handleEnterNext(event, "billNo")}
                                    />
                                    <button className="btn btn_style" type="button" onClick={() => openCreateModal("party")}>
                                        <i className="bx bx-plus"></i><span>Add</span>
                                    </button>
                                </div>
                                <p className="gstn">{selectedParty?.gstNo || "GSTNUMBER"}</p>
                            </div>
                        </div>

                        <div className="col-md-1">
                            <label className="form-label">Bill No.</label>
                            <input
                                className="form-control"
                                value={billNo}
                                ref={(el) => { refs.current.billNo = el; }}
                                onChange={(event) => setBillNo(event.target.value)}
                                onKeyDown={(event) => handleEnterNext(event, "billDate")}
                            />
                        </div>

                        <div className="col-md-2">
                            <label className="form-label">Bill Dt</label>
                            <input
                                className="form-control"
                                type="date"
                                value={billDate}
                                ref={(el) => { refs.current.billDate = el; }}
                                onChange={(event) => setBillDate(event.target.value)}
                                onKeyDown={(event) => handleEnterNext(event, "billAmountBottom")}
                            />
                        </div>

                        <div className="col-md-1">
                            <label className="form-label">Bill Amt.</label>
                            <input
                                className="form-control"
                                type="text"
                                inputMode="decimal"
                                value={billAmount}
                                ref={(el) => { refs.current.billAmountBottom = el; }}
                                onChange={(event) => setBillAmount(event.target.value)}
                                onKeyDown={(event) => handleEnterNext(event, "gstOn")}
                            />
                        </div>

                        <div className="col-md-auto">
                            <label className="form-label">GST ON</label>
                            <select
                                className="form-select"
                                value={gstOn}
                                ref={(el) => { refs.current.gstOn = el; }}
                                onChange={(event) => setGstOn(event.target.value)}
                                onKeyDown={(event) => handleEnterNext(event, "godown")}
                            >
                                {GST_OPTIONS.map((option) => <option key={option} value={option}>{option === "Bill Total" ? "On Bill Total" : "On Item"}</option>)}
                            </select>
                        </div>

                        <div className="col-md-2">
                            <label className="form-label">Inward Date</label>
                            <input
                                className="form-control"
                                type="date"
                                value={inwardDate}
                                ref={(el) => { refs.current.inwardDate = el; }}
                                onChange={(event) => setInwardDate(event.target.value)}
                                onKeyDown={(event) => handleEnterNext(event, "hundekari")}
                            />
                        </div>

                        <div className="col-md-2">
                            <label className="form-label">Hundekari</label>
                            <input
                                className="form-control"
                                value={hundekari}
                                ref={(el) => { refs.current.hundekari = el; }}
                                onChange={(event) => setHundekari(event.target.value)}
                                onKeyDown={(event) => handleEnterNext(event, "godown")}
                            />
                        </div>

                        <div className="col-md-2">
                            <label className="form-label">Godown</label>
                            <input
                                className="form-control"
                                value={godown}
                                ref={(el) => { refs.current.godown = el; }}
                                onChange={(event) => setGodown(event.target.value)}
                                onKeyDown={(event) => handleEnterNext(event, "narration")}
                            />
                        </div>

                        <div className="col-md-6">
                            <label className="form-label">Narration</label>
                            <input
                                className="form-control"
                                value={narration}
                                ref={(el) => { refs.current.narration = el; }}
                                onChange={(event) => setNarration(event.target.value)}
                            />
                        </div>
                        <datalist id="gst-on-list">
                            {GST_OPTIONS.map((option) => <option key={option} value={option} />)}
                        </datalist>
                        <datalist id="transporters-list">
                            {transporters.map((option) => <option key={option._id || option.name} value={option.name} />)}
                        </datalist>
                        <datalist id="supplier-list">
                            {suppliers.map((option) => <option key={option._id || option.name} value={option.name} />)}
                        </datalist>
                        <datalist id="firms-list">
                            {firms.map((option) => <option key={option._id || option.name} value={option.name} />)}
                        </datalist>
                        <datalist id="party-list">
                            {parties.map((option) => <option key={option._id || option.name} value={option.name} />)}
                        </datalist>
                    </form>
                    {duplicateBillCheck.loading ? (
                        <div className="alert alert-info mt-3 mb-0" role="status">
                            Checking duplicate bill...
                        </div>
                    ) : duplicateBillCheck.duplicate ? (
                        <div className="alert alert-danger mt-3 mb-0" role="alert">
                            <strong>Duplicate bill detected.</strong>{" "}
                            GRN {duplicateBillCheck.record?.grnNo || "-"} already exists for{" "}
                            {duplicateBillCheck.record?.party || party} / Bill {duplicateBillCheck.record?.billNo || billNo}
                            {duplicateBillCheck.record?.billDate ? ` on ${new Date(duplicateBillCheck.record.billDate).toLocaleDateString("en-IN")}` : ""}.
                            <Link className="ms-2 fw-bold" to={`/purchase/edit/${duplicateBillCheck.record?._id || ""}`}>Open existing bill</Link>
                        </div>
                    ) : duplicateBillCheck.checked ? (
                        <div className="alert alert-success mt-3 mb-0" role="status">
                            No duplicate bill found for this party, bill no, and bill date.
                        </div>
                    ) : null}
                </div>
            </section>

            <section className="card app-card purchase-entry__section purchase-entry__items">
                <div className="card-header app-card-header">
                    <div>
                        <h2>Purchase Items</h2>
                        <p>Add item rows with category, HSN, rate, discount, and totals.</p>
                    </div>
                    <div className="toolbar-actions purchase-entry__item-actions">
                        <button type="button" onClick={() => setPasteModalOpen(true)} className="btn btn_style inActive"><i className="bx bx-clipboard"></i><span>Paste Rows</span></button>
                        <button type="button" onClick={addItem} className="btn btn_style"><i className="bx bx-plus"></i><span>Add Rows</span></button>
                    </div>
                </div>

                <div className="card-body">
                    <div className="table-responsive app-table-wrap purchase-items-wrap purchase-entry__desktop-table">
                        <table className="table app-table align-middle purchase-entry-table" style={styles.table}>
                            <colgroup>
                                <col className="col-sr" style={{ width: 56 }} />
                                <col className="col-category" style={{ width: 188 }} />
                                <col className="col-hsn" style={{ width: 124 }} />
                                <col className="col-brand" style={{ width: 188 }} />
                                <col className="col-size" style={{ width: 108 }} />
                                <col className="col-item" style={{ width: 280 }} />
                                <col className="col-qty" style={{ width: 100 }} />
                                <col className="col-unit" style={{ width: 96 }} />
                                <col className="col-rate" style={{ width: 118 }} />
                                <col className="col-disc" style={{ width: 96 }} />
                                <col className="col-net" style={{ width: 124 }} />
                                <col className="col-total" style={{ width: 132 }} />
                                <col className="col-actions" style={{ width: 74 }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th style={styles.tableHeadCell}>Sr</th>
                                    <th style={styles.tableHeadCell}>Category *</th>
                                    <th style={styles.tableHeadCell}>HSN Code</th>
                                    <th style={styles.tableHeadCell}>Brand *</th>
                                    <th style={styles.tableHeadCell}>Size</th>
                                    <th style={styles.tableHeadCell}>Item Name *</th>
                                    <th style={styles.tableHeadCell}>Qty</th>
                                    <th style={styles.tableHeadCell}>Unit</th>
                                    <th style={styles.tableHeadCell}>Pur Rate</th>
                                    <th style={styles.tableHeadCell}>Disc</th>
                                    <th style={styles.tableHeadCell}>Net Rate</th>
                                    <th style={styles.tableHeadCell}>Total Amt</th>
                                    <th style={styles.tableHeadCell}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => (
                                    <React.Fragment key={item.id}>
                                        <tr>
                                            <td style={{ ...styles.tableBodyCell, ...styles.serialCell }}>{index + 1}</td>
                                            <td style={styles.tableBodyCell}>
                                                <div style={styles.inlineField}>
                                                    <input
                                                        value={item.category}
                                                        list="categories-list"
                                                        ref={(el) => {
                                                            refs.current[`${item.id}-category`] = el;
                                                        }}
                                                        onFocus={() => {
                                                            setActiveCreateTarget({ type: "category", rowId: item.id });
                                                            setActiveHistoryRowId(item.id);
                                                        }}
                                                        onChange={(e) => updateItem(item.id, "category", e.target.value)}
                                                        onBlur={(e) => updateItem(item.id, "category", e.target.value)}
                                                        onKeyDown={(e) => handleItemKeyDown(e, item.id, "category")}
                                                        placeholder="Category"
                                                        style={rowErrorById.get(item.id)?.category ? styles.errorCellInput : styles.cellInput}
                                                    />
                                                    <button type="button" onClick={() => openCreateModal("category", item.id)} style={styles.plusButton}>+</button>
                                                </div>
                                            </td>
                                            <td style={styles.tableBodyCell}>
                                                <input
                                                    value={item.hsn}
                                                    ref={(el) => { refs.current[`${item.id}-hsn`] = el; }}
                                                    onFocus={() => setActiveHistoryRowId(item.id)}
                                                    onChange={(e) => updateItem(item.id, "hsn", e.target.value)}
                                                    onKeyDown={(e) => handleItemKeyDown(e, item.id, "hsn")}
                                                    style={rowErrorById.get(item.id)?.hsn ? styles.errorCellInput : styles.cellInput}
                                                />
                                            </td>
                                            <td style={styles.tableBodyCell}>
                                                <div style={styles.inlineField}>
                                                    <input
                                                        value={item.brand}
                                                        list="brands-list"
                                                        ref={(el) => { refs.current[`${item.id}-brand`] = el; }}
                                                        onFocus={() => {
                                                            setActiveCreateTarget({ type: "brand", rowId: item.id });
                                                            setActiveHistoryRowId(item.id);
                                                        }}
                                                        onChange={(e) => updateItem(item.id, "brand", e.target.value)}
                                                        onBlur={(e) => updateItem(item.id, "brand", e.target.value)}
                                                        onKeyDown={(e) => handleItemKeyDown(e, item.id, "brand")}
                                                        placeholder="Brand"
                                                        style={styles.cellInput}
                                                    />
                                                    <button type="button" onClick={() => openCreateModal("brand", item.id)} style={styles.plusButton}>+</button>
                                                </div>
                                            </td>
                                            <td style={styles.tableBodyCell}>
                                                <input
                                                    value={item.size}
                                                    ref={(el) => { refs.current[`${item.id}-size`] = el; }}
                                                    onFocus={() => setActiveHistoryRowId(item.id)}
                                                    onChange={(e) => updateItem(item.id, "size", e.target.value)}
                                                    onKeyDown={(e) => handleItemKeyDown(e, item.id, "size")}
                                                    style={styles.cellInput}
                                                />
                                            </td>
                                            <td style={styles.tableBodyCell}>
                                                <input
                                                    value={item.name}
                                                    list={`items-list-${item.id}`}
                                                    ref={(el) => { refs.current[`${item.id}-name`] = el; }}
                                                    onFocus={() => setActiveHistoryRowId(item.id)}
                                                    onChange={(e) => updateItem(item.id, "name", e.target.value)}
                                                    onBlur={(e) => applyItemLookup(item.id, e.target.value)}
                                                    onKeyDown={(e) => handleItemKeyDown(e, item.id, "name")}
                                                    style={rowErrorById.get(item.id)?.name ? styles.errorCellInputWide : styles.cellInputWide}
                                                />
                                            </td>
                                            <td style={styles.tableBodyCell}>
                                                <input
                                                    value={item.qty}
                                                    ref={(el) => { refs.current[`${item.id}-qty`] = el; }}
                                                    inputMode="decimal"
                                                    onFocus={() => setActiveHistoryRowId(item.id)}
                                                    onChange={(e) => updateItem(item.id, "qty", e.target.value)}
                                                    onKeyDown={(e) => handleItemKeyDown(e, item.id, "qty")}
                                                    style={rowErrorById.get(item.id)?.qty ? styles.errorCellInputSmall : styles.cellInputSmall}
                                                />
                                            </td>
                                            <td style={styles.tableBodyCell}>
                                                <select
                                                    value={item.unit}
                                                    ref={(el) => { refs.current[`${item.id}-unit`] = el; }}
                                                    onFocus={() => setActiveHistoryRowId(item.id)}
                                                    onChange={(e) => updateItem(item.id, "unit", e.target.value)}
                                                    onKeyDown={(e) => handleItemKeyDown(e, item.id, "unit")}
                                                    style={styles.cellInputSmall}
                                                >
                                                    {UNIT_OPTIONS.map((unitOption) => (
                                                        <option key={unitOption} value={unitOption}>{unitOption}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={styles.tableBodyCell}>
                                                <input
                                                    value={item.purchaseRate}
                                                    ref={(el) => { refs.current[`${item.id}-purchaseRate`] = el; }}
                                                    inputMode="decimal"
                                                    onFocus={() => setActiveHistoryRowId(item.id)}
                                                    onChange={(e) => updateItem(item.id, "purchaseRate", e.target.value)}
                                                    onKeyDown={(e) => handleItemKeyDown(e, item.id, "purchaseRate")}
                                                    style={rowErrorById.get(item.id)?.purchaseRate ? styles.errorCellInputSmall : styles.cellInputSmall}
                                                />
                                            </td>
                                            <td style={styles.tableBodyCell}>
                                                <input
                                                    value={item.discount}
                                                    ref={(el) => { refs.current[`${item.id}-discount`] = el; }}
                                                    inputMode="decimal"
                                                    onFocus={() => setActiveHistoryRowId(item.id)}
                                                    onChange={(e) => updateItem(item.id, "discount", e.target.value)}
                                                    onKeyDown={(e) => handleItemKeyDown(e, item.id, "discount")}
                                                    style={styles.cellInputSmall}
                                                />
                                            </td>
                                            <td style={styles.tableBodyCell}><input value={item.netRate.toFixed(2)} readOnly style={styles.readonlyCell} /></td>
                                            <td style={styles.tableBodyCell}><input value={item.total.toFixed(2)} readOnly style={styles.readonlyCell} /></td>
                                            <td style={styles.tableBodyCell}>
                                                <button type="button" onClick={() => removeItem(item.id)} style={styles.rowDeleteButton}>
                                                    X
                                                </button>
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={styles.mobileItemsWrap} className="purchase-entry__mobile-items">
                        {items.map((item, index) => renderMobileItemCard(item, index))}
                    </div>

                    <datalist id="categories-list">
                        {categories.map((category) => <option key={category._id} value={category.name} />)}
                    </datalist>
                    <datalist id="brands-list">
                        {brands.map((brand) => <option key={brand._id} value={brand.name} />)}
                    </datalist>
                    <datalist id="items-list">
                        {itemMasters.map((item) => <option key={item._id} value={item.name} />)}
                    </datalist>
                    {items.map((item) => (
                        <datalist key={`items-list-${item.id}`} id={`items-list-${item.id}`}>
                            {getItemSuggestions(item).map((masterItem) => (
                                <option
                                    key={`${item.id}-${masterItem._id}`}
                                    value={masterItem.name}
                                >
                                    {[
                                        masterItem.category?.name || "",
                                        masterItem.brand?.name || "",
                                        masterItem.hsn || "",
                                    ].filter(Boolean).join(" • ")}
                                </option>
                            ))}
                        </datalist>
                    ))}
                </div>
            </section>

            <section className="card app-card app-datatable-card purchase-entry__footer-panel">
                <div className="card-body">
                    <div className="row g-4">
                        <div className="col-md-8 d-flex flex-column purchase-entry__history-panel">
                            <div className="app-card-header p-0 mb-3">
                                <div>
                                    <h2>Similar Item Purchase History</h2>
                                    <p>
                                        {normalizeName(activeHistoryItem?.name)
                                            ? `Showing recent purchases for ${activeHistoryItem.name}`
                                            : "Select or type an item to see its recent purchase history."}
                                    </p>
                                </div>
                            </div>
                            <div className="datatable-toolbar px-0 pt-0">
                                <div className="datatable-toolbar-start">
                                    <label className="datatable-length">
                                        <span>Show</span>
                                        <select className="form-select form-select-sm datatable-page-size" aria-label="Purchase history rows per page" defaultValue="10">
                                            <option value="10">10</option>
                                            <option value="25">25</option>
                                            <option value="50">50</option>
                                        </select>
                                    </label>
                                </div>
                                <div className="datatable-toolbar-end">
                                    <div className="datatable-search">
                                        <input type="text" placeholder="Search Purchase History" aria-label="Search purchase history" readOnly />
                                    </div>
                                </div>
                            </div>
                            <div className="table-responsive app-table-wrap purchase-entry__history-table">
                                <table className="table app-table align-middle purchase-history-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>GRN</th>
                                            <th>HSNCode</th>
                                            <th>P.Rate</th>
                                            <th>PackQty</th>
                                            <th>Net Qty</th>
                                            <th>MRP</th>
                                            <th>Sale Rate</th>
                                            <th>Party Name</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="table-border-bottom-0">
                                        {similarItemHistory.length > 0 ? similarItemHistory.map((row) => (
                                            <tr key={row.id}>
                                                <td>{row.date ? String(row.date).slice(0, 10) : "-"}</td>
                                                <td>{row.grnNo}</td>
                                                <td>{row.hsn}</td>
                                                <td>{row.purchaseRate}</td>
                                                <td>{row.packQty}</td>
                                                <td>{row.netQty}</td>
                                                <td>{row.mrp}</td>
                                                <td>{row.saleRate}</td>
                                                <td>{row.partyName}</td>
                                                <td>
                                                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => applyHistoryRowToActiveItem(row)}>
                                                        Apply
                                                    </button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="10" style={styles.historyEmptyCell}>
                                                    No similar purchase history found yet for the active row.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="pagination-row">
                                <span>Showing 0 to {similarItemHistory.length} of {similarItemHistory.length} entries</span>
                                <nav aria-label="Purchase history pagination">
                                    <ul className="pagination mb-0">
                                        <li className="page-item disabled"><button className="page-link" type="button" aria-label="Previous"><i className="bx bx-chevron-left"></i></button></li>
                                        <li className="page-item active"><button className="page-link" type="button">1</button></li>
                                        <li className="page-item disabled"><button className="page-link" type="button" aria-label="Next"><i className="bx bx-chevron-right"></i></button></li>
                                    </ul>
                                </nav>
                            </div>
                            <div style={styles.mobileHistoryCards} className="purchase-entry__history-cards">
                                {similarItemHistory.length > 0 ? similarItemHistory.map((row) => (
                                    <article key={`history-card-${row.id}`} style={styles.mobileHistoryCard} className="app-card">
                                        <div style={styles.mobileHistoryGrid} className="purchase-entry__mobile-history-grid">
                                            <div><strong>Date</strong><div style={styles.subtleText}>{row.date ? String(row.date).slice(0, 10) : "-"}</div></div>
                                            <div><strong>GRN</strong><div style={styles.subtleText}>{row.grnNo}</div></div>
                                            <div><strong>HSN</strong><div style={styles.subtleText}>{row.hsn || "-"}</div></div>
                                            <div><strong>P.Rate</strong><div style={styles.subtleText}>{row.purchaseRate}</div></div>
                                            <div><strong>Net Qty</strong><div style={styles.subtleText}>{row.netQty}</div></div>
                                            <div><strong>MRP</strong><div style={styles.subtleText}>{row.mrp}</div></div>
                                            <div><strong>Sale Rate</strong><div style={styles.subtleText}>{row.saleRate}</div></div>
                                            <div><strong>Sub Style</strong><div style={styles.subtleText}>{row.subStyle || "-"}</div></div>
                                            <div style={{ gridColumn: "1 / -1" }}><strong>Party</strong><div style={styles.subtleText}>{row.partyName || "-"}</div></div>
                                            <button type="button" className="btn btn-sm btn-outline-primary" style={{ gridColumn: "1 / -1" }} onClick={() => applyHistoryRowToActiveItem(row)}>
                                                Apply to active item
                                            </button>
                                        </div>
                                    </article>
                                )) : (
                                    <div style={styles.historyEmptyCell}>No similar purchase history found yet for the active row.</div>
                                )}
                            </div>

                            <div style={styles.purchaseFooterLeft}>
                                <label style={styles.footerNarrationField}>
                                    <span style={styles.label}>Narration</span>
                                    <textarea value={narration} onChange={(e) => setNarration(e.target.value)} style={styles.footerNarrationInput} />
                                </label>

                                <div style={styles.footerQuickRow}>
                                    <button type="button" style={styles.secondaryButton} onClick={() => setShowMrpPreview((current) => !current)}>
                                        {showMrpPreview ? "Hide MRP" : "Show MRP"}
                                    </button>
                                    <div style={{ ...styles.taxMiniTable, gridTemplateColumns: isIntraState ? "0.7fr 1fr 1fr" : "0.7fr 1fr" }}>
                                        <div style={styles.taxMiniHead}>GST%</div>
                                        <div style={styles.taxMiniHead}>{isIntraState ? "CGST" : "IGST"}</div>
                                        {isIntraState ? <div style={styles.taxMiniHead}>SGST</div> : null}
                                        <input
                                            ref={(el) => { refs.current.gstRate = el; }}
                                            type="text"
                                            inputMode="decimal"
                                            value={gstRate}
                                            onChange={(e) => setGstRate(e.target.value)}
                                            onKeyDown={(e) => handleEnterNext(e, "discountTotal")}
                                            style={{ ...styles.taxMiniCell, ...styles.taxMiniInput }}
                                        />
                                        <div style={styles.taxMiniCell}>{isIntraState ? cgst.toFixed(2) : igst.toFixed(2)}</div>
                                        {isIntraState ? <div style={styles.taxMiniCell}>{sgst.toFixed(2)}</div> : null}
                                    </div>
                                </div>
                                {showMrpPreview ? (
                                    <div style={styles.mrpPreviewPanel}>
                                        <div style={styles.mrpPreviewTitle}>Current Row MRP Preview</div>
                                        <div style={styles.mrpPreviewList}>
                                            {rowsForValidation.length > 0 ? rowsForValidation.map((row) => (
                                                <div key={`mrp-preview-${row.id}`} style={styles.mrpPreviewItem}>
                                                    <span>{row.name || `Item ${items.findIndex((item) => item.id === row.id) + 1}`}</span>
                                                    <strong>MRP: {Number(row.mrp || 0).toFixed(2)}</strong>
                                                </div>
                                            )) : (
                                                <div style={styles.subtleText}>Add an item to preview its MRP.</div>
                                            )}
                                        </div>
                                    </div>
                                ) : null}

                                <div style={styles.footerButtonRow} className="purchase-entry__footer-buttons">
                                    <button type="button" onClick={openSaveConfirmModal} style={styles.primaryButton} disabled={savingPurchase}>
                                        {savingPurchase ? "Saving..." : purchaseId ? "Update" : "Add"}
                                    </button>
                                    <button type="button" style={styles.secondaryButton} onClick={() => refs.current.receiveDate?.focus()}>Edit</button>
                                    {canDeletePurchase ? <button type="button" style={styles.secondaryButton} onClick={deleteCurrentPurchase}>Delete</button> : null}
                                    <button type="button" style={styles.secondaryButton} onClick={() => navigate("/purchase")}>Search</button>
                                    <button type="button" onClick={resetForm} style={styles.secondaryButton}>Cancel</button>
                                    <button type="button" style={styles.secondaryButton} onClick={() => navigatePurchaseRecord(-1)}>{"<"}</button>
                                    <button type="button" style={styles.secondaryButton} onClick={() => navigatePurchaseRecord(1)}>{">"}</button>
                                    <button type="button" onClick={() => navigate("/purchase")} style={styles.secondaryButton}>Exit</button>
                                </div>
                            </div>

                        </div>

                        <div className="col-md-4">
                            <div className="card app-card mb-0 purchase-entry__summary">
                                <div className="card-body">
                                    <div className="mb-1 row gx-0 align-items-center">
                                        <div className="col-md-6">
                                            <label className="col-form-label">Total Amount :</label>
                                        </div>
                                        <div className="col-md-6">
                                            <input className="form-control" type="text" value={`Rs. ${subtotal.toFixed(2)}`} readOnly />
                                        </div>
                                    </div>

                                    <div className="mb-1 row gx-0 align-items-center">
                                        <div className="col-md-6">
                                            <label className="col-form-label">Discount on Total :</label>
                                        </div>
                                        <div className="col-md-2">
                                            <input
                                                className="form-control"
                                                ref={(el) => { refs.current.discountTotal = el; }}
                                                type="text"
                                                inputMode="decimal"
                                                value={discountTotal}
                                                onChange={(e) => setDiscountTotal(e.target.value)}
                                                onKeyDown={(e) => handleEnterNext(e, "addCharges")}
                                            />
                                        </div>
                                        <div className="col-md-4">
                                            <input className="form-control" type="text" value={`Rs. ${Number(discountTotal || 0).toFixed(2)}`} readOnly />
                                        </div>
                                    </div>

                                    <div className="mb-1 row gx-0 align-items-center">
                                        <div className="col-md-6">
                                            <label className="col-form-label">Add Charges :</label>
                                        </div>
                                        <div className="col-md-2">
                                            <input
                                                className="form-control"
                                                ref={(el) => { refs.current.addCharges = el; }}
                                                type="text"
                                                inputMode="decimal"
                                                value={addCharges}
                                                onChange={(e) => setAddCharges(e.target.value)}
                                                onKeyDown={(e) => handleEnterNext(e, "commission")}
                                            />
                                        </div>
                                        <div className="col-md-4">
                                            <input className="form-control" type="text" value={`Rs. ${Number(addCharges || 0).toFixed(2)}`} readOnly />
                                        </div>
                                    </div>

                                    <div className="mb-1 row gx-0 align-items-center">
                                        <div className="col-md-6">
                                            <label className="col-form-label">{gstDisplayLabel} :</label>
                                        </div>
                                        <div className="col-md-2">
                                            <input
                                                className="form-control"
                                                ref={(el) => { refs.current.gstRateSummary = el; }}
                                                type="text"
                                                inputMode="decimal"
                                                value={gstRate}
                                                onChange={(e) => setGstRate(e.target.value)}
                                                onKeyDown={(e) => handleEnterNext(e, "commission")}
                                            />
                                        </div>
                                        <div className="col-md-2">
                                            <input className="form-control" type="text" value={`Rs. ${gstDisplayValue.toFixed(2)}`} readOnly />
                                        </div>
                                        <div className="col-md-2">
                                            <input className="form-control" type="text" value={isIntraState ? `Rs. ${sgst.toFixed(2)}` : `Rs. ${igst.toFixed(2)}`} readOnly />
                                        </div>
                                    </div>

                                    <div className="mb-1 row gx-0 align-items-center">
                                        <div className="col-md-6">
                                            <label className="col-form-label">Add Cmsn / Charges :</label>
                                        </div>
                                        <div className="col-md-2">
                                            <input
                                                className="form-control"
                                                ref={(el) => { refs.current.commission = el; }}
                                                type="text"
                                                inputMode="decimal"
                                                value={commission}
                                                onChange={(e) => setCommission(e.target.value)}
                                                onKeyDown={(e) => handleEnterNext(e, "hamaliCharges")}
                                            />
                                        </div>
                                        <div className="col-md-4">
                                            <input className="form-control" type="text" value={`Rs. ${Number(commission || 0).toFixed(2)}`} readOnly />
                                        </div>
                                    </div>

                                    <div className="mb-1 row gx-0 align-items-center">
                                        <div className="col-md-6">
                                            <label className="col-form-label">Auto R.Off :</label>
                                        </div>
                                        <div className="col-md-6">
                                            <input className="form-control" type="text" inputMode="decimal" value={packingRoundoff} readOnly />
                                        </div>
                                    </div>

                                    <div className="mb-1 row gx-0 align-items-center">
                                        <div className="col-md-6">
                                            <label className="col-form-label">Misc Expenses :</label>
                                        </div>
                                        <div className="col-md-6">
                                            <input
                                                className="form-control"
                                                ref={(el) => { refs.current.hamaliCharges = el; }}
                                                type="text"
                                                inputMode="decimal"
                                                value={hamaliCharges}
                                                onChange={(e) => setHamaliCharges(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="mb-1 row gx-0 align-items-center">
                                        <div className="col-md-6">
                                            <label className="col-form-label">Net Qty / Amount :</label>
                                        </div>
                                        <div className="col-md-2">
                                            <input className="form-control" type="text" value={netQty} readOnly />
                                        </div>
                                        <div className="col-md-4">
                                            <input className="form-control" type="text" value={`Rs. ${finalTotal.toFixed(2)}`} readOnly />
                                        </div>
                                        <div className="col-12 border-top mt-3 pt-3">
                                            <div className="form-check">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    checked={allowBillVariance}
                                                    onChange={(e) => setAllowBillVariance(e.target.checked)}
                                                    id="allowBillVariance"
                                                />
                                                <label className="form-check-label" htmlFor="allowBillVariance">
                                                    Allow bill variance if supplier invoice differs from system total
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div style={styles.section} className="purchase-entry__section">
                <div style={styles.sectionTitleRow}>
                    <div>
                        <h3 style={styles.sectionTitle}>Bill Scanner & Attachments</h3>
                        <p style={styles.subtleText}>Upload a supplier bill photo or PDF, review the scan, then apply it to this purchase entry.</p>
                    </div>
                    <div style={styles.headerActions}>
                        <button type="button" style={styles.primaryButton} onClick={() => billScanInputRef.current?.click()} disabled={billScanLoading}>
                            {billScanLoading ? "Scanning..." : "Scan Purchase Bill"}
                        </button>
                        <label style={styles.secondaryButton}>
                            Add Invoice Files
                            <input type="file" multiple accept="image/*,.pdf" onChange={handleAttachmentSelect} style={{ display: "none" }} />
                        </label>
                        <input
                            ref={billScanInputRef}
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleBillScanFileSelect}
                            style={{ display: "none" }}
                        />
                    </div>
                </div>
                <div className="purchase-entry__bill-scanner-grid" style={styles.billScannerGrid}>
                    <div style={styles.billScannerPanel}>
                        <div style={styles.billScannerIcon}><i className="bx bx-scan"></i></div>
                        <div>
                            <div style={{ fontWeight: 800, color: "var(--text-main)" }}>AI bill scan draft</div>
                            <p style={styles.subtleText}>
                                The scanner creates a draft only. Values must be reviewed before saving the purchase.
                            </p>
                        </div>
                        <textarea
                            value={billScanText}
                            onChange={(event) => setBillScanText(event.target.value)}
                            placeholder="Optional: paste OCR text from the bill here for better extraction until the AI provider is connected."
                            style={{ ...styles.textarea, minHeight: 92 }}
                        />
                        <div style={styles.headerActions}>
                            <button
                                type="button"
                                style={styles.secondaryButton}
                                onClick={() => runPurchaseBillScan(attachments[attachments.length - 1])}
                                disabled={billScanLoading || attachments.length === 0}
                            >
                                Re-scan Latest Attachment
                            </button>
                            {billScanPreview ? (
                                <button type="button" style={styles.primaryButton} onClick={applyBillScanPreview}>
                                    Apply to Purchase Entry
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <div style={styles.billScannerPanel}>
                        {billScanPreview ? (
                            <>
                                <div style={styles.scanSummaryHeader}>
                                    <div>
                                        <div style={{ fontWeight: 800, color: "var(--text-main)" }}>Scan Preview</div>
                                        <p style={styles.subtleText}>{billScanPreview.status || "review_required"}</p>
                                    </div>
                                    <span style={styles.scanConfidencePill}>
                                        {Math.round(Number(billScanPreview.confidenceScore || 0) * 100)}% confidence
                                    </span>
                                </div>
                                <div style={styles.scanFieldGrid}>
                                    <div><span style={styles.detailLabel}>Party</span><strong>{billScanPreview.extracted?.party || "Needs review"}</strong></div>
                                    <div><span style={styles.detailLabel}>Bill No</span><strong>{billScanPreview.extracted?.billNo || "Needs review"}</strong></div>
                                    <div><span style={styles.detailLabel}>Bill Date</span><strong>{billScanPreview.extracted?.billDate || "Needs review"}</strong></div>
                                    <div><span style={styles.detailLabel}>Bill Amount</span><strong>{billScanPreview.extracted?.billAmount ? `Rs. ${billScanPreview.extracted.billAmount}` : "Needs review"}</strong></div>
                                    <div><span style={styles.detailLabel}>Items</span><strong>{billScanPreview.extracted?.items?.length || 0}</strong></div>
                                </div>
                                {billScanPreview.warnings?.length ? (
                                    <div style={styles.scanWarningBox}>
                                        {billScanPreview.warnings.map((warning) => (
                                            <div key={warning}><i className="bx bx-info-circle"></i> {warning}</div>
                                        ))}
                                    </div>
                                ) : null}
                            </>
                        ) : (
                            <div style={styles.subtleText}>No scan preview yet. Use “Scan Purchase Bill” to start.</div>
                        )}
                    </div>
                </div>
                {attachments.length === 0 ? (
                    <div style={styles.subtleText}>No attachments added yet.</div>
                ) : (
                    <div style={styles.attachmentList}>
                        {attachments.map((attachment) => (
                            <div key={attachment.id || attachment._id} style={styles.attachmentRow}>
                                <div>
                                    <div style={{ fontWeight: 700 }}>{attachment.name || "Attachment"}</div>
                                    <div style={styles.subtleText}>
                                        {(attachment.mimeType || "file")} • {Math.round(Number(attachment.size || 0) / 1024)} KB
                                    </div>
                                </div>
                                <div style={styles.headerActions}>
                                    {attachment.dataUrl ? (
                                        <a href={attachment.dataUrl} target="_blank" rel="noreferrer" style={styles.inlineLink}>View</a>
                                    ) : null}
                                    <button type="button" onClick={() => removeAttachment(attachment.id || attachment._id)} style={styles.removeButton}>Remove</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {pasteModalOpen ? (
                <div style={styles.modalBackdrop}>
                    <div style={styles.modal}>
                        <div style={styles.modalHeader}>
                            <div>
                                <h3 style={{ margin: 0 }}>Paste Item Rows</h3>
                                <p style={styles.subtleText}>Paste tab-separated rows in this order: Category, HSN, Brand, Size, Item, Qty, Unit, Purchase Rate, Disc %</p>
                            </div>
                            <button type="button" onClick={() => setPasteModalOpen(false)} style={styles.closeButton}>Close</button>
                        </div>
                        <textarea value={pasteValue} onChange={(e) => setPasteValue(e.target.value)} style={{ ...styles.textarea, minHeight: 220 }} />
                        <div style={styles.footerActions}>
                            <button type="button" onClick={() => setPasteModalOpen(false)} style={styles.secondaryButton}>Cancel</button>
                            <button type="button" onClick={importPastedRows} style={styles.primaryButton}>Import Rows</button>
                        </div>
                    </div>
                </div>
            ) : null}

            {modalState.open ? (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div className="modal fade show d-block" tabIndex="-1" aria-modal="true" role="dialog" onMouseDown={closeCreateModal}>
                        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" onMouseDown={(event) => event.stopPropagation()}>
                            <div className="modal-content">
                                <div className="modal-header">
                                    <div>
                                        <h5 className="modal-title">Create {ENTITY_LABELS[modalState.type]}</h5>
                                        <p className="mb-0 text-muted">Saved entries become available immediately in the dropdown list.</p>
                                    </div>
                                    <button type="button" className="btn-close" onClick={closeCreateModal} aria-label="Close"></button>
                                </div>

                                <div className="modal-body">
                                    <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                                        <div className="col-12 col-md-4">
                                            <label className="form-label">{ENTITY_LABELS[modalState.type]} Name</label>
                                            <input
                                                className="form-control"
                                                value={modalState.form.name}
                                                onChange={(e) => updateModalField("name", e.target.value)}
                                                onKeyDown={(event) => handleEnterNext(event, modalState.type === "category" ? "modalHsn" : modalState.type === "transporter" ? "modalPhone" : undefined)}
                                            />
                                        </div>

                                        {modalState.type === "category" ? (
                                            <>
                                                <div className="col-12 col-md-4">
                                                    <label className="form-label">HSN Code</label>
                                                    <input
                                                        className="form-control"
                                                        ref={(el) => { refs.current.modalHsn = el; }}
                                                        value={modalState.form.hsn}
                                                        onChange={(e) => updateModalField("hsn", e.target.value)}
                                                    />
                                                </div>
                                                <div className="col-12 col-md-4">
                                                    <label className="form-label">Unit</label>
                                                    <div className="d-flex flex-wrap gap-3 min-h-40 align-items-center">
                                                        {UNIT_OPTIONS.map((option) => (
                                                            <label key={option} className="d-inline-flex align-items-center gap-2 mb-0">
                                                                <input
                                                                    type="radio"
                                                                    name="purchase-category-unit"
                                                                    value={option}
                                                                    checked={normalizeUnit(modalState.form.unit) === option}
                                                                    onChange={(e) => updateModalField("unit", e.target.value)}
                                                                />
                                                                <span>{option === "PCS" ? "Pieces (PCS)" : "Meters (MTRS)"}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            </>
                                        ) : null}

                                        {modalState.type === "transporter" ? (
                                            <div className="col-12 col-md-4">
                                                <label className="form-label">Phone</label>
                                                <input
                                                    className="form-control"
                                                    ref={(el) => { refs.current.modalPhone = el; }}
                                                    value={modalState.form.phone}
                                                    onChange={(e) => updateModalField("phone", e.target.value)}
                                                />
                                            </div>
                                        ) : DETAILED_ENTITY_TYPES.has(modalState.type) ? (
                                            <>
                                                <div className="col-12 col-md-4">
                                                    <label className="form-label">Contact Person</label>
                                                    <input className="form-control" value={modalState.form.contactPerson} onChange={(e) => updateModalField("contactPerson", e.target.value)} />
                                                </div>
                                                <div className="col-12 col-md-4">
                                                    <label className="form-label">Phone</label>
                                                    <input className="form-control" value={modalState.form.phone} onChange={(e) => updateModalField("phone", e.target.value)} />
                                                </div>
                                                <div className="col-12 col-md-4">
                                                    <label className="form-label">Email</label>
                                                    <input className="form-control" type="email" value={modalState.form.email} onChange={(e) => updateModalField("email", e.target.value)} />
                                                </div>
                                                <div className="col-12 col-md-4">
                                                    <label className="form-label">GST No</label>
                                                    <div className="input-group">
                                                        <input className="form-control" value={modalState.form.gstNo} onChange={(e) => updateModalField("gstNo", e.target.value.toUpperCase())} />
                                                        {GST_ENABLED_ENTITY_TYPES.has(modalState.type) ? (
                                                            <button type="button" className="btn btn_style" onClick={fetchGstDetails} disabled={modalState.loadingGst}>
                                                                {modalState.loadingGst ? "Fetching..." : "Fetch GST"}
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <div className="col-12 col-md-4">
                                                    <label className="form-label">Address Line 1</label>
                                                    <input className="form-control" value={modalState.form.addressLine1} onChange={(e) => updateModalField("addressLine1", e.target.value)} />
                                                </div>
                                                <div className="col-12 col-md-4">
                                                    <label className="form-label">Address Line 2</label>
                                                    <input className="form-control" value={modalState.form.addressLine2} onChange={(e) => updateModalField("addressLine2", e.target.value)} />
                                                </div>
                                                <div className="col-12 col-md-4">
                                                    <label className="form-label">City</label>
                                                    <input className="form-control" value={modalState.form.city} onChange={(e) => updateModalField("city", e.target.value)} />
                                                </div>
                                                <div className="col-12 col-md-4">
                                                    <label className="form-label">State</label>
                                                    <input className="form-control" value={modalState.form.state} onChange={(e) => updateModalField("state", e.target.value)} />
                                                </div>
                                                <div className="col-12 col-md-4">
                                                    <label className="form-label">State Code</label>
                                                    <input className="form-control" value={modalState.form.stateCode} onChange={(e) => updateModalField("stateCode", e.target.value)} />
                                                </div>
                                                <div className="col-12 col-md-4">
                                                    <label className="form-label">Pincode</label>
                                                    <input className="form-control" value={modalState.form.pincode} onChange={(e) => updateModalField("pincode", e.target.value)} />
                                                </div>
                                                <div className="col-12 col-md-4">
                                                    <label className="form-label">Bank Name</label>
                                                    <input className="form-control" value={modalState.form.bankName} onChange={(e) => updateModalField("bankName", e.target.value)} />
                                                </div>
                                                <div className="col-12 col-md-4">
                                                    <label className="form-label">Bank Branch</label>
                                                    <input className="form-control" value={modalState.form.bankBranch} onChange={(e) => updateModalField("bankBranch", e.target.value)} />
                                                </div>
                                                <div className="col-12 col-md-4">
                                                    <label className="form-label">Account No</label>
                                                    <input className="form-control" value={modalState.form.accountNo} onChange={(e) => updateModalField("accountNo", e.target.value)} />
                                                </div>
                                                <div className="col-12 col-md-4">
                                                    <label className="form-label">IFSC</label>
                                                    <input className="form-control" value={modalState.form.ifsc} onChange={(e) => updateModalField("ifsc", e.target.value.toUpperCase())} />
                                                </div>
                                                <div className="col-12">
                                                    <label className="form-label">Notes</label>
                                                    <textarea className="form-control" rows="4" value={modalState.form.notes} onChange={(e) => updateModalField("notes", e.target.value)} />
                                                </div>
                                            </>
                                        ) : modalState.type !== "category" && modalState.type !== "brand" ? (
                                            <>
                                                <div className="col-12 col-md-4">
                                                    <label className="form-label">Phone</label>
                                                    <input className="form-control" value={modalState.form.phone} onChange={(e) => updateModalField("phone", e.target.value)} />
                                                </div>
                                                <div className="col-12 col-md-8">
                                                    <label className="form-label">Notes</label>
                                                    <input className="form-control" value={modalState.form.notes} onChange={(e) => updateModalField("notes", e.target.value)} />
                                                </div>
                                            </>
                                        ) : null}
                                    </form>
                                </div>

                                <div className="modal-footer">
                                    <button type="button" onClick={closeCreateModal} className="btn btn_style inActive">Cancel</button>
                                    <button type="button" onClick={saveEntity} className="btn btn_style">Save</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}

            {saveConfirmState.open ? (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" aria-hidden="false">
                        <div className="modal-dialog modal-dialog-centered" onMouseDown={(event) => event.stopPropagation()}>
                            <div className="modal-content">
                                <div className="modal-header">
                                    <div>
                                        <h5 className="modal-title">{saveConfirmState.title}</h5>
                                        <p className="mb-0 text-muted">{saveConfirmState.message}</p>
                                    </div>
                                    <button type="button" className="btn-close" onClick={closeSaveConfirmModal} aria-label="Close"></button>
                                </div>
                                <div className="modal-body">
                                    <div className="row g-3">
                                        <div className="col-6">
                                            <div className="summary-line">
                                                <span>GRN</span>
                                                <strong>{grnNo || "-"}</strong>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="summary-line">
                                                <span>Bill No</span>
                                                <strong>{billNo || "-"}</strong>
                                            </div>
                                        </div>
                                        <div className="col-12">
                                            <div className="summary-line">
                                                <span>Party</span>
                                                <strong>{party || "-"}</strong>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="summary-line">
                                                <span>Items</span>
                                                <strong>{rowsForValidation.length}</strong>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="summary-line">
                                                <span>Net Qty</span>
                                                <strong>{netQty}</strong>
                                            </div>
                                        </div>
                                        <div className="col-12">
                                            <div className="summary-line">
                                                <span>Final Total</span>
                                                <strong>Rs. {finalTotal.toFixed(2)}</strong>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" onClick={closeSaveConfirmModal} className="btn btn_style inActive">Cancel</button>
                                    <button
                                        ref={saveConfirmYesRef}
                                        type="button"
                                        onClick={() => {
                                            closeSaveConfirmModal();
                                            savePurchase();
                                        }}
                                        className="btn btn_style"
                                        disabled={savingPurchase}
                                    >
                                        {savingPurchase ? "Saving..." : saveConfirmState.title}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
};

export default PurchaseEntry;
