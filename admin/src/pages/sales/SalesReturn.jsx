import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../../app/axios";
import { getApiErrorMessage } from "../../utils/api";
import { notifyError, notifySuccess } from "../../utils/notify";

const SalesReturn = () => {
    const location = useLocation();
    const preselectedSaleId = location.state?.saleId || "";
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSaleId, setSelectedSaleId] = useState(preselectedSaleId);
    const [returnQuantities, setReturnQuantities] = useState({});
    const [submitting, setSubmitting] = useState(false);

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

    const selectedSale = useMemo(
        () => sales.find((sale) => sale._id === selectedSaleId) || null,
        [sales, selectedSaleId]
    );

    const returnPreview = useMemo(() => {
        if (!selectedSale) return 0;
        return selectedSale.items.reduce((sum, item) => {
            const qty = Number(returnQuantities[item._id] || 0);
            return sum + (qty * Number(item.sellingRate || 0));
        }, 0);
    }, [returnQuantities, selectedSale]);

    const handleReturnQtyChange = (itemId, value) => {
        setReturnQuantities({ ...returnQuantities, [itemId]: Number(value) });
    };

    const handleSubmitReturn = async () => {
        if (!selectedSale) {
            notifyError("Select a sale first");
            return;
        }

        const returnItems = selectedSale.items.map((item) => ({
            id: item._id,
            qty: returnQuantities[item._id] || 0
        })).filter((item) => item.qty > 0);

        if (returnItems.length === 0) {
            notifyError("Enter return quantity for at least one item");
            return;
        }

        try {
            setSubmitting(true);
            const { data } = await api.post(`/sales/return/${selectedSale._id}`, { items: returnItems });

            notifySuccess("Return processed successfully");
            setSales((prev) => prev.map((sale) => (sale._id === data.data._id ? data.data : sale)));
            setReturnQuantities({});
        } catch (err) {
            console.error(err);
            notifyError(getApiErrorMessage(err, "Failed to process return"));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="card app-card"><div className="card-body">Loading sales returns...</div></div>;
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
                        <h1>Sales Return</h1>
                        <p className="mb-0 text-muted">Accept customer returns, validate invoice items, and restore stock with credit notes.</p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-check-circle"></i> Ready</span>
                        <button className="btn btn_style" type="button">
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
                            <label className="form-label">Select Invoice</label>
                            <select
                                className="form-control form-select"
                                onChange={(event) => {
                                    setSelectedSaleId(event.target.value);
                                    setReturnQuantities({});
                                }}
                                value={selectedSaleId}
                            >
                                <option value="">Select invoice</option>
                                {sales.map((sale) => (
                                    <option key={sale._id} value={sale._id}>
                                        {sale.invoiceNo} - {sale.customer || "Unknown"} - {new Date(sale.saleDate).toLocaleDateString()}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Customer</label>
                            <input className="form-control" value={selectedSale?.customer || ""} readOnly placeholder="Enter Customer" />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Invoice</label>
                            <input className="form-control" value={selectedSale?.invoiceNo || ""} readOnly placeholder="Enter Invoice" />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Return Preview</label>
                            <input className="form-control" value={`Rs. ${returnPreview.toFixed(2)}`} readOnly placeholder="Enter Return Preview" />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Already Returned</label>
                            <input className="form-control" value={`Rs. ${Number(selectedSale?.totalReturnedAmount || 0).toFixed(2)}`} readOnly placeholder="Enter Already Returned" />
                        </div>
                        <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                            <button className="btn btn_style" type="button" onClick={handleSubmitReturn} disabled={!selectedSale || submitting}>
                                <i className="bx bx-save"></i><span>{submitting ? "Submitting..." : "Save"}</span>
                            </button>
                            <button className="btn btn_style inActive" type="button" onClick={() => setReturnQuantities({})}>
                                <i className="bx bx-reset"></i><span>Clear</span>
                            </button>
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
                            <button className="btn btn_style datatable-create" type="button">
                                <i className="bx bx-plus"></i><span>Create Sales Return</span>
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
                                <input type="text" placeholder="Search Sales Return" aria-label="Search Sales Return" readOnly />
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
                                    <th><span className="sortable-heading">Item<i className="bx bx-sort-up"></i></span></th>
                                    <th><span className="sortable-heading">Sold<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Returned<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Remaining<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Return Qty<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Status<i className="bx bx-sort"></i></span></th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!selectedSale ? (
                                    <tr className="table-state-row table-state-row-empty">
                                        <td colSpan="8">
                                            <div className="empty-state compact">
                                                <span className="empty-state-icon"><i className="bx bx-search-alt"></i></span>
                                                <h6>No invoice selected</h6>
                                                <p>Select an invoice to start the return flow.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : selectedSale.items.map((item) => {
                                    const returnedQty = Number(item.returnedQty || 0);
                                    const remainingQty = Number(item.qty || 0) - returnedQty;
                                    const currentReturnQty = Number(returnQuantities[item._id] || 0);
                                    const statusClass = currentReturnQty > 0 ? "status-warning" : remainingQty <= 0 ? "status-success" : "status-primary";
                                    const statusText = currentReturnQty > 0 ? "Draft" : remainingQty <= 0 ? "Settled" : "Open";
                                    return (
                                        <tr key={item._id}>
                                            <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" /></td>
                                            <td>{item.itemId?.name || `Item ${item.itemId}`}</td>
                                            <td>{item.qty}</td>
                                            <td>{returnedQty}</td>
                                            <td>{remainingQty}</td>
                                            <td>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={remainingQty}
                                                    className="form-control form-control-sm"
                                                    value={returnQuantities[item._id] || 0}
                                                    onChange={(event) => handleReturnQtyChange(item._id, Math.min(Number(event.target.value || 0), remainingQty))}
                                                    style={{ width: 90 }}
                                                />
                                            </td>
                                            <td><span className={`status-badge ${statusClass}`}>{statusText}</span></td>
                                            <td className="text-end">
                                                <div className="datatable-actions">
                                                    <button type="button" className="btn action-btn" aria-label="Delete" onClick={() => handleReturnQtyChange(item._id, 0)}><i className="bx bx-trash"></i></button>
                                                    <button type="button" className="btn action-btn" aria-label="View"><i className="bx bx-show"></i></button>
                                                    <div className="dropdown">
                                                        <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions">
                                                            <i className="bx bx-dots-vertical-rounded"></i>
                                                        </button>
                                                        <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                                            <button className="dropdown-item" type="button" onClick={() => window.print()}>Download</button>
                                                            <button className="dropdown-item" type="button">Edit</button>
                                                            <button className="dropdown-item" type="button">Duplicate</button>
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
                        <span>Showing {selectedSale ? 1 : 0} to {selectedSale?.items?.length || 0} of {selectedSale?.items?.length || 0} entries</span>
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
        </>
    );
};

const SummaryRow = ({ label, value }) => (
    <div style={styles.summaryRow}>
        <span style={styles.subtle}>{label}</span>
        <strong>{value}</strong>
    </div>
);

const styles = {
    page: { display: "grid", gap: 20 },
    hero: {
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
    grid: {
        display: "grid",
        gridTemplateColumns: "0.95fr 1.05fr",
        gap: 18,
    },
    formCard: {
        padding: 18,
        display: "grid",
        gap: 14,
    },
    tableCard: {
        padding: 14,
        display: "grid",
        gap: 14,
    },
    sectionTitle: { fontWeight: 800 },
    input: {
        width: "100%",
        padding: "12px 14px",
        borderRadius: 14,
        border: "1px solid var(--line)",
        background: "var(--field-bg)",
        color: "var(--field-text)",
    },
    tableInput: {
        width: 90,
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid var(--line)",
        background: "var(--field-bg)",
        color: "var(--field-text)",
    },
    summaryCard: {
        display: "grid",
        gap: 10,
        borderRadius: 18,
        background: "var(--surface-soft)",
        padding: 14,
    },
    summaryRow: {
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
    },
    primaryButton: {
        justifySelf: "end",
        border: "none",
        borderRadius: 16,
        padding: "12px 16px",
        background: "var(--button-primary)",
        color: "var(--button-primary-text)",
        fontWeight: 800,
        cursor: "pointer",
    },
    emptyState: {
        padding: 18,
        borderRadius: 18,
        background: "var(--surface-soft)",
        color: "var(--text-soft)",
    },
};

export default SalesReturn;
