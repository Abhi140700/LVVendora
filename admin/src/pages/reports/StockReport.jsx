import React, { useEffect, useMemo, useState } from "react";
import { fetchStockReport } from "../../services/reportService";
import { exportReportToPDF } from "../../utils/pdfExport";
import useAppSettings from "../../hooks/useAppSettings";

const formatMoney = (value) => Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const getCategoryName = (item) => item.category?.name || item.category || "Unmapped";
const getBrandName = (item) => item.brand?.name || item.brand || "-";
const getItemValue = (item) => {
    const rate = Number(item.avgPurchaseRate || item.purchaseRate || item.sellingRate || 0);
    return Number(item.stock || 0) * rate;
};

const StockReport = () => {
    const appSettings = useAppSettings();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        category: "",
        brand: "",
        itemName: "",
        lowStockOnly: false,
        search: "",
    });

    useEffect(() => {
        fetchStockReport()
            .then((data) => {
                setReport(data);
                setError(null);
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const items = report?.data || [];
    const filteredItems = useMemo(() => {
        const category = filters.category.trim().toLowerCase();
        const brand = filters.brand.trim().toLowerCase();
        const itemName = filters.itemName.trim().toLowerCase();
        const search = filters.search.trim().toLowerCase();

        return items.filter((item) => {
            const categoryName = getCategoryName(item).toLowerCase();
            const brandName = getBrandName(item).toLowerCase();
            const name = String(item.name || "").toLowerCase();
            const haystack = `${categoryName} ${brandName} ${name}`.toLowerCase();

            if (category && !categoryName.includes(category)) return false;
            if (brand && !brandName.includes(brand)) return false;
            if (itemName && !name.includes(itemName)) return false;
            if (filters.lowStockOnly && Number(item.stock || 0) > 5) return false;
            if (search && !haystack.includes(search)) return false;
            return true;
        });
    }, [filters, items]);

    const summary = useMemo(() => ({
        totalStock: filteredItems.reduce((sum, item) => sum + Number(item.stock || 0), 0),
        totalValue: filteredItems.reduce((sum, item) => sum + getItemValue(item), 0),
        lowStock: filteredItems.filter((item) => Number(item.stock || 0) <= 5).length,
    }), [filteredItems]);

    const handleClear = () => {
        setFilters({
            category: "",
            brand: "",
            itemName: "",
            lowStockOnly: false,
            search: "",
        });
    };

    const handleExportPDF = () => {
        exportReportToPDF({
            inventory: filteredItems.map((item) => ({
                ...item,
                sellingRate: Number(item.avgPurchaseRate || item.purchaseRate || item.sellingRate || 0),
            })),
        }, "Stock", appSettings);
    };

    if (loading) return <div style={{ padding: 24 }}>Loading stock report...</div>;
    if (error) return <div style={{ padding: 24, color: "#b42318" }}>Error: {error}</div>;

    return (
        <>
            <div className="container-fluid p-0 flex-grow-1">
                <div className="page-header card">
                    <div className="card-body">
                        <div>
                            <nav aria-label="breadcrumb">
                                <ol className="breadcrumb mb-2">
                                    <li className="breadcrumb-item"><a href="/">Home</a></li>
                                    <li className="breadcrumb-item active" aria-current="page">Tally</li>
                                </ol>
                            </nav>
                            <p className="section-label">Tally</p>
                            <h1>Stock Report</h1>
                            <p className="mb-0 text-muted">Prepare stock valuation, batch balances, and movement reports for reconciliation.</p>
                        </div>
                        <div className="page-header-actions">
                            <span className="metric-pill"><i className="bx bx-check-circle"></i> {filteredItems.length} SKUs</span>
                            <button className="btn btn_style" type="button" onClick={() => window.print()}>
                                <i className="bx bx-printer"></i><span>Print</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="row g-3">
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="card stat-card">
                            <div className="card-body">
                                <span className="stat-icon text-primary"><i className="bx bx-package"></i></span>
                                <p>SKUs</p>
                                <h3>{filteredItems.length}</h3>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="card stat-card">
                            <div className="card-body">
                                <span className="stat-icon text-success"><i className="bx bx-layer"></i></span>
                                <p>Units</p>
                                <h3>{summary.totalStock}</h3>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="card stat-card">
                            <div className="card-body">
                                <span className="stat-icon text-info"><i className="bx bx-rupee"></i></span>
                                <p>Stock Value</p>
                                <h3>{formatMoney(summary.totalValue)}</h3>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="card stat-card">
                            <div className="card-body">
                                <span className="stat-icon text-warning"><i className="bx bx-error-circle"></i></span>
                                <p>Low Stock</p>
                                <h3>{summary.lowStock}</h3>
                            </div>
                        </div>
                    </div>
                </div>

                <section className="card app-card mt-4">
                    <div className="card-header app-card-header">
                        <div>
                            <h2>Report Filters</h2>
                            <p>Use consistent master data so downstream billing and reporting stay clean.</p>
                        </div>
                    </div>
                    <div className="card-body">
                        <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                            <div className="col-12 col-sm-6 col-xl-3">
                                <label className="form-label" htmlFor="stock-report-category">Category</label>
                                <input type="text" className="form-control" id="stock-report-category" placeholder="Enter Category" value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))} />
                            </div>
                            <div className="col-12 col-sm-6 col-xl-3">
                                <label className="form-label" htmlFor="stock-report-brand">Brand</label>
                                <input type="text" className="form-control" id="stock-report-brand" placeholder="Enter Brand" value={filters.brand} onChange={(event) => setFilters((current) => ({ ...current, brand: event.target.value }))} />
                            </div>
                            <div className="col-12 col-sm-6 col-xl-3">
                                <label className="form-label" htmlFor="stock-report-item">Item Name</label>
                                <input type="text" className="form-control" id="stock-report-item" placeholder="Enter Item Name" value={filters.itemName} onChange={(event) => setFilters((current) => ({ ...current, itemName: event.target.value }))} />
                            </div>
                            <div className="col-12 col-sm-6 col-xl-3">
                                <label className="form-label" htmlFor="stock-report-low-stock">Low Stock Only</label>
                                <select className="form-select" id="stock-report-low-stock" value={filters.lowStockOnly ? "yes" : "no"} onChange={(event) => setFilters((current) => ({ ...current, lowStockOnly: event.target.value === "yes" }))}>
                                    <option value="no">No</option>
                                    <option value="yes">Yes</option>
                                </select>
                            </div>
                            <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                                <button className="btn btn_style" type="button" onClick={handleExportPDF}><i className="bx bx-export"></i><span>Export PDF</span></button>
                                <button className="btn btn_style inActive" type="button" onClick={handleClear}><i className="bx bx-reset"></i><span>Clear</span></button>
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
                                        <option value="10">10</option>
                                        <option value="25">25</option>
                                        <option value="50">50</option>
                                    </select>
                                </label>
                                <button className="btn btn_style datatable-create" type="button" onClick={() => window.print()}><i className="bx bx-printer"></i><span>Print Stock</span></button>
                            </div>
                            <div className="datatable-toolbar-end">
                                <button className="btn btn_style inActive datatable-tool-btn" type="button" onClick={handleClear}>
                                    <i className="bx bx-filter-alt"></i><span>Clear</span>
                                </button>
                                <div className="dropdown">
                                    <button className="btn btn_style inActive datatable-tool-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                        <i className="bx bx-export"></i><span>Export</span>
                                    </button>
                                    <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                        <button className="dropdown-item" type="button" onClick={handleExportPDF}><i className="bx bx-file me-2"></i>PDF</button>
                                        <button className="dropdown-item" type="button" onClick={() => window.print()}><i className="bx bx-printer me-2"></i>Print</button>
                                    </div>
                                </div>
                                <div className="datatable-search">
                                    <input type="text" placeholder="Search Stock Report" aria-label="Search Stock Report" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
                                </div>
                                <select className="form-select datatable-status-filter" aria-label="Filter stock status" value={filters.lowStockOnly ? "Low Stock" : "All Stock"} onChange={(event) => setFilters((current) => ({ ...current, lowStockOnly: event.target.value === "Low Stock" }))}>
                                    <option>All Stock</option>
                                    <option>Low Stock</option>
                                </select>
                            </div>
                        </div>

                        <div className="datatable-bulk-bar">
                            <div className="datatable-bulk-copy">
                                <strong>{filteredItems.length} rows</strong>
                                <span>Stock value Rs. {formatMoney(summary.totalValue)}</span>
                            </div>
                            <div className="datatable-bulk-actions">
                                <button className="btn btn_style inActive" type="button" onClick={handleExportPDF}><i className="bx bx-export"></i><span>Export</span></button>
                                <button className="btn btn_style inActive" type="button" onClick={() => window.print()}><i className="bx bx-printer"></i><span>Print</span></button>
                            </div>
                        </div>

                        <div className="table-responsive app-table-wrap datatable-wrap">
                            <table className="table app-table align-middle">
                                <thead>
                                    <tr>
                                        <th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" aria-label="Select all rows" disabled /></th>
                                        <th><span className="sortable-heading">Category<i className="bx bx-sort-up"></i></span></th>
                                        <th><span className="sortable-heading">Brand<i className="bx bx-sort"></i></span></th>
                                        <th><span className="sortable-heading">Item<i className="bx bx-sort"></i></span></th>
                                        <th><span className="sortable-heading">Stock<i className="bx bx-sort"></i></span></th>
                                        <th><span className="sortable-heading">Avg Purchase<i className="bx bx-sort"></i></span></th>
                                        <th><span className="sortable-heading">Value<i className="bx bx-sort"></i></span></th>
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.length > 0 ? filteredItems.map((item) => {
                                        const rate = Number(item.avgPurchaseRate || item.purchaseRate || item.sellingRate || 0);
                                        const value = getItemValue(item);
                                        return (
                                            <tr key={item._id || item.name}>
                                                <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" disabled /></td>
                                                <td>{getCategoryName(item)}</td>
                                                <td>{getBrandName(item)}</td>
                                                <td>{item.name || "-"}</td>
                                                <td>{Number(item.stock || 0)}</td>
                                                <td>{formatMoney(rate)}</td>
                                                <td><span className="status-badge status-primary">{formatMoney(value)}</span></td>
                                                <td className="text-end">
                                                    <div className="datatable-actions">
                                                        <button type="button" className="btn action-btn" aria-label="Print row" onClick={() => window.print()}><i className="bx bx-printer"></i></button>
                                                        <button type="button" className="btn action-btn" aria-label="View"><i className="bx bx-show"></i></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr className="table-state-row table-state-row-empty">
                                            <td colSpan="8">
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
                            <span>Showing {filteredItems.length > 0 ? 1 : 0} to {filteredItems.length} of {filteredItems.length} entries</span>
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
            </div>
        </>
    );
};

export default StockReport;
