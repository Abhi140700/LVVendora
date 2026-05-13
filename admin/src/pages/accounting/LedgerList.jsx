import React, { useEffect, useRef, useState } from "react";
import { fetchAccountingCustomers, fetchCustomerLedger } from "../../services/accountingService";
import { notifyError } from "../../utils/notify";

const LedgerList = () => {
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [entries, setEntries] = useState([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeCustomerIndex, setActiveCustomerIndex] = useState(-1);
    const customerRowRefs = useRef(new Map());

    useEffect(() => {
        setLoading(true);
        setError("");
        fetchAccountingCustomers(query)
            .then((data) => {
                setCustomers(data.data || []);
                setLoading(false);
            })
            .catch((err) => {
                const message = err.message || "Failed to load customers.";
                notifyError(message);
                setError(message);
                setLoading(false);
            });
    }, [query]);

    useEffect(() => {
        if (!selectedCustomer?._id) {
            setEntries([]);
            return;
        }
        setError("");
        fetchCustomerLedger(selectedCustomer._id)
            .then((data) => setEntries(data.data || []))
            .catch((err) => {
                const message = err.message || "Failed to load ledger entries.";
                notifyError(message);
                setError(message);
            });
    }, [selectedCustomer]);

    useEffect(() => {
        setActiveCustomerIndex(customers.length > 0 ? 0 : -1);
    }, [customers.length]);

    useEffect(() => {
        if (activeCustomerIndex < 0) {
            return;
        }
        customerRowRefs.current.get(activeCustomerIndex)?.scrollIntoView?.({ block: "nearest" });
    }, [activeCustomerIndex]);

    const handleCustomerListKeyDown = (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveCustomerIndex((current) => (customers.length ? (current + 1 + customers.length) % customers.length : -1));
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveCustomerIndex((current) => (customers.length ? (current - 1 + customers.length) % customers.length : -1));
            return;
        }

        if (event.key === "Enter" && activeCustomerIndex >= 0 && customers[activeCustomerIndex]) {
            event.preventDefault();
            setSelectedCustomer(customers[activeCustomerIndex]);
        }
    };

    if (loading) return <div className="card app-card"><div className="card-body">Loading ledger list...</div></div>;

    return (
        <>
            <div className="page-header card">
                <div className="card-body">
                    <div>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-2">
                                <li className="breadcrumb-item"><a href="/dashboard">Home</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Accounting</li>
                            </ol>
                        </nav>
                        <p className="section-label">Accounting</p>
                        <h1>Ledger List</h1>
                        <p className="mb-0 text-muted">Browse ledgers, account groups, opening balances, GST mapping, and activity status.</p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-check-circle"></i> Ready</span>
                        <button className="btn btn_style" type="button">
                            <i className="bx bx-plus"></i><span>New</span>
                        </button>
                    </div>
                </div>
            </div>

            {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}

            <section className="card app-card">
                <div className="card-header app-card-header">
                    <div>
                        <h2>Filters</h2>
                        <p>Use consistent master data so downstream billing and reporting stay clean.</p>
                    </div>
                </div>
                <div className="card-body">
                    <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Search Customer Or Phone</label>
                            <input
                                type="text"
                                className="form-control"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                onKeyDown={handleCustomerListKeyDown}
                                data-enter-nav="false"
                                placeholder="Enter Search Customer Or Phone"
                            />
                        </div>
                        <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                            <button className="btn btn_style" type="button">
                                <i className="bx bx-save"></i><span>Save</span>
                            </button>
                            <button className="btn btn_style inActive" type="button" onClick={() => setQuery("")}>
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
                                <i className="bx bx-plus"></i><span>Create Ledger</span>
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
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    onKeyDown={handleCustomerListKeyDown}
                                    data-enter-nav="false"
                                    placeholder="Search Ledger List"
                                    aria-label="Search Ledger List"
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
                                    <th><span className="sortable-heading">Customer<i className="bx bx-sort-up"></i></span></th>
                                    <th><span className="sortable-heading">Phone<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Location<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Ledger Balance<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Last Reference<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Status<i className="bx bx-sort"></i></span></th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.length > 0 ? customers.map((customer, index) => (
                                    <tr
                                        key={customer._id}
                                        ref={(node) => {
                                            if (node) customerRowRefs.current.set(index, node);
                                            else customerRowRefs.current.delete(index);
                                        }}
                                        className={selectedCustomer?._id === customer._id || activeCustomerIndex === index ? "table-active" : ""}
                                        onClick={() => setSelectedCustomer(customer)}
                                        onMouseEnter={() => setActiveCustomerIndex(index)}
                                    >
                                        <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" onClick={(event) => event.stopPropagation()} /></td>
                                        <td>{customer.name || "-"}</td>
                                        <td>{customer.phone || "-"}</td>
                                        <td>{customer.location || customer.area || customer.city || "-"}</td>
                                        <td>Rs. {Number(customer.ledgerBalance || 0).toFixed(2)}</td>
                                        <td>{customer.lastReference || customer.lastBillNo || customer.referenceNo || "-"}</td>
                                        <td><span className="status-badge status-success">Active</span></td>
                                        <td className="text-end">
                                            <div className="datatable-actions">
                                                <button type="button" className="btn action-btn" aria-label="Delete" onClick={(event) => event.stopPropagation()}><i className="bx bx-trash"></i></button>
                                                <button type="button" className="btn action-btn" aria-label="View" onClick={(event) => { event.stopPropagation(); setSelectedCustomer(customer); }}><i className="bx bx-show"></i></button>
                                                <div className="dropdown">
                                                    <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions" onClick={(event) => event.stopPropagation()}>
                                                        <i className="bx bx-dots-vertical-rounded"></i>
                                                    </button>
                                                    <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                                        <button className="dropdown-item" type="button" onClick={() => setSelectedCustomer(customer)}>View Ledger</button>
                                                        <button className="dropdown-item" type="button">Edit</button>
                                                        <button className="dropdown-item" type="button">Download</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr className="table-state-row table-state-row-empty">
                                        <td colSpan="8">
                                            <div className="empty-state compact">
                                                <span className="empty-state-icon"><i className="bx bx-search-alt"></i></span>
                                                <h6>No matching records</h6>
                                                <p>Try changing filters or clearing the search field.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="pagination-row">
                        <span>Showing {customers.length === 0 ? 0 : 1} to {customers.length} of {customers.length} entries</span>
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

            <section className="card app-card mt-3">
                <div className="card-header app-card-header">
                    <div>
                        <h2>Ledger Entries</h2>
                        <p>{selectedCustomer ? selectedCustomer.name : "Select a customer to inspect ledger entries."}</p>
                    </div>
                </div>
                <div className="card-body p-0">
                    <div className="table-responsive app-table-wrap">
                        <table className="table app-table align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Direction</th>
                                    <th>Reference</th>
                                    <th>Amount</th>
                                    <th>Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.length > 0 ? entries.map((entry) => (
                                    <tr key={entry._id}>
                                        <td>{new Date(entry.createdAt).toLocaleString()}</td>
                                        <td>{entry.entryType}</td>
                                        <td>{entry.direction}</td>
                                        <td>{entry.referenceNo || entry.billNo || "-"}</td>
                                        <td>Rs. {Number(entry.amount || 0).toFixed(2)}</td>
                                        <td>{entry.note || "-"}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="6">
                                            <div className="empty-state compact">
                                                <span className="empty-state-icon"><i className="bx bx-receipt"></i></span>
                                                <h6>No ledger entries</h6>
                                                <p>Select a customer to inspect ledger entries.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </>
    );
};

const styles = {
    page: { display: "grid", gap: 18 },
    hero: { padding: 24, display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" },
    eyebrow: { fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-soft)", fontWeight: 800 },
    title: { margin: "6px 0 8px" },
    subtle: { margin: 0, color: "var(--text-soft)" },
    grid: { display: "grid", gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)", gap: 16 },
    card: { padding: 18, display: "grid", gap: 14 },
    sectionTitle: { fontWeight: 800 },
    list: { display: "grid", gap: 10, maxHeight: 560, overflowY: "auto" },
    row: { border: "1px solid var(--line)", background: "var(--field-bg)", borderRadius: 16, padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 12, cursor: "pointer", textAlign: "left", color: "var(--field-text)" },
    keyboardRow: { border: "1px solid rgba(108, 150, 255, 0.38)", background: "rgba(108, 150, 255, 0.12)", borderRadius: 16, padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 12, cursor: "pointer", textAlign: "left", color: "var(--field-text)", boxShadow: "0 0 0 2px rgba(108, 150, 255, 0.12)" },
    activeRow: { border: "1px solid rgba(0,0,0,0.04)", background: "var(--accent)", borderRadius: 16, padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 12, cursor: "pointer", textAlign: "left" },
    muted: { color: "var(--text-soft)", fontSize: 12 },
    error: { padding: "12px 14px", borderRadius: 14, background: "var(--danger-soft-bg)", color: "var(--danger-soft-text)" },
    input: { width: "min(320px, 100%)", padding: "12px 14px", borderRadius: 14, border: "1px solid var(--field-border)", background: "var(--field-bg)", color: "var(--field-text)" },
    emptyCell: { padding: 18, textAlign: "center", color: "var(--text-soft)" },
};

export default LedgerList;
