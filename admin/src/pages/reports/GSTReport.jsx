import React, { useEffect, useMemo, useState } from "react";
import { fetchGstComplianceReport, fetchGstReport } from "../../services/reportService";
import { downloadRowsAsExcel, shareReportByEmail, shareReportByWhatsApp } from "./reportTools";

const formatMoney = (value) => Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const formatDateInput = (value) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const formatDateDisplay = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("en-IN");
};

const GSTReport = ({ complianceMode = false }) => {
    const [report, setReport] = useState(null);
    const [compliance, setCompliance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        from: "",
        to: "",
        type: "",
        gstRate: "",
        party: "",
        search: "",
    });

    useEffect(() => {
        Promise.all([
            fetchGstReport(),
            fetchGstComplianceReport().catch(() => ({ data: null })),
        ])
            .then(([gstData, complianceData]) => {
                setReport(gstData);
                setCompliance(complianceData.data || null);
                setError(null);
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const entries = report?.data || [];
    const filteredEntries = useMemo(() => {
        const from = filters.from ? new Date(filters.from) : null;
        const to = filters.to ? new Date(filters.to) : null;
        const type = filters.type.trim().toLowerCase();
        const gstRate = filters.gstRate.trim();
        const party = filters.party.trim().toLowerCase();
        const search = filters.search.trim().toLowerCase();

        return entries.filter((entry) => {
            const entryDateInput = formatDateInput(entry.date);
            const entryDate = entryDateInput ? new Date(entryDateInput) : null;
            const entryType = String(entry.type || "").toLowerCase();
            const entryParty = String(entry.party || "").toLowerCase();
            const entryRate = String(Number(entry.gstRate || 0));
            const haystack = `${entry.type || ""} ${entry.refNo || ""} ${entry.party || ""}`.toLowerCase();

            if (from && entryDate && entryDate < from) return false;
            if (to && entryDate && entryDate > to) return false;
            if (type && entryType !== type) return false;
            if (gstRate && !entryRate.includes(gstRate)) return false;
            if (party && !entryParty.includes(party)) return false;
            if (search && !haystack.includes(search)) return false;
            return true;
        });
    }, [entries, filters]);

    const summary = useMemo(() => ({
        taxable: filteredEntries.reduce((sum, entry) => sum + Number(entry.taxableAmount || 0), 0),
        gst: filteredEntries.reduce((sum, entry) => sum + Number(entry.gstAmount || 0), 0),
        total: filteredEntries.reduce((sum, entry) => sum + Number(entry.totalAmount || 0), 0),
        entries: filteredEntries.length,
    }), [filteredEntries]);

    const handleClear = () => {
        setFilters({ from: "", to: "", type: "", gstRate: "", party: "", search: "" });
    };

    if (loading) return <div style={{ padding: 24 }}>Loading GST report...</div>;
    if (error) return <div style={{ padding: 24, color: "#b42318" }}>Error: {error}</div>;

    if (complianceMode) {
        const complianceRows = [
            { label: "GSTR-1 Outward Taxable", value: formatMoney(compliance?.gstr1?.taxableOutwardSupply), detail: `${compliance?.gstr1?.invoiceCount || 0} invoices` },
            { label: "GSTR-1 Output Tax", value: formatMoney(compliance?.gstr1?.outputTax), detail: "Outward GST liability" },
            { label: "GSTR-3B Eligible ITC", value: formatMoney(compliance?.gstr3b?.eligibleItc), detail: "Input tax credit from purchases" },
            { label: "GSTR-3B Net Payable", value: formatMoney(compliance?.gstr3b?.netTaxPayable), detail: "Output GST minus ITC" },
            { label: "Reverse Charge", value: formatMoney(compliance?.reverseCharge?.taxAmount), detail: compliance?.reverseCharge?.note || "No reverse charge rows" },
            { label: "E-Invoice Ready", value: compliance?.eInvoiceReadiness?.readyInvoices || 0, detail: compliance?.eInvoiceReadiness?.note || "Needs IRP setup" },
        ];
        return (
            <div className="container-fluid p-0 flex-grow-1">
                <div className="page-header card">
                    <div className="card-body">
                        <div>
                            <p className="section-label">GST / Tax</p>
                            <h1>GST Compliance</h1>
                            <p className="mb-0 text-muted">GSTR-1, GSTR-3B, HSN summary, ITC tracking, mismatch checks, tax slabs, and e-invoice readiness.</p>
                        </div>
                        <div className="page-header-actions">
                            <button className="btn btn_style" type="button" onClick={() => downloadRowsAsExcel(complianceRows, [{ label: "Metric", value: "label" }, { label: "Value", value: "value" }, { label: "Detail", value: "detail" }], "gst-compliance.xls")}><i className="bx bx-spreadsheet"></i><span>Excel</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={() => shareReportByEmail({ title: "GST Compliance", summary: `Net payable ${formatMoney(compliance?.gstr3b?.netTaxPayable)}` })}><i className="bx bx-envelope"></i><span>Email</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={() => shareReportByWhatsApp({ title: "GST Compliance", summary: `Net payable ${formatMoney(compliance?.gstr3b?.netTaxPayable)}` })}><i className="bx bxl-whatsapp"></i><span>WhatsApp</span></button>
                        </div>
                    </div>
                </div>

                <div className="row g-3">
                    {complianceRows.map((row) => (
                        <div className="col-12 col-md-6 col-xl-4" key={row.label}>
                            <div className="card stat-card h-100"><div className="card-body"><span className="stat-icon text-primary"><i className="bx bx-receipt"></i></span><p>{row.label}</p><h3>{row.value}</h3><small className="text-muted">{row.detail}</small></div></div>
                        </div>
                    ))}
                </div>

                <div className="row g-3 mt-1">
                    <div className="col-12 col-xl-7">
                        <section className="card app-card h-100">
                            <div className="card-header app-card-header"><div><h2>HSN Summary</h2><p>HSN-wise quantity and taxable value.</p></div></div>
                            <div className="card-body p-0 table-responsive">
                                <table className="table app-table mb-0"><thead><tr><th>HSN</th><th>Qty</th><th>Taxable</th><th>GST</th><th>Total</th></tr></thead><tbody>
                                    {(compliance?.hsnSummary || []).slice(0, 20).map((row) => <tr key={row.hsn}><td>{row.hsn}</td><td>{row.qty}</td><td>{formatMoney(row.taxableAmount)}</td><td>{formatMoney(row.gstAmount)}</td><td>{formatMoney(row.totalAmount)}</td></tr>)}
                                </tbody></table>
                            </div>
                        </section>
                    </div>
                    <div className="col-12 col-xl-5">
                        <section className="card app-card h-100">
                            <div className="card-header app-card-header"><div><h2>Mismatch & Tax Slabs</h2><p>GSTIN validation and slab distribution.</p></div></div>
                            <div className="card-body">
                                <h6>GST Mismatch Report</h6>
                                {(compliance?.mismatchRows || []).length ? compliance.mismatchRows.map((row) => <div className="summary-line" key={`${row.refNo}-${row.issue}`}><span>{row.refNo} - {row.party}</span><strong>{row.issue}</strong></div>) : <p className="text-muted">No GSTIN mismatches found in captured data.</p>}
                                <h6 className="mt-3">Tax Slab Master</h6>
                                {(compliance?.taxSlabs || []).map((row) => <div className="summary-line" key={row.rate}><span>{row.rate}% GST</span><strong>{formatMoney(row.gstAmount)}</strong></div>)}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="container-fluid p-0 flex-grow-1">
                <div className="page-header card">
                    <div className="card-body">
                        <div>
                            <nav aria-label="breadcrumb">
                                <ol className="breadcrumb mb-2">
                                    <li className="breadcrumb-item"><a href="/">Home</a></li>
                                    <li className="breadcrumb-item active" aria-current="page">Reports</li>
                                </ol>
                            </nav>
                            <p className="section-label">Reports</p>
                            <h1>GST Report</h1>
                            <p className="mb-0 text-muted">Summarize taxable value, CGST, SGST, IGST, input credit, and outward liability.</p>
                        </div>
                        <div className="page-header-actions">
                            <span className="metric-pill"><i className="bx bx-check-circle"></i> {summary.entries} entries</span>
                            <button className="btn btn_style" type="button" onClick={() => downloadRowsAsExcel(filteredEntries, [
                                { label: "Type", value: "type" },
                                { label: "Date", value: (entry) => formatDateDisplay(entry.date) },
                                { label: "Reference", value: "refNo" },
                                { label: "Party", value: "party" },
                                { label: "Taxable", value: "taxableAmount" },
                                { label: "GST %", value: "gstRate" },
                                { label: "GST", value: "gstAmount" },
                                { label: "Total", value: "totalAmount" },
                            ], "gst-report.xls")}>
                                <i className="bx bx-spreadsheet"></i><span>Excel</span>
                            </button>
                            <button className="btn btn_style inActive" type="button" onClick={() => window.print()}>
                                <i className="bx bx-printer"></i><span>Print</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="row g-3">
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="card stat-card"><div className="card-body"><span className="stat-icon text-primary"><i className="bx bx-receipt"></i></span><p>Entries</p><h3>{summary.entries}</h3></div></div>
                    </div>
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="card stat-card"><div className="card-body"><span className="stat-icon text-info"><i className="bx bx-rupee"></i></span><p>Taxable</p><h3>{formatMoney(summary.taxable)}</h3></div></div>
                    </div>
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="card stat-card"><div className="card-body"><span className="stat-icon text-warning"><i className="bx bx-percent"></i></span><p>GST</p><h3>{formatMoney(summary.gst)}</h3></div></div>
                    </div>
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="card stat-card"><div className="card-body"><span className="stat-icon text-success"><i className="bx bx-calculator"></i></span><p>Total</p><h3>{formatMoney(summary.total)}</h3></div></div>
                    </div>
                </div>

                <section className="card app-card mt-4">
                    <div className="card-header app-card-header">
                        <div><h2>Report Filters</h2><p>Use consistent master data so downstream billing and reporting stay clean.</p></div>
                    </div>
                    <div className="card-body">
                        <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                            <div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor="gst-from">From Date</label><input type="date" className="form-control" id="gst-from" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} /></div>
                            <div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor="gst-to">To Date</label><input type="date" className="form-control" id="gst-to" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} /></div>
                            <div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor="gst-type">Type</label><select className="form-select" id="gst-type" value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}><option value="">Select Type</option><option value="sales">Sales</option><option value="purchase">Purchase</option><option value="expense">Expense</option></select></div>
                            <div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor="gst-rate">GST %</label><input type="text" className="form-control" id="gst-rate" placeholder="Enter GST %" value={filters.gstRate} onChange={(event) => setFilters((current) => ({ ...current, gstRate: event.target.value }))} /></div>
                            <div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor="gst-party">Party</label><input type="text" className="form-control" id="gst-party" placeholder="Enter Party" value={filters.party} onChange={(event) => setFilters((current) => ({ ...current, party: event.target.value }))} /></div>
                            <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                                <button className="btn btn_style" type="button" onClick={() => window.print()}><i className="bx bx-printer"></i><span>Print</span></button>
                                <button className="btn btn_style inActive" type="button" onClick={handleClear}><i className="bx bx-reset"></i><span>Clear</span></button>
                            </div>
                        </form>
                    </div>
                </section>

                <section className="card app-card app-datatable-card">
                    <div className="card-body p-0">
                        <div className="datatable-toolbar">
                            <div className="datatable-toolbar-start">
                                <label className="datatable-length"><span>Show</span><select className="form-select form-select-sm datatable-page-size" aria-label="Rows per page" defaultValue="10"><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label>
                                <button className="btn btn_style datatable-create" type="button" onClick={() => window.print()}><i className="bx bx-printer"></i><span>Print GST</span></button>
                            </div>
                            <div className="datatable-toolbar-end">
                                <button className="btn btn_style inActive datatable-tool-btn" type="button" onClick={handleClear}><i className="bx bx-filter-alt"></i><span>Clear</span></button>
                                <div className="dropdown"><button className="btn btn_style inActive datatable-tool-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false"><i className="bx bx-export"></i><span>Export</span></button><div className="dropdown-menu dropdown-menu-end datatable-action-menu"><button className="dropdown-item" type="button" onClick={() => window.print()}><i className="bx bx-printer me-2"></i>Print</button></div></div>
                                <div className="datatable-search"><input type="text" placeholder="Search GST Report" aria-label="Search GST Report" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></div>
                                <select className="form-select datatable-status-filter" aria-label="Filter type" value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}><option value="">All Types</option><option value="sales">Sales</option><option value="purchase">Purchase</option><option value="expense">Expense</option></select>
                            </div>
                        </div>
                        <div className="datatable-bulk-bar"><div className="datatable-bulk-copy"><strong>{filteredEntries.length} rows</strong><span>GST total Rs. {formatMoney(summary.gst)}</span></div><div className="datatable-bulk-actions"><button className="btn btn_style inActive" type="button" onClick={() => window.print()}><i className="bx bx-printer"></i><span>Print</span></button></div></div>
                        <div className="table-responsive app-table-wrap datatable-wrap">
                            <table className="table app-table align-middle">
                                <thead><tr><th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" aria-label="Select all rows" disabled /></th><th><span className="sortable-heading">Type<i className="bx bx-sort-up"></i></span></th><th><span className="sortable-heading">Date<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Reference<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Party<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Taxable<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">GST %<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">GST<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Total<i className="bx bx-sort"></i></span></th><th className="text-end">Actions</th></tr></thead>
                                <tbody>
                                    {filteredEntries.length > 0 ? filteredEntries.map((entry, index) => (
                                        <tr key={`${entry.type}-${entry.refNo}-${index}`}>
                                            <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" disabled /></td>
                                            <td style={{ textTransform: "capitalize" }}>{entry.type || "-"}</td>
                                            <td>{formatDateDisplay(entry.date)}</td>
                                            <td>{entry.refNo || "-"}</td>
                                            <td>{entry.party || "-"}</td>
                                            <td>{formatMoney(entry.taxableAmount)}</td>
                                            <td>{Number(entry.gstRate || 0).toFixed(2)}%</td>
                                            <td>{formatMoney(entry.gstAmount)}</td>
                                            <td><span className="status-badge status-primary">{formatMoney(entry.totalAmount)}</span></td>
                                            <td className="text-end"><div className="datatable-actions"><button type="button" className="btn action-btn" aria-label="Print row" onClick={() => window.print()}><i className="bx bx-printer"></i></button><button type="button" className="btn action-btn" aria-label="View"><i className="bx bx-show"></i></button></div></td>
                                        </tr>
                                    )) : (
                                        <tr className="table-state-row table-state-row-empty"><td colSpan="10"><div className="empty-state compact"><span className="empty-state-icon"><i className="bx bx-search-alt"></i></span><h6>No matching records</h6><p>Try changing filters or clearing the search field.</p></div></td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="pagination-row"><span>Showing {filteredEntries.length > 0 ? 1 : 0} to {filteredEntries.length} of {filteredEntries.length} entries</span><nav aria-label="Table pagination"><ul className="pagination pagination-sm mb-0"><li className="page-item disabled"><a className="page-link" href="#" aria-label="Previous"><i className="bx bx-chevron-left"></i></a></li><li className="page-item active"><a className="page-link" href="#">1</a></li><li className="page-item disabled"><a className="page-link" href="#" aria-label="Next"><i className="bx bx-chevron-right"></i></a></li></ul></nav></div>
                    </div>
                </section>
            </div>
        </>
    );
};

export default GSTReport;
