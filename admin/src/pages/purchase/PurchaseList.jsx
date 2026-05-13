import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../app/axios";
import { getApiErrorMessage } from "../../utils/api";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const PurchaseList = () => {
    const navigate = useNavigate();
    const [filters, setFilters] = useState({ party: "", billNo: "", status: "" });
    const [purchases, setPurchases] = useState([]);
    const [pageSize, setPageSize] = useState(10);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchPurchases = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/purchases");
            setPurchases(data.data || []);
            setError(null);
        } catch (err) {
            setError(getApiErrorMessage(err, "Failed to fetch purchases"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPurchases();
    }, []);

    const filteredPurchases = useMemo(() => purchases.filter((purchase) => {
        const partyName = purchase.party?.name || purchase.party || "";
        const status = purchase.received ? "Received" : "Pending";
        if (filters.party && !partyName.toLowerCase().includes(filters.party.toLowerCase())) return false;
        if (filters.billNo && !String(purchase.billNo || "").toLowerCase().includes(filters.billNo.toLowerCase())) return false;
        if (filters.status && status !== filters.status) return false;
        return true;
    }), [filters, purchases]);

    const visibleRows = filteredPurchases.slice(0, pageSize);
    const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((purchase) => selectedIds.includes(purchase._id));
    const summary = useMemo(() => ({
        totalBills: filteredPurchases.length,
        totalAmount: filteredPurchases.reduce((sum, purchase) => sum + Number(purchase.finalTotal || purchase.billAmount || 0), 0),
        pendingBills: filteredPurchases.filter((purchase) => !purchase.received).length,
        labelPending: filteredPurchases.filter((purchase) => !purchase.labelsPrinted).length,
    }), [filteredPurchases]);

    return (
        <div className="container-fluid p-0 flex-grow-1">
            <div className="page-header card">
                <div className="card-body">
                    <div>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-2">
                                <li className="breadcrumb-item"><Link to="/">Home</Link></li>
                                <li className="breadcrumb-item active" aria-current="page">Purchase</li>
                            </ol>
                        </nav>
                        <p className="section-label">Purchase</p>
                        <h1>Purchase List</h1>
                        <p className="mb-0 text-muted">Track purchase bills, receiving, and label progress from one register.</p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-check-circle" /> {loading ? "Loading" : "Ready"}</span>
                        <button className="btn btn_style inActive" type="button" onClick={fetchPurchases}><i className="bx bx-refresh" /><span>Refresh</span></button>
                        <button className="btn btn_style" type="button" onClick={() => navigate("/purchase/new")}><i className="bx bx-plus" /><span>New Purchase</span></button>
                    </div>
                </div>
            </div>

            <div className="row g-3 mb-3">
                <StatCard label="Bills" value={summary.totalBills} />
                <StatCard label="Purchase Value" value={money(summary.totalAmount)} />
                <StatCard label="Pending Receive" value={summary.pendingBills} />
                <StatCard label="Label Pending" value={summary.labelPending} />
            </div>

            <section className="card app-card">
                <div className="card-header app-card-header">
                    <div><h2>Filters</h2><p>Use quick filters to narrow the register without leaving the page.</p></div>
                </div>
                <div className="card-body">
                    <form className="row g-3">
                        <Field id="purchase-party" label="Party" value={filters.party} onChange={(party) => setFilters((current) => ({ ...current, party }))} placeholder="Search party" />
                        <Field id="purchase-bill" label="Bill No" value={filters.billNo} onChange={(billNo) => setFilters((current) => ({ ...current, billNo }))} placeholder="Bill no" />
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label" htmlFor="purchase-status">Status</label>
                            <select className="form-select" id="purchase-status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                                <option value="">All status</option>
                                <option value="Pending">Pending</option>
                                <option value="Received">Received</option>
                            </select>
                        </div>
                    </form>
                    {error ? <div className="alert alert-danger mt-3 mb-0">{error}</div> : null}
                </div>
            </section>

            <section className="card app-card app-datatable-card">
                <div className="card-body p-0">
                    <div className="datatable-toolbar">
                        <div className="datatable-toolbar-start">
                            <label className="datatable-length"><span>Show</span><select className="form-select form-select-sm datatable-page-size" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} aria-label="Rows per page"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
                            <button className="btn btn_style datatable-create" type="button" onClick={() => navigate("/purchase/new")}><i className="bx bx-plus" /><span>Create Purchase</span></button>
                        </div>
                        <div className="datatable-toolbar-end">
                            <button className="btn btn_style inActive datatable-tool-btn" type="button"><i className="bx bx-filter-alt" /><span>Filters</span></button>
                            <div className="dropdown">
                                <button className="btn btn_style inActive datatable-tool-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false"><i className="bx bx-export" /><span>Export</span></button>
                                <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                    <button className="dropdown-item" type="button"><i className="bx bx-file me-2" />CSV</button>
                                    <button className="dropdown-item" type="button" onClick={() => window.print()}><i className="bx bx-printer me-2" />Print</button>
                                </div>
                            </div>
                            <div className="datatable-search"><input type="text" placeholder="Search Purchase List" value={filters.party} onChange={(event) => setFilters((current) => ({ ...current, party: event.target.value }))} aria-label="Search Purchase List" /></div>
                        </div>
                    </div>
                    <div className="datatable-bulk-bar"><div className="datatable-bulk-copy"><strong>{selectedIds.length} selected</strong><span>Choose rows to unlock bulk actions</span></div><div className="datatable-bulk-actions"><button className="btn btn_style inActive" type="button"><i className="bx bx-export" /><span>Export</span></button></div></div>
                    <div className="table-responsive app-table-wrap datatable-wrap">
                        <table className="table app-table align-middle">
                            <thead>
                                <tr>
                                    <th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" checked={allVisibleSelected} onChange={(event) => setSelectedIds(event.target.checked ? visibleRows.map((purchase) => purchase._id) : [])} aria-label="Select all rows" /></th>
                                    <th><span className="sortable-heading">GRN<i className="bx bx-sort-up" /></span></th>
                                    <th><span className="sortable-heading">Bill No<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">Party<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">Items<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">Qty<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">Amount<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">Status<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">Labels<i className="bx bx-sort" /></span></th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr className="table-state-row"><td colSpan="10"><div className="table-skeleton-list" aria-label="Loading rows"><span /><span /><span /></div></td></tr>
                                ) : visibleRows.length ? visibleRows.map((purchase) => {
                                    const totalQty = (purchase.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
                                    const totalAmount = Number(purchase.finalTotal || purchase.billAmount || (purchase.items || []).reduce((sum, item) => sum + Number(item.total || 0), 0));
                                    return (
                                        <tr key={purchase._id}>
                                            <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" checked={selectedIds.includes(purchase._id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, purchase._id] : current.filter((id) => id !== purchase._id))} aria-label="Select row" /></td>
                                            <td>{purchase.grnNo || "-"}</td>
                                            <td>{purchase.billNo || "-"}</td>
                                            <td>{purchase.party?.name || purchase.party || "-"}</td>
                                            <td>{purchase.items?.length || 0}</td>
                                            <td>{totalQty}</td>
                                            <td>{money(totalAmount)}</td>
                                            <td><span className={`status-badge ${purchase.received ? "status-success" : "status-warning"}`}>{purchase.received ? "Received" : "Pending"}</span></td>
                                            <td><span className={`status-badge ${purchase.labelsPrinted ? "status-primary" : "status-warning"}`}>{purchase.labelsPrinted ? "Done" : "Pending"}</span></td>
                                            <td className="text-end">
                                                <div className="datatable-actions">
                                                    <button type="button" className="btn action-btn" aria-label="Edit" onClick={() => navigate(`/purchase/edit/${purchase._id}`)}><i className="bx bx-edit" /></button>
                                                    <button type="button" className="btn action-btn" aria-label="View" onClick={() => navigate(`/purchase/edit/${purchase._id}`)}><i className="bx bx-show" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr className="table-state-row table-state-row-empty"><td colSpan="10"><div className="empty-state compact"><span className="empty-state-icon"><i className="bx bx-search-alt" /></span><h6>No purchases found</h6><p>Try changing filters or clearing the search field.</p></div></td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="pagination-row"><span>Showing {visibleRows.length ? 1 : 0} to {visibleRows.length} of {filteredPurchases.length} entries</span><nav aria-label="Table pagination"><ul className="pagination pagination-sm mb-0"><li className="page-item disabled"><a className="page-link" href="#previous" aria-label="Previous"><i className="bx bx-chevron-left" /></a></li><li className="page-item active"><a className="page-link" href="#page-1">1</a></li><li className="page-item disabled"><a className="page-link" href="#next" aria-label="Next"><i className="bx bx-chevron-right" /></a></li></ul></nav></div>
                </div>
            </section>
        </div>
    );
};

const StatCard = ({ label, value }) => (
    <div className="col-12 col-sm-6 col-xl-3"><div className="card app-card h-100"><div className="card-body"><span className="text-muted d-block mb-1">{label}</span><h3 className="mb-0">{value}</h3></div></div></div>
);

const Field = ({ id, label, value, onChange, placeholder }) => (
    <div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor={id}>{label}</label><input className="form-control" id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder || `Enter ${label}`} /></div>
);

export default PurchaseList;
