import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import LabelPrintModal from "../labelPrinting/LabelPrintModal";
import useAppSettings from "../../hooks/useAppSettings.js";
import { buildLabelDraft, buildLabelPrintHtml, normalizeBarcodeFormat } from "../labelPrinting/labelPrintUtils.jsx";
import { notifyError, notifyInfo, notifySuccess } from "../../utils/notify";
import { ROLE_GROUPS, getCurrentRole, hasRole } from "../../utils/permissions";
import {
    API_BASE,
    COMPANY_STATE_CODE,
    EMPTY_FILTERS,
    UNIT_OPTIONS,
    asNumber,
    createBillDraft,
    createItemDraft,
    enrichBillsWithInventory,
    formatDate,
    getDisplayText,
    getInputMode,
    getLowerText,
    handleAdvanceOnEnter,
    hasValidSearchFilters,
    mapItemToDraft,
    mapBillToDraft,
    normalizeInputType,
    recalculateItem,
    request,
    toPositiveNumber,
} from "./manageReceiveUtils.js";

const ManageReceive = () => {
    const currentRole = getCurrentRole();
    const canDeletePurchase = hasRole(currentRole, ROLE_GROUPS.adminOnly);
    const appSettings = useAppSettings();
    const filterInputRefs = useRef({});
    const findButtonRef = useRef(null);
    const billModalFirstInputRef = useRef(null);
    const itemModalFirstInputRef = useRef(null);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [bills, setBills] = useState([]);
    const [draft, setDraft] = useState(createBillDraft);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [selectedBillId, setSelectedBillId] = useState(null);
    const [isBillModalOpen, setIsBillModalOpen] = useState(false);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [itemDraft, setItemDraft] = useState(createItemDraft);
    const [editingItemId, setEditingItemId] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [labelPrintBill, setLabelPrintBill] = useState(null);
    const [selectedItemIndex, setSelectedItemIndex] = useState(null);
    const [isQuickPrintOpen, setIsQuickPrintOpen] = useState(false);
    const [quickPrintQty, setQuickPrintQty] = useState(1);
    const [quickPrintItem, setQuickPrintItem] = useState(null);
    const [quickPrinting, setQuickPrinting] = useState(false);
    const quickPrintInputRef = useRef(null);
    const [billPageSize, setBillPageSize] = useState(10);
    const [itemPageSize, setItemPageSize] = useState(10);
    const [billStatusFilter, setBillStatusFilter] = useState("");
    const [itemStatusFilter, setItemStatusFilter] = useState("");
    const [queueSearch, setQueueSearch] = useState("");
    const [itemTableSearch, setItemTableSearch] = useState("");
    const hasActiveSearchFilters = useMemo(() => hasValidSearchFilters(filters), [filters]);
    const filterFieldOrder = useMemo(
        () => ["grn", "party", "supplier", "agent", "billNo", "billDate", "lrNo", "category", "brand", "itemName", "barcode"],
        [],
    );

    const loadBills = useCallback(async (nextSelectedBillId = selectedBillId, searchTriggered = false) => {
        setLoading(true);
        try {
            const [purchaseData, inventoryData] = await Promise.all([
                request(`${API_BASE}/purchases`, { method: "GET" }),
                request(`${API_BASE}/inventory`, { method: "GET" }),
            ]);
            const nextBills = enrichBillsWithInventory(
                purchaseData.data || [],
                inventoryData.data || [],
            );
            setBills(nextBills);
            setError("");
            setHasSearched(searchTriggered || hasSearched);

            if (nextSelectedBillId) {
                const nextBill = nextBills.find((bill) => bill._id === nextSelectedBillId);
                if (nextBill) {
                    setDraft(mapBillToDraft(nextBill));
                    setSelectedBillId(nextSelectedBillId);
                    setLoading(false);
                    return;
                }
            }
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [hasSearched, selectedBillId]);

    const filteredBills = useMemo(() => bills.filter((bill) => {
        const partyName = getDisplayText(bill.party?.name || bill.party);
        const supplierName = getDisplayText(bill.supplier || bill.supplierAgent);
        const agentName = getDisplayText(bill.agent || bill.supplierAgent);
        const lrNo = getDisplayText(bill.lrNo);
        const grn = getDisplayText(bill.grnNo);
        const billDate = bill.billDate ? String(bill.billDate).slice(0, 10) : "";

        if (filters.grn && !getLowerText(grn).includes(filters.grn.toLowerCase())) return false;
        if (filters.party && !getLowerText(partyName).includes(filters.party.toLowerCase())) return false;
        if (filters.supplier && !getLowerText(supplierName).includes(filters.supplier.toLowerCase())) return false;
        if (filters.agent && !getLowerText(agentName).includes(filters.agent.toLowerCase())) return false;
        if (filters.billNo && !String(bill.billNo || "").toLowerCase().includes(filters.billNo.toLowerCase())) return false;
        if (filters.lrNo && !getLowerText(lrNo).includes(filters.lrNo.toLowerCase())) return false;
        if (filters.billDate && billDate !== filters.billDate) return false;

        if (filters.category || filters.brand || filters.itemName || filters.barcode) {
            return (bill.items || []).some((item) => {
                const category = getDisplayText(item.category?.name || item.category);
                const brand = getDisplayText(item.brand?.name || item.brand);
                const itemName = getDisplayText(item.name || item.itemName);
                const barcode = String(item.barcode || "");

                if (filters.category && !getLowerText(category).includes(filters.category.toLowerCase())) return false;
                if (filters.brand && !getLowerText(brand).includes(filters.brand.toLowerCase())) return false;
                if (filters.itemName && !getLowerText(itemName).includes(filters.itemName.toLowerCase())) return false;
                if (filters.barcode && !barcode.toLowerCase().includes(filters.barcode.toLowerCase())) return false;
                return true;
            });
        }

        return true;
    }), [bills, filters]);

    const getLabelTargetForItem = useCallback((item = {}) => {
        const unit = String(item.unit || "").toUpperCase();
        if (["MTR", "MTRS", "METER", "METERS"].includes(unit)) {
            return 1;
        }
        return Math.max(Math.ceil(Number(item.qty || 0)), 0);
    }, []);
    const getRemainingLabelCount = useCallback((item = {}) => {
        if (item.labelsPrinted) return 0;
        return Math.max(getLabelTargetForItem(item) - Number(item.printedLabels || 0), 0);
    }, [getLabelTargetForItem]);
    const getBillPendingLabelCount = useCallback(
        (bill = {}) => (bill.items || []).reduce((sum, item) => sum + getRemainingLabelCount(item), 0),
        [getRemainingLabelCount],
    );
    const getDefaultSalesQtyForItem = useCallback((item = {}) => {
        const unit = String(item.unit || "").toUpperCase();
        const defaultSalesQty = Number(item.defQty || item.defaultSalesQty || 0);
        if (Number.isFinite(defaultSalesQty) && defaultSalesQty > 0) {
            return defaultSalesQty;
        }
        return ["MTR", "MTRS", "METER", "METERS"].includes(unit)
            ? Math.max(Number(item.qty || 1), 1)
            : 1;
    }, []);
    const getReceivingQtyForLabel = useCallback((item = {}) => {
        const receivingQty = Number(item.qty || 0);
        return Number.isFinite(receivingQty) && receivingQty > 0 ? receivingQty : 1;
    }, []);

    const visibleBills = useMemo(() => {
        if (!hasSearched) return [];
        return filteredBills.filter((bill) => {
            if (billStatusFilter === "Pending" && bill.received) return false;
            if (billStatusFilter === "Received" && !bill.received) return false;
            if (billStatusFilter === "Labels Pending" && getBillPendingLabelCount(bill) <= 0) return false;
            if (billStatusFilter === "Labels Printed" && getBillPendingLabelCount(bill) > 0) return false;
            if (queueSearch) {
                const haystack = [
                    bill.grnNo,
                    bill.billNo,
                    bill.lrNo,
                    bill.party?.name || bill.party,
                    bill.supplier || bill.supplierAgent,
                ].join(" ").toLowerCase();
                if (!haystack.includes(queueSearch.toLowerCase())) return false;
            }
            return true;
        });
    }, [billStatusFilter, filteredBills, getBillPendingLabelCount, hasSearched, queueSearch]);
    const pagedBills = useMemo(() => visibleBills.slice(0, billPageSize), [billPageSize, visibleBills]);
    const pendingReceiveCount = useMemo(
        () => visibleBills.filter((bill) => !bill.received).length,
        [visibleBills]
    );
    const pendingLabelCount = useMemo(
        () => visibleBills.reduce((sum, bill) => sum + getBillPendingLabelCount(bill), 0),
        [getBillPendingLabelCount, visibleBills]
    );

    useEffect(() => {
        if (!hasSearched) {
            setSelectedBillId(null);
            return;
        }

        if (visibleBills.length === 0) {
            setSelectedBillId(null);
            return;
        }

        const activeBill = visibleBills.find((bill) => bill._id === selectedBillId);
        if (!activeBill) {
            setSelectedBillId(visibleBills[0]._id);
        }
    }, [hasSearched, selectedBillId, visibleBills]);

    const selectedBill = visibleBills.find((bill) => bill._id === selectedBillId) || null;
    const selectedBillItems = useMemo(
        () => (selectedBill?.items || []).map((item, index) => mapItemToDraft(item, `${selectedBill._id}-${index}`)),
        [selectedBill],
    );
    const visibleSelectedBillItems = useMemo(() => selectedBillItems.map((item, index) => ({ ...item, originalIndex: index })).filter((item) => {
        if (itemStatusFilter === "Pending Labels" && getRemainingLabelCount(item) <= 0) return false;
        if (itemStatusFilter === "Labels Printed" && getRemainingLabelCount(item) > 0) return false;
        if (itemTableSearch) {
            const haystack = [
                item.barcode,
                item.category,
                item.brand,
                item.name,
                item.designNo,
            ].join(" ").toLowerCase();
            if (!haystack.includes(itemTableSearch.toLowerCase())) return false;
        }
        return true;
    }).slice(0, itemPageSize), [getRemainingLabelCount, itemPageSize, itemStatusFilter, itemTableSearch, selectedBillItems]);
    const selectedItem = selectedBillItems[selectedItemIndex ?? -1] || null;
    const selectedBillItemCount = selectedBill?.items?.length || 0;
    const selectedBillParty = getDisplayText(selectedBill?.party?.name || selectedBill?.party, "-");
    const selectedBillFirm = getDisplayText(selectedBill?.firm, "-");

    useEffect(() => {
        if (selectedBill) {
            setDraft(mapBillToDraft(selectedBill));
        }
    }, [selectedBill]);

    useEffect(() => {
        setSelectedItemIndex(selectedBill?.items?.length ? 0 : null);
    }, [selectedBillId, selectedBill?.items?.length]);

    useEffect(() => {
        if (!isBillModalOpen) {
            return;
        }

        requestAnimationFrame(() => {
            billModalFirstInputRef.current?.focus();
            billModalFirstInputRef.current?.select?.();
        });
    }, [isBillModalOpen]);

    useEffect(() => {
        if (!isItemModalOpen) {
            return;
        }

        requestAnimationFrame(() => {
            itemModalFirstInputRef.current?.focus();
            itemModalFirstInputRef.current?.select?.();
        });
    }, [isItemModalOpen]);

    useEffect(() => {
        if (!isQuickPrintOpen) {
            return;
        }

        requestAnimationFrame(() => {
            quickPrintInputRef.current?.focus();
            quickPrintInputRef.current?.select?.();
        });
    }, [isQuickPrintOpen]);

    const handleFilterEnter = useCallback((event, fieldKey) => {
        if (event.key !== "Enter") {
            return;
        }

        event.preventDefault();
        const currentIndex = filterFieldOrder.indexOf(fieldKey);
        const nextFieldKey = filterFieldOrder[currentIndex + 1];

        if (nextFieldKey) {
            const nextField = filterInputRefs.current[nextFieldKey];
            nextField?.focus?.();
            nextField?.select?.();
            return;
        }

        findButtonRef.current?.focus?.();
    }, [filterFieldOrder]);

    const handleSelectBill = (bill) => {
        setSelectedBillId(bill._id);
    };

    const handleOpenBillModal = (bill) => {
        setSelectedBillId(bill._id);
        setDraft(mapBillToDraft(bill));
        setIsBillModalOpen(true);
    };

    const handleNewBill = () => {
        setSelectedBillId(null);
        setDraft(createBillDraft());
        setIsBillModalOpen(true);
    };

    const handleCloseBillModal = () => {
        setIsBillModalOpen(false);
    };

    const handleOpenItemModal = (item) => {
        setEditingItemId(item.id);
        setItemDraft(recalculateItem({ ...item }));
        setIsItemModalOpen(true);
    };

    const handleAddItemModal = () => {
        const nextItem = createItemDraft();
        setEditingItemId(nextItem.id);
        setItemDraft(nextItem);
        setIsItemModalOpen(true);
    };

    const handleAddItemForBill = (bill) => {
        const nextItem = createItemDraft();
        setSelectedBillId(bill._id);
        setDraft(mapBillToDraft(bill));
        setEditingItemId(nextItem.id);
        setItemDraft(nextItem);
        setIsItemModalOpen(true);
    };

    const handleCloseItemModal = () => {
        setIsItemModalOpen(false);
        setEditingItemId(null);
    };

    const openLabelWorkbench = (bill, targetItem = null) => {
        const sourceBill = bill || selectedBill;
        if (!sourceBill?._id) {
            return;
        }

        const sourceItems = (sourceBill.items || []).map((item, index) => ({
            ...item,
            _id: item._id || `${sourceBill._id}-${index}`,
            name: item.itemName || item.name,
            itemId: item.itemId?._id || item.itemId || item._id || `${sourceBill._id}-${index}`,
            category: item.category,
            brand: item.brand,
            material: item.material || item.fabric,
            color: item.color || item.colour,
        }));

        const nextItems = targetItem
            ? sourceItems.filter((item) => String(item.itemId || item._id) === String(targetItem.itemId || targetItem._id || targetItem.id))
            : sourceItems;

        if (nextItems.length === 0) {
            setError("No matching item found for label printing.");
            notifyError("No matching item found for label printing.");
            return;
        }

        setLabelPrintBill({
            ...sourceBill,
            items: nextItems,
        });
    };

    const handleOpenQuickPrint = () => {
        if (!selectedBill?._id || !selectedItem) {
            setError("Select an item first to print labels.");
            notifyError("Select an item first to print labels.");
            return;
        }

        setQuickPrintItem(selectedItem);
        setQuickPrintQty(Math.max(getRemainingLabelCount(selectedItem) || getLabelTargetForItem(selectedItem), 1));
        setIsQuickPrintOpen(true);
    };

    const handleCloseQuickPrint = () => {
        if (quickPrinting) return;
        setIsQuickPrintOpen(false);
        setQuickPrintItem(null);
    };

    const handleOpenQuickPrintForItem = (item, index) => {
        if (!selectedBill?._id || !item) {
            setError("Select an item first to print labels.");
            notifyError("Select an item first to print labels.");
            return;
        }

        setSelectedItemIndex(index);
        setQuickPrintItem(item);
        setQuickPrintQty(Math.max(getRemainingLabelCount(item) || getLabelTargetForItem(item), 1));
        setIsQuickPrintOpen(true);
    };

    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key !== "Escape") {
                return;
            }

            if (isQuickPrintOpen) {
                event.preventDefault();
                handleCloseQuickPrint();
                return;
            }

            if (isItemModalOpen) {
                event.preventDefault();
                handleCloseItemModal();
                return;
            }

            if (isBillModalOpen) {
                event.preventDefault();
                handleCloseBillModal();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isBillModalOpen, isItemModalOpen, isQuickPrintOpen, quickPrinting]);

    const openPrintSheet = (html) =>
        new Promise((resolve) => {
            if (typeof document === "undefined") {
                resolve(false);
                return;
            }

            const iframe = document.createElement("iframe");
            iframe.style.position = "fixed";
            iframe.style.width = "0";
            iframe.style.height = "0";
            iframe.style.right = "0";
            iframe.style.bottom = "0";
            iframe.style.border = "0";
            document.body.appendChild(iframe);

            const printWindow = iframe.contentWindow;
            const printDocument = printWindow?.document;
            if (!printWindow || !printDocument) {
                document.body.removeChild(iframe);
                resolve(false);
                return;
            }

            printDocument.open();
            printDocument.write(html);
            printDocument.close();

            let settled = false;
            const finalize = (printed) => {
                if (settled) return;
                settled = true;
                setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                    }
                    resolve(printed);
                }, 250);
            };

            setTimeout(() => finalize(false), 30000);

            iframe.onload = () => {
                const triggerPrint = () => {
                    try {
                        const barcodeNodes = Array.from(printWindow.document.querySelectorAll(".barcode-svg"));
                        barcodeNodes.forEach((barcodeNode) => {
                            JsBarcode(barcodeNode, barcodeNode.getAttribute("jsbarcode-value") || "", {
                                format: barcodeNode.getAttribute("jsbarcode-format") || "CODE128",
                                displayValue: false,
                                width: Number(barcodeNode.getAttribute("jsbarcode-width") || 1.35),
                                height: Number(barcodeNode.getAttribute("jsbarcode-height") || 22),
                                margin: 0,
                                background: "#ffffff",
                            });
                        });
                    } catch (error) {
                        console.error("Print barcode render failed:", error);
                        notifyError("Unable to render barcode for printing.");
                        finalize(false);
                        return;
                    }
                    printWindow.addEventListener("afterprint", () => finalize(true), { once: true });
                    printWindow.focus();
                    printWindow.print();
                    setTimeout(() => finalize(true), 10000);
                };

                if (printWindow.document?.fonts?.ready) {
                    printWindow.document.fonts.ready.then(triggerPrint);
                } else {
                    setTimeout(triggerPrint, 300);
                }
            };
        });

    const createPrintableItem = (item, printQty, fallbackKey) => ({
        ...item,
        _id: item._id || fallbackKey,
        itemId: item.itemId?._id || item.itemId || item._id || fallbackKey,
        name: item.itemName || item.name,
        barcode: item.barcode || item.itemId?.barcode || "",
        colour: item.color || item.colour || "",
        fabric: item.material || item.fabric || "",
        per: item.percentage || item.per || 0,
        purchaseRate: toPositiveNumber(item.purchaseRate, 0),
        mrp: toPositiveNumber(item.mrp, toPositiveNumber(item.saleRate, 0)),
        saleRate: toPositiveNumber(item.saleRate, toPositiveNumber(item.mrp, 0)),
        labels: printQty,
        printQty,
        qty: getReceivingQtyForLabel(item),
    });

    const getLatestLabelsByItem = useCallback(async (itemsToPrint) => {
        const uniqueItemIds = Array.from(
            new Set(
                itemsToPrint
                    .map((item) => String(item.itemId || "").trim())
                    .filter(Boolean),
            ),
        );

        const entries = await Promise.all(
            uniqueItemIds.map(async (itemId) => {
                try {
                    const response = await request(`${API_BASE}/label/item/${itemId}`, { method: "GET" });
                    return [itemId, Array.isArray(response.data) ? response.data[0] || null : null];
                } catch (error) {
                    console.error("Failed to load label history for item", itemId, error);
                    return [itemId, null];
                }
            }),
        );

        return new Map(entries);
    }, []);

    const printItemsDirectly = async (itemsToPrint) => {
        if (!selectedBill?._id || !Array.isArray(itemsToPrint) || itemsToPrint.length === 0) {
            return;
        }

        try {
            setQuickPrinting(true);
            const latestLabelByItemId = await getLatestLabelsByItem(itemsToPrint);
            const needsFreshBarcode = itemsToPrint.some((item) => {
                const latestLabel = latestLabelByItemId.get(String(item.itemId || "")) || null;
                return !item.barcode && !latestLabel?.barcode;
            });
            let barcodeCursor = 1000;
            if (needsFreshBarcode) {
                const nextBarcodeResponse = await request(`${API_BASE}/label/next-barcode`, { method: "GET" });
                barcodeCursor = Number(nextBarcodeResponse.data?.nextBarcode || "1000") || 1000;
            }
            const resolvedPrintItems = itemsToPrint.map((printItem) => {
                const latestLabel = latestLabelByItemId.get(String(printItem.itemId || "")) || null;
                const fallbackBarcode = String(barcodeCursor);
                const targetBarcode = String(
                    printItem.barcode ||
                    latestLabel?.barcode ||
                    fallbackBarcode,
                );
                const normalizedBarcode = normalizeBarcodeFormat(appSettings.barcodeFormat, targetBarcode);
                if (!printItem.barcode && !latestLabel?.barcode) {
                    barcodeCursor += 1;
                }

                return {
                    ...printItem,
                    barcode: normalizedBarcode.value,
                    mrp: toPositiveNumber(printItem.mrp, toPositiveNumber(latestLabel?.mrp, toPositiveNumber(latestLabel?.price, 0))),
                    saleRate: toPositiveNumber(
                        printItem.saleRate,
                        toPositiveNumber(latestLabel?.saleRate, toPositiveNumber(latestLabel?.price, 0)),
                    ),
                    purchaseRate: toPositiveNumber(printItem.purchaseRate, toPositiveNumber(latestLabel?.purchaseRate, 0)),
                };
            });

            const labelHtml = buildLabelPrintHtml({
                labels: resolvedPrintItems.map((printItem) =>
                    buildLabelDraft({
                        row: printItem,
                        barcode: printItem.barcode,
                        companyName: appSettings.companyName,
                        billNo: selectedBill.billNo,
                        partyName: getDisplayText(selectedBill.party?.name || selectedBill.party, ""),
                    }),
                ),
                labelSize: appSettings.labelSize || "50x25",
                companyName: appSettings.companyName,
                billNo: selectedBill.billNo,
                barcodeFormat: appSettings.barcodeFormat,
            });

            const confirmed = await openPrintSheet(labelHtml);
            if (!confirmed) {
                return;
            }

            for (const printItem of resolvedPrintItems) {
                await request(`${API_BASE}/label/create`, {
                    method: "POST",
                    body: JSON.stringify({
                        productName: printItem.name,
                        barcode: printItem.barcode || undefined,
                        price: Number(printItem.saleRate || 0),
                        purchaseRate: Number(printItem.purchaseRate || 0),
                        qty: Number(printItem.qty || 1),
                        printQty: Number(printItem.printQty || printItem.labels || 1),
                        copies: 1,
                        category: printItem.category?._id || printItem.category || "",
                        itemId: printItem.itemId,
                        brand: printItem.brand?._id || printItem.brand || null,
                        unit: printItem.unit || null,
                        mrp: Number(printItem.mrp || 0),
                        saleRate: Number(printItem.saleRate || 0),
                        markupPercent: Number(printItem.per || 0),
                        gstPercent: 0,
                        color: printItem.colour || "",
                        material: printItem.fabric || "",
                        style: printItem.style || "",
                        subStyle: printItem.subStyle || "",
                        designNo: printItem.designNo || "",
                        printer: appSettings.labelPrinter || "Zebra ZD230",
                        labelSize: appSettings.labelSize || "50x25",
                        billId: selectedBill._id,
                        skipInventorySync: true,
                    }),
                });
            }

            setError("");
            notifySuccess("Labels printed successfully.");
            handleCloseQuickPrint();
            await loadBills(selectedBill._id, hasSearched);
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to print labels.");
            notifyError(err.message || "Failed to print labels.");
        } finally {
            setQuickPrinting(false);
        }
    };

    const reprintItemDirectly = async (itemToPrint, reprintQty = 1) => {
        if (!selectedBill?._id || !itemToPrint) {
            return;
        }

        try {
            setQuickPrinting(true);
            const printItem = createPrintableItem(
                itemToPrint,
                Math.max(Number(reprintQty || 1), 1),
                `${selectedBill._id}-${selectedItemIndex ?? 0}`,
            );
            const latestLabelByItemId = await getLatestLabelsByItem([printItem]);
            const latestLabel = latestLabelByItemId.get(String(printItem.itemId || "")) || null;
            if (!latestLabel?._id || !latestLabel?.barcode) {
                setError("No printed barcode found for this item. Open Label Workbench to create the first label.");
                notifyError("No printed barcode found for this item. Open Label Workbench to create the first label.");
                return;
            }

            const normalizedBarcode = normalizeBarcodeFormat(appSettings.barcodeFormat, latestLabel.barcode);
            if (!normalizedBarcode.value) {
                setError("Saved barcode is invalid for reprint.");
                notifyError("Saved barcode is invalid for reprint.");
                return;
            }

            const reprintItem = {
                ...printItem,
                barcode: normalizedBarcode.value,
                mrp: toPositiveNumber(printItem.mrp, toPositiveNumber(latestLabel.mrp, toPositiveNumber(latestLabel.price, 0))),
                saleRate: toPositiveNumber(printItem.saleRate, toPositiveNumber(latestLabel.saleRate, toPositiveNumber(latestLabel.price, 0))),
                purchaseRate: toPositiveNumber(printItem.purchaseRate, toPositiveNumber(latestLabel.purchaseRate, 0)),
            };

            const labelHtml = buildLabelPrintHtml({
                labels: [
                    buildLabelDraft({
                        row: reprintItem,
                        barcode: reprintItem.barcode,
                        companyName: appSettings.companyName,
                        billNo: selectedBill.billNo,
                        partyName: getDisplayText(selectedBill.party?.name || selectedBill.party, ""),
                    }),
                ],
                labelSize: appSettings.labelSize || "50x25",
                companyName: appSettings.companyName,
                billNo: selectedBill.billNo,
                barcodeFormat: appSettings.barcodeFormat,
            });

            const confirmed = await openPrintSheet(labelHtml);
            if (!confirmed) {
                return;
            }

            await request(`${API_BASE}/label/reprint/${latestLabel._id}`, {
                method: "POST",
                body: JSON.stringify({
                    qty: Number(reprintItem.printQty || 1),
                    copies: 1,
                    printer: appSettings.labelPrinter || "Zebra ZD230",
                    labelSize: appSettings.labelSize || "50x25",
                    mrp: Number(reprintItem.mrp || 0),
                    saleRate: Number(reprintItem.saleRate || 0),
                    markupPercent: Number(reprintItem.per || 0),
                    gstPercent: 0,
                }),
            });

            setError("");
            notifySuccess("Label reprinted successfully.");
            handleCloseQuickPrint();
            await loadBills(selectedBill._id, hasSearched);
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to reprint label.");
            notifyError(err.message || "Failed to reprint label.");
        } finally {
            setQuickPrinting(false);
        }
    };

    const handleQuickPrint = async () => {
        if (!selectedBill?._id || !quickPrintItem) {
            return;
        }

        if (getRemainingLabelCount(quickPrintItem) <= 0) {
            await reprintItemDirectly(quickPrintItem, quickPrintQty);
            return;
        }

        const remainingQty = Math.max(getRemainingLabelCount(quickPrintItem), 1);
        const qty = Math.min(Math.max(Number(quickPrintQty || 1), 1), remainingQty);
        const printItem = createPrintableItem(
            quickPrintItem,
            qty,
            `${selectedBill._id}-${selectedItemIndex ?? 0}`,
        );

        await printItemsDirectly([printItem]);
    };

    const handleQuickPrintAll = async () => {
        if (!selectedBill?._id || !(selectedBill.items || []).length) {
            setError("No items available to print.");
            notifyError("No items available to print.");
            return;
        }

        const itemsToPrint = selectedBillItems.map((item, index) =>
            createPrintableItem(item, getRemainingLabelCount(item), `${selectedBill._id}-${index}`),
        ).filter((item) => Number(item.printQty || 0) > 0);
        if (itemsToPrint.length === 0) {
            setError("All labels for this bill are already printed.");
            notifyInfo("All labels for this bill are already printed.");
            return;
        }

        await printItemsDirectly(itemsToPrint);
    };

    const handleLabelPrintSuccess = async ({ billId }) => {
        await loadBills(billId, hasSearched);
    };

    const handleSearch = async () => {
        if (!hasActiveSearchFilters) {
            setHasSearched(false);
            setBills([]);
            setSelectedBillId(null);
            setError("Enter at least one search filter before using Find.");
            notifyError("Enter at least one search filter before using Find.");
            return;
        }

        await loadBills(selectedBillId, true);
    };

    const handleClearSearch = () => {
        setFilters(EMPTY_FILTERS);
        setBills([]);
        setSelectedBillId(null);
        setHasSearched(false);
        setError("");
    };

    const updateDraftField = (field, value) => {
        setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
    };

    const removeItem = (id) => {
        setDraft((currentDraft) => ({
            ...currentDraft,
            items: currentDraft.items.length === 1
                ? [createItemDraft()]
                : currentDraft.items.filter((item) => item.id !== id),
        }));
    };

    const updateItemDraftField = (field, value) => {
        setItemDraft((currentItem) => recalculateItem({ ...currentItem, [field]: value }));
    };

    const buildPayload = (sourceDraft = draft) => {
        const items = sourceDraft.items
            .filter((item) => item.name.trim())
            .map((item) => ({
                _id: item._id || undefined,
                itemId: item.itemId || undefined,
                category: item.category.trim(),
                brand: item.brand.trim(),
                name: item.name.trim(),
                hsn: item.hsn.trim(),
                size: item.size.trim(),
                color: item.color.trim(),
                material: item.material.trim(),
                style: item.style.trim(),
                subStyle: item.subStyle.trim(),
                designNo: item.designNo.trim(),
                qty: asNumber(item.qty),
                unit: item.unit,
                purchaseRate: asNumber(item.purchaseRate),
                mrp: asNumber(item.mrp),
                saleRate: asNumber(item.saleRate),
                discount: asNumber(item.discount),
                netRate: asNumber(item.netRate),
                total: asNumber(item.total),
                received: Boolean(item.received),
                printedLabels: asNumber(item.printedLabels),
                labelsPrinted: Boolean(item.labelsPrinted),
            }));

        const subtotal = items.reduce((sum, item) => sum + asNumber(item.total), 0);
        const taxableAmount = subtotal - asNumber(sourceDraft.discountTotal);
        const isIntraState = String(sourceDraft.partyState || COMPANY_STATE_CODE) === COMPANY_STATE_CODE;
        const cgst = isIntraState ? (taxableAmount * asNumber(sourceDraft.gstRate)) / 200 : 0;
        const sgst = isIntraState ? (taxableAmount * asNumber(sourceDraft.gstRate)) / 200 : 0;
        const igst = isIntraState ? 0 : (taxableAmount * asNumber(sourceDraft.gstRate)) / 100;
        const totalGst = cgst + sgst + igst;
        const finalTotal = taxableAmount
            + totalGst
            + asNumber(sourceDraft.addCharges)
            + asNumber(sourceDraft.transportCharges)
            + asNumber(sourceDraft.commission)
            + asNumber(sourceDraft.packingRoundoff)
            + asNumber(sourceDraft.hamaliCharges);
        const netQty = items.reduce((sum, item) => sum + asNumber(item.qty), 0);

        return {
            grnNo: sourceDraft.grnNo.trim(),
            receiveDate: sourceDraft.receiveDate,
            lrId: sourceDraft.lrId.trim(),
            lrNo: sourceDraft.lrNo.trim(),
            bale: asNumber(sourceDraft.bale),
            transporter: sourceDraft.transporter.trim(),
            firm: sourceDraft.firm.trim(),
            party: sourceDraft.party.trim(),
            partyState: sourceDraft.partyState.trim() || COMPANY_STATE_CODE,
            supplier: sourceDraft.supplier.trim(),
            agent: sourceDraft.agent.trim(),
            supplierAgent: sourceDraft.supplier.trim() || sourceDraft.agent.trim() || sourceDraft.supplierAgent.trim(),
            billDate: sourceDraft.billDate,
            billNo: sourceDraft.billNo.trim(),
            billAmount: asNumber(sourceDraft.billAmount),
            deliveryChallan: sourceDraft.deliveryChallan.trim(),
            gstOn: sourceDraft.gstOn,
            godown: sourceDraft.godown.trim(),
            inwardDate: sourceDraft.inwardDate || undefined,
            hundekari: sourceDraft.hundekari.trim(),
            transportCharges: asNumber(sourceDraft.transportCharges),
            hamaliCharges: asNumber(sourceDraft.hamaliCharges),
            items,
            discountTotal: asNumber(sourceDraft.discountTotal),
            addCharges: asNumber(sourceDraft.addCharges),
            gstRate: asNumber(sourceDraft.gstRate),
            commission: asNumber(sourceDraft.commission),
            packingRoundoff: asNumber(sourceDraft.packingRoundoff),
            subtotal,
            taxableAmount,
            cgst,
            sgst,
            igst,
            totalGst,
            finalTotal,
            netQty,
            received: Boolean(sourceDraft.received),
            labelsPrinted: Boolean(sourceDraft.labelsPrinted),
        };
    };

    const handleSave = async () => {
        const payload = buildPayload();
        if (!payload.grnNo || !payload.party || !payload.billNo || !payload.billDate || !payload.receiveDate) {
            setError("GRN, party, bill number, bill date, and receive date are required.");
            notifyError("GRN, party, bill number, bill date, and receive date are required.");
            return;
        }

        if (payload.items.length === 0) {
            setError("Add at least one item before saving.");
            notifyError("Add at least one item before saving.");
            return;
        }

        const invalidItem = payload.items.find((item) => !item.category || !item.name || item.qty <= 0);
        if (invalidItem) {
            setError("Each item needs category, item name, and quantity greater than zero.");
            notifyError("Each item needs category, item name, and quantity greater than zero.");
            return;
        }

        setSaving(true);
        try {
            if (draft._id) {
                await request(`${API_BASE}/purchases/${draft._id}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });
                setError("");
                notifySuccess("Bill updated successfully.");
                await loadBills(draft._id);
            } else {
                const data = await request(`${API_BASE}/purchases`, {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
                const createdId = data.data?._id || null;
                setError("");
                notifySuccess("Bill created successfully.");
                await loadBills(createdId);
            }
        } catch (err) {
            console.error(err);
            setError(err.message);
            notifyError(err.message || "Failed to save bill.");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveItem = async () => {
        if (!itemDraft.category.trim() || !itemDraft.name.trim() || asNumber(itemDraft.qty) <= 0) {
            setError("Item category, name, and quantity are required.");
            notifyError("Item category, name, and quantity are required.");
            return;
        }

        const nextItem = recalculateItem(itemDraft);
        const nextDraft = {
            ...draft,
            items: draft.items.some((item) => item.id === editingItemId)
                ? draft.items.map((item) => (item.id === editingItemId ? nextItem : item))
                : [...draft.items, nextItem],
        };

        setDraft(nextDraft);
        setIsItemModalOpen(false);
        setEditingItemId(null);

        if (nextDraft._id) {
            setSaving(true);
            try {
                const payload = buildPayload(nextDraft);
                await request(`${API_BASE}/purchases/${nextDraft._id}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });
                setError("");
                notifySuccess("Item updated successfully.");
                await loadBills(nextDraft._id);
            } catch (err) {
                console.error(err);
                setError(err.message);
                notifyError(err.message || "Failed to save item.");
            } finally {
                setSaving(false);
            }
        }
    };

    const handleDelete = async (billId) => {
        if (!canDeletePurchase) {
            notifyError("Only admin users can delete purchase bills.");
            return;
        }

        if (!window.confirm("Delete this bill and all its items?")) {
            return;
        }

        try {
            await request(`${API_BASE}/purchases/${billId}`, { method: "DELETE" });
            setError("");
            notifySuccess("Bill deleted successfully.");
            if (selectedBillId === billId) {
                handleNewBill();
            }
            await loadBills(selectedBillId === billId ? null : selectedBillId);
        } catch (err) {
            console.error(err);
            setError(err.message);
            notifyError(err.message || "Failed to delete bill.");
        }
    };

    const handleReceive = async (billId) => {
        try {
            await request(`${API_BASE}/purchases/${billId}/receive`, { method: "POST" });
            setError("");
            notifySuccess("Bill marked as received.");
            await loadBills(billId);
        } catch (err) {
            console.error(err);
            setError(err.message);
            notifyError(err.message || "Failed to mark bill as received.");
        }
    };

    const draftPreview = buildPayload(draft);

    if (loading && hasSearched && bills.length === 0) return <div style={{ padding: 24 }}>Loading receive workspace...</div>;
    if (error && hasSearched && bills.length === 0) return <div style={{ padding: 24, color: "#b42318" }}>Error: {error}</div>;

    return (
        <div className="manage-receive-page app-page">
            <div className="container-fluid p-0 flex-grow-1">
                <div className="page-header card">
                    <div className="card-body">
                        <div>
                            <nav aria-label="breadcrumb">
                                <ol className="breadcrumb mb-2">
                                    <li className="breadcrumb-item"><a href="/">Home</a></li>
                                    <li className="breadcrumb-item active" aria-current="page">Receive</li>
                                </ol>
                            </nav>
                            <p className="section-label">Receive</p>
                            <h1>Manage Receive</h1>
                            <p className="mb-0 text-muted">Coordinate inward stock, transporter arrivals, physical checks, and release to inventory.</p>
                        </div>
                        <div className="page-header-actions">
                            <span className="metric-pill"><i className="bx bx-check-circle"></i> {selectedBill ? `GRN ${getDisplayText(selectedBill.grnNo, "-")}` : hasSearched ? `${visibleBills.length} bills` : "Ready"}</span>
                            <button className="btn btn_style" type="button" onClick={handleNewBill}>
                                <i className="bx bx-plus"></i><span>New</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="row g-3">
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="card stat-card">
                            <div className="card-body">
                                <span className="stat-icon text-primary"><i className="bx bx-receipt"></i></span>
                                <p>Loaded Bills</p>
                                <h3>{visibleBills.length}</h3>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="card stat-card">
                            <div className="card-body">
                                <span className="stat-icon text-warning"><i className="bx bx-package"></i></span>
                                <p>Pending Receive</p>
                                <h3>{pendingReceiveCount}</h3>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="card stat-card">
                            <div className="card-body">
                                <span className="stat-icon text-info"><i className="bx bx-barcode"></i></span>
                                <p>Pending Labels</p>
                                <h3>{pendingLabelCount}</h3>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="card stat-card">
                            <div className="card-body">
                                <span className="stat-icon text-success"><i className="bx bx-list-check"></i></span>
                                <p>Active Items</p>
                                <h3>{selectedBillItemCount}</h3>
                            </div>
                        </div>
                    </div>
                </div>

                <section className="card app-card mt-4">
                    <div className="card-header app-card-header">
                        <div><h2>Find Receive Bills</h2><p>Use consistent master data so downstream billing and reporting stay clean.</p></div>
                    </div>
                    <div className="card-body pt-1">
                        <form className="row g-3" data-enter-scope="manage-receive" onSubmit={(event) => { event.preventDefault(); handleSearch(); }}>
                            {[
                                ["grn", "GRN", "col-12 col-sm-6 col-xl-1"],
                                ["party", "Party", "col-12 col-sm-6 col-xl-2"],
                                ["supplier", "Supplier", "col-12 col-sm-6 col-xl-2"],
                                ["agent", "Agent", "col-12 col-sm-6 col-xl-2"],
                                ["billNo", "Bill No", "col-12 col-sm-6 col-xl-2"],
                                ["billDate", "Bill Date", "col-12 col-sm-6 col-xl-2"],
                                ["lrNo", "LR No", "col-12 col-sm-6 col-xl-2"],
                                ["category", "Category", "col-12 col-sm-6 col-xl-2"],
                                ["brand", "Brand", "col-12 col-sm-6 col-xl-2"],
                                ["itemName", "Item Name", "col-12 col-sm-6 col-xl-3"],
                                ["barcode", "Barcode", "col-12 col-sm-6 col-xl-2"],
                            ].map(([key, label, className], index) => (
                                <div className={className} key={key}>
                                    <label className="form-label" htmlFor={`receive-filter-${index}`}>{label}</label>
                                    <input
                                        ref={(node) => {
                                            filterInputRefs.current[key] = node;
                                        }}
                                        type={key.toLowerCase().includes("date") ? "date" : "text"}
                                        className="form-control"
                                        id={`receive-filter-${index}`}
                                        placeholder={key.toLowerCase().includes("date") ? undefined : `Enter ${label}`}
                                        value={filters[key]}
                                        onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))}
                                        onKeyDown={(event) => handleFilterEnter(event, key)}
                                        autoFocus={key === "grn"}
                                    />
                                </div>
                            ))}
                            <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                                <button ref={findButtonRef} className="btn btn_style" type="submit" disabled={!hasActiveSearchFilters || loading}>
                                    <i className="bx bx-search"></i><span>{loading ? "Searching..." : "Search"}</span>
                                </button>
                                <button className="btn btn_style inActive" type="button" onClick={handleClearSearch}>
                                    <i className="bx bx-reset"></i><span>Clear</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </section>

                <section className="card app-card app-datatable-card">
                    <div className="card-body">
                        <div className="datatable-toolbar">
                            <div className="datatable-toolbar-start">
                                <label className="datatable-length">
                                    <span>Show</span>
                                    <select className="form-select form-select-sm datatable-page-size" aria-label="Rows per page" value={billPageSize} onChange={(event) => setBillPageSize(Number(event.target.value))}>
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                    </select>
                                </label>
                                <button className="btn btn_style datatable-create" type="button" onClick={handleNewBill}><i className="bx bx-plus"></i><span>Create Receive</span></button>
                            </div>
                            <div className="datatable-toolbar-end">
                                <div className="datatable-search">
                                    <input type="text" placeholder="Search Receive Queue" aria-label="Search Receive Queue" value={queueSearch} onChange={(event) => setQueueSearch(event.target.value)} />
                                </div>
                                <select className="form-select datatable-status-filter" aria-label="Filter status" value={billStatusFilter} onChange={(event) => setBillStatusFilter(event.target.value)}>
                                    <option value="">All Status</option>
                                    <option value="Pending">Pending Receive</option>
                                    <option value="Received">Received</option>
                                    <option value="Labels Pending">Labels Pending</option>
                                    <option value="Labels Printed">Labels Printed</option>
                                </select>
                            </div>
                        </div>
                        <div className="table-responsive app-table-wrap">
                            <table className="table app-table align-middle">
                                <thead>
                                    <tr><th>GRN</th><th>Bill No</th><th>Bill Date</th><th>Party</th><th>Supplier</th><th>LR No</th><th>Items</th><th>Receive</th><th>Labels</th><th className="text-end">Actions</th></tr>
                                </thead>
                                <tbody>
                                    {pagedBills.length > 0 ? pagedBills.map((bill) => (
                                        <tr key={bill._id} className={bill._id === selectedBillId ? "manage-receive__table-row--active" : undefined} onClick={() => handleSelectBill(bill)} onDoubleClick={() => handleOpenBillModal(bill)}>
                                            <td>{getDisplayText(bill.grnNo, "-")}</td>
                                            <td>{getDisplayText(bill.billNo, "-")}</td>
                                            <td>{formatDate(bill.billDate)}</td>
                                            <td>{getDisplayText(bill.party?.name || bill.party, "-")}</td>
                                            <td>{getDisplayText(bill.supplier || bill.supplierAgent, "-")}</td>
                                            <td>{getDisplayText(bill.lrNo, "-")}</td>
                                            <td>{bill.items?.length || 0}</td>
                                            <td><span className={`status-badge ${bill.received ? "status-success" : "status-warning"}`}>{bill.received ? "Received" : "Pending"}</span></td>
                                            <td><span className={`status-badge ${getBillPendingLabelCount(bill) <= 0 ? "status-primary" : "status-warning"}`}>{getBillPendingLabelCount(bill) <= 0 ? "Printed" : `${getBillPendingLabelCount(bill)} Pending`}</span></td>
                                            <td className="text-end">
                                                <div className="dropdown">
                                                    <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="Actions">
                                                        <i className="bx bx-dots-vertical-rounded"></i>
                                                    </button>
                                                    <div className="dropdown-menu dropdown-menu-end">
                                                        <button className="dropdown-item" type="button" onClick={() => handleOpenBillModal(bill)}><i className="bx bx-show me-2"></i>View</button>
                                                        <button className="dropdown-item" type="button" onClick={() => handleAddItemForBill(bill)}><i className="bx bx-edit-alt me-2"></i>Edit Item</button>
                                                        <button className="dropdown-item" type="button" onClick={() => { handleSelectBill(bill); openLabelWorkbench(bill); }}><i className="bx bx-printer me-2"></i>Print Labels</button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="10" className="text-center text-muted py-4">
                                                {hasSearched ? "No bills matched the current filters." : "Run a search to load bills."}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <section className="card app-card app-datatable-card">
                    <div className="card-body">
                        <div className="datatable-toolbar">
                            <div className="datatable-toolbar-start">
                                <label className="datatable-length">
                                    <span>Show</span>
                                    <select className="form-select form-select-sm datatable-page-size" aria-label="Rows per page" value={itemPageSize} onChange={(event) => setItemPageSize(Number(event.target.value))}>
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                    </select>
                                </label>
                                <button className="btn btn_style datatable-create" type="button" onClick={handleAddItemModal}><i className="bx bx-plus"></i><span>Create Receive Items</span></button>
                            </div>
                            <div className="datatable-toolbar-end">
                                <div className="datatable-search">
                                    <input type="text" placeholder="Search Receive Items" aria-label="Search Receive Items" value={itemTableSearch} onChange={(event) => setItemTableSearch(event.target.value)} />
                                </div>
                                <select className="form-select datatable-status-filter" aria-label="Filter status" value={itemStatusFilter} onChange={(event) => setItemStatusFilter(event.target.value)}>
                                    <option value="">All Labels</option>
                                    <option value="Pending Labels">Pending Labels</option>
                                    <option value="Labels Printed">Labels Printed</option>
                                </select>
                            </div>
                        </div>
                        <div className="table-responsive app-table-wrap">
                            <table className="table app-table align-middle">
                                <thead>
                                    <tr><th>BarCode</th><th>Category</th><th>Brand</th><th>Item Name</th><th>Pur.Rate</th><th>MRP</th><th>Sale Rate</th><th>P.Qty</th><th>On Hand</th><th className="text-end">Actions</th></tr>
                                </thead>
                                <tbody>
                                    {selectedBill && visibleSelectedBillItems.length > 0 ? visibleSelectedBillItems.map((item, index) => (
                                        <tr key={item.id || `${selectedBill._id}-${index}`} className={item.originalIndex === selectedItemIndex ? "manage-receive__table-row--active" : undefined} onClick={() => setSelectedItemIndex(item.originalIndex)} onDoubleClick={() => handleOpenItemModal(item)}>
                                            <td>{getDisplayText(item.barcode, "-")}</td>
                                            <td>{getDisplayText(item.category, "-")}</td>
                                            <td>{getDisplayText(item.brand, "-")}</td>
                                            <td>{getDisplayText(item.name, "-")}</td>
                                            <td>{Number(item.purchaseRate || 0).toFixed(2)}</td>
                                            <td>{Number(item.mrp || 0).toFixed(2)}</td>
                                            <td>{Number(item.saleRate || 0).toFixed(2)}</td>
                                            <td><span className="status-badge status-warning">{item.qty || 0}</span></td>
                                            <td><span className="status-badge status-warning">{Number(item.stockOnHand || 0)}</span></td>
                                            <td className="text-end">
                                                <div className="dropdown">
                                                    <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="Actions"><i className="bx bx-dots-vertical-rounded"></i></button>
                                                    <div className="dropdown-menu dropdown-menu-end">
                                                        <button className="dropdown-item" type="button" onClick={() => handleOpenItemModal(item)}><i className="bx bx-show me-2"></i>View</button>
                                                        <button className="dropdown-item" type="button" onClick={() => handleOpenItemModal(item)}><i className="bx bx-edit-alt me-2"></i>Edit</button>
                                                        <button className="dropdown-item" type="button" onClick={() => handleOpenQuickPrintForItem(item, item.originalIndex)}><i className="bx bx-printer me-2"></i>{getRemainingLabelCount(item) <= 0 ? "Reprint Label" : "Print Labels"}</button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="10" className="text-center text-muted py-4">
                                                {selectedBill
                                                    ? "No items matched the current item filters."
                                                    : hasSearched
                                                        ? "Select a bill to view items."
                                                        : "Search for bills first. The first result will become active automatically."}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="row gx-2 mt-3">
                            <div className="col-auto"><button className="btn btn_style" type="button" onClick={() => selectedBill && handleOpenBillModal(selectedBill)} disabled={!selectedBill}>Update Bill</button></div>
                            <div className="col-auto"><button className="btn btn_style inActive" type="button" disabled>Edit History</button></div>
                            <div className="col-auto"><button className="btn btn_style" type="button" onClick={handleOpenQuickPrint} disabled={!selectedBill || !selectedItem}>{selectedItem && getRemainingLabelCount(selectedItem) <= 0 ? "Reprint Label" : "Print Labels"}</button></div>
                            <div className="col-auto"><button className="btn btn_style inActive" type="button" onClick={handleQuickPrintAll} disabled={!selectedBill || getBillPendingLabelCount(selectedBill) <= 0}>Print All Label</button></div>
                            <div className="col-auto"><button className="btn btn_style inActive" type="button" onClick={handleClearSearch}>Exit</button></div>
                        </div>
                    </div>
                </section>
            </div>

            {isBillModalOpen ? (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div className="modal fade show d-block" tabIndex="-1" aria-modal="true" role="dialog" onMouseDown={handleCloseBillModal}>
                        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable receive-update-dialog" onMouseDown={(event) => event.stopPropagation()}>
                            <div className="modal-content receive-update-modal" data-enter-scope="manage-receive">
                            <div className="modal-header">
                                <div>
                                    <h5 className="modal-title">{draft._id ? "Receiving Update" : "Create Bill"}</h5>
                                    <p className="text-muted mb-0">Update inward status, bale count, and release details.</p>
                                </div>
                                <button type="button" className="btn-close" onClick={handleCloseBillModal} aria-label="Close"></button>
                            </div>
                            <div className="modal-body">
                                <div className="receive-update-grid">
                                    <div className="receive-update-main">
                                        <section className="receive-modal-section">
                                            <h6>Receiving Update</h6>
                                            <div className="row g-3">
                                                <BootstrapInput inputRef={billModalFirstInputRef} id="receive-update-0" label="GRN" value={draft.grnNo} onChange={(value) => updateDraftField("grnNo", value)} />
                                                <BootstrapInput id="receive-update-1" label="Receive Date" type="date" value={draft.receiveDate} onChange={(value) => updateDraftField("receiveDate", value)} />
                                                <BootstrapInput id="receive-update-2" label="Firm Name" value={draft.firm} onChange={(value) => updateDraftField("firm", value)} />
                                                <BootstrapInput id="receive-update-3" label="Party Name" value={draft.party} onChange={(value) => updateDraftField("party", value)} />
                                                <BootstrapInput id="receive-update-4" label="Supplier" value={draft.supplier} onChange={(value) => updateDraftField("supplier", value)} />
                                                <BootstrapInput id="receive-update-5" label="Agent" value={draft.agent} onChange={(value) => updateDraftField("agent", value)} />
                                                <BootstrapInput id="receive-update-6" label="Bill No." value={draft.billNo} onChange={(value) => updateDraftField("billNo", value)} />
                                                <BootstrapInput id="receive-update-7" label="Bill Date" type="date" value={draft.billDate} onChange={(value) => updateDraftField("billDate", value)} />
                                                <BootstrapInput id="receive-update-8" label="Bill Amount" type="number" value={draft.billAmount} onChange={(value) => updateDraftField("billAmount", value)} />
                                                <BootstrapInput id="receive-update-9" label="D.C. No." value={draft.deliveryChallan} onChange={(value) => updateDraftField("deliveryChallan", value)} />
                                            </div>
                                        </section>

                                        <section className="receive-modal-section">
                                            <h6>Transport Details</h6>
                                            <div className="row g-3">
                                                <BootstrapInput id="receive-transport-0" label="Transport" value={draft.transporter} onChange={(value) => updateDraftField("transporter", value)} />
                                                <BootstrapInput id="receive-transport-1" label="LR No." value={draft.lrNo} onChange={(value) => updateDraftField("lrNo", value)} />
                                                <BootstrapInput id="receive-transport-2" label="Bale" type="number" colClassName="col-12 col-md-6 col-xl-2" value={draft.bale} onChange={(value) => updateDraftField("bale", value)} />
                                                <BootstrapInput id="receive-transport-4" label="Charges" type="number" value={draft.transportCharges} onChange={(value) => updateDraftField("transportCharges", value)} />
                                                <div className="col-12">
                                                    <label className="form-label" htmlFor="receive-narration">Narration</label>
                                                    <textarea className="form-control" id="receive-narration" rows="3" placeholder="Enter narration" value={draft.narration || ""} onChange={(event) => updateDraftField("narration", event.target.value)} onKeyDown={handleAdvanceOnEnter}></textarea>
                                                </div>
                                                <div className="col-12">
                                                    <label className="receive-check-row">
                                                        <input className="form-check-input" type="checkbox" checked readOnly />
                                                        <span>Auto Re-calculate Total Amount</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </section>
                                    </div>
                                    <aside className="receive-summary-panel">
                                        <div className="receive-summary-header">
                                            <h6>Summary</h6>
                                            <span className="status-badge status-primary">{draft.grnNo || "New GRN"}</span>
                                        </div>
                                        <SummaryLine label="Item Total" value={draftPreview.subtotal.toFixed(2)} />
                                        <SummaryLine label="Total Amount" value={draftPreview.finalTotal.toFixed(2)} />
                                        <SummaryLine label="Less Discount" value={draftPreview.discountTotal.toFixed(2)} />
                                        <SummaryLine label="Add Charges" value={draftPreview.addCharges.toFixed(2)} />
                                        <SummaryLine
                                            label={String(draft.partyState || COMPANY_STATE_CODE) === COMPANY_STATE_CODE ? "CGST + SGST" : "IGST"}
                                            value={String(draft.partyState || COMPANY_STATE_CODE) === COMPANY_STATE_CODE ? (draftPreview.cgst + draftPreview.sgst).toFixed(2) : draftPreview.igst.toFixed(2)}
                                        />
                                        <SummaryLine label="Add Commission" value={draftPreview.commission.toFixed(2)} />
                                        <SummaryLine label="Packing & Forwarding" value={draftPreview.packingRoundoff.toFixed(2)} />
                                        <SummaryLine label="Misc Expenses" value={asNumber(draft.hamaliCharges).toFixed(2)} />
                                        <div className="receive-summary-total"><span>Total Qty / Bill Amount</span><strong>{draftPreview.netQty} / {draftPreview.billAmount.toFixed(2)}</strong></div>
                                    </aside>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={handleAddItemModal} className="btn btn_style inActive"><i className="bx bx-plus"></i><span>Add Item</span></button>
                                <button type="button" onClick={handleCloseBillModal} className="btn btn_style inActive"><i className="bx bx-x"></i><span>Cancel</span></button>
                                <button type="button" onClick={handleSave} className="btn btn_style" disabled={saving}><i className="bx bx-save"></i><span>{saving ? "Saving..." : draft._id ? "Update Receive" : "Create Receive"}</span></button>
                                {draft._id && !draft.received ? <button type="button" onClick={() => handleReceive(draft._id)} className="btn btn_style inActive"><i className="bx bx-check"></i><span>Mark Received</span></button> : null}
                                {draft._id && canDeletePurchase ? <button type="button" onClick={() => handleDelete(draft._id)} className="btn btn_style inActive"><i className="bx bx-trash"></i><span>Delete</span></button> : null}
                            </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}

            {isItemModalOpen ? (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div className="modal fade show d-block" tabIndex="-1" aria-modal="true" role="dialog" onMouseDown={handleCloseItemModal}>
                        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable item-update-dialog" onMouseDown={(event) => event.stopPropagation()}>
                            <div className="modal-content item-update-modal" data-enter-scope="manage-receive">
                            <div className="modal-header">
                                <div>
                                    <h5 className="modal-title">{draft._id ? "Item Update" : "Add Item"}</h5>
                                    <p className="text-muted mb-0">Review received quantities, shortage, damage, and label release status.</p>
                                </div>
                                <button type="button" className="btn-close" onClick={handleCloseItemModal} aria-label="Close"></button>
                            </div>
                            <div className="modal-body">
                                <div className="item-update-grid">
                                    <div className="item-update-main">
                                        <section className="item-modal-section">
                                            <h6>Item Header</h6>
                                            <div className="row g-3">
                                                <BootstrapInput inputRef={itemModalFirstInputRef} id="item-update-0" label="BarCode ID" value={itemDraft.barcode || ""} onChange={(value) => updateItemDraftField("barcode", value)} />
                                                <BootstrapInput id="item-update-1" label="Size" value={itemDraft.size} onChange={(value) => updateItemDraftField("size", value)} />
                                                <BootstrapInput id="item-update-2" label="Color" value={itemDraft.color} onChange={(value) => updateItemDraftField("color", value)} />
                                                <BootstrapInput id="item-update-3" label="Category" value={itemDraft.category} onChange={(value) => updateItemDraftField("category", value)} />
                                                <BootstrapInput id="item-update-4" label="Material" value={itemDraft.material} onChange={(value) => updateItemDraftField("material", value)} />
                                                <BootstrapInput id="item-update-5" label="Style" value={itemDraft.style} onChange={(value) => updateItemDraftField("style", value)} />
                                                <BootstrapInput id="item-update-6" label="Brand" value={itemDraft.brand} onChange={(value) => updateItemDraftField("brand", value)} />
                                                <BootstrapInput id="item-update-7" label="Sub Style" value={itemDraft.subStyle} onChange={(value) => updateItemDraftField("subStyle", value)} />
                                                <BootstrapInput id="item-update-8" label="Design No" value={itemDraft.designNo} onChange={(value) => updateItemDraftField("designNo", value)} />
                                                <BootstrapInput id="item-update-9" label="Product Name" value={itemDraft.name} onChange={(value) => updateItemDraftField("name", value)} />
                                                <BootstrapInput id="item-update-10" label="Purchase Rate" type="number" value={itemDraft.purchaseRate} onChange={(value) => updateItemDraftField("purchaseRate", value)} />
                                                <BootstrapInput id="item-update-11" label="GST %" type="number" value={draft.gstRate || 0} readOnly />
                                                <BootstrapInput id="item-update-12" label="HSN" value={itemDraft.hsn} onChange={(value) => updateItemDraftField("hsn", value)} />
                                                <BootstrapInput id="item-update-13" label="Per %" type="number" value={0} readOnly />
                                                <BootstrapInput id="item-update-14" label="Disc %" type="number" value={itemDraft.discount} onChange={(value) => updateItemDraftField("discount", value)} />
                                                <BootstrapInput id="item-update-15" label="RC" type="number" value={itemDraft.netRate || 0} readOnly />
                                                <BootstrapInput id="item-update-16" label="MRP" type="number" value={itemDraft.mrp} onChange={(value) => updateItemDraftField("mrp", value)} />
                                                <BootstrapInput id="item-update-17" label="Sale Rate" type="number" value={itemDraft.saleRate} onChange={(value) => updateItemDraftField("saleRate", value)} />
                                                <BootstrapInput id="item-update-18" label="Print Rate" type="number" value={itemDraft.saleRate || 0} readOnly />
                                            </div>
                                        </section>
                                    </div>

                                    <aside className="item-side-panel">
                                        <div className="item-metric-grid">
                                            <div className="item-metric"><span>Net Rate</span><strong>{itemDraft.netRate.toFixed(2)}</strong></div>
                                            <div className="item-metric"><span>Total</span><strong>{itemDraft.total.toFixed(2)}</strong></div>
                                            <div className="item-metric"><span>Receiving Qty</span><strong>{itemDraft.qty} {itemDraft.unit}</strong></div>
                                            <div className="item-metric"><span>MRP</span><strong>{Number(itemDraft.mrp || 0).toFixed(2)}</strong></div>
                                            <div className="item-metric"><span>Sale Rate</span><strong>{Number(itemDraft.saleRate || 0).toFixed(2)}</strong></div>
                                        </div>

                                        <section className="item-modal-section">
                                            <h6>Receiving</h6>
                                            <div className="row g-3">
                                                <BootstrapInput id="item-receive-0" label="Receiving Qty" type="number" colClassName="col-6 col-md-4 col-xl-4" value={itemDraft.qty} onChange={(value) => updateItemDraftField("qty", value)} />
                                                <div className="col-6 col-md-4 col-xl-4">
                                                    <label className="form-label" htmlFor="item-receive-1">Unit</label>
                                                    <select className="form-select" id="item-receive-1" value={itemDraft.unit} onChange={(event) => updateItemDraftField("unit", event.target.value)} onKeyDown={handleAdvanceOnEnter}>
                                                        {UNIT_OPTIONS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                                                    </select>
                                                </div>
                                                <BootstrapInput id="item-receive-2" label="Short" colClassName="col-6 col-md-4 col-xl-4" value={0} readOnly />
                                                <BootstrapInput id="item-receive-3" label="Stock-in-hand" colClassName="col-6 col-md-4 col-xl-4" value={Number(itemDraft.stockOnHand || 0)} readOnly />
                                                <BootstrapInput id="item-receive-4" label="Before" colClassName="col-6 col-md-4 col-xl-4" value={Number(itemDraft.stockOnHand || 0)} readOnly />
                                                <BootstrapInput id="item-receive-5" label="After" colClassName="col-6 col-md-4 col-xl-4" value={itemDraft.received ? Number(itemDraft.stockOnHand || 0) : Number(itemDraft.stockOnHand || 0) + Number(itemDraft.qty || 0)} readOnly />
                                                <BootstrapInput id="item-receive-6" label="Qty On Label" colClassName="col-6 col-md-4 col-xl-4" value={getReceivingQtyForLabel(itemDraft)} readOnly />
                                                <BootstrapInput id="item-receive-7" label="Printed Labels" colClassName="col-6 col-md-4 col-xl-4" value={Number(itemDraft.printedLabels || 0)} readOnly />
                                                <BootstrapInput id="item-receive-8" label="Pending Labels" colClassName="col-6 col-md-4 col-xl-4" value={getRemainingLabelCount(itemDraft)} readOnly />
                                            </div>
                                        </section>

                                        <section className="item-pricing-panel">
                                            <h6>Pricing</h6>
                                            <div className="item-price-grid">
                                                <div className="item-price-card"><span>MRP</span><strong>{Number(itemDraft.mrp || 0).toFixed(2)}</strong></div>
                                                <div className="item-price-card"><span>Sale Rate</span><strong>{Number(itemDraft.saleRate || 0).toFixed(2)}</strong></div>
                                            </div>
                                        </section>
                                    </aside>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={handleCloseItemModal} className="btn btn_style inActive"><i className="bx bx-x"></i><span>Close</span></button>
                                <button type="button" onClick={handleSaveItem} className="btn btn_style" disabled={saving}><i className="bx bx-check"></i><span>{saving ? "Saving..." : "Save Items"}</span></button>
                                {draft.items.some((item) => item.id === editingItemId) ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            removeItem(editingItemId);
                                            handleCloseItemModal();
                                        }}
                                        className="btn btn_style inActive"
                                    >
                                        <i className="bx bx-trash"></i><span>Remove</span>
                                    </button>
                                ) : null}
                            </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}

            {isQuickPrintOpen ? (
                <div className="app-modal__backdrop manage-receive__modal-backdrop" onClick={handleCloseQuickPrint}>
                    <div className="app-card manage-receive__modal-card manage-receive__modal-card--quick" onClick={(e) => e.stopPropagation()} data-enter-scope="manage-receive">
                        <div className="manage-receive__modal-titlebar">
                            <div>
                                <strong>Print Labels</strong>
                                <div className="manage-receive__modal-subtitle">{quickPrintItem?.name || "Selected item"}</div>
                            </div>
                            <button type="button" onClick={handleCloseQuickPrint} className="manage-receive__modal-close">×</button>
                        </div>
                        <div className="manage-receive__quick-print-body">
                            <div className="manage-receive__quick-print-meta">
                                <span>Stock On Hand</span>
                                <strong>{Number(quickPrintItem?.stockOnHand || 0)}</strong>
                            </div>
                            <div className="manage-receive__quick-print-meta">
                                <span>{getRemainingLabelCount(quickPrintItem) <= 0 ? "Reprint Labels" : "Labels To Print"}</span>
                                <strong>{getRemainingLabelCount(quickPrintItem) <= 0 ? Math.max(getLabelTargetForItem(quickPrintItem), 1) : getRemainingLabelCount(quickPrintItem)}</strong>
                            </div>
                            <label className="manage-receive__input-block">
                                <span className="manage-receive__form-label manage-receive__form-label--compact">
                                    {getRemainingLabelCount(quickPrintItem) <= 0 ? "Reprint Qty" : "Print Qty"}
                                </span>
                                <input
                                    ref={quickPrintInputRef}
                                    type="text"
                                    inputMode="numeric"
                                    min="1"
                                    value={quickPrintQty}
                                    onChange={(event) => {
                                        const value = event.target.value.replace(/\D/g, "");
                                        setQuickPrintQty(value);
                                    }}
                                    onKeyDown={handleAdvanceOnEnter}
                                    className="manage-receive__form-input"
                                />
                            </label>
                            <div className="manage-receive__quick-print-meta">
                                <span>Qty On Label</span>
                                <strong>{getReceivingQtyForLabel(quickPrintItem)} {quickPrintItem?.unit || "PC"}</strong>
                            </div>
                        </div>
                        <div className="manage-receive__modal-footer">
                            <button type="button" onClick={handleCloseQuickPrint} className="manage-receive__secondary-btn" disabled={quickPrinting}>
                                Cancel
                            </button>
                            <button type="button" onClick={handleQuickPrint} className="manage-receive__primary-btn" disabled={quickPrinting}>
                                {quickPrinting ? "Printing..." : getRemainingLabelCount(quickPrintItem) <= 0 ? "Reprint" : "Print"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {labelPrintBill ? (
                <LabelPrintModal
                    bill={labelPrintBill}
                    items={labelPrintBill.items || []}
                    onClose={() => setLabelPrintBill(null)}
                    onSuccess={handleLabelPrintSuccess}
                />
            ) : null}
        </div>
    );
};

const Input = ({ label, value, onChange, type = "text", readOnly = false, inputRef = null }) => (
    <label className="manage-receive__input-block">
        <span className="manage-receive__form-label manage-receive__form-label--compact">{label}</span>
        <input
            ref={inputRef}
            type={normalizeInputType(type)}
            inputMode={getInputMode(type)}
            value={value}
            onChange={readOnly ? undefined : (e) => onChange(e.target.value)}
            onKeyDown={readOnly ? undefined : handleAdvanceOnEnter}
            readOnly={readOnly}
            className={`manage-receive__form-input${readOnly ? " manage-receive__form-input--readonly" : ""}`}
        />
    </label>
);

const BootstrapInput = ({
    id,
    label,
    value,
    onChange,
    type = "text",
    readOnly = false,
    inputRef = null,
    colClassName = "col-12 col-md-6 col-xl-3",
}) => (
    <div className={colClassName}>
        <label className="form-label" htmlFor={id}>{label}</label>
        <input
            ref={inputRef}
            className="form-control"
            id={id}
            type={normalizeInputType(type)}
            inputMode={getInputMode(type)}
            placeholder={readOnly ? undefined : `Enter ${label}`}
            value={value}
            onChange={readOnly ? undefined : (event) => onChange(event.target.value)}
            onKeyDown={readOnly ? undefined : handleAdvanceOnEnter}
            readOnly={readOnly}
        />
    </div>
);

const SummaryPill = ({ label, value }) => (
    <div className="manage-receive__summary-pill">
        <span className="manage-receive__summary-label">{label}</span>
        <strong>{value}</strong>
    </div>
);

const MetricCard = ({ label, value, tone = "default" }) => (
    <div style={tone === "warn" ? styles.metricCardWarn : tone === "info" ? styles.metricCardInfo : styles.metricCardDefault}>
        <span style={styles.metricLabel}>{label}</span>
        <strong style={styles.metricValue}>{value}</strong>
    </div>
);

const SummaryLine = ({ label, value, strong = false }) => (
    <div className={strong ? "receive-summary-line receive-summary-total" : "receive-summary-line"}>
        <span>{label}</span>
        <strong>{value}</strong>
    </div>
);

const styles = {
    page: { display: "grid", gap: 18, minWidth: 0 },
    desktopShell: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: 18,
        alignItems: "start",
    },
    desktopMain: {
        display: "grid",
        gap: 16,
        minWidth: 0,
    },
    desktopRail: {
        display: "grid",
        gap: 12,
        alignContent: "start",
        position: "sticky",
        top: 16,
    },
    desktopHeader: {
        display: "flex",
        justifyContent: "space-between",
        gap: 18,
        alignItems: "flex-start",
        padding: 24,
        borderRadius: 28,
    },
    eyebrow: {
        color: "var(--text-soft)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: 11,
        fontWeight: 700,
    },
    title: {
        margin: "4px 0 6px",
        fontSize: "1.5rem",
        lineHeight: 1.1,
        fontWeight: 650,
    },
    subtle: { color: "var(--text-soft)", margin: 0, maxWidth: 680, fontSize: 14, lineHeight: 1.55 },
    headerSummary: {
        display: "grid",
        gap: 8,
        minWidth: 180,
        textAlign: "left",
        color: "var(--text-soft)",
        fontSize: 12,
        fontWeight: 600,
        padding: "12px 14px",
        borderRadius: 18,
        background: "rgba(255,255,255,0.72)",
        border: "1px solid var(--line)",
    },
    topActionCluster: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
    heroActions: { display: "flex", gap: 10, flexWrap: "wrap" },
    commandDeck: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.4fr) 320px",
        gap: 18,
        alignItems: "start",
    },
    sideDeck: {
        display: "grid",
        gap: 18,
        alignContent: "start",
    },
    filterCard: {
        padding: 18,
        display: "grid",
        gap: 14,
        borderRadius: 24,
    },
    desktopFilterRows: { display: "grid", gap: 8 },
    toolbarSection: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 10,
        alignItems: "end",
    },
    toolbarField: { display: "grid", gap: 6, minWidth: 0 },
    toolbarFieldWide: { display: "grid", gap: 6, minWidth: 0, gridColumn: "span 2" },
    filterActionPanel: {
        display: "flex",
        alignItems: "stretch",
        gap: 10,
        minWidth: 320,
        justifyContent: "flex-start",
        flexWrap: "wrap",
        gridColumn: "1 / -1",
        paddingTop: 8,
        borderTop: "1px solid color-mix(in srgb, var(--line) 75%, transparent 25%)",
    },
    actionButtonGroup: {
        display: "inline-flex",
        alignItems: "stretch",
        gap: 10,
        flexWrap: "wrap",
    },
    sectionHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        paddingBottom: 10,
        borderBottom: "1px solid color-mix(in srgb, var(--line) 72%, transparent 28%)",
    },
    sectionMeta: { color: "var(--text-soft)", fontSize: 12, fontWeight: 500 },
    panelTitle: {
        fontWeight: 700,
        color: "var(--text-main)",
        fontSize: 13,
    },
    filterGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
        gap: 12,
    },
    filterField: {
        display: "grid",
        gap: 6,
    },
    filterLabel: {
        fontWeight: 600,
        fontSize: 11,
        color: "var(--text-soft)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
    },
    filterLabelAccent: {
        fontWeight: 600,
        fontSize: 11,
        color: "var(--danger-soft-text-strong)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
    },
    compactInput: {
        width: "100%",
        minWidth: 0,
        padding: "12px 14px",
        borderRadius: 16,
        border: "1px solid var(--field-border)",
        background: "linear-gradient(180deg, #ffffff 0%, #fbfcf8 100%)",
        color: "var(--field-text)",
        fontSize: 14,
        minHeight: 46,
    },
    desktopStatusBar: {
        display: "grid",
        alignContent: "start",
        gap: 6,
        padding: "14px 16px",
        borderRadius: 18,
        border: "1px solid var(--line)",
        background: "rgba(255,255,255,0.72)",
        color: "var(--text-soft)",
        fontSize: 12,
    },
    performanceCard: {
        padding: 12,
        display: "grid",
        gap: 10,
    },
    metricStack: {
        display: "grid",
        gap: 8,
    },
    metricCardDefault: {
        padding: "10px 12px",
        borderRadius: 12,
        background: "var(--surface-soft)",
        border: "1px solid var(--line)",
        display: "grid",
        gap: 4,
    },
    metricCardWarn: {
        padding: "10px 12px",
        borderRadius: 12,
        background: "var(--warning-soft-bg)",
        border: "1px solid var(--warning-soft-border)",
        display: "grid",
        gap: 4,
        color: "var(--warning-soft-text)",
    },
    metricCardInfo: {
        padding: "10px 12px",
        borderRadius: 12,
        background: "var(--info-soft-bg)",
        border: "1px solid var(--info-soft-border)",
        display: "grid",
        gap: 4,
        color: "var(--info-soft-text)",
    },
    metricLabel: {
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontWeight: 800,
        color: "var(--text-soft)",
    },
    metricValue: {
        fontSize: 18,
        lineHeight: 1,
    },
    stack: {
        display: "grid",
        gap: 16,
    },
    tableCard: {
        padding: 16,
        display: "grid",
        gap: 14,
        borderRadius: 24,
    },
    formGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 12,
    },
    billHeaderRows: {
        display: "grid",
        gap: 12,
    },
    billHeaderRow: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 12,
    },
    billHeaderRowCompact: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1.2fr",
        gap: 8,
    },
    billHeaderRowWide: {
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 8,
    },
    inputBlock: { display: "grid", gap: 4 },
    label: { fontWeight: 600, fontSize: 12, color: "var(--text-soft)", letterSpacing: "0.06em", textTransform: "uppercase" },
    labelCompact: { fontWeight: 600, fontSize: 11, color: "var(--text-soft)", letterSpacing: "0.06em", textTransform: "uppercase" },
    input: {
        width: "100%",
        padding: "12px 14px",
        borderRadius: 16,
        border: "1px solid var(--field-border)",
        background: "linear-gradient(180deg, #ffffff 0%, #fbfcf8 100%)",
        color: "var(--field-text)",
        fontSize: 14,
        minHeight: 46,
    },
    textarea: {
        width: "100%",
        minHeight: 104,
        padding: "12px 14px",
        borderRadius: 16,
        border: "1px solid var(--field-border)",
        background: "linear-gradient(180deg, #ffffff 0%, #fbfcf8 100%)",
        color: "var(--field-text)",
        resize: "vertical",
        fontFamily: "inherit",
    },
    readOnlyInput: {
        background: "linear-gradient(180deg, var(--surface-soft) 0%, rgba(255,255,255,0.9) 100%)",
        color: "var(--text-main)",
    },
    primaryButton: {
        border: "1px solid rgba(27, 38, 31, 0.18)",
        borderRadius: 16,
        padding: "11px 16px",
        background: "var(--button-primary)",
        color: "var(--button-primary-text)",
        fontWeight: 700,
        cursor: "pointer",
        fontSize: 13,
        minHeight: 46,
    },
    secondaryButton: {
        border: "1px solid rgba(211, 220, 210, 0.92)",
        borderRadius: 16,
        padding: "11px 16px",
        background: "var(--button-secondary-bg)",
        color: "var(--button-secondary-text)",
        fontWeight: 700,
        cursor: "pointer",
        fontSize: 13,
        minHeight: 46,
    },
    dangerButton: {
        border: "1px solid var(--danger-soft-border-strong)",
        borderRadius: 16,
        padding: "11px 16px",
        background: "var(--danger-soft-bg-strong)",
        color: "var(--danger-soft-text-strong)",
        fontWeight: 700,
        cursor: "pointer",
        fontSize: 13,
        minHeight: 46,
    },
    desktopGlyphButton: {
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "11px 14px",
        minWidth: 78,
        background: "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(245,247,242,0.92) 100%)",
        color: "var(--button-secondary-text)",
        cursor: "pointer",
        fontWeight: 600,
        fontSize: 12,
        textAlign: "center",
        minHeight: 46,
    },
    desktopGlyphButtonPrimary: {
        border: "1px solid rgba(27, 38, 31, 0.18)",
        borderRadius: 16,
        padding: "11px 14px",
        minWidth: 78,
        background: "var(--button-primary)",
        color: "var(--button-primary-text)",
        cursor: "pointer",
        fontWeight: 700,
        fontSize: 12,
        textAlign: "center",
        minHeight: 46,
    },
    desktopGlyph: {
        display: "block",
        lineHeight: 1.1,
    },
    rowActions: { display: "flex", gap: 6, flexWrap: "wrap" },
    rowButton: {
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: "9px 11px",
        background: "var(--button-secondary-bg)",
        color: "var(--button-secondary-text)",
        fontWeight: 700,
        cursor: "pointer",
    },
    iconRailMiniButton: {
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: "5px 7px",
        background: "var(--surface-soft)",
        color: "var(--text-main)",
        fontWeight: 700,
        cursor: "pointer",
        fontSize: 11,
        minWidth: 46,
    },
    primaryMiniButton: {
        border: "none",
        borderRadius: 12,
        padding: "9px 11px",
        background: "var(--button-primary)",
        color: "var(--button-primary-text)",
        fontWeight: 800,
        cursor: "pointer",
    },
    dangerMiniButton: {
        border: "1px solid var(--danger-soft-border-strong)",
        borderRadius: 12,
        padding: "9px 11px",
        background: "var(--danger-soft-bg-strong)",
        color: "var(--danger-soft-text-strong)",
        fontWeight: 800,
        cursor: "pointer",
    },
    pendingPill: {
        display: "inline-flex",
        padding: "8px 10px",
        borderRadius: 999,
        background: "var(--warning-pill-bg)",
        color: "var(--warning-pill-text)",
        fontWeight: 800,
        fontSize: 12,
    },
    successPill: {
        display: "inline-flex",
        padding: "8px 10px",
        borderRadius: 999,
        background: "var(--success-pill-bg)",
        color: "var(--success-pill-text)",
        fontWeight: 800,
        fontSize: 12,
    },
    emptyCell: { textAlign: "center", padding: "24px 14px", color: "var(--text-soft)" },
    emptyState: {
        padding: 24,
        borderRadius: 20,
        background: "linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(245,247,242,0.82) 100%)",
        color: "var(--text-soft)",
        border: "1px solid var(--line)",
    },
    selectedRow: {
        background: "color-mix(in srgb, var(--accent) 18%, white 82%)",
        color: "var(--text-main)",
    },
    summaryStrip: {
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 12,
    },
    summaryPill: {
        display: "grid",
        gap: 4,
        padding: 14,
        borderRadius: 18,
        background: "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(249,250,245,0.9) 100%)",
        border: "1px solid var(--line)",
    },
    summaryLabel: {
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--text-soft)",
        fontWeight: 600,
    },
    itemHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
    },
    editorTable: { width: "100%", borderCollapse: "collapse", minWidth: 980 },
    cellInput: {
        width: "100%",
        minWidth: 84,
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid var(--line)",
        background: "#fff",
    },
    iconButton: {
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "8px 10px",
        background: "#fff",
        cursor: "pointer",
        fontWeight: 700,
    },
    editorActions: { display: "flex", gap: 10, flexWrap: "wrap" },
    billModalGrid: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.35fr) 320px",
        gap: 18,
        alignItems: "start",
    },
    billModalMain: {
        display: "grid",
        gap: 16,
    },
    billModalSummary: {
        display: "grid",
        gap: 12,
        padding: 16,
        borderRadius: 20,
        background: "linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(245,247,242,0.9) 100%)",
        border: "1px solid var(--line)",
        alignContent: "start",
    },
    modalPanel: {
        display: "grid",
        gap: 12,
        padding: 16,
        borderRadius: 20,
        background: "linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(245,247,242,0.9) 100%)",
        border: "1px solid var(--line)",
    },
    formSection: {
        display: "grid",
        gap: 14,
        padding: 16,
        borderRadius: 18,
        background: "var(--surface-soft)",
        border: "1px solid var(--line)",
    },
    formSectionTitle: { fontWeight: 700, color: "var(--text-main)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" },
    transportStrip: {
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 12,
    },
    transportDetailGrid: {
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 14,
        alignItems: "start",
    },
    transportHeaderBar: {
        display: "grid",
        gridTemplateColumns: "1fr 90px 1.35fr 120px",
        gap: 8,
    },
    transportDetailMain: {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 12,
    },
    narrationField: {
        display: "grid",
        gap: 8,
    },
    transportMockTable: {
        display: "grid",
        border: "1px solid var(--line)",
        background: "rgba(255,255,255,0.82)",
        borderRadius: 18,
        overflow: "hidden",
    },
    transportTableHeader: {
        display: "grid",
        gridTemplateColumns: "1.1fr 1fr 80px 1.2fr 110px",
        background: "color-mix(in srgb, var(--surface-soft) 86%, var(--line) 14%)",
        borderBottom: "1px solid var(--line)",
        fontSize: 11,
        fontWeight: 600,
    },
    transportTableRow: {
        display: "grid",
        gridTemplateColumns: "1.1fr 1fr 80px 1.2fr 110px",
    },
    tableLikeInput: {
        width: "100%",
        minWidth: 0,
        border: "none",
        borderRight: "1px solid var(--line)",
        padding: "12px 14px",
        background: "transparent",
        color: "var(--field-text)",
        fontSize: 13,
        minHeight: 44,
    },
    billModalCheckboxRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },
    checkboxLabel: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        color: "var(--text-main)",
    },
    summaryBox: {
        display: "grid",
        gap: 10,
    },
    summaryLine: {
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 12,
        alignItems: "center",
        color: "var(--text-main)",
    },
    summaryLineStrong: {
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 12,
        alignItems: "center",
        color: "var(--text-main)",
        paddingTop: 10,
        borderTop: "1px solid var(--line)",
    },
    itemModalGrid: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.2fr) 340px",
        gap: 18,
        alignItems: "start",
    },
    itemEditorRows: {
        display: "grid",
        gap: 12,
    },
    itemEditorRow: {
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 12,
    },
    itemEditorRowCompact: {
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 8,
    },
    itemEditorRowWide: {
        display: "grid",
        gap: 12,
    },
    itemModalSide: {
        display: "grid",
        gap: 16,
    },
    rateStrip: {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 12,
    },
    priceInfoGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 12,
    },
    priceInfoCard: {
        display: "grid",
        gap: 6,
        padding: 14,
        borderRadius: 16,
        background: "#fff",
        border: "1px solid var(--line)",
    },
    priceInfoValue: {
        fontSize: 22,
        lineHeight: 1,
    },
    formGridCompact: {
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 8,
    },
    modalBackdrop: {
        position: "fixed",
        inset: 0,
        background: "rgba(18, 22, 19, 0.36)",
        backdropFilter: "blur(8px)",
        display: "grid",
        placeItems: "center",
        padding: 24,
        zIndex: 50,
    },
    modalCard: {
        width: "min(760px, 100%)",
        maxHeight: "calc(100dvh - 48px)",
        overflowY: "auto",
        padding: 20,
        display: "grid",
        gap: 16,
    },
    itemModalCard: {
        width: "min(820px, 100%)",
        maxHeight: "calc(100dvh - 48px)",
        overflowY: "auto",
        padding: 20,
        display: "grid",
        gap: 16,
    },
    quickPrintCard: {
        width: "min(360px, 100%)",
        padding: 20,
        display: "grid",
        gap: 16,
    },
    quickPrintBody: {
        display: "grid",
        gap: 12,
        padding: 16,
        borderRadius: 20,
        background: "linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(245,247,242,0.9) 100%)",
    },
    quickPrintMeta: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 12,
        color: "var(--text-main)",
    },
    modalTitleBar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: 0,
        color: "var(--text-main)",
    },
    modalSubtitle: { fontSize: 12, marginTop: 4, color: "var(--text-soft)" },
    modalCloseButton: {
        width: 36,
        height: 36,
        borderRadius: "50%",
        border: "1px solid var(--line)",
        background: "rgba(255,255,255,0.84)",
        color: "var(--text-main)",
        cursor: "pointer",
        fontWeight: 600,
    },
    modalFooterBar: {
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
        flexWrap: "wrap",
        paddingTop: 4,
    },
    desktopBottomBar: {
        display: "grid",
        gap: 10,
        padding: 16,
        borderRadius: 24,
    },
    bottomButtonRow: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
    },
    bottomMetaRow: {
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 8,
        fontSize: 12,
        color: "var(--text-soft)",
    },
    shortcutRailCard: {
        padding: 12,
        display: "grid",
        gap: 10,
    },
    shortcutList: {
        display: "grid",
        gap: 8,
    },
    railButton: {
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "10px 10px",
        background: "var(--button-secondary-bg)",
        color: "var(--button-secondary-text)",
        cursor: "pointer",
        fontWeight: 800,
        textAlign: "left",
        fontSize: 13,
    },
    desktopFooterButtonMuted: {
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: "10px 14px",
        background: "var(--surface-soft)",
        color: "var(--text-soft)",
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
    },
};

export default ManageReceive;
