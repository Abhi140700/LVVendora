import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../app/axios";
import { getApiErrorMessage } from "../../utils/api";
import { notifyError, notifySuccess } from "../../utils/notify";

const itemCategory = (item) => item.category?.name || item.category || "-";
const itemBrand = (item) => item.brand?.name || item.brand || "-";

export default function StockAdjustment() {
  const [searchParams] = useSearchParams();
  const selectedId = searchParams.get("id") || "";
  const [inventory, setInventory] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(selectedId);
  const [adjustQty, setAdjustQty] = useState("");
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchInventory = async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/inventory");
        setInventory(data.data || []);
        setError("");
      } catch (err) {
        console.error(err);
        setError(getApiErrorMessage(err, "Failed to fetch inventory"));
      } finally {
        setLoading(false);
      }
    };

    fetchInventory();
  }, []);

  const item = useMemo(() => inventory.find((entry) => entry._id === selectedItemId) || null, [inventory, selectedItemId]);
  const afterQty = item ? Number(item.stock || 0) + Number(adjustQty || 0) : 0;

  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventory.filter((entry) => [entry.name, itemCategory(entry), itemBrand(entry)].join(" ").toLowerCase().includes(q));
  }, [inventory, search]);

  const handleAdjustStock = async () => {
    if (!item) return notifyError("Select an item first");
    if (!adjustQty || Number(adjustQty) === 0) return notifyError("Enter a valid positive or negative quantity");

    try {
      setSaving(true);
      const { data } = await api.post("/inventory/adjust", {
          itemId: item._id,
          name: item.name,
          category: item.category?._id || item.category,
          brand: item.brand?._id || item.brand,
          unit: item.unit,
          qty: Number(adjustQty),
          purchaseRate: item.purchaseRate,
          reason,
      });

      const updatedItem = data.data;
      setInventory((prev) => prev.map((entry) => (entry._id === updatedItem._id ? updatedItem : entry)));
      setAdjustQty("");
      setReason("");
      notifySuccess(`Stock adjusted. New quantity: ${updatedItem.stock}`);
    } catch (err) {
      console.error(err);
      notifyError(getApiErrorMessage(err, "Failed to adjust stock"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="container-fluid p-0 flex-grow-1"><div className="card app-card"><div className="card-body">Loading stock adjustment...</div></div></div>;
  if (error) return <div className="container-fluid p-0 flex-grow-1"><div className="alert alert-danger mb-0">Error: {error}</div></div>;

  return (
    <div className="container-fluid p-0 flex-grow-1">
      <div className="page-header card">
        <div className="card-body">
          <div>
            <nav aria-label="breadcrumb"><ol className="breadcrumb mb-2"><li className="breadcrumb-item"><a href="/">Home</a></li><li className="breadcrumb-item active" aria-current="page">Inventory</li></ol></nav>
            <p className="section-label">Inventory</p>
            <h1>Stock Adjustment</h1>
            <p className="mb-0 text-muted">Adjust received, damaged, counted, or corrected quantities against live inventory.</p>
          </div>
          <div className="page-header-actions">
            <span className="metric-pill"><i className="bx bx-edit"></i> Ready</span>
            <button className="btn btn_style" type="button" onClick={handleAdjustStock} disabled={saving}>
              <i className="bx bx-save"></i><span>{saving ? "Saving..." : "Save"}</span>
            </button>
          </div>
        </div>
      </div>

      <section className="card app-card">
        <div className="card-header app-card-header">
          <div><h2>Adjustment Details</h2><p>Use a positive quantity to add stock and a negative quantity to reduce stock.</p></div>
        </div>
        <div className="card-body">
          <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
            <div className="col-12 col-sm-6 col-xl-3">
              <label className="form-label" htmlFor="adjust-item">Select Item</label>
              <select className="form-select" id="adjust-item" value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)}>
                <option value="">Choose inventory item</option>
                {inventory.map((entry) => <option key={entry._id} value={entry._id}>{entry.name} ({entry.stock || 0} {entry.unit || "PC"})</option>)}
              </select>
            </div>
            <FormInput id="adjust-qty" label="Adjustment Quantity" type="number" value={adjustQty} onChange={setAdjustQty} placeholder="Example: 12 or -3" />
            <FormInput id="current-qty" label="Current Qty" value={item?.stock ?? ""} readOnly />
            <FormInput id="adjust-unit" label="Unit" value={item?.unit || ""} readOnly />
            <FormInput id="purchase-rate" label="Purchase Rate" value={item?.purchaseRate || ""} readOnly />
            <FormInput id="adjust-reason" label="Reason" value={reason} onChange={setReason} placeholder="Enter Reason" />
            <div className="col-12 d-flex flex-wrap gap-2 pt-2">
              <button className="btn btn_style" type="button" onClick={handleAdjustStock} disabled={saving}><i className="bx bx-save"></i><span>{saving ? "Saving..." : "Save"}</span></button>
              <button className="btn btn_style inActive" type="button" onClick={() => { setAdjustQty(""); setReason(""); }}><i className="bx bx-reset"></i><span>Clear</span></button>
            </div>
          </form>
        </div>
      </section>

      <section className="card app-card app-datatable-card">
        <div className="card-body p-0">
          <div className="datatable-toolbar">
            <div className="datatable-toolbar-start">
              <label className="datatable-length"><span>Show</span><select className="form-select form-select-sm datatable-page-size" aria-label="Rows per page" defaultValue="10"><option>10</option><option>25</option><option>50</option></select></label>
              <button className="btn btn_style datatable-create" type="button" onClick={handleAdjustStock} disabled={saving}><i className="bx bx-plus"></i><span>Create Stock Adjustment</span></button>
            </div>
            <div className="datatable-toolbar-end">
              <button className="btn btn_style inActive datatable-tool-btn" type="button"><i className="bx bx-filter-alt"></i><span>Filters</span></button>
              <button className="btn btn_style inActive datatable-tool-btn" type="button" onClick={() => window.print()}><i className="bx bx-printer"></i><span>Print</span></button>
              <div className="datatable-search"><input type="text" placeholder="Search Stock Adjustment" aria-label="Search Stock Adjustment" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            </div>
          </div>

          <div className="datatable-bulk-bar">
            <div className="datatable-bulk-copy"><strong>{item ? item.name : "No item selected"}</strong><span>{item ? `Before ${item.stock || 0}, after ${afterQty}` : "Choose an item to preview the adjustment."}</span></div>
            <div className="datatable-bulk-actions"><button className="btn btn_style inActive" type="button" onClick={() => window.print()}><i className="bx bx-export"></i><span>Export</span></button></div>
          </div>

          <div className="table-responsive app-table-wrap datatable-wrap">
            <table className="table app-table align-middle">
              <thead><tr><th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" aria-label="Select all rows" /></th><th><span className="sortable-heading">Item<i className="bx bx-sort-up"></i></span></th><th><span className="sortable-heading">Category<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Brand<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Before Qty<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Adjust Qty<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">After Qty<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Status<i className="bx bx-sort"></i></span></th><th className="text-end">Actions</th></tr></thead>
              <tbody>
                {tableRows.length > 0 ? tableRows.map((entry) => {
                  const isSelected = entry._id === selectedItemId;
                  const before = Number(entry.stock || 0);
                  const adjust = isSelected ? Number(adjustQty || 0) : 0;
                  return (
                    <tr key={entry._id}>
                      <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" /></td>
                      <td>{entry.name}</td><td>{itemCategory(entry)}</td><td>{itemBrand(entry)}</td><td>{before}</td><td>{isSelected ? adjust : "-"}</td><td>{isSelected ? before + adjust : before}</td>
                      <td><span className={`status-badge ${isSelected ? "status-primary" : "status-success"}`}>{isSelected ? "Selected" : "Available"}</span></td>
                      <td className="text-end"><button type="button" className="btn action-btn" aria-label="Select item" onClick={() => setSelectedItemId(entry._id)}><i className="bx bx-edit"></i></button></td>
                    </tr>
                  );
                }) : <EmptyRow colSpan="9" />}
              </tbody>
            </table>
          </div>
          <Pagination count={tableRows.length} />
        </div>
      </section>
    </div>
  );
}

const FormInput = ({ id, label, value, onChange, type = "text", placeholder = "", readOnly = false }) => (
  <div className="col-12 col-sm-6 col-xl-3">
    <label className="form-label" htmlFor={id}>{label}</label>
    <input className="form-control" id={id} type={type} value={value} placeholder={placeholder} readOnly={readOnly} onChange={(event) => onChange?.(event.target.value)} />
  </div>
);

const EmptyRow = ({ colSpan }) => (
  <tr className="table-state-row"><td colSpan={colSpan}><div className="empty-state compact"><span className="empty-state-icon"><i className="bx bx-search-alt"></i></span><h6>No matching records</h6><p>Try changing filters or clearing the search field.</p></div></td></tr>
);

const Pagination = ({ count }) => (
  <div className="pagination-row"><span>Showing {count ? 1 : 0} to {count} of {count} entries</span><nav aria-label="Table pagination"><ul className="pagination pagination-sm mb-0"><li className="page-item disabled"><span className="page-link"><i className="bx bx-chevron-left"></i></span></li><li className="page-item active"><span className="page-link">1</span></li><li className="page-item disabled"><span className="page-link"><i className="bx bx-chevron-right"></i></span></li></ul></nav></div>
);
