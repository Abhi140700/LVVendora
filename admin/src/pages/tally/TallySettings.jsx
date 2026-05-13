import React, { useEffect, useState } from "react";
import { fetchTallySettings, saveTallySettings } from "../../services/tallyService";
import { notifyError, notifySuccess } from "../../utils/notify";

const createEmptySettings = () => ({
    companyName: "",
    companyAlias: "",
    fromDate: "",
    toDate: "",
    voucherTypes: {
        sales: "Sales",
        purchase: "Purchase",
        receipt: "Receipt",
        payment: "Payment",
        journal: "Journal",
    },
    ledgers: {
        salesLedger: "Sales Account",
        purchaseLedger: "Purchase Account",
        cashLedger: "Cash",
        customerLedgerControl: "Customer Ledger Control",
        roundOffLedger: "Round Off",
        gstOutputLedger: "Output GST",
        gstInputLedger: "Input GST",
    },
    exportBehavior: {
        markSalesAsExported: true,
        markPurchasesAsExported: true,
        onlyUnexportedByDefault: true,
    },
    xmlFormat: "tally-import-v1",
});

const TallySettings = () => {
    const [settings, setSettings] = useState(createEmptySettings());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        fetchTallySettings()
            .then((response) => {
                const data = response.data || createEmptySettings();
                setSettings({
                    ...createEmptySettings(),
                    ...data,
                    fromDate: data.fromDate ? String(data.fromDate).slice(0, 10) : "",
                    toDate: data.toDate ? String(data.toDate).slice(0, 10) : "",
                });
                setError("");
            })
            .catch((err) => {
                setError(err.message);
                notifyError(err.message || "Failed to load Tally settings");
            })
            .finally(() => setLoading(false));
    }, []);

    const updateNested = (group, key, value) => {
        setSettings((current) => ({
            ...current,
            [group]: {
                ...current[group],
                [key]: value,
            },
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const response = await saveTallySettings(settings);
            setMessage(response.message || "Tally settings saved.");
            setError("");
            notifySuccess(response.message || "Tally settings saved.");
        } catch (err) {
            setError(err.message);
            notifyError(err.message || "Failed to save Tally settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="card app-card"><div className="card-body">Loading Tally settings...</div></div>;
    if (error && !settings.companyName && !settings.companyAlias) return <div className="card app-card"><div className="card-body text-danger">Error: {error}</div></div>;

    return (
        <>
            <div className="page-header card">
                <div className="card-body">
                    <div>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-2">
                                <li className="breadcrumb-item"><a href="/dashboard">Home</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Tally</li>
                            </ol>
                        </nav>
                        <p className="section-label">Tally</p>
                        <h1>Tally Settings</h1>
                        <p className="mb-0 text-muted">Configure sync company, voucher types, ledger mappings, tax behavior, and retry policy.</p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-check-circle"></i> Ready</span>
                        <button className="btn btn_style" type="button" onClick={handleSave} disabled={saving}>
                            <i className="bx bx-save"></i><span>{saving ? "Saving..." : "Save Settings"}</span>
                        </button>
                    </div>
                </div>
            </div>

            {message ? <div className="alert alert-success" role="alert">{message}</div> : null}
            {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}

            <section className="card app-card">
                <div className="card-header app-card-header">
                    <div>
                        <h2>Configuration</h2>
                        <p>Use consistent master data so downstream billing and reporting stay clean.</p>
                    </div>
                </div>
                <div className="card-body">
                    <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                        <Field label="Company Name" value={settings.companyName} onChange={(value) => setSettings((current) => ({ ...current, companyName: value }))} />
                        <Field label="Company Alias" value={settings.companyAlias} onChange={(value) => setSettings((current) => ({ ...current, companyAlias: value }))} />
                        <Field label="Default From Date" type="date" value={settings.fromDate} onChange={(value) => setSettings((current) => ({ ...current, fromDate: value }))} />
                        <Field label="Default To Date" type="date" value={settings.toDate} onChange={(value) => setSettings((current) => ({ ...current, toDate: value }))} />

                        <Field label="Sales Voucher Type" value={settings.voucherTypes.sales} onChange={(value) => updateNested("voucherTypes", "sales", value)} />
                        <Field label="Purchase Voucher Type" value={settings.voucherTypes.purchase} onChange={(value) => updateNested("voucherTypes", "purchase", value)} />
                        <Field label="Payment Voucher Type" value={settings.voucherTypes.payment} onChange={(value) => updateNested("voucherTypes", "payment", value)} />
                        <Field label="Receipt Voucher Type" value={settings.voucherTypes.receipt} onChange={(value) => updateNested("voucherTypes", "receipt", value)} />
                        <Field label="Journal Voucher Type" value={settings.voucherTypes.journal} onChange={(value) => updateNested("voucherTypes", "journal", value)} />

                        <Field label="Sales Ledger" value={settings.ledgers.salesLedger} onChange={(value) => updateNested("ledgers", "salesLedger", value)} />
                        <Field label="Purchase Ledger" value={settings.ledgers.purchaseLedger} onChange={(value) => updateNested("ledgers", "purchaseLedger", value)} />
                        <Field label="Cash Ledger" value={settings.ledgers.cashLedger} onChange={(value) => updateNested("ledgers", "cashLedger", value)} />
                        <Field label="Customer Ledger Control" value={settings.ledgers.customerLedgerControl} onChange={(value) => updateNested("ledgers", "customerLedgerControl", value)} />
                        <Field label="Round Off Ledger" value={settings.ledgers.roundOffLedger} onChange={(value) => updateNested("ledgers", "roundOffLedger", value)} />
                        <Field label="Output GST Ledger" value={settings.ledgers.gstOutputLedger} onChange={(value) => updateNested("ledgers", "gstOutputLedger", value)} />
                        <Field label="Input GST Ledger" value={settings.ledgers.gstInputLedger} onChange={(value) => updateNested("ledgers", "gstInputLedger", value)} />

                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">XML Format</label>
                            <select className="form-select" value={settings.xmlFormat} onChange={(event) => setSettings((current) => ({ ...current, xmlFormat: event.target.value }))}>
                                <option value="tally-import-v1">Tally Import V1</option>
                                <option value="tally-import-v2">Tally Import V2</option>
                            </select>
                        </div>

                        <div className="col-12 d-flex flex-wrap gap-3 pt-2">
                            <Checkbox
                                label="Mark sales as exported"
                                checked={settings.exportBehavior.markSalesAsExported}
                                onChange={(checked) => updateNested("exportBehavior", "markSalesAsExported", checked)}
                            />
                            <Checkbox
                                label="Mark purchases as exported"
                                checked={settings.exportBehavior.markPurchasesAsExported}
                                onChange={(checked) => updateNested("exportBehavior", "markPurchasesAsExported", checked)}
                            />
                            <Checkbox
                                label="Only unexported by default"
                                checked={settings.exportBehavior.onlyUnexportedByDefault}
                                onChange={(checked) => updateNested("exportBehavior", "onlyUnexportedByDefault", checked)}
                            />
                        </div>

                        <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                            <button className="btn btn_style" type="button" onClick={handleSave} disabled={saving}>
                                <i className="bx bx-save"></i><span>{saving ? "Saving..." : "Save"}</span>
                            </button>
                            <button className="btn btn_style inActive" type="button" onClick={() => setSettings(createEmptySettings())}>
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
                            <button className="btn btn_style datatable-create" type="button" onClick={handleSave} disabled={saving}>
                                <i className="bx bx-plus"></i><span>Create Recent Changes</span>
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
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" defaultChecked /><span>Setting</span></label>
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" defaultChecked /><span>Value</span></label>
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" defaultChecked /><span>Updated By</span></label>
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" defaultChecked /><span>Status</span></label>
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
                                <input type="text" placeholder="Search Recent Changes" aria-label="Search Recent Changes" readOnly />
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
                                    <th><span className="sortable-heading">Setting<i className="bx bx-sort-up"></i></span></th>
                                    <th><span className="sortable-heading">Value<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Updated By<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Updated On<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Status<i className="bx bx-sort"></i></span></th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" /></td>
                                    <td>Company Name</td>
                                    <td>{settings.companyName || "-"}</td>
                                    <td>Admin</td>
                                    <td>-</td>
                                    <td><span className="status-badge status-success">Active</span></td>
                                    <td className="text-end">
                                        <div className="datatable-actions">
                                            <button type="button" className="btn action-btn" aria-label="Delete"><i className="bx bx-trash"></i></button>
                                            <button type="button" className="btn action-btn" aria-label="View"><i className="bx bx-show"></i></button>
                                            <div className="dropdown">
                                                <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions">
                                                    <i className="bx bx-dots-vertical-rounded"></i>
                                                </button>
                                                <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                                    <button className="dropdown-item" type="button">Download</button>
                                                    <button className="dropdown-item" type="button">Edit</button>
                                                    <button className="dropdown-item" type="button">Duplicate</button>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" /></td>
                                    <td>XML Format</td>
                                    <td>{settings.xmlFormat || "-"}</td>
                                    <td>Admin</td>
                                    <td>-</td>
                                    <td><span className="status-badge status-success">Active</span></td>
                                    <td className="text-end">
                                        <div className="datatable-actions">
                                            <button type="button" className="btn action-btn" aria-label="Delete"><i className="bx bx-trash"></i></button>
                                            <button type="button" className="btn action-btn" aria-label="View"><i className="bx bx-show"></i></button>
                                            <div className="dropdown">
                                                <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions">
                                                    <i className="bx bx-dots-vertical-rounded"></i>
                                                </button>
                                                <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                                    <button className="dropdown-item" type="button">Download</button>
                                                    <button className="dropdown-item" type="button">Edit</button>
                                                    <button className="dropdown-item" type="button">Duplicate</button>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" /></td>
                                    <td>Only Unexported</td>
                                    <td>{settings.exportBehavior.onlyUnexportedByDefault ? "Yes" : "No"}</td>
                                    <td>Admin</td>
                                    <td>-</td>
                                    <td><span className="status-badge status-success">Active</span></td>
                                    <td className="text-end">
                                        <div className="datatable-actions">
                                            <button type="button" className="btn action-btn" aria-label="Delete"><i className="bx bx-trash"></i></button>
                                            <button type="button" className="btn action-btn" aria-label="View"><i className="bx bx-show"></i></button>
                                            <div className="dropdown">
                                                <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions">
                                                    <i className="bx bx-dots-vertical-rounded"></i>
                                                </button>
                                                <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                                    <button className="dropdown-item" type="button">Download</button>
                                                    <button className="dropdown-item" type="button">Edit</button>
                                                    <button className="dropdown-item" type="button">Duplicate</button>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="pagination-row">
                        <span>Showing 1 to 3 of 3 entries</span>
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

            <div className="modal fade" id="pageActionModal" tabIndex="-1" aria-hidden="true">
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">New Tally Settings</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            <p className="text-muted mb-3">Use the page form or table action menu to continue this workflow.</p>
                            <div className="quick-action-list">
                                <button className="quick-action" type="button"><i className="bx bx-plus"></i><span>Create record</span></button>
                                <button className="quick-action" type="button"><i className="bx bx-import"></i><span>Import data</span></button>
                                <button className="quick-action" type="button"><i className="bx bx-printer"></i><span>Print view</span></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

const Field = ({ label, value, onChange, type = "text" }) => (
    <div className="col-12 col-sm-6 col-xl-3">
        <label className="form-label">{label}</label>
        <input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} className="form-control" placeholder={`Enter ${label}`} />
    </div>
);

const Checkbox = ({ label, checked, onChange }) => (
    <label className="filter-check-row mb-0">
        <input className="form-check-input" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>{label}</span>
    </label>
);

const buttonStyle = {
    border: "none",
    borderRadius: 16,
    padding: "12px 16px",
    background: "linear-gradient(135deg, #17261f 0%, #314a3d 100%)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
};

const styles = {
    banner: { padding: 16, marginBottom: 14 },
    card: { padding: 16, display: "grid", gap: 16 },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
    field: { display: "grid", gap: 6 },
    label: { fontWeight: 700, color: "var(--text-soft)" },
    input: { border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", background: "var(--surface)", color: "var(--text-main)" },
    checkRow: { display: "flex", gap: 18, flexWrap: "wrap" },
    checkbox: { display: "flex", alignItems: "center", gap: 8, fontWeight: 600 },
};

export default TallySettings;
