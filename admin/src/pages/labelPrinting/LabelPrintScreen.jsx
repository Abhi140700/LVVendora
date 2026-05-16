import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../app/axios";
import useAppSettings from "../../hooks/useAppSettings";
import { getApiErrorMessage } from "../../utils/api";
import { notifyError } from "../../utils/notify";
import LabelPrintModal from "./LabelPrintModal";
import { buildRows } from "./labelPrintUtils.jsx";

const getPendingItems = (bill) => buildRows(bill.items || []).filter((item) => Number(item.remainingLabels || 0) > 0);
const getPendingLabelCount = (bill) => getPendingItems(bill).reduce((sum, item) => sum + Number(item.remainingLabels || 0), 0);
const getReceiveDate = (bill) => String(bill.receiveDate || bill.receivedAt || bill.createdAt || "").slice(0, 10);
const getBillDate = (bill) => String(bill.billDate || "").slice(0, 10);

const LabelPrintScreen = () => {
    const appSettings = useAppSettings();
    const purchaseSettings = appSettings.purchase || {};
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedBill, setSelectedBill] = useState(null);
    const [filters, setFilters] = useState({ grnNo: "", billNo: "", party: "", receiveDate: "", billDate: "", status: "", search: "" });
    const [pageSize, setPageSize] = useState(10);
    const [activeBillIndex, setActiveBillIndex] = useState(-1);
    const billRowRefs = useRef(new Map());

    const fetchBills = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/purchases");
            const billsData = data.data || data.bills || data || [];
            setBills(Array.isArray(billsData) ? billsData : []);
            setError(null);
        } catch (err) {
            setError(getApiErrorMessage(err, "Failed to fetch bills"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBills();
    }, []);

    const openModal = (bill) => {
        if (!purchaseSettings.labelPrintingEnabled) {
            notifyError("Label printing is disabled in settings.");
            return;
        }
        const formattedItems = getPendingItems(bill).map((item) => ({
            ...item,
            name: item.itemName || item.name,
            price: item.rate || item.price,
            itemId: item.itemId || item._id,
        }));
        setSelectedBill({ ...bill, items: formattedItems });
    };

    const handlePrintSuccess = ({ billId, remainingItems = [], completed = false }) => {
        setBills((prevBills) => {
            if (completed || remainingItems.length === 0) return prevBills.filter((bill) => bill._id !== billId);
            return prevBills.map((bill) => bill._id === billId ? { ...bill, labelsPrinted: false, items: remainingItems } : bill);
        });
        setSelectedBill((prevSelectedBill) => {
            if (!prevSelectedBill || prevSelectedBill._id !== billId) return prevSelectedBill;
            if (completed || remainingItems.length === 0) return null;
            return { ...prevSelectedBill, items: remainingItems };
        });
    };

    const pendingBills = useMemo(() => bills.filter((bill) => {
        if (bill.labelsPrinted || getPendingItems(bill).length === 0) return false;
        if (filters.grnNo && !String(bill.grnNo || "").toLowerCase().includes(filters.grnNo.toLowerCase())) return false;
        if (filters.billNo && !String(bill.billNo || "").toLowerCase().includes(filters.billNo.toLowerCase())) return false;
        if (filters.party && !String(bill.party?.name || bill.party || "").toLowerCase().includes(filters.party.toLowerCase())) return false;
        if (filters.receiveDate && getReceiveDate(bill) !== filters.receiveDate) return false;
        if (filters.billDate && getBillDate(bill) !== filters.billDate) return false;
        if (filters.status && filters.status !== "Pending") return false;
        if (filters.search) {
            const haystack = [
                bill.grnNo,
                bill.billNo,
                bill.party?.name || bill.party,
                getReceiveDate(bill),
                getBillDate(bill),
            ].join(" ").toLowerCase();
            if (!haystack.includes(filters.search.toLowerCase())) return false;
        }
        return true;
    }), [bills, filters]);

    const visibleRows = pendingBills.slice(0, pageSize);

    useEffect(() => {
        if (pendingBills.length === 0) {
            setActiveBillIndex(-1);
            return;
        }
        setActiveBillIndex((current) => (current >= 0 && current < pendingBills.length ? current : 0));
    }, [pendingBills]);

    useEffect(() => {
        if (activeBillIndex >= 0) {
            billRowRefs.current.get(activeBillIndex)?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
        }
    }, [activeBillIndex]);

    const handleRegisterKeyDown = (event) => {
        if (selectedBill || event.altKey || event.ctrlKey || event.metaKey || pendingBills.length === 0) return;
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveBillIndex((current) => (current + 1 + pendingBills.length) % pendingBills.length);
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveBillIndex((current) => (current - 1 + pendingBills.length) % pendingBills.length);
        }
        if (event.key === "Enter" && activeBillIndex >= 0 && pendingBills[activeBillIndex]) {
            event.preventDefault();
            openModal(pendingBills[activeBillIndex]);
        }
    };

    const exportCsv = () => {
        const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
        const rows = [
            ["GRN", "Receive Date", "Party", "Bill No", "Bill Date", "Pending Labels", "Status"],
            ...pendingBills.map((bill) => [
                bill.grnNo || "",
                getReceiveDate(bill),
                bill.party?.name || bill.party || "",
                bill.billNo || "",
                getBillDate(bill),
                getPendingLabelCount(bill),
                "Pending",
            ]),
        ];
        const blob = new Blob([rows.map((row) => row.map(escapeCsv).join(",")).join("\n")], {
            type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `label-printing-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="container-fluid p-0 flex-grow-1">
            <div className="page-header card">
                <div className="card-body">
                    <div>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-2">
                                <li className="breadcrumb-item"><Link to="/">Home</Link></li>
                                <li className="breadcrumb-item active" aria-current="page">Label Printing</li>
                            </ol>
                        </nav>
                        <p className="section-label">Label Printing</p>
                        <h1>Stock Release Queue</h1>
                        <p className="mb-0 text-muted">Print barcode labels for purchase bills that still have unprinted label items.</p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-check-circle" /> {loading ? "Loading" : "Ready"}</span>
                        <button className="btn btn_style inActive" type="button" onClick={fetchBills}><i className="bx bx-refresh" /><span>Refresh</span></button>
                    </div>
                </div>
            </div>

            <div className="row g-3 mb-3">
                <StatCard label="Pending Bills" value={pendingBills.length} />
                <StatCard label="Label Printing" value={purchaseSettings.labelPrintingEnabled ? "Enabled" : "Disabled"} />
            </div>

            <section className="card app-card">
                <div className="card-header app-card-header">
                    <div><h2>Label Filters</h2><p>Use consistent master data so downstream billing and reporting stay clean.</p></div>
                </div>
                <div className="card-body">
                    {!purchaseSettings.labelPrintingEnabled ? <div className="alert alert-warning">Label printing is currently disabled from settings.</div> : null}
                    {error ? <div className="alert alert-danger">{error}</div> : null}
                    <form className="row g-3">
                        <Field id="label-grn" label="GRN" value={filters.grnNo} onChange={(grnNo) => setFilters((current) => ({ ...current, grnNo }))} />
                        <DateField id="label-date" label="Receive Date" value={filters.receiveDate} onChange={(receiveDate) => setFilters((current) => ({ ...current, receiveDate }))} />
                        <Field id="label-party" label="Party" value={filters.party} onChange={(party) => setFilters((current) => ({ ...current, party }))} />
                        <Field id="label-bill" label="Bill No" value={filters.billNo} onChange={(billNo) => setFilters((current) => ({ ...current, billNo }))} />
                        <DateField id="label-bill-date" label="Bill Date" value={filters.billDate} onChange={(billDate) => setFilters((current) => ({ ...current, billDate }))} />
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label" htmlFor="label-status">Status</label>
                            <select className="form-select" id="label-status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                                <option value="">Select Status</option>
                                <option value="Pending">Pending</option>
                            </select>
                        </div>
                        <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                            <button className="btn btn_style" type="button" onClick={fetchBills}><i className="bx bx-save" /><span>Apply</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={() => setFilters({ grnNo: "", billNo: "", party: "", receiveDate: "", billDate: "", status: "", search: "" })}><i className="bx bx-reset" /><span>Clear</span></button>
                        </div>
                    </form>
                </div>
            </section>

            <section className="card app-card app-datatable-card">
                <div className="card-header app-card-header"><div><h2>Pending Label Bills</h2><p>Bills with unprinted or partially printed barcode labels.</p></div></div>
                <div className="card-body" onKeyDown={handleRegisterKeyDown}>
                    <div className="datatable-toolbar">
                        <div className="datatable-toolbar-start">
                            <label className="datatable-length"><span>Show</span><select className="form-select form-select-sm datatable-page-size" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} aria-label="Rows per page"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
                            <button className="btn btn_style datatable-create" type="button" disabled={!visibleRows[0]} onClick={() => visibleRows[0] && openModal(visibleRows[0])}><i className="bx bx-plus" /><span>Create Records</span></button>
                        </div>
                        <div className="datatable-toolbar-end">
                            <button className="btn btn_style inActive datatable-tool-btn" type="button"><i className="bx bx-filter-alt" /><span>Filters</span></button>
                            <div className="dropdown">
                                <button className="btn btn_style inActive datatable-tool-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false"><i className="bx bx-export" /><span>Export</span></button>
                                <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                    <button className="dropdown-item" type="button" onClick={exportCsv}><i className="bx bx-file me-2" />CSV</button>
                                    <button className="dropdown-item" type="button" onClick={() => window.print()}><i className="bx bx-printer me-2" />Print</button>
                                </div>
                            </div>
                            <div className="datatable-search"><input type="text" placeholder="Search Records" aria-label="Search Records" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></div>
                        </div>
                    </div>
                    <div className="table-responsive app-table-wrap">
                        <table className="table app-table align-middle">
                            <thead><tr><th>GRN</th><th>Receive Date</th><th>Party</th><th>Bill No</th><th>Bill Date</th><th>Pending Labels</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
                            <tbody>
                                {loading ? (
                                    <tr className="table-state-row"><td colSpan="8"><div className="table-skeleton-list" aria-label="Loading rows"><span /><span /><span /></div></td></tr>
                                ) : visibleRows.length ? visibleRows.map((bill, index) => (
                                    <tr
                                        key={bill._id}
                                        ref={(node) => { if (node) billRowRefs.current.set(index, node); else billRowRefs.current.delete(index); }}
                                        onMouseEnter={() => setActiveBillIndex(index)}
                                        onClick={() => setActiveBillIndex(index)}
                                        className={index === activeBillIndex ? "label-printing__row--active" : ""}
                                    >
                                        <td>{bill.grnNo || "-"}</td>
                                        <td>{getReceiveDate(bill) ? new Date(getReceiveDate(bill)).toLocaleDateString() : "-"}</td>
                                        <td>{bill.party?.name || bill.party || "N/A"}</td>
                                        <td>{bill.billNo || "-"}</td>
                                        <td>{bill.billDate ? new Date(bill.billDate).toLocaleDateString() : "-"}</td>
                                        <td>{getPendingLabelCount(bill)}</td>
                                        <td><span className="status-badge status-warning">Pending</span></td>
                                        <td className="text-end">
                                            <button className="btn btn_style" type="button" onClick={() => openModal(bill)} disabled={!purchaseSettings.labelPrintingEnabled}>
                                                <i className="bx bx-barcode" /><span>Workbench</span>
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr className="table-state-row table-state-row-empty"><td colSpan="8"><div className="empty-state compact"><span className="empty-state-icon"><i className="bx bx-search-alt" /></span><h6>No bills pending label printing</h6><p>Try changing filters or clearing the search field.</p></div></td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {selectedBill ? (
                <LabelPrintModal
                    bill={selectedBill}
                    items={selectedBill.items || []}
                    onClose={() => setSelectedBill(null)}
                    onSuccess={handlePrintSuccess}
                />
            ) : null}
        </div>
    );
};

const StatCard = ({ label, value }) => (
    <div className="col-12 col-sm-6 col-xl-3"><div className="card app-card h-100"><div className="card-body"><span className="text-muted d-block mb-1">{label}</span><h3 className="mb-0">{value}</h3></div></div></div>
);

const Field = ({ id, label, value, onChange }) => (
    <div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor={id}>{label}</label><input type="text" className="form-control" id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={`Enter ${label}`} /></div>
);

const DateField = ({ id, label, value, onChange }) => (
    <div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor={id}>{label}</label><input type="date" className="form-control" id={id} value={value} onChange={(event) => onChange(event.target.value)} /></div>
);

export default LabelPrintScreen;
