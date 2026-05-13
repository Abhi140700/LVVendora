import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchAdvancedReport } from "../../services/reportService";
import { downloadRowsAsExcel, formatMoney, loadReportPresets, saveReportPreset, shareReportByEmail, shareReportByWhatsApp } from "./reportTools";

const REPORT_CONFIG = {
    margin: {
        title: "Margin Report",
        subtitle: "Estimate item-level sales margin from sale value and current purchase cost.",
        columns: [
            { label: "Invoice", value: "invoiceNo" },
            { label: "Date", value: (row) => row.date ? new Date(row.date).toLocaleDateString("en-IN") : "-" },
            { label: "Item", value: "itemName" },
            { label: "Customer", value: "customer" },
            { label: "Sales", value: (row) => formatMoney(row.salesAmount) },
            { label: "Cost", value: (row) => formatMoney(row.costAmount) },
            { label: "Margin", value: (row) => formatMoney(row.marginAmount) },
            { label: "Margin %", value: (row) => `${Number(row.marginPercent || 0).toFixed(2)}%` },
        ],
        drill: (row) => row.saleId ? `/sales/invoice?id=${row.saleId}` : "/reports/sales",
    },
    salesman: {
        title: "Salesman Report",
        subtitle: "Sales grouped by salesman for counter accountability.",
        columns: [
            { label: "Salesman", value: "label" },
            { label: "Bills", value: "count" },
            { label: "Items", value: "qty" },
            { label: "Amount", value: (row) => formatMoney(row.amount) },
        ],
    },
    "vendor-performance": {
        title: "Vendor Performance Report",
        subtitle: "Supplier purchase value, bill count, and quantity contribution.",
        columns: [
            { label: "Vendor", value: "label" },
            { label: "Bills", value: "count" },
            { label: "Qty / Lines", value: "qty" },
            { label: "Purchase Amount", value: (row) => formatMoney(row.amount) },
        ],
    },
    "customer-performance": {
        title: "Customer Performance Report",
        subtitle: "Customer sales value and repeat purchase contribution.",
        columns: [
            { label: "Customer", value: "label" },
            { label: "Bills", value: "count" },
            { label: "Items", value: "qty" },
            { label: "Sales Amount", value: (row) => formatMoney(row.amount) },
        ],
    },
    "inventory-ageing": {
        title: "Inventory Ageing Report",
        subtitle: "Stock value by item age since last purchase movement.",
        columns: [
            { label: "Item", value: "itemName" },
            { label: "Category", value: "category" },
            { label: "Brand", value: "brand" },
            { label: "Stock", value: "stock" },
            { label: "Value", value: (row) => formatMoney(row.value) },
            { label: "Age", value: (row) => `${row.ageDays || 0} days` },
            { label: "Bucket", value: "bucket" },
        ],
    },
    comparative: {
        title: "Comparative Report",
        subtitle: "Month-wise sales, purchase, and estimated profit comparison.",
        columns: [
            { label: "Period", value: "period" },
            { label: "Sales", value: (row) => formatMoney(row.salesAmount) },
            { label: "Purchase", value: (row) => formatMoney(row.purchaseAmount) },
            { label: "Profit Estimate", value: (row) => formatMoney(row.profitEstimate) },
        ],
    },
};

const getColumnValue = (column, row) => typeof column.value === "function" ? column.value(row) : row[column.value];

const AdvancedReport = ({ type }) => {
    const navigate = useNavigate();
    const config = REPORT_CONFIG[type] || REPORT_CONFIG.margin;
    const presetKey = `report-presets:${type}`;
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [presetName, setPresetName] = useState("");
    const [presets, setPresets] = useState(() => loadReportPresets(presetKey));

    useEffect(() => {
        setLoading(true);
        fetchAdvancedReport(type)
            .then((data) => {
                setReport(data);
                setError(null);
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [type]);

    const rows = Array.isArray(report?.data) ? report.data : [];
    const filteredRows = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return rows;
        return rows.filter((row) => config.columns.some((column) => String(getColumnValue(column, row) ?? "").toLowerCase().includes(needle)));
    }, [config.columns, rows, search]);

    const totalAmount = filteredRows.reduce((sum, row) => sum + Number(row.amount || row.salesAmount || row.purchaseAmount || row.value || 0), 0);
    const shareSummary = `${filteredRows.length} rows | Total ${formatMoney(totalAmount)}`;

    const handleSavePreset = () => {
        const name = presetName.trim() || `Preset ${new Date().toLocaleDateString("en-IN")}`;
        setPresets(saveReportPreset(presetKey, { name, search }));
        setPresetName("");
    };

    if (loading) return <div className="card app-card"><div className="card-body">Loading {config.title.toLowerCase()}...</div></div>;
    if (error) return <div className="card app-card"><div className="card-body text-danger">Error: {error}</div></div>;

    return (
        <div className="container-fluid p-0 flex-grow-1">
            <div className="page-header card">
                <div className="card-body">
                    <div>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-2">
                                <li className="breadcrumb-item"><Link to="/reports">Reports</Link></li>
                                <li className="breadcrumb-item active" aria-current="page">{config.title}</li>
                            </ol>
                        </nav>
                        <p className="section-label">Advanced Reports</p>
                        <h1>{config.title}</h1>
                        <p className="mb-0 text-muted">{config.subtitle}</p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-table"></i> {filteredRows.length} rows</span>
                        <button className="btn btn_style" type="button" onClick={() => downloadRowsAsExcel(filteredRows, config.columns, `${type}-report.xls`)}><i className="bx bx-spreadsheet"></i><span>Excel</span></button>
                    </div>
                </div>
            </div>

            <section className="card app-card">
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-12 col-lg-4">
                            <label className="form-label" htmlFor={`${type}-search`}>Advanced Search</label>
                            <input id={`${type}-search`} className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search any visible column" />
                        </div>
                        <div className="col-12 col-lg-4">
                            <label className="form-label" htmlFor={`${type}-preset`}>Saved Preset</label>
                            <div className="d-flex gap-2">
                                <input id={`${type}-preset`} className="form-control" value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Preset name" />
                                <button className="btn btn_style" type="button" onClick={handleSavePreset}>Save</button>
                            </div>
                        </div>
                        <div className="col-12 col-lg-4 d-flex flex-wrap gap-2">
                            <button className="btn btn_style inActive" type="button" onClick={() => shareReportByEmail({ title: config.title, summary: shareSummary })}><i className="bx bx-envelope"></i><span>Email</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={() => shareReportByWhatsApp({ title: config.title, summary: shareSummary })}><i className="bx bxl-whatsapp"></i><span>WhatsApp</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={() => window.print()}><i className="bx bx-printer"></i><span>Print</span></button>
                        </div>
                    </div>
                    {presets.length ? (
                        <div className="d-flex flex-wrap gap-2 mt-3">
                            {presets.map((preset) => (
                                <button className="btn btn-sm btn-outline-secondary" type="button" key={preset.name} onClick={() => setSearch(preset.search || "")}>{preset.name}</button>
                            ))}
                        </div>
                    ) : null}
                </div>
            </section>

            <section className="card app-card app-datatable-card">
                <div className="card-body p-0">
                    <div className="datatable-bulk-bar">
                        <div className="datatable-bulk-copy"><strong>{shareSummary}</strong><span>Use rows to drill down where source bills are available.</span></div>
                    </div>
                    <div className="table-responsive app-table-wrap datatable-wrap">
                        <table className="table app-table align-middle">
                            <thead>
                                <tr>
                                    {config.columns.map((column) => <th key={column.label}>{column.label}</th>)}
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.length ? filteredRows.map((row, index) => (
                                    <tr key={`${type}-${index}`}>
                                        {config.columns.map((column) => <td key={column.label}>{getColumnValue(column, row) ?? "-"}</td>)}
                                        <td className="text-end">
                                            {config.drill ? <button className="btn action-btn" type="button" onClick={() => navigate(config.drill(row))} aria-label="Open source bill"><i className="bx bx-show"></i></button> : <span className="text-muted">-</span>}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={config.columns.length + 1}><div className="empty-state compact"><h6>No matching records</h6><p>Try clearing the search filter.</p></div></td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default AdvancedReport;
