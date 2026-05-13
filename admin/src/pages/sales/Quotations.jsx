import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "erp.quotations";
const today = new Date().toISOString().slice(0, 10);

const emptyItem = { description: "", qty: "1", rate: "0" };
const emptyForm = {
    recordId: "",
    quoteNo: "",
    quoteDate: today,
    validTill: today,
    customerName: "",
    customerPhone: "",
    notes: "",
    items: [emptyItem],
};

const createQuoteNo = (records) => `QT-${String((records?.length || 0) + 1).padStart(4, "0")}`;
const createRecordId = () => globalThis.crypto?.randomUUID?.() || `quote-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const Quotations = () => {
    const [records, setRecords] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [query, setQuery] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        setRecords(parsed);
        setForm((current) => ({ ...current, quoteNo: createQuoteNo(parsed) }));
    }, []);

    const persist = (nextRecords) => {
        setRecords(nextRecords);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
    };

    const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

    const updateItem = (index, field, value) => {
        setForm((current) => ({
            ...current,
            items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
        }));
    };

    const addItem = () => setForm((current) => ({ ...current, items: [...current.items, { ...emptyItem }] }));
    const removeItem = (index) => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) || [emptyItem] }));

    const save = () => {
        if (!form.customerName.trim()) {
            setMessage("Customer name is required.");
            return;
        }

        const normalizedItems = form.items
            .filter((item) => item.description.trim())
            .map((item) => ({
                ...item,
                qty: Number(item.qty || 0),
                rate: Number(item.rate || 0),
                amount: Number(item.qty || 0) * Number(item.rate || 0),
            }));

        const nextRecord = {
            ...form,
            quoteNo: form.quoteNo || createQuoteNo(records),
            items: normalizedItems,
            totalAmount: normalizedItems.reduce((sum, item) => sum + Number(item.amount || 0), 0),
        };

        const nextRecords = form.recordId
            ? records.map((record) => record.recordId === form.recordId ? nextRecord : record)
            : [{ ...nextRecord, recordId: createRecordId() }, ...records];

        persist(nextRecords);
        setMessage(form.recordId ? "Quotation updated." : "Quotation created.");
        setForm({ ...emptyForm, quoteNo: createQuoteNo(nextRecords) });
    };

    const edit = (record) => {
        setForm({
            ...record,
            items: record.items?.length ? record.items.map((item) => ({
                description: item.description || "",
                qty: String(item.qty || 0),
                rate: String(item.rate || 0),
            })) : [{ ...emptyItem }],
        });
    };

    const remove = (recordId) => {
        const nextRecords = records.filter((record) => record.recordId !== recordId);
        persist(nextRecords);
        setMessage("Quotation deleted.");
        setForm({ ...emptyForm, quoteNo: createQuoteNo(nextRecords) });
    };

    const filtered = useMemo(() => records.filter((record) => {
        const haystack = `${record.quoteNo} ${record.customerName} ${record.customerPhone}`.toLowerCase();
        return haystack.includes(query.toLowerCase());
    }), [records, query]);

    const liveTotal = form.items.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.rate || 0)), 0);

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
                        <h1>Quotations</h1>
                        <p className="mb-0 text-muted">Prepare customer quotations, convert accepted offers, and track quote validity.</p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-check-circle"></i> Ready</span>
                        <button className="btn btn_style" type="button" onClick={() => setForm({ ...emptyForm, quoteNo: createQuoteNo(records) })}>
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
                    <div className="d-flex flex-wrap gap-2">
                        <span className="metric-pill">Current Total</span>
                        <span className="metric-pill">Rs. {liveTotal.toFixed(2)}</span>
                    </div>
                </div>
                <div className="card-body">
                    <form className="row g-3" data-enter-scope="quotation-form" onSubmit={(event) => event.preventDefault()}>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Quotation No</label>
                            <input type="text" className="form-control" value={form.quoteNo} readOnly placeholder="Enter Quotation No" />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Quotation Date</label>
                            <input type="date" className="form-control" value={form.quoteDate} onChange={(event) => update("quoteDate", event.target.value)} />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Valid Till</label>
                            <input type="date" className="form-control" value={form.validTill} onChange={(event) => update("validTill", event.target.value)} />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Customer Name</label>
                            <input type="text" className="form-control" value={form.customerName} onChange={(event) => update("customerName", event.target.value)} placeholder="Enter Customer Name" />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Customer Phone</label>
                            <input type="text" className="form-control" value={form.customerPhone} onChange={(event) => update("customerPhone", event.target.value)} placeholder="Enter Customer Phone" />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Notes</label>
                            <input type="text" className="form-control" value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Enter Notes" />
                        </div>
                        <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                            <button className="btn btn_style" type="button" onClick={save}><i className="bx bx-save"></i><span>{form.recordId ? "Update Quotation" : "Save Quotation"}</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={() => setForm({ ...emptyForm, quoteNo: createQuoteNo(records) })}><i className="bx bx-reset"></i><span>Clear</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={addItem}><i className="bx bx-plus"></i><span>Add Line</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={() => window.print()}><i className="bx bx-printer"></i><span>Print</span></button>
                        </div>
                    </form>

                    <div className="table-responsive app-table-wrap mt-3">
                        <table className="table app-table align-middle">
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th>Qty</th>
                                    <th>Rate</th>
                                    <th>Amount</th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {form.items.map((item, index) => {
                                    const amount = Number(item.qty || 0) * Number(item.rate || 0);
                                    return (
                                        <tr key={`quote-item-${index}`}>
                                            <td><input className="form-control form-control-sm" value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} placeholder="Enter Description" /></td>
                                            <td><input className="form-control form-control-sm" type="number" value={item.qty} onChange={(event) => updateItem(index, "qty", event.target.value)} /></td>
                                            <td><input className="form-control form-control-sm" type="number" value={item.rate} onChange={(event) => updateItem(index, "rate", event.target.value)} /></td>
                                            <td>Rs. {amount.toFixed(2)}</td>
                                            <td className="text-end">
                                                <button type="button" className="btn btn_style inActive" onClick={() => removeItem(index)}>Remove</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {message ? <div className="text-muted mt-3">{message}</div> : null}
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
                            <button className="btn btn_style datatable-create" type="button" onClick={() => setForm({ ...emptyForm, quoteNo: createQuoteNo(records) })}>
                                <i className="bx bx-plus"></i><span>Create Quotations</span>
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
                                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Quotations" aria-label="Search Quotations" />
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
                                    <th><span className="sortable-heading">Quotation<i className="bx bx-sort-up"></i></span></th>
                                    <th><span className="sortable-heading">Date<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Customer<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Items<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Total<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Status<i className="bx bx-sort"></i></span></th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr className="table-state-row table-state-row-empty">
                                        <td colSpan="8">
                                            <div className="empty-state compact">
                                                <span className="empty-state-icon"><i className="bx bx-search-alt"></i></span>
                                                <h6>No matching records</h6>
                                                <p>Try changing filters or clearing the search field.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filtered.map((record) => (
                                    <tr key={record.recordId}>
                                        <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" /></td>
                                        <td>{record.quoteNo}</td>
                                        <td>{record.quoteDate}</td>
                                        <td>{record.customerName}</td>
                                        <td>{record.items?.length || 0}</td>
                                        <td>Rs. {Number(record.totalAmount || 0).toFixed(2)}</td>
                                        <td><span className="status-badge status-warning">Open</span></td>
                                        <td className="text-end">
                                            <div className="datatable-actions">
                                                <button type="button" className="btn action-btn" aria-label="Delete" onClick={() => remove(record.recordId)}><i className="bx bx-trash"></i></button>
                                                <button type="button" className="btn action-btn" aria-label="View" onClick={() => edit(record)}><i className="bx bx-show"></i></button>
                                                <div className="dropdown">
                                                    <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions">
                                                        <i className="bx bx-dots-vertical-rounded"></i>
                                                    </button>
                                                    <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                                        <button className="dropdown-item" type="button" onClick={() => window.print()}>Download</button>
                                                        <button className="dropdown-item" type="button" onClick={() => edit(record)}>Edit</button>
                                                        <button className="dropdown-item" type="button" onClick={() => setForm({ ...record, recordId: "", quoteNo: createQuoteNo(records) })}>Duplicate</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="pagination-row">
                        <span>Showing {filtered.length === 0 ? 0 : 1} to {filtered.length} of {filtered.length} entries</span>
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

const Field = ({ label, value, onChange, type = "text", readOnly = false }) => (
    <label style={styles.field}>
        <span style={styles.label}>{label}</span>
        <input type={type} value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} readOnly={readOnly} style={styles.input} />
    </label>
);

const styles = {
    page: { display: "grid", gap: 18 },
    hero: { padding: 24, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" },
    eyebrow: { fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-soft)", fontWeight: 800 },
    title: { margin: "6px 0 8px" },
    subtle: { margin: 0, color: "var(--text-soft)", maxWidth: 620 },
    totalCard: { display: "grid", gap: 4, padding: "14px 18px", borderRadius: 18, background: "var(--surface)", border: "1px solid var(--line)", minWidth: 170 },
    totalLabel: { color: "var(--text-soft)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 },
    totalValue: { fontSize: 24 },
    card: { padding: 18, display: "grid", gap: 14 },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 },
    field: { display: "grid", gap: 6 },
    label: { fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-soft)", fontWeight: 800 },
    input: { width: "100%", padding: "12px 14px", borderRadius: 14, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text-main)" },
    tableWrap: { overflowX: "auto" },
    actions: { display: "flex", gap: 10, flexWrap: "wrap" },
    primaryButton: { border: "none", borderRadius: 16, padding: "12px 16px", background: "var(--button-primary)", color: "var(--button-primary-text)", fontWeight: 800, cursor: "pointer" },
    secondaryButton: { border: "1px solid var(--line)", borderRadius: 14, padding: "10px 12px", background: "var(--surface)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer" },
    message: { color: "var(--text-soft)" },
    listHeader: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" },
    listTitle: { margin: 0 },
    search: { minWidth: "min(320px, 100%)", padding: "12px 14px", borderRadius: 14, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text-main)" },
};

export default Quotations;
