import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../../app/axios";
import { UNIT_OPTIONS, normalizeUnit } from "../../../utils/unit";

const emptyForm = { name: "", hsn: "", unit: "PCS" };

const CategoryList = () => {
    const [categories, setCategories] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState("");
    const [query, setQuery] = useState("");
    const [pageSize, setPageSize] = useState(10);
    const [selectedIds, setSelectedIds] = useState([]);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/categories");
            if (!data.success) throw new Error(data.message || "Failed to load categories");
            setCategories(data.categories || []);
        } catch (error) {
            setMessage(error.response?.data?.message || error.message || "Failed to load categories");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const save = async () => {
        try {
            const { data } = editingId
                ? await api.put(`/categories/${editingId}`, form)
                : await api.post("/categories", form);
            if (!data.success) {
                setMessage(data.message || "Failed to save category");
                return;
            }
            setForm(emptyForm);
            setEditingId("");
            setMessage(editingId ? "Category updated." : "Category created.");
            load();
        } catch (error) {
            setMessage(error.response?.data?.message || error.message || "Failed to save category");
        }
    };

    const remove = async (id) => {
        try {
            const { data } = await api.delete(`/categories/${id}`);
            if (!data.success) {
                setMessage(data.message || "Failed to delete category");
                return;
            }
            setMessage("Category deleted.");
            setSelectedIds((current) => current.filter((item) => item !== id));
            load();
        } catch (error) {
            setMessage(error.response?.data?.message || error.message || "Failed to delete category");
        }
    };

    const filtered = useMemo(() => categories.filter((category) => (
        `${category.name || ""} ${category.hsn || ""} ${category.unit || ""}`.toLowerCase().includes(query.toLowerCase())
    )), [categories, query]);

    const visibleRows = filtered.slice(0, pageSize);
    const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((category) => selectedIds.includes(category._id));

    const startEdit = (category) => {
        setEditingId(category._id);
        setForm({
            name: category.name || "",
            hsn: category.hsn || "",
            unit: normalizeUnit(category.unit),
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
                        <h1>Category Master</h1>
                        <p className="mb-0 text-muted">Create and maintain product categories used across purchase, receive, stock, and POS.</p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-check-circle" /> {loading ? "Loading" : "Ready"}</span>
                        <button className="btn btn_style" type="button" onClick={() => { setForm(emptyForm); setEditingId(""); }}>
                            <i className="bx bx-plus" /><span>New</span>
                        </button>
                    </div>
                </div>
            </div>

            <section className="card app-card">
                <div className="card-header app-card-header">
                    <div>
                        <h2>Category Details</h2>
                        <p>Use consistent category HSN and unit data so purchase, labels, and billing stay clean.</p>
                    </div>
                </div>
                <div className="card-body">
                    <form className="row g-3" onSubmit={(event) => { event.preventDefault(); save(); }}>
                        <TextField id="category-name" label="Category Name" value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} />
                        <TextField id="category-hsn" label="HSN Code" value={form.hsn} onChange={(hsn) => setForm((current) => ({ ...current, hsn }))} />
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label" htmlFor="category-unit">Unit</label>
                            <select className="form-select" id="category-unit" value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}>
                                {UNIT_OPTIONS.map((unit) => <option key={unit} value={unit}>{unit === "PCS" ? "Pieces (PCS)" : "Meters (MTRS)"}</option>)}
                            </select>
                        </div>
                        <TextField id="category-search-inline" label="Search" value={query} onChange={setQuery} placeholder="Search categories or HSN" />
                        <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                            <button className="btn btn_style" type="submit"><i className="bx bx-save" /><span>{editingId ? "Update" : "Save"}</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={() => { setForm(emptyForm); setEditingId(""); }}><i className="bx bx-reset" /><span>Clear</span></button>
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
                            <button className="btn btn_style datatable-create" type="button" onClick={() => { setForm(emptyForm); setEditingId(""); }}><i className="bx bx-plus" /><span>Create Category</span></button>
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
                            <div className="datatable-search">
                                <input type="text" placeholder="Search Category Master List" aria-label="Search Category Master List" value={query} onChange={(event) => setQuery(event.target.value)} />
                            </div>
                        </div>
                    </div>
                    <div className="datatable-bulk-bar">
                        <div className="datatable-bulk-copy"><strong>{selectedIds.length} selected</strong><span>Choose rows to unlock bulk actions</span></div>
                        <div className="datatable-bulk-actions"><button className="btn btn_style inActive" type="button"><i className="bx bx-export" /><span>Export</span></button></div>
                    </div>
                    <div className="table-responsive app-table-wrap datatable-wrap">
                        <table className="table app-table align-middle">
                            <thead>
                                <tr>
                                    <th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" checked={allVisibleSelected} onChange={(event) => {
                                        setSelectedIds(event.target.checked ? visibleRows.map((category) => category._id) : []);
                                    }} aria-label="Select all rows" /></th>
                                    <th><span className="sortable-heading">Name<i className="bx bx-sort-up" /></span></th>
                                    <th><span className="sortable-heading">HSN<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">Unit<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">Status<i className="bx bx-sort" /></span></th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr className="table-state-row"><td colSpan="6"><div className="table-skeleton-list" aria-label="Loading rows"><span /><span /><span /></div></td></tr>
                                ) : visibleRows.length ? visibleRows.map((category) => (
                                    <tr key={category._id}>
                                        <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" checked={selectedIds.includes(category._id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, category._id] : current.filter((id) => id !== category._id))} aria-label="Select row" /></td>
                                        <td>{category.name}</td>
                                        <td>{category.hsn || "-"}</td>
                                        <td>{normalizeUnit(category.unit)}</td>
                                        <td><span className="status-badge status-success">Active</span></td>
                                        <td className="text-end">
                                            <div className="datatable-actions">
                                                <button type="button" className="btn action-btn" aria-label="Delete" onClick={() => remove(category._id)}><i className="bx bx-trash" /></button>
                                                <button type="button" className="btn action-btn" aria-label="View" onClick={() => startEdit(category)}><i className="bx bx-show" /></button>
                                                <div className="dropdown">
                                                    <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions"><i className="bx bx-dots-vertical-rounded" /></button>
                                                    <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                                        <button className="dropdown-item" type="button" onClick={() => startEdit(category)}>Edit</button>
                                                        <button className="dropdown-item" type="button" onClick={() => setForm({ name: category.name, hsn: category.hsn || "", unit: normalizeUnit(category.unit) })}>Duplicate</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr className="table-state-row table-state-row-empty"><td colSpan="6"><div className="empty-state compact"><span className="empty-state-icon"><i className="bx bx-search-alt" /></span><h6>No matching records</h6><p>Try changing filters or clearing the search field.</p></div></td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="pagination-row">
                        <span>Showing {visibleRows.length ? 1 : 0} to {visibleRows.length} of {filtered.length} entries</span>
                        <nav aria-label="Table pagination"><ul className="pagination pagination-sm mb-0"><li className="page-item disabled"><a className="page-link" href="#previous" aria-label="Previous"><i className="bx bx-chevron-left" /></a></li><li className="page-item active"><a className="page-link" href="#page-1">1</a></li><li className="page-item disabled"><a className="page-link" href="#next" aria-label="Next"><i className="bx bx-chevron-right" /></a></li></ul></nav>
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

export default CategoryList;
