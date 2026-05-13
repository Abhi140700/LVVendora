import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../app/axios";
import Modal from "../../components/ui/Modal";
import { getApiErrorMessage } from "../../utils/api";

const todayIso = () => new Date().toISOString().slice(0, 10);
const getPaymentModeSummary = (sale = {}) => {
    const modes = (sale.paymentBreakdown || [])
        .map((row) => String(row.mode || "").trim())
        .filter(Boolean);
    if (modes.length > 0) {
        return Array.from(new Set(modes)).join(", ");
    }
    if (sale.billType === "cashpay") return "Cash";
    if (sale.billType === "card-upi") return "Card / UPI";
    if (sale.billType === "credit") return "Credit";
    if (sale.billType === "advance") return "Advance";
    return sale.billType || "-";
};
const money = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;
const dateTime = (value) => (value ? new Date(value).toLocaleString("en-IN") : "-");

const SalesInvoice = () => {
    const navigate = useNavigate();
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({ customer: "", invoiceNo: "", fromDate: todayIso(), toDate: todayIso() });
    const [viewInvoice, setViewInvoice] = useState(null);
    useEffect(() => {
        const fetchSales = async () => {
            setLoading(true);
            try {
                const { data } = await api.get("/sales");
                setSales(data.data || []);
            } catch (err) {
                console.error(err);
                setError(getApiErrorMessage(err, "Failed to fetch sales"));
            } finally {
                setLoading(false);
            }
        };
        fetchSales();
    }, []);

    const filteredSales = useMemo(() => sales.filter((sale) => {
        if (filters.customer && !sale.customer?.toLowerCase().includes(filters.customer.toLowerCase())) return false;
        if (filters.invoiceNo && !sale.invoiceNo?.toLowerCase().includes(filters.invoiceNo.toLowerCase())) return false;

        const saleDate = sale.saleDate ? new Date(sale.saleDate).setHours(0, 0, 0, 0) : null; const from = filters.fromDate ? new Date(filters.fromDate).setHours(0, 0, 0, 0) : null;
        const to = filters.toDate ? new Date(filters.toDate).setHours(23, 59, 59, 999) : null;

        if (from && saleDate && saleDate < from) return false;
        if (to && saleDate && saleDate > to) return false;
        return true;
    }), [filters, sales]);

    if (loading) return <div className="card app-card"><div className="card-body">Loading sales invoices...</div></div>;
    if (error) return <div className="card app-card"><div className="card-body text-danger">Error: {error}</div></div>;

    return (
        <>
            <div className="page-header card">
                <div className="card-body">
                    <div>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-2">
                                <li className="breadcrumb-item"><a href="/dashboard">Home</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Sales</li>
                            </ol>
                        </nav>
                        <p className="section-label">Sales</p>
                        <h1>Sales Invoice</h1>
                        <p className="mb-0 text-muted">Create GST invoices with customer details, item rows, tax breakup, and payment terms.</p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-check-circle"></i> Ready</span>
                        <button className="btn btn_style" type="button" onClick={() => navigate("/sales/pos")}>
                            <i className="bx bx-plus"></i><span>New</span>
                        </button>
                    </div>
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
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Customer</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Enter Customer"
                                value={filters.customer}
                                onChange={(event) => setFilters({ ...filters, customer: event.target.value })}
                            />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Invoice No</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Enter Invoice No"
                                value={filters.invoiceNo}
                                onChange={(event) => setFilters({ ...filters, invoiceNo: event.target.value })}
                            />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">From Date</label>
                            <input
                                type="date"
                                className="form-control"
                                value={filters.fromDate}
                                onChange={(event) => setFilters({ ...filters, fromDate: event.target.value })}
                            />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">To Date</label>
                            <input
                                type="date"
                                className="form-control"
                                value={filters.toDate}
                                onChange={(event) => setFilters({ ...filters, toDate: event.target.value })}
                            />
                        </div>
                        <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                            <button className="btn btn_style" type="button"><i className="bx bx-save"></i><span>Save</span></button>
                            <button className="btn btn_style inActive" type="button"><i className="bx bx-reset"></i><span>Clear</span></button>
                        </div>
                    </form>
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
                            <button className="btn btn_style datatable-create" type="button" onClick={() => navigate("/sales/pos")}>
                                <i className="bx bx-plus"></i><span>Create Sales Invoice</span>
                            </button>
                        </div>
                        <div className="datatable-toolbar-end">
                            <button className="btn btn_style inActive datatable-tool-btn" type="button">
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
                                    <a className="dropdown-item" href="#"><i className="bx bx-file me-2"></i>CSV</a>
                                    <a className="dropdown-item" href="#"><i className="bx bx-spreadsheet me-2"></i>Excel</a>
                                    <a className="dropdown-item" href="#"><i className="bx bx-printer me-2"></i>Print</a>
                                </div>
                            </div>
                            <div className="datatable-search">
                                <input
                                    type="text"
                                    placeholder="Search Sales Invoice"
                                    aria-label="Search Sales Invoice"
                                    value={filters.invoiceNo}
                                    onChange={(event) => setFilters({ ...filters, invoiceNo: event.target.value })}
                                />
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
                            <strong>0 selected</strong>
                            <span>Choose rows to unlock bulk actions</span>
                        </div>
                        <div className="datatable-bulk-actions">
                            <button className="btn btn_style inActive" type="button"><i className="bx bx-archive"></i><span>Archive</span></button>
                            <button className="btn btn_style inActive" type="button"><i className="bx bx-export"></i><span>Export</span></button>
                            <button className="btn btn_style inActive" type="button"><i className="bx bx-trash"></i><span>Delete</span></button>
                        </div>
                    </div>

                    <div className="table-responsive app-table-wrap datatable-wrap">
                        <table className="table app-table align-middle">
                            <thead>
                                <tr>
                                    <th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" aria-label="Select all rows" /></th>
                                    <th><span className="sortable-heading">Invoice No<i className="bx bx-sort-up"></i></span></th>
                                    <th><span className="sortable-heading">Date<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Customer<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Payment Mode<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Items<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Returned<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Total Amount<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Status<i className="bx bx-sort"></i></span></th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSales.length === 0 ? (
                                    <tr className="table-state-row table-state-row-empty">
                                        <td colSpan="10">
                                            <div className="empty-state compact">
                                                <span className="empty-state-icon"><i className="bx bx-search-alt"></i></span>
                                                <h6>No matching records</h6>
                                                <p>Try changing filters or clearing the search field.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredSales.map((sale) => {
                                    const isDue = Number(sale.totalAmount || 0) > Number(sale.totalPaid || sale.paidAmount || sale.totalAmount || 0);
                                    return (
                                        <tr key={sale._id}>
                                            <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" /></td>
                                            <td>{sale.invoiceNo || "-"}</td>
                                            <td>{sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : "-"}</td>
                                            <td>{sale.customer || "-"}</td>
                                            <td>{getPaymentModeSummary(sale)}</td>
                                            <td>{sale.items?.length || 0}</td>
                                            <td>Rs. {Number(sale.totalReturnedAmount || 0).toFixed(2)}</td>
                                            <td>Rs. {Number(sale.totalAmount || 0).toFixed(2)}</td>
                                            <td><span className={`status-badge ${isDue ? "status-danger" : "status-success"}`}>{isDue ? "Due" : "Paid"}</span></td>
                                            <td className="text-end">
                                                <div className="datatable-actions">
                                                    <button type="button" className="btn action-btn" aria-label="Edit" onClick={() => navigate("/sales/pos", { state: { editSale: sale } })}>
                                                        <i className="bx bx-edit-alt"></i>
                                                    </button>
                                                    <button type="button" className="btn action-btn" aria-label="Return" onClick={() => navigate("/sales/return", { state: { saleId: sale._id } })}>
                                                        <i className="bx bx-undo"></i>
                                                    </button>
                                                    <div className="dropdown">
                                                        <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions">
                                                            <i className="bx bx-dots-vertical-rounded"></i>
                                                        </button>
                                                        <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                                            <button className="dropdown-item" type="button" onClick={() => setViewInvoice(sale)}><i className="bx bx-show me-2"></i>View Invoice</button>
                                                            <button className="dropdown-item" type="button" onClick={() => navigate("/sales/pos", { state: { editSale: sale } })}>Edit</button>
                                                            <button className="dropdown-item" type="button" onClick={() => navigate("/sales/return", { state: { saleId: sale._id } })}>Return</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="pagination-row">
                        <span>Showing {filteredSales.length === 0 ? 0 : 1} to {filteredSales.length} of {filteredSales.length} entries</span>
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
            <Modal open={Boolean(viewInvoice)} title={`Invoice ${viewInvoice?.invoiceNo || viewInvoice?.billNo || ""}`} onClose={() => setViewInvoice(null)}>
                {viewInvoice ? (
                    <div className="card-body pt-0">
                        <div className="row g-3 mb-3">
                            <div className="col-md-4"><span className="text-muted d-block">Bill No</span><strong>{viewInvoice.billNo || "-"}</strong></div>
                            <div className="col-md-4"><span className="text-muted d-block">Invoice No</span><strong>{viewInvoice.invoiceNo || "-"}</strong></div>
                            <div className="col-md-4"><span className="text-muted d-block">Date</span><strong>{dateTime(viewInvoice.saleDate)}</strong></div>
                            <div className="col-md-4"><span className="text-muted d-block">Customer</span><strong>{viewInvoice.customer || "Walk-in"}</strong></div>
                            <div className="col-md-4"><span className="text-muted d-block">Phone</span><strong>{viewInvoice.customerPhone || "-"}</strong></div>
                            <div className="col-md-4"><span className="text-muted d-block">Payment</span><strong>{getPaymentModeSummary(viewInvoice)}</strong></div>
                        </div>
                        <div className="table-responsive app-table-wrap">
                            <table className="table app-table align-middle">
                                <thead>
                                    <tr>
                                        <th>Sr</th>
                                        <th>Barcode</th>
                                        <th>Item</th>
                                        <th>Qty</th>
                                        <th>MRP</th>
                                        <th>Sale Rate</th>
                                        <th className="text-end">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(viewInvoice.items || []).map((item, index) => (
                                        <tr key={item._id || `${item.barcode}-${index}`}>
                                            <td>{index + 1}</td>
                                            <td>{item.barcode || "-"}</td>
                                            <td>{item.itemName || "-"}</td>
                                            <td>{Number(item.displayQty || item.qty || 0)} {item.unit || ""}</td>
                                            <td>{money(item.mrp)}</td>
                                            <td>{money(item.sellingRate || item.saleRate)}</td>
                                            <td className="text-end">{money(item.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="row g-3 mt-2">
                            <div className="col-md-6">
                                <div className="app-message mb-0">Status: {Number(viewInvoice.totalAmount || 0) > Number(viewInvoice.totalPaid || viewInvoice.paidAmount || viewInvoice.totalAmount || 0) ? "Due" : "Paid"}</div>
                            </div>
                            <div className="col-md-6">
                                <div className="d-grid gap-2">
                                    <div className="d-flex justify-content-between"><span>Subtotal</span><strong>{money(viewInvoice.subtotal)}</strong></div>
                                    <div className="d-flex justify-content-between"><span>Discount</span><strong>{money(viewInvoice.discountAmount || viewInvoice.discount)}</strong></div>
                                    <div className="d-flex justify-content-between"><span>GST</span><strong>{money(viewInvoice.gstAmount)}</strong></div>
                                    <div className="d-flex justify-content-between fs-5"><span>Net Amount</span><strong>{money(viewInvoice.totalAmount)}</strong></div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </Modal>
        </>
    );
};

const styles = {
    page: { display: "grid", gap: 20 },
    hero: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        padding: 24,
        borderRadius: 28,
        background: "var(--hero-gradient-soft)",
        border: "1px solid var(--panel-border-soft)",
    },
    eyebrow: {
        color: "var(--text-soft)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: 12,
        fontWeight: 800,
    },
    title: {
        margin: "8px 0 10px",
        fontSize: "1.95rem",
        lineHeight: 1.08,
    },
    subtle: { color: "var(--text-soft)", margin: 0 },
    primaryButton: {
        border: "none",
        borderRadius: 16,
        padding: "12px 16px",
        background: "var(--button-primary)",
        color: "var(--button-primary-text)",
        fontWeight: 800,
        cursor: "pointer",
    },
    filterCard: { padding: 16 },
    filterGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 12,
    },
    input: {
        width: "100%",
        padding: "12px 14px",
        borderRadius: 14,
        border: "1px solid var(--line)",
        background: "var(--field-bg)",
        color: "var(--field-text)",
    },
    tableCard: { padding: 14 },
    rowButton: {
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "10px 12px",
        background: "var(--button-secondary-bg)",
        color: "var(--button-secondary-text)",
        fontWeight: 800,
        cursor: "pointer",
        marginRight: 8,
    },
    emptyCell: {
        textAlign: "center",
        padding: "28px 14px",
        color: "var(--text-soft)",
    },
};

export default SalesInvoice;
