import React, { useEffect, useMemo, useState } from "react";
import api from "../../app/axios";
import { getApiErrorMessage } from "../../utils/api";
import { notifyError, notifySuccess } from "../../utils/notify";

const itemCategory = (item) => item.category?.name || item.category || "-";
const itemBrand = (item) => item.brand?.name || item.brand || "-";

export default function StockTransfer() {
  const [inventory, setInventory] = useState([]);
  const [sourceLocation, setSourceLocation] = useState("Warehouse A");
  const [destinationLocation, setDestinationLocation] = useState("Warehouse B");
  const [selectedItem, setSelectedItem] = useState("");
  const [transferQty, setTransferQty] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const currentItem = useMemo(() => inventory.find((item) => item._id === selectedItem) || null, [inventory, selectedItem]);
  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventory.filter((item) => [item.name, itemCategory(item), itemBrand(item)].join(" ").toLowerCase().includes(q));
  }, [inventory, search]);

  const handleTransfer = async () => {
    if (!selectedItem || Number(transferQty) <= 0) return notifyError("Select an item and enter a valid transfer quantity");

    try {
      setSubmitting(true);
      await api.post("/inventory/transfer", { itemId: selectedItem, sourceLocation, destinationLocation, qty: Number(transferQty) });
      notifySuccess(`Transferred ${transferQty} units to ${destinationLocation}`);
      setTransferQty("");
    } catch (err) {
      console.error(err);
      notifyError(getApiErrorMessage(err, "Failed to transfer stock"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="container-fluid p-0 flex-grow-1"><div className="card app-card"><div className="card-body">Loading stock transfer...</div></div></div>;
  if (error) return <div className="container-fluid p-0 flex-grow-1"><div className="alert alert-danger mb-0">Error: {error}</div></div>;

  return (
    <div className="container-fluid p-0 flex-grow-1">
      <div className="page-header card">
        <div className="card-body">
          <div>
            <nav aria-label="breadcrumb"><ol className="breadcrumb mb-2"><li className="breadcrumb-item"><a href="/">Home</a></li><li className="breadcrumb-item active" aria-current="page">Inventory</li></ol></nav>
            <p className="section-label">Inventory</p>
            <h1>Stock Transfer</h1>
            <p className="mb-0 text-muted">Move inventory between source and destination locations with quantity validation.</p>
          </div>
          <div className="page-header-actions">
            <span className="metric-pill"><i className="bx bx-transfer"></i> Ready</span>
            <button className="btn btn_style" type="button" onClick={handleTransfer} disabled={submitting}><i className="bx bx-save"></i><span>{submitting ? "Saving..." : "Transfer"}</span></button>
          </div>
        </div>
      </div>

      <section className="card app-card">
        <div className="card-header app-card-header">
          <div><h2>Transfer Details</h2><p>Select item, location movement, and transfer quantity.</p></div>
        </div>
        <div className="card-body">
          <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
            <div className="col-12 col-sm-6 col-xl-3">
              <label className="form-label" htmlFor="transfer-item">Item</label>
              <select className="form-select" id="transfer-item" value={selectedItem} onChange={(event) => setSelectedItem(event.target.value)}>
                <option value="">Select item</option>
                {inventory.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.stock || 0} {item.unit || "PC"})</option>)}
              </select>
            </div>
            <FormInput id="transfer-source" label="Source" value={sourceLocation} onChange={setSourceLocation} />
            <FormInput id="transfer-destination" label="Destination" value={destinationLocation} onChange={setDestinationLocation} />
            <FormInput id="transfer-available" label="Available" value={currentItem ? `${currentItem.stock || 0} ${currentItem.unit || "PC"}` : ""} readOnly />
            <FormInput id="transfer-qty" label="Transfer Quantity" type="number" value={transferQty} onChange={setTransferQty} />
            <FormInput id="transfer-status" label="Status" value={currentItem ? "Ready" : "Select Item"} readOnly />
            <div className="col-12 d-flex flex-wrap gap-2 pt-2">
              <button className="btn btn_style" type="button" onClick={handleTransfer} disabled={submitting}><i className="bx bx-save"></i><span>{submitting ? "Saving..." : "Save"}</span></button>
              <button className="btn btn_style inActive" type="button" onClick={() => setTransferQty("")}><i className="bx bx-reset"></i><span>Clear</span></button>
            </div>
          </form>
        </div>
      </section>

      <section className="card app-card app-datatable-card">
        <div className="card-body p-0">
          <div className="datatable-toolbar">
            <div className="datatable-toolbar-start">
              <label className="datatable-length"><span>Show</span><select className="form-select form-select-sm datatable-page-size" aria-label="Rows per page" defaultValue="10"><option>10</option><option>25</option><option>50</option></select></label>
              <button className="btn btn_style datatable-create" type="button" onClick={handleTransfer} disabled={submitting}><i className="bx bx-plus"></i><span>Create Stock Transfer</span></button>
            </div>
            <div className="datatable-toolbar-end">
              <button className="btn btn_style inActive datatable-tool-btn" type="button" onClick={() => setSearch("")}><i className="bx bx-filter-alt"></i><span>Clear</span></button>
              <button className="btn btn_style inActive datatable-tool-btn" type="button" onClick={() => window.print()}><i className="bx bx-printer"></i><span>Print</span></button>
              <div className="datatable-search"><input type="text" placeholder="Search Stock Transfer" aria-label="Search Stock Transfer" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            </div>
          </div>

          <div className="datatable-bulk-bar">
            <div className="datatable-bulk-copy"><strong>{currentItem ? currentItem.name : "No item selected"}</strong><span>{currentItem ? `${currentItem.stock || 0} ${currentItem.unit || "PC"} available` : "Choose rows to unlock transfer actions"}</span></div>
            <div className="datatable-bulk-actions"><button className="btn btn_style inActive" type="button" onClick={() => window.print()}><i className="bx bx-export"></i><span>Export</span></button></div>
          </div>

          <div className="table-responsive app-table-wrap datatable-wrap">
            <table className="table app-table align-middle">
              <thead><tr><th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" aria-label="Select all rows" /></th><th><span className="sortable-heading">Item<i className="bx bx-sort-up"></i></span></th><th><span className="sortable-heading">Source<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Destination<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Available<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Transfer Qty<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Status<i className="bx bx-sort"></i></span></th><th className="text-end">Actions</th></tr></thead>
              <tbody>
                {tableRows.length > 0 ? tableRows.map((item) => (
                  <tr key={item._id}>
                    <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" /></td>
                    <td>{item.name}</td><td>{sourceLocation}</td><td>{destinationLocation}</td><td>{item.stock || 0}</td><td>{item._id === selectedItem ? transferQty || "-" : "-"}</td>
                    <td><span className={`status-badge ${item._id === selectedItem ? "status-primary" : "status-success"}`}>{item._id === selectedItem ? "Selected" : "Available"}</span></td>
                    <td className="text-end"><button type="button" className="btn action-btn" aria-label="Select transfer item" onClick={() => setSelectedItem(item._id)}><i className="bx bx-transfer"></i></button></td>
                  </tr>
                )) : <EmptyRow colSpan="8" />}
              </tbody>
            </table>
          </div>
          <Pagination count={tableRows.length} />
        </div>
      </section>
    </div>
  );
}

const FormInput = ({ id, label, value, onChange, type = "text", readOnly = false }) => (
  <div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor={id}>{label}</label><input className="form-control" id={id} type={type} value={value} readOnly={readOnly} onChange={(event) => onChange?.(event.target.value)} /></div>
);
const EmptyRow = ({ colSpan }) => <tr className="table-state-row"><td colSpan={colSpan}><div className="empty-state compact"><span className="empty-state-icon"><i className="bx bx-search-alt"></i></span><h6>No matching records</h6><p>Try changing filters or clearing the search field.</p></div></td></tr>;
const Pagination = ({ count }) => <div className="pagination-row"><span>Showing {count ? 1 : 0} to {count} of {count} entries</span><nav aria-label="Table pagination"><ul className="pagination pagination-sm mb-0"><li className="page-item disabled"><span className="page-link"><i className="bx bx-chevron-left"></i></span></li><li className="page-item active"><span className="page-link">1</span></li><li className="page-item disabled"><span className="page-link"><i className="bx bx-chevron-right"></i></span></li></ul></nav></div>;
