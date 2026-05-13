import React, { useEffect, useMemo, useState } from "react";
import { fetchProfitLossReport } from "../../services/reportService";

const formatMoney = (value) => Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const formatShort = (value) => {
    const numeric = Number(value || 0);
    if (Math.abs(numeric) >= 100000) return `${(numeric / 100000).toFixed(2)}L`;
    if (Math.abs(numeric) >= 1000) return `${(numeric / 1000).toFixed(1)}K`;
    return formatMoney(numeric);
};

const ProfitLoss = () => {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetchProfitLossReport()
            .then((data) => {
                setReport(data);
                setError(null);
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const pnl = report?.data || {};
    const rows = useMemo(() => {
        const netSales = Number(pnl.netSales || 0);
        const netPurchases = Number(pnl.netPurchases || 0);
        const grossProfit = Number(pnl.grossProfitEstimate || 0);
        const expenseEstimate = Math.max(netSales - netPurchases - grossProfit, 0);
        const margin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
        return [
            { label: "Gross Sales", current: pnl.totalSales, previous: 0, margin: "100%", status: "Active" },
            { label: "Sales Returns", current: pnl.totalSalesReturns, previous: 0, margin: netSales ? `${((Number(pnl.totalSalesReturns || 0) / netSales) * 100).toFixed(1)}%` : "0%", status: "Active" },
            { label: "Net Sales", current: netSales, previous: 0, margin: "100%", status: "Active" },
            { label: "Cost of Goods", current: netPurchases, previous: 0, margin: netSales ? `${((netPurchases / netSales) * 100).toFixed(1)}%` : "0%", status: "Active" },
            { label: "Operating Expenses", current: expenseEstimate, previous: 0, margin: netSales ? `${((expenseEstimate / netSales) * 100).toFixed(1)}%` : "0%", status: "Active" },
            { label: "Net Profit", current: grossProfit, previous: 0, margin: `${margin.toFixed(1)}%`, status: grossProfit >= 0 ? "Active" : "Loss" },
        ];
    }, [pnl]);

    const filteredRows = rows.filter((row) => row.label.toLowerCase().includes(search.trim().toLowerCase()));

    if (loading) return <div style={{ padding: 24 }}>Loading profit and loss...</div>;
    if (error) return <div style={{ padding: 24, color: "#b42318" }}>Error: {error}</div>;

    return (
        <>
            <div className="container-fluid p-0 flex-grow-1">
                <div className="page-header card">
                    <div className="card-body">
                        <div>
                            <nav aria-label="breadcrumb"><ol className="breadcrumb mb-2"><li className="breadcrumb-item"><a href="/">Home</a></li><li className="breadcrumb-item active" aria-current="page">Reports</li></ol></nav>
                            <p className="section-label">Reports</p>
                            <h1>Profit &amp; Loss</h1>
                            <p className="mb-0 text-muted">Compare revenue, purchases, expenses, gross margin, and operating profit.</p>
                        </div>
                        <div className="page-header-actions">
                            <span className="metric-pill"><i className="bx bx-check-circle"></i> Ready</span>
                            <button className="btn btn_style" type="button" onClick={() => window.print()}><i className="bx bx-printer"></i><span>Print</span></button>
                        </div>
                    </div>
                </div>

                <div className="row g-3">
                    <div className="col-12 col-sm-6 col-xl-3"><div className="card stat-card"><div className="card-body"><span className="stat-icon text-success"><i className="bx bx-trending-up"></i></span><p>Sales</p><h3>{formatShort(pnl.netSales)}</h3></div></div></div>
                    <div className="col-12 col-sm-6 col-xl-3"><div className="card stat-card"><div className="card-body"><span className="stat-icon text-primary"><i className="bx bx-cart"></i></span><p>Purchases</p><h3>{formatShort(pnl.netPurchases)}</h3></div></div></div>
                    <div className="col-12 col-sm-6 col-xl-3"><div className="card stat-card"><div className="card-body"><span className="stat-icon text-warning"><i className="bx bx-revision"></i></span><p>Returns</p><h3>{formatShort(pnl.totalSalesReturns)}</h3></div></div></div>
                    <div className="col-12 col-sm-6 col-xl-3"><div className="card stat-card"><div className="card-body"><span className="stat-icon text-info"><i className="bx bx-line-chart"></i></span><p>Net Profit</p><h3>{formatShort(pnl.grossProfitEstimate)}</h3></div></div></div>
                </div>

                <section className="card app-card app-datatable-card mt-4">
                    <div className="card-body p-0">
                        <div className="datatable-toolbar">
                            <div className="datatable-toolbar-start"><label className="datatable-length"><span>Show</span><select className="form-select form-select-sm datatable-page-size" aria-label="Rows per page" defaultValue="10"><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label><button className="btn btn_style datatable-create" type="button" onClick={() => window.print()}><i className="bx bx-printer"></i><span>Print Profit &amp; Loss</span></button></div>
                            <div className="datatable-toolbar-end"><button className="btn btn_style inActive datatable-tool-btn" type="button" onClick={() => setSearch("")}><i className="bx bx-filter-alt"></i><span>Clear</span></button><div className="dropdown"><button className="btn btn_style inActive datatable-tool-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false"><i className="bx bx-export"></i><span>Export</span></button><div className="dropdown-menu dropdown-menu-end datatable-action-menu"><button className="dropdown-item" type="button" onClick={() => window.print()}><i className="bx bx-printer me-2"></i>Print</button></div></div><div className="datatable-search"><input type="text" placeholder="Search Profit & Loss Summary" aria-label="Search Profit & Loss Summary" value={search} onChange={(event) => setSearch(event.target.value)} /></div><select className="form-select datatable-status-filter" aria-label="Filter status" defaultValue="Active"><option>Active</option></select></div>
                        </div>
                        <div className="datatable-bulk-bar"><div className="datatable-bulk-copy"><strong>{filteredRows.length} rows</strong><span>Net profit Rs. {formatMoney(pnl.grossProfitEstimate)}</span></div><div className="datatable-bulk-actions"><button className="btn btn_style inActive" type="button" onClick={() => window.print()}><i className="bx bx-printer"></i><span>Print</span></button></div></div>
                        <div className="table-responsive app-table-wrap datatable-wrap">
                            <table className="table app-table align-middle">
                                <thead><tr><th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" aria-label="Select all rows" disabled /></th><th><span className="sortable-heading">Particulars<i className="bx bx-sort-up"></i></span></th><th><span className="sortable-heading">Current Month<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Previous Month<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Variance<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Margin<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Status<i className="bx bx-sort"></i></span></th><th className="text-end">Actions</th></tr></thead>
                                <tbody>
                                    {filteredRows.map((row) => {
                                        const variance = Number(row.previous || 0) === 0 ? "-" : `${(((Number(row.current || 0) - Number(row.previous || 0)) / Number(row.previous || 1)) * 100).toFixed(1)}%`;
                                        return (
                                            <tr key={row.label}>
                                                <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" disabled /></td>
                                                <td>{row.label}</td>
                                                <td>{formatMoney(row.current)}</td>
                                                <td>{formatMoney(row.previous)}</td>
                                                <td>{variance}</td>
                                                <td>{row.margin}</td>
                                                <td><span className={row.status === "Loss" ? "status-badge status-warning" : "status-badge status-success"}>{row.status}</span></td>
                                                <td className="text-end"><div className="datatable-actions"><button type="button" className="btn action-btn" aria-label="Print row" onClick={() => window.print()}><i className="bx bx-printer"></i></button><button type="button" className="btn action-btn" aria-label="View"><i className="bx bx-show"></i></button></div></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="pagination-row"><span>Showing {filteredRows.length > 0 ? 1 : 0} to {filteredRows.length} of {filteredRows.length} entries</span><nav aria-label="Table pagination"><ul className="pagination pagination-sm mb-0"><li className="page-item disabled"><a className="page-link" href="#" aria-label="Previous"><i className="bx bx-chevron-left"></i></a></li><li className="page-item active"><a className="page-link" href="#">1</a></li><li className="page-item disabled"><a className="page-link" href="#" aria-label="Next"><i className="bx bx-chevron-right"></i></a></li></ul></nav></div>
                    </div>
                </section>
            </div>
        </>
    );
};

export default ProfitLoss;
