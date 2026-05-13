import React, { useEffect, useMemo, useState } from "react";
import api from "../../app/axios";
import { getApiErrorMessage } from "../../utils/api";

const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
const itemCategory = (item) => item.category?.name || item.category || "-";
const itemBrand = (item) => item.brand?.name || item.brand || "-";

export default function StockDashboard() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

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

  useEffect(() => {
    fetchInventory();
  }, []);

  const summary = useMemo(() => {
    const totalUnits = inventory.reduce((sum, item) => sum + Number(item.stock || 0), 0);
    const lowStockItems = inventory.filter((item) => Number(item.stock || 0) <= 5);
    const stockValue = inventory.reduce((sum, item) => sum + Number(item.stock || 0) * Number(item.avgPurchaseRate || item.purchaseRate || 0), 0);
    return { totalItems: inventory.length, totalUnits, lowStockItems, stockValue };
  }, [inventory]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventory.filter((item) => [item.name, itemCategory(item), itemBrand(item), item.unit].join(" ").toLowerCase().includes(q));
  }, [inventory, search]);

  if (loading) return <div className="container-fluid p-0 flex-grow-1"><div className="card app-card"><div className="card-body">Loading stock dashboard...</div></div></div>;
  if (error) return <div className="container-fluid p-0 flex-grow-1"><div className="alert alert-danger mb-0">Error: {error}</div></div>;

  return (
    <div className="container-fluid p-0 flex-grow-1">
      <div className="page-header card">
        <div className="card-body">
          <div>
            <nav aria-label="breadcrumb"><ol className="breadcrumb mb-2"><li className="breadcrumb-item"><a href="/">Home</a></li><li className="breadcrumb-item active" aria-current="page">Inventory</li></ol></nav>
            <p className="section-label">Inventory</p>
            <h1>Stock Dashboard</h1>
            <p className="mb-0 text-muted">Monitor inventory value, low stock exposure, unit coverage, and warehouse utilization.</p>
          </div>
          <div className="page-header-actions">
            <span className="metric-pill"><i className="bx bx-check-circle"></i> Ready</span>
            <button className="btn btn_style" type="button" onClick={fetchInventory}><i className="bx bx-refresh"></i><span>Refresh</span></button>
          </div>
        </div>
      </div>

      <section className="row g-3 mb-4">
        <MetricCard icon="bx bx-rupee" label="Stock Value" value={money(summary.stockValue)} />
        <MetricCard icon="bx bx-error-circle" label="Low Stock" value={summary.lowStockItems.length} />
        <MetricCard icon="bx bx-box" label="Available SKUs" value={summary.totalItems} />
        <MetricCard icon="bx bx-transfer" label="Units" value={summary.totalUnits} />
      </section>

      <section className="card app-card app-datatable-card">
        <div className="card-body p-0">
          <div className="datatable-toolbar">
            <div className="datatable-toolbar-start">
              <label className="datatable-length"><span>Show</span><select className="form-select form-select-sm datatable-page-size" aria-label="Rows per page" defaultValue="10"><option>10</option><option>25</option><option>50</option></select></label>
              <button className="btn btn_style datatable-create" type="button" onClick={() => window.print()}><i className="bx bx-printer"></i><span>Print Dashboard</span></button>
            </div>
            <div className="datatable-toolbar-end">
              <button className="btn btn_style inActive datatable-tool-btn" type="button" onClick={() => setSearch("")}><i className="bx bx-filter-alt"></i><span>Clear</span></button>
              <div className="datatable-search"><input type="text" placeholder="Search Warehouse Utilization" aria-label="Search Warehouse Utilization" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
              <select className="form-select datatable-status-filter" aria-label="Filter status" defaultValue="All Stock"><option>All Stock</option><option>Low Stock</option><option>Healthy</option></select>
            </div>
          </div>

          <div className="datatable-bulk-bar">
            <div className="datatable-bulk-copy"><strong>{summary.lowStockItems.length} low stock</strong><span>Items at or below 5 units need attention.</span></div>
            <div className="datatable-bulk-actions"><button className="btn btn_style inActive" type="button" onClick={() => window.print()}><i className="bx bx-export"></i><span>Export</span></button></div>
          </div>

          <div className="table-responsive app-table-wrap datatable-wrap">
            <table className="table app-table align-middle">
              <thead><tr><th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" aria-label="Select all rows" /></th><th><span className="sortable-heading">Warehouse<i className="bx bx-sort-up"></i></span></th><th><span className="sortable-heading">Capacity<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Available SKUs<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Reserved<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Value<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Status<i className="bx bx-sort"></i></span></th><th className="text-end">Actions</th></tr></thead>
              <tbody>
                {rows.length > 0 ? rows.map((item) => {
                  const qty = Number(item.stock || 0);
                  return (
                    <tr key={item._id}>
                      <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" /></td>
                      <td>{item.location || "Main Warehouse"}</td><td>{qty}</td><td>{item.name}</td><td>0</td><td>{money(qty * Number(item.avgPurchaseRate || item.purchaseRate || 0))}</td>
                      <td><span className={`status-badge ${qty <= 5 ? "status-warning" : "status-success"}`}>{qty <= 5 ? "Low Stock" : "Healthy"}</span></td>
                      <td className="text-end"><a className="btn action-btn" aria-label="Adjust" href={`/inventory/stock-adjustment?id=${item._id}`}><i className="bx bx-edit"></i></a></td>
                    </tr>
                  );
                }) : <EmptyRow colSpan="8" />}
              </tbody>
            </table>
          </div>
          <Pagination count={rows.length} />
        </div>
      </section>
    </div>
  );
}

const MetricCard = ({ icon, label, value }) => (
  <div className="col-12 col-sm-6 col-xl-3"><div className="card stat-card h-100"><div className="card-body"><span><i className={icon}></i></span><p>{label}</p><h3>{value}</h3></div></div></div>
);

const EmptyRow = ({ colSpan }) => (
  <tr className="table-state-row"><td colSpan={colSpan}><div className="empty-state compact"><span className="empty-state-icon"><i className="bx bx-search-alt"></i></span><h6>No matching records</h6><p>Try changing filters or clearing the search field.</p></div></td></tr>
);

const Pagination = ({ count }) => (
  <div className="pagination-row"><span>Showing {count ? 1 : 0} to {count} of {count} entries</span><nav aria-label="Table pagination"><ul className="pagination pagination-sm mb-0"><li className="page-item disabled"><span className="page-link"><i className="bx bx-chevron-left"></i></span></li><li className="page-item active"><span className="page-link">1</span></li><li className="page-item disabled"><span className="page-link"><i className="bx bx-chevron-right"></i></span></li></ul></nav></div>
);
