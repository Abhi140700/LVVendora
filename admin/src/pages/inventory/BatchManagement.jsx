import React, { useEffect, useMemo, useState } from "react";
import api from "../../app/axios";
import { getApiErrorMessage } from "../../utils/api";
import { notifyError, notifySuccess } from "../../utils/notify";

const EMPTY_BATCH = { itemName: "", category: "", brand: "", batchNo: "", expiryDate: "", qty: "" };

export default function BatchManagement() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newBatch, setNewBatch] = useState(EMPTY_BATCH);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchBatches = async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/inventory/batches");
        setBatches(Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : []);
        setError("");
      } catch (err) {
        console.error(err);
        setError(getApiErrorMessage(err, "Batch endpoint is not ready in the backend yet"));
      } finally {
        setLoading(false);
      }
    };

    fetchBatches();
  }, []);

  const filteredBatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return batches.filter((batch) => [batch.itemName, batch.category, batch.brand, batch.batchNo].join(" ").toLowerCase().includes(q));
  }, [batches, search]);

  const handleAddBatch = async () => {
    try {
      setSaving(true);
      const { data } = await api.post("/inventory/batches", { ...newBatch, qty: Number(newBatch.qty || 0) });
      const savedBatch = data.data || data;
      setBatches((prev) => [...prev, savedBatch]);
      setNewBatch(EMPTY_BATCH);
      notifySuccess("Batch added successfully");
    } catch (err) {
      notifyError(getApiErrorMessage(err, "Failed to save batch"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="container-fluid p-0 flex-grow-1"><div className="card app-card"><div className="card-body">Loading batch management...</div></div></div>;

  return (
    <div className="container-fluid p-0 flex-grow-1">
      <div className="page-header card">
        <div className="card-body">
          <div>
            <nav aria-label="breadcrumb"><ol className="breadcrumb mb-2"><li className="breadcrumb-item"><a href="/">Home</a></li><li className="breadcrumb-item active" aria-current="page">Inventory</li></ol></nav>
            <p className="section-label">Inventory</p>
            <h1>Batch Management</h1>
            <p className="mb-0 text-muted">{error || "Track item batch, expiry, and quantity metadata in the inventory workspace."}</p>
          </div>
          <div className="page-header-actions">
            <span className="metric-pill"><i className="bx bx-archive"></i> {filteredBatches.length} Batches</span>
            <button className="btn btn_style" type="button" onClick={handleAddBatch} disabled={saving}><i className="bx bx-save"></i><span>{saving ? "Saving..." : "Save"}</span></button>
          </div>
        </div>
      </div>

      <section className="card app-card">
        <div className="card-header app-card-header">
          <div><h2>Batch Details</h2><p>Create or stage batch records with item, expiry, and quantity details.</p></div>
        </div>
        <div className="card-body">
          <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
            <BatchInput id="batch-item" label="Item Name" value={newBatch.itemName} onChange={(value) => setNewBatch((prev) => ({ ...prev, itemName: value }))} />
            <BatchInput id="batch-category" label="Category" value={newBatch.category} onChange={(value) => setNewBatch((prev) => ({ ...prev, category: value }))} />
            <BatchInput id="batch-brand" label="Brand" value={newBatch.brand} onChange={(value) => setNewBatch((prev) => ({ ...prev, brand: value }))} />
            <BatchInput id="batch-number" label="Batch No" value={newBatch.batchNo} onChange={(value) => setNewBatch((prev) => ({ ...prev, batchNo: value }))} />
            <BatchInput id="batch-expiry" label="Expiry Date" type="date" value={newBatch.expiryDate} onChange={(value) => setNewBatch((prev) => ({ ...prev, expiryDate: value }))} />
            <BatchInput id="batch-qty" label="Qty" type="number" value={newBatch.qty} onChange={(value) => setNewBatch((prev) => ({ ...prev, qty: value }))} />
            <div className="col-12 d-flex flex-wrap gap-2 pt-2">
              <button className="btn btn_style" type="button" onClick={handleAddBatch} disabled={saving}><i className="bx bx-save"></i><span>{saving ? "Saving..." : "Save"}</span></button>
              <button className="btn btn_style inActive" type="button" onClick={() => setNewBatch(EMPTY_BATCH)}><i className="bx bx-reset"></i><span>Clear</span></button>
            </div>
          </form>
        </div>
      </section>

      <section className="card app-card app-datatable-card">
        <div className="card-body p-0">
          <div className="datatable-toolbar">
            <div className="datatable-toolbar-start">
              <label className="datatable-length"><span>Show</span><select className="form-select form-select-sm datatable-page-size" aria-label="Rows per page" defaultValue="10"><option>10</option><option>25</option><option>50</option></select></label>
              <button className="btn btn_style datatable-create" type="button" onClick={handleAddBatch} disabled={saving}><i className="bx bx-plus"></i><span>Create Batch</span></button>
            </div>
            <div className="datatable-toolbar-end">
              <button className="btn btn_style inActive datatable-tool-btn" type="button" onClick={() => setSearch("")}><i className="bx bx-filter-alt"></i><span>Clear</span></button>
              <button className="btn btn_style inActive datatable-tool-btn" type="button" onClick={() => window.print()}><i className="bx bx-printer"></i><span>Print</span></button>
              <div className="datatable-search"><input type="text" placeholder="Search Batch Management" aria-label="Search Batch Management" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            </div>
          </div>

          <div className="datatable-bulk-bar">
            <div className="datatable-bulk-copy"><strong>{filteredBatches.length} shown</strong><span>Review batch, expiry, and quantity status.</span></div>
            <div className="datatable-bulk-actions"><button className="btn btn_style inActive" type="button" onClick={() => window.print()}><i className="bx bx-export"></i><span>Export</span></button></div>
          </div>

          <div className="table-responsive app-table-wrap datatable-wrap">
            <table className="table app-table align-middle">
              <thead><tr><th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" aria-label="Select all rows" /></th><th><span className="sortable-heading">Item<i className="bx bx-sort-up"></i></span></th><th><span className="sortable-heading">Category<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Brand<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Batch<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Expiry<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Qty<i className="bx bx-sort"></i></span></th><th className="text-end">Actions</th></tr></thead>
              <tbody>
                {filteredBatches.length > 0 ? filteredBatches.map((batch) => (
                  <tr key={batch._id || batch.batchNo}>
                    <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" /></td>
                    <td>{batch.itemName || "-"}</td><td>{batch.category || "-"}</td><td>{batch.brand || "-"}</td><td>{batch.batchNo || "-"}</td><td>{batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString("en-IN") : "-"}</td><td>{batch.qty || 0}</td>
                    <td className="text-end"><button type="button" className="btn action-btn" aria-label="View batch"><i className="bx bx-show"></i></button></td>
                  </tr>
                )) : <EmptyRow colSpan="8" />}
              </tbody>
            </table>
          </div>
          <Pagination count={filteredBatches.length} />
        </div>
      </section>
    </div>
  );
}

const BatchInput = ({ id, label, value, onChange, type = "text" }) => (
  <div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor={id}>{label}</label><input className="form-control" id={id} type={type} value={value} placeholder={`Enter ${label}`} onChange={(event) => onChange(event.target.value)} /></div>
);
const EmptyRow = ({ colSpan }) => <tr className="table-state-row"><td colSpan={colSpan}><div className="empty-state compact"><span className="empty-state-icon"><i className="bx bx-search-alt"></i></span><h6>No matching records</h6><p>Try changing filters or clearing the search field.</p></div></td></tr>;
const Pagination = ({ count }) => <div className="pagination-row"><span>Showing {count ? 1 : 0} to {count} of {count} entries</span><nav aria-label="Table pagination"><ul className="pagination pagination-sm mb-0"><li className="page-item disabled"><span className="page-link"><i className="bx bx-chevron-left"></i></span></li><li className="page-item active"><span className="page-link">1</span></li><li className="page-item disabled"><span className="page-link"><i className="bx bx-chevron-right"></i></span></li></ul></nav></div>;
