import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    createReceipt,
    fetchAccountingCustomers,
    fetchCustomerLedger,
    fetchReceipts,
} from "../../services/accountingService";
import { notifyError, notifySuccess } from "../../utils/notify";

const today = new Date().toISOString().slice(0, 10);
const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank"];

const emptyForm = {
    receiptDate: today,
    customerId: "",
    customerName: "",
    customerPhone: "",
    amount: "",
    paymentMode: "Cash",
    referenceNo: "",
    billNo: "",
    note: "",
};

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const ReceiptEntry = () => {
    const [form, setForm] = useState(emptyForm);
    const [customers, setCustomers] = useState([]);
    const [receipts, setReceipts] = useState([]);
    const [ledgerEntries, setLedgerEntries] = useState([]);
    const [customerQuery, setCustomerQuery] = useState("");
    const [receiptQuery, setReceiptQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [activeCustomerIndex, setActiveCustomerIndex] = useState(-1);
    const customerButtonRefs = useRef(new Map());

    const loadCustomers = async (query = "") => {
        const data = await fetchAccountingCustomers(query);
        setCustomers(data.data || []);
    };

    const loadReceipts = async (query = "") => {
        const data = await fetchReceipts(query);
        setReceipts(data.data || []);
    };

    const loadLedger = async (customerId) => {
        if (!customerId) {
            setLedgerEntries([]);
            return;
        }
        const data = await fetchCustomerLedger(customerId);
        setLedgerEntries(data.data || []);
    };

    useEffect(() => {
        Promise.all([loadCustomers(), loadReceipts()])
            .then(() => setError(""))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadCustomers(customerQuery).catch((err) => setError(err.message));
        }, 180);
        return () => clearTimeout(timer);
    }, [customerQuery]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadReceipts(receiptQuery).catch((err) => setError(err.message));
        }, 180);
        return () => clearTimeout(timer);
    }, [receiptQuery]);

    useEffect(() => {
        loadLedger(form.customerId).catch((err) => setError(err.message));
    }, [form.customerId]);

    const selectedCustomer = useMemo(
        () => customers.find((customer) => String(customer._id) === String(form.customerId)) || null,
        [customers, form.customerId]
    );

    useEffect(() => {
        setActiveCustomerIndex(customers.length > 0 ? 0 : -1);
    }, [customers.length]);

    useEffect(() => {
        if (activeCustomerIndex < 0) {
            return;
        }
        customerButtonRefs.current.get(activeCustomerIndex)?.scrollIntoView?.({ block: "nearest" });
    }, [activeCustomerIndex]);

    const todaySummary = useMemo(() => {
        const todayRows = receipts.filter((receipt) => String(receipt.createdAt || "").slice(0, 10) === today);
        return {
            count: todayRows.length,
            totalAmount: todayRows.reduce((sum, receipt) => sum + round2(receipt.amount), 0),
        };
    }, [receipts]);

    const updateForm = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const chooseCustomer = (customer) => {
        setForm((current) => ({
            ...current,
            customerId: customer._id,
            customerName: customer.name || "",
            customerPhone: customer.phone || "",
        }));
        setCustomerQuery(customer.name || "");
    };

    const handleCustomerLookupKeyDown = (event) => {
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
            chooseCustomer(customers[activeCustomerIndex]);
        }
    };

    const resetReceipt = () => {
        setForm((current) => ({
            ...emptyForm,
            customerId: current.customerId,
            customerName: current.customerName,
            customerPhone: current.customerPhone,
        }));
    };

    const saveCurrentReceipt = async () => {
        if (!form.customerName.trim() && !form.customerPhone.trim()) {
            notifyError("Customer name or phone is required.");
            return;
        }
        if (round2(form.amount) <= 0) {
            notifyError("Receipt amount must be greater than zero.");
            return;
        }

        try {
            setSaving(true);
            const data = await createReceipt(form);
            const nextCustomer = data.data?.customer || null;
            if (nextCustomer?._id) {
                chooseCustomer(nextCustomer);
            }
            await Promise.all([
                loadReceipts(receiptQuery),
                nextCustomer?._id ? loadLedger(nextCustomer._id) : Promise.resolve(),
                loadCustomers(customerQuery),
            ]);
            resetReceipt();
            setError("");
        } catch (err) {
            const message = err.message || "Failed to save receipt";
            setError(message);
            notifyError(message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="card app-card"><div className="card-body">Loading receipt desk...</div></div>;

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
                        <h1>Receipt Entry</h1>
                        <p className="mb-0 text-muted">Record customer receipts, map invoices, payment modes, references, and cash/bank ledgers.</p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-check-circle"></i> Ready</span>
                        <button className="btn btn_style" type="button" onClick={resetReceipt}>
                            <i className="bx bx-plus"></i><span>New</span>
                        </button>
                    </div>
                </div>
            </div>

            {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}

            <section className="card app-card">
                <div className="card-header app-card-header">
                    <div>
                        <h2>Entry Details</h2>
                        <p>Use consistent master data so downstream billing and reporting stay clean.</p>
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                        <span className="metric-pill">Today Receipts: {todaySummary.count}</span>
                        <span className="metric-pill">Rs. {todaySummary.totalAmount.toFixed(2)}</span>
                    </div>
                </div>
                <div className="card-body">
                    <form className="row g-3" data-enter-scope="receipt-form" onSubmit={(event) => event.preventDefault()}>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Receipt Date</label>
                            <input type="date" className="form-control" value={form.receiptDate} onChange={(event) => updateForm("receiptDate", event.target.value)} />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Mobile No</label>
                            <input type="text" className="form-control" value={form.customerPhone} onChange={(event) => updateForm("customerPhone", event.target.value)} placeholder="Enter Mobile No" />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Customer Name</label>
                            <input type="text" className="form-control" value={form.customerName} onChange={(event) => updateForm("customerName", event.target.value)} placeholder="Enter Customer Name" />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Amount</label>
                            <input type="number" className="form-control" value={form.amount} onChange={(event) => updateForm("amount", event.target.value)} placeholder="Enter Amount" />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Payment Mode</label>
                            <select className="form-select" value={form.paymentMode} onChange={(event) => updateForm("paymentMode", event.target.value)}>
                                {PAYMENT_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Reference No</label>
                            <input type="text" className="form-control" value={form.referenceNo} onChange={(event) => updateForm("referenceNo", event.target.value)} placeholder="Enter Reference No" />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Bill No</label>
                            <input type="text" className="form-control" value={form.billNo} onChange={(event) => updateForm("billNo", event.target.value)} placeholder="Enter Bill No" />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Note</label>
                            <input type="text" className="form-control" value={form.note} onChange={(event) => updateForm("note", event.target.value)} placeholder="Enter Note" />
                        </div>
                        <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                            <button className="btn btn_style" type="button" onClick={saveCurrentReceipt} disabled={saving}>
                                <i className="bx bx-save"></i><span>{saving ? "Saving..." : "Save"}</span>
                            </button>
                            <button className="btn btn_style inActive" type="button" onClick={resetReceipt}>
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
                            <button className="btn btn_style datatable-create" type="button" onClick={resetReceipt}>
                                <i className="bx bx-plus"></i><span>Create Receipt Entry</span>
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
                                <input value={receiptQuery} onChange={(event) => setReceiptQuery(event.target.value)} type="text" placeholder="Search Receipt Entry" aria-label="Search Receipt Entry" />
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
                                    <th><span className="sortable-heading">Receipt Date<i className="bx bx-sort-up"></i></span></th>
                                    <th><span className="sortable-heading">Customer<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Phone<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Payment Mode<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Reference<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Bill No<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Amount<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Status<i className="bx bx-sort"></i></span></th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {receipts.length > 0 ? receipts.map((receipt) => (
                                    <tr key={receipt._id}>
                                        <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" /></td>
                                        <td>{new Date(receipt.createdAt).toLocaleDateString()}</td>
                                        <td>{receipt.customerName || "-"}</td>
                                        <td>{receipt.customerPhone || "-"}</td>
                                        <td>{receipt.paymentMode || "-"}</td>
                                        <td>{receipt.referenceNo || "-"}</td>
                                        <td>{receipt.billNo || "-"}</td>
                                        <td>Rs. {round2(receipt.amount).toFixed(2)}</td>
                                        <td><span className="status-badge status-success">Posted</span></td>
                                        <td className="text-end">
                                            <div className="datatable-actions">
                                                <button type="button" className="btn action-btn" aria-label="Delete"><i className="bx bx-trash"></i></button>
                                                <button type="button" className="btn action-btn" aria-label="View"><i className="bx bx-show"></i></button>
                                                <div className="dropdown">
                                                    <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions">
                                                        <i className="bx bx-dots-vertical-rounded"></i>
                                                    </button>
                                                    <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                                        <a className="dropdown-item" href="#">Download</a>
                                                        <a className="dropdown-item" href="#">Edit</a>
                                                        <a className="dropdown-item" href="#">Duplicate</a>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr className="table-state-row table-state-row-empty">
                                        <td colSpan="10">
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
                        <span>Showing {receipts.length === 0 ? 0 : 1} to {receipts.length} of {receipts.length} entries</span>
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

            <section className="row g-3 mt-1">
                <div className="col-12 col-xl-5">
                    <div className="card app-card h-100">
                        <div className="card-header app-card-header">
                            <div><h2>Customer Lookup</h2><p>{customers.length} shown</p></div>
                        </div>
                        <div className="card-body">
                            <div className="datatable-search w-100 mb-3">
                                <input
                                    value={customerQuery}
                                    onChange={(event) => setCustomerQuery(event.target.value)}
                                    onKeyDown={handleCustomerLookupKeyDown}
                                    data-enter-nav="false"
                                    placeholder="Search by phone or name"
                                    aria-label="Search customer"
                                />
                            </div>
                            <div className="quick-action-list">
                                {customers.map((customer, index) => (
                                    <button
                                        key={customer._id}
                                        ref={(node) => {
                                            if (node) customerButtonRefs.current.set(index, node);
                                            else customerButtonRefs.current.delete(index);
                                        }}
                                        type="button"
                                        onClick={() => chooseCustomer(customer)}
                                        onMouseEnter={() => setActiveCustomerIndex(index)}
                                        className={`quick-action justify-content-between ${String(customer._id) === String(form.customerId) || activeCustomerIndex === index ? "active" : ""}`}
                                    >
                                        <span>
                                            <strong>{customer.name || "Customer"}</strong>
                                            <small className="d-block text-muted">{customer.phone || "No phone"} • Balance Rs. {round2(customer.ledgerBalance).toFixed(2)}</small>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-xl-7">
                    <div className="card app-card h-100">
                        <div className="card-header app-card-header">
                            <div><h2>Customer Ledger</h2><p>{selectedCustomer ? selectedCustomer.name : "Choose customer"}</p></div>
                        </div>
                        <div className="card-body">
                            {selectedCustomer ? (
                                <>
                                    <div className="summary-line"><span>Current Balance</span><strong>Rs. {round2(selectedCustomer.ledgerBalance).toFixed(2)}</strong></div>
                                    <div className="table-responsive app-table-wrap mt-3">
                                        <table className="table app-table align-middle">
                                            <thead><tr><th>Entry</th><th>Date</th><th className="text-end">Amount</th><th>Reference</th></tr></thead>
                                            <tbody>
                                                {ledgerEntries.slice(0, 8).map((entry) => (
                                                    <tr key={entry._id}>
                                                        <td>{entry.entryType}</td>
                                                        <td>{new Date(entry.createdAt).toLocaleString()}</td>
                                                        <td className="text-end">{entry.direction === "credit" ? "-" : "+"}Rs. {round2(entry.amount).toFixed(2)}</td>
                                                        <td>{entry.referenceNo || entry.billNo || "-"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : (
                                <div className="empty-state compact">
                                    <span className="empty-state-icon"><i className="bx bx-user-circle"></i></span>
                                    <h6>Choose customer</h6>
                                    <p>Choose a customer to inspect receipt history and ledger movement.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
};

const Field = ({ label, value, onChange, type = "text", as = "input" }) => (
    <label style={styles.field}>
        <span style={styles.label}>{label}</span>
        {as === "textarea" ? (
            <textarea value={value} onChange={(e) => onChange(e.target.value)} style={styles.textarea} />
        ) : (
            <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={styles.input} />
        )}
    </label>
);

const StatCard = ({ label, value, tone = "default" }) => (
    <div style={tone === "accent" ? styles.statCardAccent : styles.statCard}>
        <span style={styles.statLabel}>{label}</span>
        <strong style={styles.statValue}>{value}</strong>
    </div>
);

const customerButton = (active, selected) => ({
    border: active || selected ? "1px solid rgba(129, 174, 101, 0.68)" : "1px solid var(--line)",
    background: active ? "rgba(222, 239, 201, 0.58)" : selected ? "rgba(108, 150, 255, 0.12)" : "var(--surface)",
    borderRadius: 16,
    padding: "12px 14px",
    textAlign: "left",
    cursor: "pointer",
    boxShadow: selected ? "0 0 0 2px rgba(108, 150, 255, 0.18)" : "none",
});

const styles = {
    page: { display: "grid", gap: 20 },
    hero: {
        display: "flex",
        justifyContent: "space-between",
        gap: 18,
        flexWrap: "wrap",
        padding: 24,
        borderRadius: 28,
        background: "var(--hero-gradient)",
        border: "1px solid var(--panel-border)",
    },
    eyebrow: {
        color: "var(--text-soft)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: 12,
        fontWeight: 800,
    },
    title: { margin: "8px 0 10px", fontSize: "1.95rem", lineHeight: 1.08 },
    subtle: { color: "var(--text-soft)", margin: 0, maxWidth: 760 },
    heroStats: { display: "grid", gridTemplateColumns: "repeat(2, minmax(160px, 1fr))", gap: 12 },
    statCard: {
        display: "grid",
        gap: 8,
        padding: 16,
        borderRadius: 18,
        background: "var(--surface)",
        border: "1px solid var(--line)",
        minWidth: 160,
    },
    statCardAccent: {
        display: "grid",
        gap: 8,
        padding: 16,
        borderRadius: 18,
        background: "var(--accent)",
        border: "1px solid rgba(0,0,0,0.04)",
        minWidth: 160,
    },
    statLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-soft)", fontWeight: 800 },
    statValue: { fontSize: 24, lineHeight: 1.1 },
    errorBanner: {
        padding: "14px 16px",
        borderRadius: 16,
        background: "var(--danger-soft-bg)",
        border: "1px solid var(--danger-soft-border)",
        color: "var(--danger-soft-text)",
    },
    grid: { display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) 360px", gap: 18, alignItems: "start" },
    formCard: { padding: 18, display: "grid", gap: 16 },
    sideStack: { display: "grid", gap: 18 },
    sideCard: { padding: 18, display: "grid", gap: 14 },
    sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
    sectionMeta: { color: "var(--text-soft)", fontSize: 13 },
    formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
    field: { display: "grid", gap: 6 },
    label: { fontWeight: 700, fontSize: 12, color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.04em" },
    input: { width: "100%", padding: "12px 14px", borderRadius: 14, border: "1px solid var(--field-border)", background: "var(--field-bg)", color: "var(--field-text)" },
    textarea: { width: "100%", minHeight: 96, padding: "12px 14px", borderRadius: 14, border: "1px solid var(--field-border)", background: "var(--field-bg)", color: "var(--field-text)", resize: "vertical" },
    actions: { display: "flex", gap: 10, flexWrap: "wrap" },
    primaryButton: { border: "none", borderRadius: 16, padding: "12px 16px", background: "var(--button-primary)", color: "var(--button-primary-text)", fontWeight: 800, cursor: "pointer" },
    secondaryButton: { border: "1px solid var(--button-secondary-border)", borderRadius: 16, padding: "12px 16px", background: "var(--button-secondary-bg)", color: "var(--button-secondary-text)", fontWeight: 800, cursor: "pointer" },
    lookupList: { display: "grid", gap: 10, maxHeight: 320, overflowY: "auto" },
    smallMuted: { color: "var(--text-soft)", fontSize: 12 },
    ledgerHighlight: {
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        padding: "14px 16px",
        borderRadius: 16,
        background: "var(--surface-soft)",
        border: "1px solid var(--line)",
    },
    ledgerList: { display: "grid", gap: 10 },
    ledgerRow: {
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 14,
        border: "1px solid var(--line)",
        background: "var(--surface)",
    },
    emptyState: { padding: 18, borderRadius: 16, background: "var(--surface-soft)", color: "var(--text-soft)" },
    tableCard: { padding: 18, display: "grid", gap: 14 },
    emptyCell: { textAlign: "center", padding: 24, color: "var(--text-soft)" },
};

export default ReceiptEntry;
