import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../../app/axios";
import { UNIT_OPTIONS, normalizeUnit } from "../../../utils/unit";

const emptyForm = {
    recordId: "",
    name: "",
    category: "",
    brand: "",
    unit: "PCS",
    hsn: "",
    size: "",
    color: "",
    material: "",
    style: "",
    subStyle: "",
    designNo: "",
    defaultPurchaseRate: "",
    mrp: "",
    saleRate: "",
};

const ItemList = () => {
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [query, setQuery] = useState("");
    const [pageSize, setPageSize] = useState(10);
    const [selectedIds, setSelectedIds] = useState([]);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const [itemsRes, categoryRes, brandRes] = await Promise.all([
                api.get("/items"),
                api.get("/categories"),
                api.get("/brands"),
            ]);
            if (!itemsRes.data.success) throw new Error(itemsRes.data.message || "Failed to load items");
            if (!categoryRes.data.success) throw new Error(categoryRes.data.message || "Failed to load categories");
            if (!brandRes.data.success) throw new Error(brandRes.data.message || "Failed to load brands");
            setItems(itemsRes.data.data || []);
            setCategories(categoryRes.data.categories || []);
            setBrands(brandRes.data.brands || []);
        } catch (error) {
            setMessage(error.response?.data?.message || error.message || "Failed to load items");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const save = async () => {
        try {
            const payload = {
                ...form,
                defaultPurchaseRate: Number(form.defaultPurchaseRate || 0),
                mrp: Number(form.mrp || 0),
                saleRate: Number(form.saleRate || 0),
            };
            const { data } = form.recordId
                ? await api.put(`/items/${form.recordId}`, payload)
                : await api.post("/items", payload);
            if (!data.success) {
                setMessage(data.message || "Failed to save item");
                return;
            }
            setForm(emptyForm);
            setMessage(form.recordId ? "Item updated." : "Item created.");
            load();
        } catch (error) {
            setMessage(error.response?.data?.message || error.message || "Failed to save item");
        }
    };

    const remove = async (id) => {
        try {
            const { data } = await api.delete(`/items/${id}`);
            if (!data.success) {
                setMessage(data.message || "Failed to delete item");
                return;
            }
            setSelectedIds((current) => current.filter((item) => item !== id));
            setMessage("Item deleted.");
            load();
        } catch (error) {
            setMessage(error.response?.data?.message || error.message || "Failed to delete item");
        }
    };

    const filtered = useMemo(() => items.filter((item) => {
        const haystack = `${item.name || ""} ${item.hsn || ""} ${item.category?.name || ""} ${item.brand?.name || ""} ${item.designNo || ""}`.toLowerCase();
        return haystack.includes(query.toLowerCase());
    }), [items, query]);

    const visibleRows = filtered.slice(0, pageSize);
    const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((item) => selectedIds.includes(item._id));

    const startEdit = (item) => {
        setForm({
            recordId: item._id,
            name: item.name || "",
            category: item.category?._id || item.category || "",
            brand: item.brand?._id || item.brand || "",
            unit: normalizeUnit(item.unit || item.category?.unit || "PCS"),
            hsn: item.hsn || "",
            size: item.size || "",
            color: item.color || "",
            material: item.material || "",
            style: item.style || "",
            subStyle: item.subStyle || "",
            designNo: item.designNo || "",
            defaultPurchaseRate: item.defaultPurchaseRate || "",
            mrp: item.mrp || "",
            saleRate: item.saleRate || "",
        });
        setMessage("Edit mode enabled.");
    };

    const updateCategory = (categoryId) => {
        const selectedCategory = categories.find((category) => String(category._id) === String(categoryId));
        setForm((current) => ({
            ...current,
            category: categoryId,
            hsn: selectedCategory?.hsn || current.hsn,
            unit: normalizeUnit(selectedCategory?.unit || current.unit),
        }));
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
                        <h1>Items Master</h1>
                        <p className="mb-0 text-muted">Create apparel items with category, brand, HSN, style metadata, and default pricing.</p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-check-circle" /> {loading ? "Loading" : "Ready"}</span>
                        <button className="btn btn_style" type="button" onClick={() => setForm(emptyForm)}><i className="bx bx-plus" /><span>New</span></button>
                    </div>
                </div>
            </div>

            <section className="card app-card">
                <div className="card-header app-card-header">
                    <div>
                        <h2>Item Details</h2>
                        <p>Keep product metadata complete so purchase, labels, stock, and POS use the same item record.</p>
                    </div>
                </div>
                <div className="card-body">
                    <form className="row g-3" onSubmit={(event) => { event.preventDefault(); save(); }}>
                        <TextField id="item-name" label="Name" value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} />
                        <SelectField id="item-category" label="Category" value={form.category} onChange={updateCategory} options={categories.map((category) => ({ value: category._id, label: category.name }))} />
                        <SelectField id="item-brand" label="Brand" value={form.brand} onChange={(brand) => setForm((current) => ({ ...current, brand }))} options={[{ value: "", label: "No brand" }, ...brands.map((brand) => ({ value: brand._id, label: brand.name }))]} />
                        <SelectField id="item-unit" label="Unit" value={form.unit} onChange={(unit) => setForm((current) => ({ ...current, unit }))} options={UNIT_OPTIONS.map((unit) => ({ value: unit, label: unit }))} />
                        <TextField id="item-hsn" label="HSN" value={form.hsn} onChange={(hsn) => setForm((current) => ({ ...current, hsn }))} />
                        <TextField id="item-size" label="Size" value={form.size} onChange={(size) => setForm((current) => ({ ...current, size }))} />
                        <TextField id="item-color" label="Color" value={form.color} onChange={(color) => setForm((current) => ({ ...current, color }))} />
                        <TextField id="item-material" label="Material" value={form.material} onChange={(material) => setForm((current) => ({ ...current, material }))} />
                        <TextField id="item-style" label="Style" value={form.style} onChange={(style) => setForm((current) => ({ ...current, style }))} />
                        <TextField id="item-substyle" label="Sub Style" value={form.subStyle} onChange={(subStyle) => setForm((current) => ({ ...current, subStyle }))} />
                        <TextField id="item-design" label="Design No" value={form.designNo} onChange={(designNo) => setForm((current) => ({ ...current, designNo }))} />
                        <TextField id="item-purchase-rate" label="Purchase Rate" value={form.defaultPurchaseRate} onChange={(defaultPurchaseRate) => setForm((current) => ({ ...current, defaultPurchaseRate }))} />
                        <TextField id="item-mrp" label="MRP" value={form.mrp} onChange={(mrp) => setForm((current) => ({ ...current, mrp }))} />
                        <TextField id="item-sale-rate" label="Sale Rate" value={form.saleRate} onChange={(saleRate) => setForm((current) => ({ ...current, saleRate }))} />
                        <TextField id="item-search-inline" label="Search" value={query} onChange={setQuery} placeholder="Search item, HSN, category, brand" />
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
                            <label className="datatable-length"><span>Show</span><select className="form-select form-select-sm datatable-page-size" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} aria-label="Rows per page"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
                            <button className="btn btn_style datatable-create" type="button" onClick={() => setForm(emptyForm)}><i className="bx bx-plus" /><span>Create Item</span></button>
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
                            <div className="datatable-search"><input type="text" placeholder="Search Items Master List" aria-label="Search Items Master List" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
                        </div>
                    </div>
                    <div className="datatable-bulk-bar"><div className="datatable-bulk-copy"><strong>{selectedIds.length} selected</strong><span>Choose rows to unlock bulk actions</span></div><div className="datatable-bulk-actions"><button className="btn btn_style inActive" type="button"><i className="bx bx-export" /><span>Export</span></button></div></div>
                    <div className="table-responsive app-table-wrap datatable-wrap">
                        <table className="table app-table align-middle">
                            <thead>
                                <tr>
                                    <th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" checked={allVisibleSelected} onChange={(event) => setSelectedIds(event.target.checked ? visibleRows.map((item) => item._id) : [])} aria-label="Select all rows" /></th>
                                    <th><span className="sortable-heading">Name<i className="bx bx-sort-up" /></span></th>
                                    <th><span className="sortable-heading">Category<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">Brand<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">Unit<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">HSN<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">MRP<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">Sale Rate<i className="bx bx-sort" /></span></th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr className="table-state-row"><td colSpan="9"><div className="table-skeleton-list" aria-label="Loading rows"><span /><span /><span /></div></td></tr>
                                ) : visibleRows.length ? visibleRows.map((item) => (
                                    <tr key={item._id}>
                                        <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" checked={selectedIds.includes(item._id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, item._id] : current.filter((id) => id !== item._id))} aria-label="Select row" /></td>
                                        <td>{item.name}</td>
                                        <td>{item.category?.name || "-"}</td>
                                        <td>{item.brand?.name || "-"}</td>
                                        <td>{normalizeUnit(item.unit || item.category?.unit || "-")}</td>
                                        <td>{item.hsn || "-"}</td>
                                        <td>{Number(item.mrp || 0).toLocaleString("en-IN")}</td>
                                        <td>{Number(item.saleRate || 0).toLocaleString("en-IN")}</td>
                                        <td className="text-end">
                                            <div className="datatable-actions">
                                                <button type="button" className="btn action-btn" aria-label="Delete" onClick={() => remove(item._id)}><i className="bx bx-trash" /></button>
                                                <button type="button" className="btn action-btn" aria-label="View" onClick={() => startEdit(item)}><i className="bx bx-show" /></button>
                                                <div className="dropdown">
                                                    <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions"><i className="bx bx-dots-vertical-rounded" /></button>
                                                    <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                                        <button className="dropdown-item" type="button" onClick={() => startEdit(item)}>Edit</button>
                                                        <button className="dropdown-item" type="button" onClick={() => setForm({ ...emptyForm, ...item, recordId: "" })}>Duplicate</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr className="table-state-row table-state-row-empty"><td colSpan="9"><div className="empty-state compact"><span className="empty-state-icon"><i className="bx bx-search-alt" /></span><h6>No matching records</h6><p>Try changing filters or clearing the search field.</p></div></td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="pagination-row"><span>Showing {visibleRows.length ? 1 : 0} to {visibleRows.length} of {filtered.length} entries</span><nav aria-label="Table pagination"><ul className="pagination pagination-sm mb-0"><li className="page-item disabled"><a className="page-link" href="#previous" aria-label="Previous"><i className="bx bx-chevron-left" /></a></li><li className="page-item active"><a className="page-link" href="#page-1">1</a></li><li className="page-item disabled"><a className="page-link" href="#next" aria-label="Next"><i className="bx bx-chevron-right" /></a></li></ul></nav></div>
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

const SelectField = ({ id, label, value, onChange, options }) => (
    <div className="col-12 col-sm-6 col-xl-3">
        <label className="form-label" htmlFor={id}>{label}</label>
        <select className="form-select" id={id} value={value} onChange={(event) => onChange(event.target.value)}>
            <option value="">Select {label}</option>
            {options.map((option) => <option key={`${id}-${option.value}`} value={option.value}>{option.label}</option>)}
        </select>
    </div>
);

export default ItemList;
