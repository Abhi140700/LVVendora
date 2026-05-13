import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import useAppSettings from "../../hooks/useAppSettings";
import { getCompanyName } from "../../utils/appSettings";
import {
    createPurchaseReturn,
    fetchPurchaseReturnById,
    updatePurchaseReturn,
    lookupPurchaseReturnBarcode,
} from "../../services/purchaseReturnService";
import {
    asNumber,
    exportRowsAsSpreadsheet,
    formatDateDisplay,
    formatDateInput,
    getStoredReturnDrafts,
    openPurchaseReturnBarcodePrint,
    openPurchaseReturnPrint,
    round2,
    saveStoredReturnDrafts,
} from "./purchaseReturnHelpers";

const blankForm = (companyName) => ({
    returnId: "",
    returnNo: "",
    debitNoteNo: "",
    returnDate: formatDateInput(),
    firm: companyName,
    party: "",
    partyPhone: "",
    shipTo: "",
    transporterName: "",
    transporterId: "",
    distanceKm: "",
    transportMode: "Road",
    vehicleType: "Regular",
    lrNo: "",
    lrDate: formatDateInput(),
    vehicleNo: "",
    narration: "",
    addCharges: 0,
    roundOff: 0,
    printBarcodeLabels: false,
    items: [],
});

const mapLookupRow = (data, boxNo) => ({
    rowId: `${data.labelId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    labelId: data.labelId,
    itemId: data.itemId,
    barcode: data.barcode,
    party: data.party || "",
    partyPhone: data.partyPhone || "",
    firm: data.firm || "",
    billNo: data.billNo || "",
    grnNo: data.grnNo || "",
    brandName: data.brandName || "",
    itemName: data.productName || "",
    qty: 1,
    maxQty: Math.max(1, asNumber(data.remainingQty, 1)),
    rate: round2(data.purchaseRate),
    amount: round2(data.purchaseRate),
    gstPercent: round2(data.gstPercent),
    stockAtReturn: asNumber(data.inventoryStock),
    commission: round2(data.commission),
    discount: round2(data.discount),
    boxNo: String(boxNo || data.boxNo || "").trim(),
});

const mapReturnToForm = (record) => ({
    returnId: record._id || "",
    returnNo: record.returnNo || "",
    debitNoteNo: record.debitNoteNo || "",
    returnDate: formatDateInput(record.returnDate),
    firm: record.firm || "",
    party: record.party || "",
    partyPhone: record.partyPhone || "",
    shipTo: record.shipTo || "",
    transporterName: record.transporterName || "",
    transporterId: record.transporterId || "",
    distanceKm: record.distanceKm || "",
    transportMode: record.transportMode || "Road",
    vehicleType: record.vehicleType || "Regular",
    lrNo: record.lrNo || "",
    lrDate: formatDateInput(record.lrDate),
    vehicleNo: record.vehicleNo || "",
    narration: record.narration || "",
    addCharges: asNumber(record.addCharges),
    roundOff: asNumber(record.roundOff),
    printBarcodeLabels: Boolean(record.printBarcodeLabels),
    items: (record.items || []).map((item, index) => ({
        rowId: `${item.labelId}-${index}`,
        labelId: item.labelId,
        itemId: item.itemId,
        barcode: item.barcode || "",
        party: record.party || "",
        partyPhone: record.partyPhone || "",
        firm: record.firm || "",
        billNo: item.sourceBillNo || "",
        grnNo: item.sourceGrnNo || "",
        brandName: item.brandName || "",
        itemName: item.name || "",
        qty: Math.max(1, asNumber(item.qty, 1)),
        maxQty: Math.max(1, asNumber(item.qty, 1)),
        rate: round2(item.rate),
        amount: round2(item.amount),
        gstPercent: round2(item.gstPercent),
        stockAtReturn: asNumber(item.stockAtReturn),
        commission: round2(item.commission),
        discount: round2(item.discount),
        boxNo: item.boxNo || "",
    })),
});

function PurchaseReturn() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const barcodeInputRef = useRef(null);
    const appSettings = useAppSettings();
    const companyName = appSettings.companyName || getCompanyName();
    const [form, setForm] = useState(() => blankForm(companyName));
    const [barcode, setBarcode] = useState("");
    const [boxNo, setBoxNo] = useState("");
    const [selectedRowId, setSelectedRowId] = useState("");
    const [saving, setSaving] = useState(false);
    const [loadingRecord, setLoadingRecord] = useState(false);
    const [heldDrafts, setHeldDrafts] = useState([]);
    const [showRecallModal, setShowRecallModal] = useState(false);

    useEffect(() => {
        setHeldDrafts(getStoredReturnDrafts());
    }, []);

    useEffect(() => {
        if (!form.firm && !form.returnId) {
            setForm((current) => ({ ...current, firm: companyName }));
        }
    }, [companyName, form.firm, form.returnId]);

    useEffect(() => {
        const returnId = searchParams.get("returnId");
        if (!returnId) return;

        let active = true;
        setLoadingRecord(true);
        fetchPurchaseReturnById(returnId)
            .then((data) => {
                if (!active) return;
                const nextForm = mapReturnToForm(data.data || {});
                setForm(nextForm);
                setSelectedRowId(nextForm.items[0]?.rowId || "");
            })
            .catch((error) => {
                console.error(error);
                toast.error(error.message || "Failed to load purchase return");
            })
            .finally(() => {
                if (active) setLoadingRecord(false);
            });

        return () => {
            active = false;
        };
    }, [searchParams]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === "F10") {
                event.preventDefault();
                if (selectedRowId) {
                    removeRow(selectedRowId);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedRowId, form.items]);

    const groupedSummary = useMemo(() => {
        const groups = new Map();

        form.items.forEach((item) => {
            const key = `${item.firm || ""}::${item.party || ""}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    firm: item.firm || form.firm || companyName,
                    party: item.party || form.party || "",
                    partyPhone: item.partyPhone || form.partyPhone || "",
                    totalQty: 0,
                    totalAmt: 0,
                    discount: 0,
                    gstAmt: 0,
                    netAmt: 0,
                    lrNo: form.lrNo || "",
                });
            }

            const current = groups.get(key);
            const amount = round2(asNumber(item.qty) * asNumber(item.rate));
            const discountValue = round2((amount * asNumber(item.discount)) / 100);
            const gstValue = round2((amount * asNumber(item.gstPercent)) / 100);

            current.totalQty += asNumber(item.qty);
            current.totalAmt += amount;
            current.discount += discountValue;
            current.gstAmt += gstValue;
            current.netAmt += amount - discountValue + gstValue;
        });

        return Array.from(groups.values()).map((entry, index) => ({
            id: `${entry.firm}-${entry.party}-${index}`,
            ...entry,
            totalQty: round2(entry.totalQty),
            totalAmt: round2(entry.totalAmt),
            discount: round2(entry.discount),
            gstAmt: round2(entry.gstAmt),
            netAmt: round2(entry.netAmt),
        }));
    }, [companyName, form.firm, form.items, form.lrNo, form.party, form.partyPhone]);

    const totals = useMemo(() => {
        const totalQty = round2(form.items.reduce((sum, item) => sum + asNumber(item.qty), 0));
        const totalAmount = round2(form.items.reduce((sum, item) => sum + asNumber(item.amount), 0));
        const discountAmount = round2(form.items.reduce((sum, item) => (
            sum + ((asNumber(item.amount) * asNumber(item.discount)) / 100)
        ), 0));
        const gstAmount = round2(form.items.reduce((sum, item) => (
            sum + ((asNumber(item.amount) * asNumber(item.gstPercent)) / 100)
        ), 0));
        const taxableAmount = round2(totalAmount - discountAmount);
        const netAmount = round2(taxableAmount + gstAmount + asNumber(form.addCharges) + asNumber(form.roundOff));

        return { totalQty, totalAmount, discountAmount, gstAmount, taxableAmount, netAmount };
    }, [form.addCharges, form.items, form.roundOff]);

    const handleScan = async () => {
        const cleanBarcode = barcode.trim();
        if (!cleanBarcode) return;

        if (form.items.some((item) => item.barcode === cleanBarcode)) {
            toast.error("This barcode is already added.");
            setBarcode("");
            return;
        }

        try {
            const data = await lookupPurchaseReturnBarcode(cleanBarcode);
            const nextRow = mapLookupRow(data.data, boxNo);
            setForm((current) => {
                const nextItems = [...current.items, nextRow];
                return {
                    ...current,
                    items: nextItems,
                    firm: current.firm || nextRow.firm || companyName,
                    party: current.party || nextRow.party || "",
                    partyPhone: current.partyPhone || nextRow.partyPhone || "",
                };
            });
            setSelectedRowId(nextRow.rowId);
            setBarcode("");
            setBoxNo("");
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to find barcode");
        }
    };

    const updateRow = (rowId, field, value) => {
        setForm((current) => ({
            ...current,
            items: current.items.map((item) => {
                if (item.rowId !== rowId) return item;

                const nextItem = {
                    ...item,
                    [field]: value,
                };

                if (field === "qty") {
                    const safeQty = Math.min(Math.max(asNumber(value, 1), 1), Math.max(1, asNumber(item.maxQty, 1)));
                    nextItem.qty = safeQty;
                }

                if (field === "rate" || field === "qty") {
                    nextItem.amount = round2(asNumber(nextItem.qty) * asNumber(nextItem.rate));
                }

                if (field === "discount" || field === "gstPercent" || field === "boxNo") {
                    nextItem.amount = round2(asNumber(nextItem.qty) * asNumber(nextItem.rate));
                }

                return nextItem;
            }),
        }));
    };

    const removeRow = (rowId) => {
        setForm((current) => {
            const nextItems = current.items.filter((item) => item.rowId !== rowId);
            return { ...current, items: nextItems };
        });
        setSelectedRowId((current) => (current === rowId ? "" : current));
    };

    const resetForm = () => {
        setForm(blankForm(companyName));
        setBarcode("");
        setBoxNo("");
        setSelectedRowId("");
        setSearchParams({}, { replace: true });
        barcodeInputRef.current?.focus();
    };

    const buildPayload = () => ({
        returnDate: form.returnDate,
        debitNoteNo: form.debitNoteNo,
        firm: form.firm,
        party: form.party,
        partyPhone: form.partyPhone,
        shipTo: form.shipTo,
        transporterName: form.transporterName,
        transporterId: form.transporterId,
        distanceKm: asNumber(form.distanceKm),
        transportMode: form.transportMode,
        vehicleType: form.vehicleType,
        lrNo: form.lrNo,
        lrDate: form.lrDate,
        vehicleNo: form.vehicleNo,
        narration: form.narration,
        addCharges: round2(form.addCharges),
        roundOff: round2(form.roundOff),
        printBarcodeLabels: form.printBarcodeLabels,
        items: form.items.map((item) => ({
            labelId: item.labelId,
            barcode: item.barcode,
            qty: asNumber(item.qty, 1),
            rate: round2(item.rate),
            gstPercent: round2(item.gstPercent),
            discount: round2(item.discount),
            commission: round2(item.commission),
            boxNo: item.boxNo || "",
            stockAtReturn: asNumber(item.stockAtReturn),
            brandName: item.brandName || "",
        })),
    });

    const handleSave = async () => {
        if (form.items.length === 0) {
            toast.error("Add at least one item before saving.");
            return;
        }

        if (form.returnId) {
            const mixedParty = form.items.some((item) => (item.party || "").trim() !== (form.party || "").trim());
            if (mixedParty) {
                toast.error("Edit mode only supports one party per return document.");
                return;
            }
        }

        try {
            setSaving(true);
            const payload = buildPayload();
            const response = form.returnId
                ? await updatePurchaseReturn(form.returnId, payload)
                : await createPurchaseReturn(payload);

            const createdEntries = Array.isArray(response.data) ? response.data : [response.data];
            toast.success(
                form.returnId
                    ? `Purchase return ${createdEntries[0]?.returnNo || ""} updated`
                    : createdEntries.length > 1
                        ? `${createdEntries.length} purchase return bills saved`
                        : `Purchase return ${createdEntries[0]?.returnNo || ""} saved`
            );

            saveStoredReturnDrafts(getStoredReturnDrafts().filter((draft) => draft.returnId !== form.returnId));
            setHeldDrafts(getStoredReturnDrafts());

            if (createdEntries[0]) {
                const primary = createdEntries[0];
                setForm(mapReturnToForm(primary));
                setSelectedRowId("");
                setSearchParams({ returnId: primary._id });
            } else {
                resetForm();
            }
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to save purchase return");
        } finally {
            setSaving(false);
        }
    };

    const handleHold = () => {
        if (form.items.length === 0) {
            toast.error("Nothing to hold yet.");
            return;
        }

        const drafts = getStoredReturnDrafts();
        const draftEntry = {
            ...form,
            heldAt: new Date().toISOString(),
            holdLabel: `${form.party || "Draft"} · ${form.items.length} item${form.items.length > 1 ? "s" : ""}`,
            returnId: form.returnId || `draft-${Date.now()}`,
        };

        const nextDrafts = [draftEntry, ...drafts.filter((draft) => draft.returnId !== draftEntry.returnId)].slice(0, 20);
        saveStoredReturnDrafts(nextDrafts);
        setHeldDrafts(nextDrafts);
        toast.success("Purchase return draft held.");
    };

    const recallDraft = (draft) => {
        setForm({
            ...draft,
            items: Array.isArray(draft.items) ? draft.items : [],
        });
        setSelectedRowId(draft.items?.[0]?.rowId || "");
        setShowRecallModal(false);
        toast.success("Held draft recalled.");
    };

    const deleteHeldDraft = (draftId) => {
        const nextDrafts = getStoredReturnDrafts().filter((draft) => draft.returnId !== draftId);
        saveStoredReturnDrafts(nextDrafts);
        setHeldDrafts(nextDrafts);
    };

    const exportCurrentSheet = () => {
        exportRowsAsSpreadsheet(
            "purchase-return-entry.xls",
            ["Sr", "Barcode", "GRN", "Party Name", "Bill No", "Brand Name", "Item Name", "Qty", "Rate", "Amount", "GST%", "Stock", "Cmsn", "Disc", "BoxNo"],
            form.items.map((item, index) => [
                index + 1,
                item.barcode,
                item.grnNo,
                item.party,
                item.billNo,
                item.brandName,
                item.itemName,
                item.qty,
                item.rate,
                item.amount,
                item.gstPercent,
                item.stockAtReturn,
                item.commission,
                item.discount,
                item.boxNo,
            ])
        );
    };

    const currentPrintPayload = {
        ...form,
        totalQty: totals.totalQty,
        totalAmount: totals.totalAmount,
        discountAmount: totals.discountAmount,
        gstAmount: totals.gstAmount,
        taxableAmount: totals.taxableAmount,
        netAmount: totals.netAmount,
        items: form.items.map((item) => ({
            barcode: item.barcode,
            sourceBillNo: item.billNo,
            sourceGrnNo: item.grnNo,
            name: item.itemName,
            boxNo: item.boxNo,
            qty: item.qty,
            rate: item.rate,
            amount: item.amount,
            gstPercent: item.gstPercent,
        })),
    };

    return (
        <>
            <div className="page-header card">
                <div className="card-body">
                    <div>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-2">
                                <li className="breadcrumb-item"><a href="/dashboard">Home</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Purchase Operations</li>
                            </ol>
                        </nav>
                        <p className="section-label">Purchase Operations</p>
                        <h1>Purchase Return</h1>
                        <p className="mb-0 text-muted">Record supplier returns, damaged stock movement, debit notes, and return approvals.</p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-check-circle"></i> Ready</span>
                        <button className="btn btn_style" type="button" onClick={resetForm}>
                            <i className="bx bx-plus"></i><span>New</span>
                        </button>
                        <button className="btn btn_style inActive" type="button" onClick={() => setShowRecallModal(true)}>
                            <i className="bx bx-history"></i><span>Recall</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="row g-3 mb-3">
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card stat-card"><div className="card-body"><span className="stat-icon text-primary"><i className="bx bx-package"></i></span><p>Items</p><h3>{form.items.length}</h3></div></div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card stat-card"><div className="card-body"><span className="stat-icon text-success"><i className="bx bx-list-check"></i></span><p>Total Qty</p><h3>{totals.totalQty.toFixed(2)}</h3></div></div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card stat-card"><div className="card-body"><span className="stat-icon text-warning"><i className="bx bx-rupee"></i></span><p>Net Amount</p><h3>Rs. {totals.netAmount.toFixed(2)}</h3></div></div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card stat-card"><div className="card-body"><span className="stat-icon text-info"><i className="bx bx-time-five"></i></span><p>Held Drafts</p><h3>{heldDrafts.length}</h3></div></div>
                </div>
            </div>

            <section className="card app-card">
                <div className="card-header app-card-header">
                    <div>
                        <h2>Entry Details</h2>
                        <p>Use consistent master data so downstream billing and reporting stay clean.</p>
                    </div>
                </div>
                <div className="card-body">
                    <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                        <Field label="Return No"><input type="text" className="form-control" value={form.returnNo} readOnly placeholder="Enter Return No" /></Field>
                        <Field label="Return Date"><input type="date" className="form-control" value={form.returnDate} onChange={(event) => setForm((current) => ({ ...current, returnDate: event.target.value }))} /></Field>
                        <Field label="Party"><input type="text" className="form-control" value={form.party} onChange={(event) => setForm((current) => ({ ...current, party: event.target.value }))} placeholder="Enter Party" /></Field>
                        <Field label="Bill No"><input type="text" className="form-control" value={form.items[0]?.billNo || ""} readOnly placeholder="Enter Bill No" /></Field>
                        <Field label="GRN"><input type="text" className="form-control" value={form.items[0]?.grnNo || ""} readOnly placeholder="Enter GRN" /></Field>
                        <Field label="Barcode"><input type="text" className="form-control" ref={barcodeInputRef} value={barcode} onChange={(event) => setBarcode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") handleScan(); }} placeholder="Enter Barcode" /></Field>
                        <Field label="Reason"><input type="text" className="form-control" value={form.narration} onChange={(event) => setForm((current) => ({ ...current, narration: event.target.value }))} placeholder="Enter Reason" /></Field>
                        <Field label="Return Qty"><input type="text" className="form-control" value={totals.totalQty.toFixed(2)} readOnly placeholder="Enter Return Qty" /></Field>
                        <Field label="Debit Note"><input type="text" className="form-control" value={form.debitNoteNo} onChange={(event) => setForm((current) => ({ ...current, debitNoteNo: event.target.value }))} placeholder="Enter Debit Note" /></Field>
                        <Field label="Narration"><input type="text" className="form-control" value={form.narration} onChange={(event) => setForm((current) => ({ ...current, narration: event.target.value }))} placeholder="Enter Narration" /></Field>
                        <Field label="Box No"><input type="text" className="form-control" value={boxNo} onChange={(event) => setBoxNo(event.target.value)} placeholder="Enter Box No" /></Field>
                        <Field label="Print Barcode">
                            <label className="filter-check-row mb-0">
                                <input className="form-check-input" type="checkbox" checked={form.printBarcodeLabels} onChange={(event) => setForm((current) => ({ ...current, printBarcodeLabels: event.target.checked }))} />
                                <span>Print Barcode Labels</span>
                            </label>
                        </Field>
                        <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                            <button className="btn btn_style" type="button" onClick={handleSave} disabled={saving || loadingRecord}>
                                <i className="bx bx-save"></i><span>{saving ? "Saving..." : form.returnId ? "Update" : "Save"}</span>
                            </button>
                            <button className="btn btn_style inActive" type="button" onClick={handleScan}><i className="bx bx-plus"></i><span>Add</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={handleHold}><i className="bx bx-time"></i><span>Hold</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={resetForm}><i className="bx bx-reset"></i><span>Clear</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={exportCurrentSheet}><i className="bx bx-export"></i><span>Export to XLS</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={() => navigate("/purchase/return-register")}><i className="bx bx-search"></i><span>Find</span></button>
                        </div>
                    </form>
                    <div className="text-muted mt-3">F10 deletes the selected row.</div>
                </div>
            </section>

            <section className="card app-card app-datatable-card">
                <div className="card-body p-0">
                    <div className="datatable-toolbar">
                        <div className="datatable-toolbar-start">
                            <label className="datatable-length">
                                <span>Show</span>
                                <select className="form-select form-select-sm datatable-page-size" aria-label="Rows per page" defaultValue="10">
                                    <option>10</option>
                                    <option>25</option>
                                    <option>50</option>
                                </select>
                            </label>
                            <button className="btn btn_style datatable-create" type="button" onClick={resetForm}>
                                <i className="bx bx-plus"></i><span>Create Purchase Return</span>
                            </button>
                        </div>
                        <div className="datatable-toolbar-end">
                            <button className="btn btn_style inActive datatable-tool-btn" type="button" data-bs-toggle="offcanvas" data-bs-target="#advancedFilterOffcanvas" aria-controls="advancedFilterOffcanvas">
                                <i className="bx bx-filter-alt"></i><span>Filters</span>
                            </button>
                            <div className="dropdown">
                                <button className="btn btn_style inActive datatable-tool-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <i className="bx bx-columns"></i><span>Columns</span>
                                </button>
                                <div className="dropdown-menu dropdown-menu-end datatable-column-menu">
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" defaultChecked /><span>Reference</span></label>
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" defaultChecked /><span>Date</span></label>
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" defaultChecked /><span>Party</span></label>
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" defaultChecked /><span>Amount</span></label>
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" /><span>Status</span></label>
                                </div>
                            </div>
                            <div className="dropdown">
                                <button className="btn btn_style inActive datatable-tool-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <i className="bx bx-export"></i><span>Export</span>
                                </button>
                                <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                    <button className="dropdown-item" type="button" onClick={exportCurrentSheet}><i className="bx bx-file me-2"></i>CSV</button>
                                    <button className="dropdown-item" type="button" onClick={exportCurrentSheet}><i className="bx bx-spreadsheet me-2"></i>Excel</button>
                                    <button className="dropdown-item" type="button" onClick={() => openPurchaseReturnPrint(currentPrintPayload, companyName)}><i className="bx bx-printer me-2"></i>Print</button>
                                </div>
                            </div>
                            <div className="datatable-search">
                                <input type="text" placeholder="Search Purchase Return" aria-label="Search Purchase Return" readOnly />
                            </div>
                            <select className="form-select datatable-status-filter" aria-label="Filter status" defaultValue="Invoice Status">
                                <option>Invoice Status</option>
                                <option>Active</option>
                                <option>Paid</option>
                                <option>Pending</option>
                                <option>Received</option>
                            </select>
                        </div>
                    </div>

                    <div className="datatable-bulk-bar">
                        <div className="datatable-bulk-copy">
                            <strong>{selectedRowId ? 1 : 0} selected</strong>
                            <span>{selectedRowId ? "Selected row actions are available" : "Choose rows to unlock bulk actions"}</span>
                        </div>
                        <div className="datatable-bulk-actions">
                            <button className="btn btn_style inActive" type="button" onClick={handleHold}><i className="bx bx-archive"></i><span>Hold</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={exportCurrentSheet}><i className="bx bx-export"></i><span>Export</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={() => selectedRowId ? removeRow(selectedRowId) : toast.error("Select a row first.")}><i className="bx bx-trash"></i><span>Delete</span></button>
                        </div>
                    </div>

                    <div className="table-responsive app-table-wrap datatable-wrap">
                        <table className="table app-table align-middle">
                            <thead>
                                <tr>
                                    <th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" aria-label="Select all rows" /></th>
                                    <th><span className="sortable-heading">Sr.<i className="bx bx-sort-up"></i></span></th>
                                    <th><span className="sortable-heading">Barcode<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Bill No<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">GRN<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Item Name<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Box No<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Qty<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Rate<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Amount<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">GST%<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Status<i className="bx bx-sort"></i></span></th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {form.items.length > 0 ? form.items.map((item, index) => (
                                    <tr key={item.rowId} onClick={() => setSelectedRowId(item.rowId)} className={item.rowId === selectedRowId ? "table-active" : ""}>
                                        <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" checked={item.rowId === selectedRowId} onChange={() => setSelectedRowId(item.rowId)} onClick={(event) => event.stopPropagation()} /></td>
                                        <td>{index + 1}</td>
                                        <td>{item.barcode}</td>
                                        <td>{item.billNo}</td>
                                        <td>{item.grnNo}</td>
                                        <td>{item.itemName}</td>
                                        <td><input className="form-control form-control-sm" value={item.boxNo} onChange={(event) => updateRow(item.rowId, "boxNo", event.target.value)} onClick={(event) => event.stopPropagation()} /></td>
                                        <td><input className="form-control form-control-sm" type="number" min="1" max={item.maxQty} value={item.qty} onChange={(event) => updateRow(item.rowId, "qty", event.target.value)} onClick={(event) => event.stopPropagation()} /></td>
                                        <td><input className="form-control form-control-sm" type="number" value={item.rate} onChange={(event) => updateRow(item.rowId, "rate", event.target.value)} onClick={(event) => event.stopPropagation()} /></td>
                                        <td>{round2(item.amount).toFixed(2)}</td>
                                        <td><input className="form-control form-control-sm" type="number" value={item.gstPercent} onChange={(event) => updateRow(item.rowId, "gstPercent", event.target.value)} onClick={(event) => event.stopPropagation()} /></td>
                                        <td><span className={`status-badge ${form.returnId ? "status-success" : "status-warning"}`}>{form.returnId ? "Posted" : "Draft"}</span></td>
                                        <td className="text-end"><PurchaseReturnActions onView={() => setSelectedRowId(item.rowId)} onDelete={() => removeRow(item.rowId)} /></td>
                                    </tr>
                                )) : (
                                    <tr className="table-state-row table-state-row-empty">
                                        <td colSpan="13">
                                            <div className="empty-state compact">
                                                <span className="empty-state-icon"><i className="bx bx-search-alt"></i></span>
                                                <h6>No matching records</h6>
                                                <p>Scan barcode items to begin purchase return entry.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="pagination-row">
                        <span>Showing {form.items.length === 0 ? 0 : 1} to {form.items.length} of {form.items.length} entries</span>
                        <nav aria-label="Table pagination">
                            <ul className="pagination pagination-sm mb-0">
                                <li className="page-item disabled"><a className="page-link" href="#" aria-label="Previous"><i className="bx bx-chevron-left"></i></a></li>
                                <li className="page-item active"><a className="page-link" href="#">1</a></li>
                                <li className="page-item disabled"><a className="page-link" href="#" aria-label="Next"><i className="bx bx-chevron-right"></i></a></li>
                            </ul>
                        </nav>
                    </div>
                </div>
            </section>

            <section className="card app-card">
                <div className="card-header app-card-header">
                    <div>
                        <h2>Party Summary</h2>
                        <p>Party-wise summary updates live as rows are added or edited.</p>
                    </div>
                </div>
                <div className="card-body p-0">
                    <div className="table-responsive app-table-wrap">
                        <table className="table app-table align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Ret. No</th>
                                    <th>Firm Name</th>
                                    <th>Party Name</th>
                                    <th>Total Qty</th>
                                    <th>Total Amt</th>
                                    <th>Discount</th>
                                    <th>GST Amt</th>
                                    <th>Net Amount</th>
                                    <th>Lr No / Remark</th>
                                    <th>Supplier Contact No</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupedSummary.length > 0 ? groupedSummary.map((entry, index) => (
                                    <tr key={entry.id}>
                                        <td>{form.returnNo || `Draft-${index + 1}`}</td>
                                        <td>{entry.firm || "-"}</td>
                                        <td>{entry.party || "-"}</td>
                                        <td>{entry.totalQty}</td>
                                        <td>{entry.totalAmt.toFixed(2)}</td>
                                        <td>{entry.discount.toFixed(2)}</td>
                                        <td>{entry.gstAmt.toFixed(2)}</td>
                                        <td>{entry.netAmt.toFixed(2)}</td>
                                        <td>{entry.lrNo || form.narration || "-"}</td>
                                        <td>{entry.partyPhone || "-"}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="10">
                                            <div className="empty-state compact">
                                                <span className="empty-state-icon"><i className="bx bx-receipt"></i></span>
                                                <h6>No summary yet</h6>
                                                <p>Party-wise summary will appear here as items are added.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section className="card app-card">
                <div className="card-header app-card-header">
                    <div>
                        <h2>Return Details</h2>
                        <p>Maintain transport, party, and totals data for the final return document.</p>
                    </div>
                </div>
                <div className="card-body">
                    <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                        <Field label="Return Date"><input className="form-control" type="date" value={form.returnDate} onChange={(event) => setForm((current) => ({ ...current, returnDate: event.target.value }))} /></Field>
                        <Field label="Return No"><input className="form-control" value={form.returnNo} readOnly /></Field>
                        <Field label="Debit Note No"><input className="form-control" value={form.debitNoteNo} onChange={(event) => setForm((current) => ({ ...current, debitNoteNo: event.target.value }))} /></Field>
                        <Field label="Firm"><input className="form-control" value={form.firm} onChange={(event) => setForm((current) => ({ ...current, firm: event.target.value }))} /></Field>
                        <Field label="Party Name"><input className="form-control" value={form.party} onChange={(event) => setForm((current) => ({ ...current, party: event.target.value }))} /></Field>
                        <Field label="Ship To"><input className="form-control" value={form.shipTo} onChange={(event) => setForm((current) => ({ ...current, shipTo: event.target.value }))} /></Field>
                        <Field label="Transporter Name"><input className="form-control" value={form.transporterName} onChange={(event) => setForm((current) => ({ ...current, transporterName: event.target.value }))} /></Field>
                        <Field label="Transporter ID"><input className="form-control" value={form.transporterId} onChange={(event) => setForm((current) => ({ ...current, transporterId: event.target.value }))} /></Field>
                        <Field label="Distance (KM)"><input className="form-control" type="number" value={form.distanceKm} onChange={(event) => setForm((current) => ({ ...current, distanceKm: event.target.value }))} /></Field>
                        <Field label="Mode">
                            <select className="form-select" value={form.transportMode} onChange={(event) => setForm((current) => ({ ...current, transportMode: event.target.value }))}>
                                <option>Road</option>
                                <option>Rail</option>
                                <option>Air</option>
                                <option>Ship</option>
                            </select>
                        </Field>
                        <Field label="Vehicle Type">
                            <select className="form-select" value={form.vehicleType} onChange={(event) => setForm((current) => ({ ...current, vehicleType: event.target.value }))}>
                                <option>Regular</option>
                                <option>ODC (Cargo)</option>
                            </select>
                        </Field>
                        <Field label="LR No."><input className="form-control" value={form.lrNo} onChange={(event) => setForm((current) => ({ ...current, lrNo: event.target.value }))} /></Field>
                        <Field label="LR Date"><input className="form-control" type="date" value={form.lrDate} onChange={(event) => setForm((current) => ({ ...current, lrDate: event.target.value }))} /></Field>
                        <Field label="Vehicle No."><input className="form-control" value={form.vehicleNo} onChange={(event) => setForm((current) => ({ ...current, vehicleNo: event.target.value }))} /></Field>
                        <Field label="Add Charges"><input className="form-control" type="number" value={form.addCharges} onChange={(event) => setForm((current) => ({ ...current, addCharges: event.target.value }))} /></Field>
                        <Field label="Round Off"><input className="form-control" type="number" value={form.roundOff} onChange={(event) => setForm((current) => ({ ...current, roundOff: event.target.value }))} /></Field>
                        <div className="col-12">
                            <label className="form-label">Narration</label>
                            <input className="form-control" value={form.narration} onChange={(event) => setForm((current) => ({ ...current, narration: event.target.value }))} />
                        </div>
                    </form>

                    <div className="row g-3 mt-1">
                        <div className="col-12 col-sm-6 col-xl"><SummaryBox label="Total Qty" value={totals.totalQty.toFixed(2)} /></div>
                        <div className="col-12 col-sm-6 col-xl"><SummaryBox label="Total Amt" value={totals.totalAmount.toFixed(2)} /></div>
                        <div className="col-12 col-sm-6 col-xl"><SummaryBox label="Disc" value={totals.discountAmount.toFixed(2)} /></div>
                        <div className="col-12 col-sm-6 col-xl"><SummaryBox label="GST Amt" value={totals.gstAmount.toFixed(2)} /></div>
                        <div className="col-12 col-sm-6 col-xl"><SummaryBox label="Net Amt" value={totals.netAmount.toFixed(2)} /></div>
                    </div>

                    <div className="d-flex flex-wrap gap-2 pt-3">
                        <button className="btn btn_style inActive" type="button" onClick={handleSave} disabled={saving}>Ok</button>
                        <button className="btn btn_style inActive" type="button" onClick={handleScan}>Add</button>
                        <button className="btn btn_style inActive" type="button" onClick={() => toast("Use Recall or Register to edit saved returns.")}>Edit</button>
                        <button className="btn btn_style inActive" type="button" onClick={() => selectedRowId ? removeRow(selectedRowId) : toast.error("Select a row first.")}>Delete</button>
                        <button className="btn btn_style inActive" type="button" onClick={resetForm}>Cancel</button>
                        <button className="btn btn_style inActive" type="button" onClick={() => openPurchaseReturnPrint(currentPrintPayload, companyName)}>Print</button>
                        <button className="btn btn_style inActive" type="button" onClick={() => navigate("/purchase/return-register")}>Search</button>
                        <button className="btn btn_style inActive" type="button" onClick={() => openPurchaseReturnBarcodePrint(currentPrintPayload, companyName)}>Print Barcode</button>
                        <button className="btn btn_style" type="button" onClick={() => navigate("/purchase/return-register")}>Exit</button>
                    </div>
                </div>
            </section>

            {showRecallModal ? (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" aria-hidden="false" onClick={() => setShowRecallModal(false)}>
                        <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(event) => event.stopPropagation()}>
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title">Held Purchase Returns</h5>
                                    <button type="button" className="btn-close" onClick={() => setShowRecallModal(false)} aria-label="Close"></button>
                                </div>
                                <div className="modal-body">
                                    {heldDrafts.length > 0 ? heldDrafts.map((draft) => (
                                        <div key={draft.returnId} className="quick-action justify-content-between mb-2">
                                            <span>
                                                <strong>{draft.holdLabel || draft.party || "Held Draft"}</strong>
                                                <small className="d-block text-muted">{draft.firm || "-"} | {draft.returnDate ? formatDateDisplay(draft.returnDate) : "-"} | {draft.items?.length || 0} items</small>
                                            </span>
                                            <span className="d-flex gap-2">
                                                <button type="button" className="btn btn_style" onClick={() => recallDraft(draft)}>Recall</button>
                                                <button type="button" className="btn btn_style inActive" onClick={() => deleteHeldDraft(draft.returnId)}>Delete</button>
                                            </span>
                                        </div>
                                    )) : (
                                        <div className="empty-state compact">
                                            <span className="empty-state-icon"><i className="bx bx-time-five"></i></span>
                                            <h6>No held drafts</h6>
                                            <p>No held purchase return drafts yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}

            <div className="modal fade" id="pageActionModal" tabIndex="-1" aria-hidden="true">
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">New Purchase Return</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            <p className="text-muted mb-3">Use the page form or table action menu to continue this workflow.</p>
                            <div className="quick-action-list">
                                <button className="quick-action" type="button" onClick={resetForm}><i className="bx bx-plus"></i><span>Create record</span></button>
                                <button className="quick-action" type="button" onClick={() => setShowRecallModal(true)}><i className="bx bx-import"></i><span>Recall data</span></button>
                                <button className="quick-action" type="button" onClick={() => openPurchaseReturnPrint(currentPrintPayload, companyName)}><i className="bx bx-printer"></i><span>Print view</span></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

const Field = ({ label, children }) => (
    <div className="col-12 col-sm-6 col-xl-3">
        <label className="form-label">{label}</label>
        {children}
    </div>
);

const SummaryBox = ({ label, value }) => (
    <div className="summary-line">
        <span>{label}</span>
        <strong>{value}</strong>
    </div>
);

const PurchaseReturnActions = ({ onView, onDelete }) => (
    <div className="datatable-actions">
        <button type="button" className="btn action-btn" aria-label="Delete" onClick={(event) => { event.stopPropagation(); onDelete(); }}><i className="bx bx-trash"></i></button>
        <button type="button" className="btn action-btn" aria-label="View" onClick={(event) => { event.stopPropagation(); onView(); }}><i className="bx bx-show"></i></button>
        <div className="dropdown">
            <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions" onClick={(event) => event.stopPropagation()}>
                <i className="bx bx-dots-vertical-rounded"></i>
            </button>
            <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                <button className="dropdown-item" type="button">Download</button>
                <button className="dropdown-item" type="button" onClick={(event) => { event.stopPropagation(); onView(); }}>Edit</button>
                <button className="dropdown-item" type="button">Duplicate</button>
            </div>
        </div>
    </div>
);

export default PurchaseReturn;
