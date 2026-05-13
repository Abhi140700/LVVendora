import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../app/axios";
import { getApiErrorMessage } from "../../utils/api";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const dateText = (value) => (value ? new Date(value).toLocaleDateString("en-IN") : "-");

const itemCategory = (item) => item.category?.name || item.category || "-";
const itemBrand = (item) => item.brand?.name || item.brand || "-";

export default function Inventory() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ category: "", brand: "", name: "", search: "" });

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const { data: result } = await api.get("/inventory");
      setInventory(result.data || []);
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

  const filteredInventory = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return inventory.filter((item) => {
      const category = itemCategory(item);
      const brand = itemBrand(item);
      const name = item.name || "";
      const rowText = [item.barcode, category, brand, name, item.unit].join(" ").toLowerCase();

      if (filters.category && !category.toLowerCase().includes(filters.category.toLowerCase())) return false;
      if (filters.brand && !brand.toLowerCase().includes(filters.brand.toLowerCase())) return false;
      if (filters.name && !name.toLowerCase().includes(filters.name.toLowerCase())) return false;
      if (query && !rowText.includes(query)) return false;
      return true;
    });
  }, [filters, inventory]);

  const summary = useMemo(() => {
    const totalUnits = filteredInventory.reduce((sum, item) => sum + Number(item.stock || 0), 0);
    const lowStock = filteredInventory.filter((item) => Number(item.stock || 0) <= 5).length;
    const stockValue = filteredInventory.reduce(
      (sum, item) => sum + Number(item.stock || 0) * Number(item.avgPurchaseRate || item.purchaseRate || 0),
      0
    );

    return { totalUnits, lowStock, stockValue, itemCount: filteredInventory.length };
  }, [filteredInventory]);

  const clearFilters = () => setFilters({ category: "", brand: "", name: "", search: "" });

  if (loading) return <div className="container-fluid p-0 flex-grow-1"><div className="card app-card"><div className="card-body">Loading inventory...</div></div></div>;
  if (error) return <div className="container-fluid p-0 flex-grow-1"><div className="alert alert-danger mb-0">Error: {error}</div></div>;

  return (
    <div className="container-fluid p-0 flex-grow-1">
      <div className="page-header card">
        <div className="card-body">
          <div>
            <nav aria-label="breadcrumb">
              <ol className="breadcrumb mb-2">
                <li className="breadcrumb-item"><a href="/">Home</a></li>
                <li className="breadcrumb-item active" aria-current="page">Inventory</li>
              </ol>
            </nav>
            <p className="section-label">Inventory</p>
            <h1>Inventory</h1>
            <p className="mb-0 text-muted">View item-wise quantity, stock value, warehouse location, and reorder exposure.</p>
          </div>
          <div className="page-header-actions">
            <span className="metric-pill"><i className="bx bx-package"></i> {summary.itemCount} Items</span>
            <button className="btn btn_style inActive" type="button" onClick={fetchInventory}>
              <i className="bx bx-refresh"></i><span>Refresh</span>
            </button>
            <button className="btn btn_style" type="button" onClick={() => navigate("/inventory/stock-adjustment")}>
              <i className="bx bx-plus"></i><span>Adjust</span>
            </button>
          </div>
        </div>
      </div>

      <section className="row g-3 mb-4">
        <MetricCard icon="bx bx-box" label="Visible SKUs" value={summary.itemCount} />
        <MetricCard icon="bx bx-cube" label="Units In Stock" value={summary.totalUnits} />
        <MetricCard icon="bx bx-error-circle" label="Low Stock" value={summary.lowStock} />
        <MetricCard icon="bx bx-rupee" label="Stock Value" value={money(summary.stockValue)} />
      </section>

      <section className="card app-card">
        <div className="card-header app-card-header">
          <div>
            <h2>Filters</h2>
            <p>Use consistent master data so downstream billing and reporting stay clean.</p>
          </div>
        </div>
        <div className="card-body">
          <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
            <FilterField id="inventory-category" label="Category" value={filters.category} onChange={(value) => setFilters((current) => ({ ...current, category: value }))} />
            <FilterField id="inventory-brand" label="Brand" value={filters.brand} onChange={(value) => setFilters((current) => ({ ...current, brand: value }))} />
            <FilterField id="inventory-name" label="Item Name" value={filters.name} onChange={(value) => setFilters((current) => ({ ...current, name: value }))} />
            <div className="col-12 d-flex flex-wrap gap-2 pt-2">
              <button className="btn btn_style" type="button" onClick={() => setFilters((current) => ({ ...current }))}><i className="bx bx-search"></i><span>Search</span></button>
              <button className="btn btn_style inActive" type="button" onClick={clearFilters}><i className="bx bx-reset"></i><span>Clear</span></button>
              <button className="btn btn_style inActive" type="button" onClick={() => navigate("/inventory/stock-dashboard")}><i className="bx bx-line-chart"></i><span>Dashboard</span></button>
              <button className="btn btn_style inActive" type="button" onClick={() => navigate("/inventory/stock-transfer")}><i className="bx bx-transfer"></i><span>Transfer</span></button>
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
                  <option>10</option><option>25</option><option>50</option>
                </select>
              </label>
              <button className="btn btn_style datatable-create" type="button" onClick={() => navigate("/inventory/stock-adjustment")}>
                <i className="bx bx-plus"></i><span>Create Inventory</span>
              </button>
            </div>
            <div className="datatable-toolbar-end">
              <button className="btn btn_style inActive datatable-tool-btn" type="button" onClick={clearFilters}><i className="bx bx-filter-alt"></i><span>Clear</span></button>
              <button className="btn btn_style inActive datatable-tool-btn" type="button" onClick={() => window.print()}><i className="bx bx-printer"></i><span>Print</span></button>
              <div className="datatable-search">
                <input type="text" placeholder="Search Inventory" aria-label="Search Inventory" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
              </div>
              <select className="form-select datatable-status-filter" aria-label="Filter stock status" defaultValue="All Stock">
                <option>All Stock</option><option>Low Stock</option><option>In Stock</option>
              </select>
            </div>
          </div>

          <div className="datatable-bulk-bar">
            <div className="datatable-bulk-copy">
              <strong>{filteredInventory.length} shown</strong>
              <span>Choose an item row to adjust live inventory.</span>
            </div>
            <div className="datatable-bulk-actions">
              <button className="btn btn_style inActive" type="button" onClick={() => navigate("/inventory/batch-management")}><i className="bx bx-archive"></i><span>Batches</span></button>
              <button className="btn btn_style inActive" type="button" onClick={() => navigate("/reports/stock")}><i className="bx bx-export"></i><span>Report</span></button>
            </div>
          </div>

          <div className="table-responsive app-table-wrap datatable-wrap">
            <table className="table app-table align-middle">
              <thead>
                <tr>
                  <th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" aria-label="Select all rows" /></th>
                  <th><span className="sortable-heading">Barcode<i className="bx bx-sort-up"></i></span></th>
                  <th><span className="sortable-heading">Category<i className="bx bx-sort"></i></span></th>
                  <th><span className="sortable-heading">Brand<i className="bx bx-sort"></i></span></th>
                  <th><span className="sortable-heading">Item<i className="bx bx-sort"></i></span></th>
                  <th><span className="sortable-heading">Unit<i className="bx bx-sort"></i></span></th>
                  <th><span className="sortable-heading">Qty<i className="bx bx-sort"></i></span></th>
                  <th><span className="sortable-heading">Purchase<i className="bx bx-sort"></i></span></th>
                  <th><span className="sortable-heading">MRP<i className="bx bx-sort"></i></span></th>
                  <th><span className="sortable-heading">Sale Rate<i className="bx bx-sort"></i></span></th>
                  <th><span className="sortable-heading">Last Purchase<i className="bx bx-sort"></i></span></th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.length > 0 ? filteredInventory.map((item) => (
                  <tr key={item._id}>
                    <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" /></td>
                    <td>{item.barcode || "-"}</td>
                    <td>{itemCategory(item)}</td>
                    <td>{itemBrand(item)}</td>
                    <td>{item.name || "-"}</td>
                    <td>{item.unit || "PC"}</td>
                    <td><span className={`status-badge ${Number(item.stock || 0) <= 5 ? "status-warning" : "status-success"}`}>{item.stock || 0}</span></td>
                    <td>{money(item.purchaseRate)}</td>
                    <td>{money(item.mrp)}</td>
                    <td>{money(item.sellingRate || item.saleRate)}</td>
                    <td><span className="status-badge status-primary">{dateText(item.lastPurchaseDate)}</span></td>
                    <td className="text-end">
                      <div className="datatable-actions">
                        <button type="button" className="btn action-btn" aria-label="Adjust stock" onClick={() => navigate(`/inventory/stock-adjustment?id=${item._id}`)}><i className="bx bx-edit"></i></button>
                        <button type="button" className="btn action-btn" aria-label="Transfer stock" onClick={() => navigate("/inventory/stock-transfer")}><i className="bx bx-transfer"></i></button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr className="table-state-row">
                    <td colSpan="12">
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
            <span>Showing {filteredInventory.length ? 1 : 0} to {filteredInventory.length} of {filteredInventory.length} entries</span>
            <nav aria-label="Table pagination">
              <ul className="pagination pagination-sm mb-0">
                <li className="page-item disabled"><span className="page-link"><i className="bx bx-chevron-left"></i></span></li>
                <li className="page-item active"><span className="page-link">1</span></li>
                <li className="page-item disabled"><span className="page-link"><i className="bx bx-chevron-right"></i></span></li>
              </ul>
            </nav>
          </div>
        </div>
      </section>
    </div>
  );
}

const MetricCard = ({ icon, label, value }) => (
  <div className="col-12 col-sm-6 col-xl-3">
    <div className="card stat-card h-100">
      <div className="card-body">
        <span><i className={icon}></i></span>
        <p>{label}</p>
        <h3>{value}</h3>
      </div>
    </div>
  </div>
);

const FilterField = ({ id, label, value, onChange }) => (
  <div className="col-12 col-sm-6 col-xl-3">
    <label className="form-label" htmlFor={id}>{label}</label>
    <input type="text" className="form-control" id={id} placeholder={`Enter ${label}`} value={value} onChange={(event) => onChange(event.target.value)} />
  </div>
);
