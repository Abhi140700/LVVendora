import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    createParty,
    deleteParty,
    fetchPartyByGst,
    fetchParties,
    updateParty,
} from "../../../services/partyService";

const PARTY_TYPES = ["party", "customer", "transporter", "supplierAgent", "firm", "salesman", "warehouse"];

const emptyForm = {
    recordId: "",
    name: "",
    phone: "",
    location: "",
    gstNo: "",
    state: "",
    stateCode: "",
};

const TITLES = {
    party: {
        title: "Party Master",
        subtitle: "Manage customers, suppliers, transporters, firms, agents, and salesmen from one master desk.",
        details: "Use consistent master data so downstream billing and reporting stay clean.",
        create: "Create Party Master",
    },
    warehouse: {
        title: "Warehouse Master",
        subtitle: "Manage stock locations and godowns used in purchase intake, transfer, and receive workflows.",
        details: "Keep warehouse names and GST/location data aligned with purchase and inventory movement.",
        create: "Create Warehouse",
    },
};

const labelForType = (type) => ({
    supplierAgent: "supplier agent",
}[type] || type);

const PartyList = ({ initialType = "party", lockedType = false, title, description }) => {
    const [partyType, setPartyType] = useState(initialType);
    const [parties, setParties] = useState([]);
    const [query, setQuery] = useState("");
    const [pageSize, setPageSize] = useState(10);
    const [selectedIds, setSelectedIds] = useState([]);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(emptyForm);

    const copy = TITLES[partyType] || TITLES.party;
    const pageTitle = title || copy.title;
    const pageSubtitle = description || copy.subtitle;

    const load = async (type = partyType) => {
        setLoading(true);
        try {
            const data = await fetchParties(type);
            if (!data.success) throw new Error(data.message || "Failed to load parties");
            setParties(data.data || []);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setSelectedIds([]);
        load(partyType);
    }, [partyType]);

    const save = async () => {
        try {
            const payload = { ...form, partyType };
            const data = form.recordId
                ? await updateParty(form.recordId, payload)
                : await createParty(payload);
            if (!data.success) {
                setMessage(data.message || "Failed to save party");
                return;
            }
            setForm(emptyForm);
            setMessage(form.recordId ? "Party updated." : "Party created.");
            load();
        } catch (error) {
            setMessage(error.response?.data?.message || error.message || "Failed to save party");
        }
    };

    const remove = async (id) => {
        try {
            const data = await deleteParty(id);
            if (!data.success) {
                setMessage(data.message || "Failed to delete party");
                return;
            }
            setMessage("Party deleted.");
            setSelectedIds((current) => current.filter((item) => item !== id));
            load();
        } catch (error) {
            setMessage(error.response?.data?.message || error.message || "Failed to delete party");
        }
    };

    const lookupGst = async () => {
        if (!form.gstNo) return;
        try {
            const data = await fetchPartyByGst(form.gstNo);
            const result = data.data || data;
            setForm((current) => ({
                ...current,
                name: current.name || result.partyName || result.tradeName || result.legalName || "",
                phone: current.phone || result.phone || "",
                location: current.location || result.city || result.addressLine2 || "",
                state: current.state || result.state || "",
                stateCode: current.stateCode || result.stateCode || "",
            }));
            setMessage("GST details loaded.");
        } catch (error) {
            setMessage(error.response?.data?.message || error.message || "GST lookup failed");
        }
    };

    const filtered = useMemo(() => parties.filter((party) => {
        const haystack = `${party.name || ""} ${party.phone || ""} ${party.location || ""} ${party.gstNo || ""} ${party.partyType || ""}`.toLowerCase();
        return haystack.includes(query.toLowerCase());
    }), [parties, query]);

    const visibleRows = filtered.slice(0, pageSize);
    const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((party) => selectedIds.includes(party._id));

    const toggleSelectAll = (checked) => {
        if (!checked) {
            setSelectedIds((current) => current.filter((id) => !visibleRows.some((party) => party._id === id)));
            return;
        }
        setSelectedIds((current) => Array.from(new Set([...current, ...visibleRows.map((party) => party._id)])));
    };

    const startEdit = (party) => {
        setForm({
            recordId: party._id,
            name: party.name || "",
            phone: party.phone || "",
            location: party.location || "",
            gstNo: party.gstNo || "",
            state: party.state || "",
            stateCode: party.stateCode || "",
        });
        setMessage("Edit mode enabled.");
    };

    return (
        <div className="container-fluid p-0 flex-grow-1">
            <div className="page-header card">
                <div className="card-body">
                    <div>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-2">
                                <li className="breadcrumb-item"><Link to="/">Home</Link></li>
                                <li className="breadcrumb-item active" aria-current="page">Masters</li>
                            </ol>
                        </nav>
                        <p className="section-label">Masters</p>
                        <h1>{pageTitle}</h1>
                        <p className="mb-0 text-muted">{pageSubtitle}</p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-check-circle" /> {loading ? "Loading" : "Ready"}</span>
                        <button className="btn btn_style" type="button" onClick={() => setForm(emptyForm)}>
                            <i className="bx bx-plus" /><span>New</span>
                        </button>
                    </div>
                </div>
            </div>

            <section className="card app-card">
                <div className="card-header app-card-header">
                    <div>
                        <h2>{pageTitle.replace("Master", "Details")}</h2>
                        <p>{copy.details}</p>
                    </div>
                </div>
                <div className="card-body">
                    <form className="row g-3" onSubmit={(event) => { event.preventDefault(); save(); }}>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label" htmlFor="party-type">Type</label>
                            <select
                                className="form-select"
                                id="party-type"
                                value={partyType}
                                disabled={lockedType}
                                onChange={(event) => { setPartyType(event.target.value); setForm(emptyForm); }}
                            >
                                {PARTY_TYPES.map((type) => <option key={type} value={type}>{labelForType(type)}</option>)}
                            </select>
                        </div>
                        <TextField id="party-name" label="Name" value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} />
                        <TextField id="party-phone" label="Phone" value={form.phone} onChange={(phone) => setForm((current) => ({ ...current, phone }))} />
                        <TextField id="party-location" label="Location" value={form.location} onChange={(location) => setForm((current) => ({ ...current, location }))} />
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label" htmlFor="party-gst">GST No</label>
                            <div className="input-group">
                                <input className="form-control" id="party-gst" value={form.gstNo} onChange={(event) => setForm((current) => ({ ...current, gstNo: event.target.value }))} placeholder="Enter GST No" />
                                <button className="btn btn_style inActive" type="button" onClick={lookupGst}><i className="bx bx-search" /></button>
                            </div>
                        </div>
                        <TextField id="party-state" label="State" value={form.state} onChange={(state) => setForm((current) => ({ ...current, state }))} />
                        <TextField id="party-state-code" label="State Code" value={form.stateCode} onChange={(stateCode) => setForm((current) => ({ ...current, stateCode }))} />
                        <TextField id="party-search-inline" label="Search" value={query} onChange={setQuery} placeholder={`Search ${pageTitle}`} />
                        <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                            <button className="btn btn_style" type="submit"><i className="bx bx-save" /><span>{form.recordId ? "Update" : "Save"}</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={() => setForm(emptyForm)}><i className="bx bx-reset" /><span>Clear</span></button>
                        </div>
                    </form>
                    {message ? <div className="alert alert-info mt-3 mb-0">{message}</div> : null}
                </div>
            </section>

            <section className="card app-card app-datatable-card">
                <div className="card-body p-0">
                    <div className="datatable-toolbar">
                        <div className="datatable-toolbar-start">
                            <label className="datatable-length">
                                <span>Show</span>
                                <select className="form-select form-select-sm datatable-page-size" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} aria-label="Rows per page">
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                </select>
                            </label>
                            <button className="btn btn_style datatable-create" type="button" onClick={() => setForm(emptyForm)}>
                                <i className="bx bx-plus" /><span>{copy.create}</span>
                            </button>
                        </div>
                        <div className="datatable-toolbar-end">
                            <button className="btn btn_style inActive datatable-tool-btn" type="button"><i className="bx bx-filter-alt" /><span>Filters</span></button>
                            <div className="dropdown">
                                <button className="btn btn_style inActive datatable-tool-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false"><i className="bx bx-columns" /><span>Columns</span></button>
                                <div className="dropdown-menu dropdown-menu-end datatable-column-menu">
                                    {["Name", "Phone", "Location", "GST", "Status"].map((column) => (
                                        <label className="dropdown-item column-toggle-row" key={column}>
                                            <input className="form-check-input" type="checkbox" checked readOnly />
                                            <span>{column}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="dropdown">
                                <button className="btn btn_style inActive datatable-tool-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false"><i className="bx bx-export" /><span>Export</span></button>
                                <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                    <button className="dropdown-item" type="button"><i className="bx bx-file me-2" />CSV</button>
                                    <button className="dropdown-item" type="button"><i className="bx bx-spreadsheet me-2" />Excel</button>
                                    <button className="dropdown-item" type="button" onClick={() => window.print()}><i className="bx bx-printer me-2" />Print</button>
                                </div>
                            </div>
                            <div className="datatable-search">
                                <input type="text" placeholder={`Search ${pageTitle} List`} aria-label={`Search ${pageTitle} List`} value={query} onChange={(event) => setQuery(event.target.value)} />
                            </div>
                            <select className="form-select datatable-status-filter" aria-label="Filter status" defaultValue="Invoice Status">
                                <option>Invoice Status</option>
                                <option>Active</option>
                            </select>
                        </div>
                    </div>

                    <div className="datatable-bulk-bar">
                        <div className="datatable-bulk-copy">
                            <strong>{selectedIds.length} selected</strong>
                            <span>Choose rows to unlock bulk actions</span>
                        </div>
                        <div className="datatable-bulk-actions">
                            <button className="btn btn_style inActive" type="button"><i className="bx bx-archive" /><span>Archive</span></button>
                            <button className="btn btn_style inActive" type="button"><i className="bx bx-export" /><span>Export</span></button>
                        </div>
                    </div>

                    <div className="table-responsive app-table-wrap datatable-wrap">
                        <table className="table app-table align-middle">
                            <thead>
                                <tr>
                                    <th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" checked={allVisibleSelected} onChange={(event) => toggleSelectAll(event.target.checked)} aria-label="Select all rows" /></th>
                                    <th><span className="sortable-heading">Name<i className="bx bx-sort-up" /></span></th>
                                    <th><span className="sortable-heading">Phone<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">Location<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">GST<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">Type<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">Status<i className="bx bx-sort" /></span></th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr className="table-state-row"><td colSpan="8"><div className="table-skeleton-list" aria-label="Loading rows"><span /><span /><span /></div></td></tr>
                                ) : visibleRows.length ? visibleRows.map((party) => (
                                    <tr key={party._id}>
                                        <td className="datatable-check-cell">
                                            <input className="form-check-input" type="checkbox" checked={selectedIds.includes(party._id)} onChange={(event) => {
                                                setSelectedIds((current) => event.target.checked ? [...current, party._id] : current.filter((id) => id !== party._id));
                                            }} aria-label="Select row" />
                                        </td>
                                        <td>{party.name}</td>
                                        <td>{party.phone || "-"}</td>
                                        <td>{party.location || "-"}</td>
                                        <td>{party.gstNo || "-"}</td>
                                        <td>{labelForType(party.partyType || partyType)}</td>
                                        <td><span className="status-badge status-success">Active</span></td>
                                        <td className="text-end">
                                            <div className="datatable-actions">
                                                <button type="button" className="btn action-btn" aria-label="Delete" onClick={() => remove(party._id)}><i className="bx bx-trash" /></button>
                                                <button type="button" className="btn action-btn" aria-label="View" onClick={() => startEdit(party)}><i className="bx bx-show" /></button>
                                                <div className="dropdown">
                                                    <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions"><i className="bx bx-dots-vertical-rounded" /></button>
                                                    <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                                        <button className="dropdown-item" type="button" onClick={() => startEdit(party)}>Edit</button>
                                                        <button className="dropdown-item" type="button" onClick={() => setForm({ ...emptyForm, ...party, recordId: "" })}>Duplicate</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr className="table-state-row table-state-row-empty">
                                        <td colSpan="8">
                                            <div className="empty-state compact">
                                                <span className="empty-state-icon"><i className="bx bx-search-alt" /></span>
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
                        <span>Showing {visibleRows.length ? 1 : 0} to {visibleRows.length} of {filtered.length} entries</span>
                        <nav aria-label="Table pagination">
                            <ul className="pagination pagination-sm mb-0">
                                <li className="page-item disabled"><a className="page-link" href="#previous" aria-label="Previous"><i className="bx bx-chevron-left" /></a></li>
                                <li className="page-item active"><a className="page-link" href="#page-1">1</a></li>
                                <li className="page-item disabled"><a className="page-link" href="#next" aria-label="Next"><i className="bx bx-chevron-right" /></a></li>
                            </ul>
                        </nav>
                    </div>
                </div>
            </section>
        </div>
    );
};

const TextField = ({ id, label, value, onChange, placeholder }) => (
    <div className="col-12 col-sm-6 col-xl-3">
        <label className="form-label" htmlFor={id}>{label}</label>
        <input className="form-control" id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder || `Enter ${label}`} />
    </div>
);

export default PartyList;
