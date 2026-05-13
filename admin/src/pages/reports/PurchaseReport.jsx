import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchPurchaseReport } from "../../services/reportService";
import { exportReportToPDF } from "../../utils/pdfExport";
import useAppSettings from "../../hooks/useAppSettings";

const PurchaseReport = () => {
    const appSettings = useAppSettings();
    const navigate = useNavigate();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        fromDate: "",
        toDate: "",
        grn: "",
        billNo: "",
        party: "",
        receiveStatus: "",
        search: "",
        status: "",
    });
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
        fetchPurchaseReport()
            .then((data) => setReport(data))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const purchases = Array.isArray(report?.data) ? report.data : [];
    const filteredPurchases = useMemo(() => {
        const search = filters.search.trim().toLowerCase();
        return purchases.filter((bill) => {
            const billDate = bill.billDate ? String(bill.billDate).slice(0, 10) : "";
            const party = String(bill.party?.name || bill.party || "").toLowerCase();
            const receiveStatus = bill.received ? "Received" : "Pending";
            const haystack = [
                bill.grnNo,
                bill.billNo,
                billDate,
                party,
                receiveStatus,
                bill.labelsPrinted ? "Printed" : "Pending",
                bill.finalTotal,
                bill.billAmount,
            ].join(" ").toLowerCase();

            if (filters.fromDate && billDate && billDate < filters.fromDate) return false;
            if (filters.toDate && billDate && billDate > filters.toDate) return false;
            if (filters.grn && !String(bill.grnNo || "").toLowerCase().includes(filters.grn.toLowerCase())) return false;
            if (filters.billNo && !String(bill.billNo || "").toLowerCase().includes(filters.billNo.toLowerCase())) return false;
            if (filters.party && !party.includes(filters.party.toLowerCase())) return false;
            if (filters.receiveStatus && receiveStatus !== filters.receiveStatus) return false;
            if (filters.status && filters.status !== "Invoice Status" && !haystack.includes(filters.status.toLowerCase())) return false;
            if (search && !haystack.includes(search)) return false;
            return true;
        });
    }, [filters, purchases]);
    const visiblePurchases = filteredPurchases.slice(0, pageSize);
    const exportRows = (format) => exportRowsToCsv(filteredPurchases, `purchase-report.${format === "excel" ? "xls" : "csv"}`);
    const clearFilters = () => setFilters({ fromDate: "", toDate: "", grn: "", billNo: "", party: "", receiveStatus: "", search: "", status: "" });

    if (loading) return <div style={{ padding: 24 }}>Loading purchase report...</div>;
    if (error) return <div style={{ padding: 24, color: "#b42318" }}>Error: {error}</div>;

    return (
        <div className="container-fluid p-0 flex-grow-1 purchase-report-page">
            <div className="page-header card">
                <div className="card-body">
                    <div>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-2">
                                <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
                                <li className="breadcrumb-item active" aria-current="page">Reports</li>
                            </ol>
                        </nav>
                        <p className="section-label">Reports</p>
                        <h1>Purchase Report</h1>
                        <p className="mb-0 text-muted">
                            Analyze supplier purchases by GRN, bill, item, category, GST rate, and posting status.
                        </p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-check-circle" /> Ready</span>
                        <button className="btn btn_style" type="button" onClick={() => exportReportToPDF({ purchases }, "Purchase", appSettings)}>
                            <i className="bx bx-export" /><span>Export PDF</span>
                        </button>
                    </div>
                </div>
            </div>

            <section className="card app-card">
                <div className="card-header app-card-header">
                    <div>
                        <h2>Report Filters</h2>
                        <p>Use consistent master data so downstream billing and reporting stay clean.</p>
                    </div>
                </div>
                <div className="card-body">
                    <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label" htmlFor="purchase-report-from-date">From Date</label>
                            <input type="date" className="form-control" id="purchase-report-from-date" value={filters.fromDate} onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))} />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label" htmlFor="purchase-report-to-date">To Date</label>
                            <input type="date" className="form-control" id="purchase-report-to-date" value={filters.toDate} onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))} />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label" htmlFor="purchase-report-grn">GRN</label>
                            <input type="text" className="form-control" id="purchase-report-grn" placeholder="Enter GRN" value={filters.grn} onChange={(event) => setFilters((current) => ({ ...current, grn: event.target.value }))} />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label" htmlFor="purchase-report-bill-no">Bill No</label>
                            <input type="text" className="form-control" id="purchase-report-bill-no" placeholder="Enter Bill No" value={filters.billNo} onChange={(event) => setFilters((current) => ({ ...current, billNo: event.target.value }))} />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label" htmlFor="purchase-report-party">Party</label>
                            <input type="text" className="form-control" id="purchase-report-party" placeholder="Enter Party" value={filters.party} onChange={(event) => setFilters((current) => ({ ...current, party: event.target.value }))} />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label" htmlFor="purchase-report-receive-status">Receive Status</label>
                            <select className="form-select" id="purchase-report-receive-status" value={filters.receiveStatus} onChange={(event) => setFilters((current) => ({ ...current, receiveStatus: event.target.value }))}>
                                <option value="">Select Receive Status</option>
                                <option>Received</option>
                                <option>Pending</option>
                            </select>
                        </div>
                        <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                            <button className="btn btn_style" type="submit"><i className="bx bx-search" /><span>Apply</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={clearFilters}><i className="bx bx-reset" /><span>Clear</span></button>
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
                                <select className="form-select form-select-sm datatable-page-size" aria-label="Rows per page" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                </select>
                            </label>
                            <button className="btn btn_style datatable-create" type="button" onClick={() => navigate("/purchase/new")}>
                                <i className="bx bx-plus" /><span>Create Purchase</span>
                            </button>
                        </div>
                        <div className="datatable-toolbar-end">
                            <button className="btn btn_style inActive datatable-tool-btn" type="button" onClick={clearFilters}>
                                <i className="bx bx-filter-alt" /><span>Filters</span>
                            </button>
                            <div className="dropdown">
                                <button className="btn btn_style inActive datatable-tool-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <i className="bx bx-columns" /><span>Columns</span>
                                </button>
                                <div className="dropdown-menu dropdown-menu-end datatable-column-menu">
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" defaultChecked /><span>Reference</span></label>
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" defaultChecked /><span>Date</span></label>
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" defaultChecked /><span>Party</span></label>
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" defaultChecked /><span>Amount</span></label>
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" /><span>Status</span></label>
                                </div>
                            </div>
                            <div className="dropdown">
                                <button className="btn btn_style inActive datatable-tool-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <i className="bx bx-export" /><span>Export</span>
                                </button>
                                <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                    <button className="dropdown-item" type="button" onClick={() => exportRows("csv")}><i className="bx bx-file me-2" />CSV</button>
                                    <button className="dropdown-item" type="button" onClick={() => exportRows("excel")}><i className="bx bx-spreadsheet me-2" />Excel</button>
                                    <button className="dropdown-item" type="button" onClick={() => window.print()}><i className="bx bx-printer me-2" />Print</button>
                                    <button className="dropdown-item" type="button" onClick={() => exportReportToPDF({ purchases }, "Purchase", appSettings)}><i className="bx bx-file-blank me-2" />PDF</button>
                                </div>
                            </div>
                            <div className="datatable-search">
                                <input type="text" placeholder="Search Purchase Report" aria-label="Search Purchase Report" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
                            </div>
                            <select className="form-select datatable-status-filter" aria-label="Filter status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                                <option>Invoice Status</option>
                                <option>Active</option>
                                <option>Paid</option>
                                <option>Pending</option>
                                <option>Received</option>
                            </select>
                        </div>
                    </div>

                    <div className="datatable-bulk-bar">
                        <div className="datatable-bulk-copy">
                            <strong>0 selected</strong>
                            <span>Choose rows to unlock bulk actions</span>
                        </div>
                        <div className="datatable-bulk-actions">
                            <button className="btn btn_style inActive" type="button" disabled><i className="bx bx-archive" /><span>Archive</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={() => exportRows("csv")}><i className="bx bx-export" /><span>Export</span></button>
                            <button className="btn btn_style inActive" type="button" disabled><i className="bx bx-trash" /><span>Delete</span></button>
                        </div>
                    </div>

                    <div className="table-responsive app-table-wrap datatable-wrap">
                        <table className="table app-table align-middle">
                            <thead>
                                <tr>
                                    <th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" aria-label="Select all rows" /></th>
                                    <th><span className="sortable-heading">GRN<i className="bx bx-sort-up" /></span></th>
                                    <th><span className="sortable-heading">Bill No<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">Party<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">Date<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">Receive<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">Labels<i className="bx bx-sort" /></span></th>
                                    <th><span className="sortable-heading">Total<i className="bx bx-sort" /></span></th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visiblePurchases.map((bill) => (
                                    <tr key={bill._id}>
                                        <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" /></td>
                                        <td>{bill.grnNo}</td>
                                        <td>{bill.billNo}</td>
                                        <td>{bill.party || "-"}</td>
                                        <td>{bill.billDate ? new Date(bill.billDate).toLocaleDateString() : "-"}</td>
                                        <td>{bill.received ? "Received" : "Pending"}</td>
                                        <td>{bill.labelsPrinted ? "Printed" : "Pending"}</td>
                                        <td><span className="status-badge status-primary">{Number(bill.finalTotal || bill.billAmount || 0).toFixed(2)}</span></td>
                                        <td className="text-end">
                                            <div className="datatable-actions">
                                                <button type="button" className="btn action-btn" aria-label="Delete" disabled><i className="bx bx-trash" /></button>
                                                <button type="button" className="btn action-btn" aria-label="View" onClick={() => navigate(`/purchase/edit/${bill._id}`)}><i className="bx bx-show" /></button>
                                                <div className="dropdown">
                                                    <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions">
                                                        <i className="bx bx-dots-vertical-rounded" />
                                                    </button>
                                                    <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                                        <button className="dropdown-item" type="button" onClick={() => exportReportToPDF({ purchases: [bill] }, `Purchase ${bill.grnNo || bill.billNo || ""}`, appSettings)}>Download</button>
                                                        <button className="dropdown-item" type="button" onClick={() => navigate(`/purchase/edit/${bill._id}`)}>Edit</button>
                                                        <button className="dropdown-item" type="button" onClick={() => navigate("/purchase/new")}>Duplicate</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredPurchases.length === 0 ? (
                                    <tr className="table-state-row table-state-row-empty">
                                        <td colSpan="9">
                                            <div className="empty-state compact">
                                                <span className="empty-state-icon"><i className="bx bx-search-alt" /></span>
                                                <h6>No matching records</h6>
                                                <p>Try changing filters or clearing the search field.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>

                    <div className="pagination-row">
                        <span>Showing {filteredPurchases.length ? 1 : 0} to {Math.min(filteredPurchases.length, pageSize)} of {filteredPurchases.length} entries</span>
                        <nav aria-label="Table pagination">
                            <ul className="pagination pagination-sm mb-0">
                                <li className="page-item disabled"><button className="page-link" type="button" aria-label="Previous" disabled><i className="bx bx-chevron-left" /></button></li>
                                <li className="page-item active"><button className="page-link" type="button" disabled>1</button></li>
                                <li className="page-item disabled"><button className="page-link" type="button" aria-label="Next" disabled><i className="bx bx-chevron-right" /></button></li>
                            </ul>
                        </nav>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default PurchaseReport;

function exportRowsToCsv(rows, filename) {
    const columns = ["GRN", "Bill No", "Party", "Date", "Receive", "Labels", "Total"];
    const body = rows.map((bill) => [
        bill.grnNo || "",
        bill.billNo || "",
        bill.party?.name || bill.party || "",
        bill.billDate ? new Date(bill.billDate).toLocaleDateString() : "",
        bill.received ? "Received" : "Pending",
        bill.labelsPrinted ? "Printed" : "Pending",
        Number(bill.finalTotal || bill.billAmount || 0).toFixed(2),
    ]);
    downloadCsv([columns, ...body], filename);
}

function downloadCsv(rows, filename) {
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}
