import React, { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";
import api from "../../app/axios";
import useAppSettings from "../../hooks/useAppSettings";
import { getApiErrorMessage } from "../../utils/api";
import { amountToWords, isMeterUnit } from "./salesPOSUtils";

const todayIso = () => new Date().toISOString().slice(0, 10);
const getPaymentModeSummary = (sale = {}) => {
    const modes = (sale.paymentBreakdown || [])
        .map((row) => String(row.mode || "").trim())
        .filter(Boolean);
    if (modes.length > 0) {
        return Array.from(new Set(modes)).join(", ");
    }
    if (sale.billType === "cashpay") return "Cash";
    if (sale.billType === "card-upi") return "Card / UPI";
    if (sale.billType === "credit") return "Credit";
    if (sale.billType === "advance") return "Advance";
    return sale.billType || "-";
};
const money = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;
const getInvoiceTitle = (sale = {}) => {
    if (sale.billingMode === "ADVANCE") return "ADVANCE BILL / TAX INVOICE";
    if (sale.billingMode === "CREDIT") return "CREDIT BILL / TAX INVOICE";
    return "TAX INVOICE";
};

const SalesInvoice = () => {
    const navigate = useNavigate();
    const appSettings = useAppSettings();
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({ customer: "", invoiceNo: "", fromDate: "", toDate: "", billingMode: "" });
    const [viewInvoice, setViewInvoice] = useState(null);
    useEffect(() => {
        const fetchSales = async () => {
            setLoading(true);
            try {
                const { data } = await api.get("/sales");
                setSales(data.data || []);
            } catch (err) {
                console.error(err);
                setError(getApiErrorMessage(err, "Failed to fetch sales"));
            } finally {
                setLoading(false);
            }
        };
        fetchSales();
    }, []);

    const filteredSales = useMemo(() => sales.filter((sale) => {
        if (filters.customer && !sale.customer?.toLowerCase().includes(filters.customer.toLowerCase())) return false;
        const invoiceSearch = filters.invoiceNo.toLowerCase();
        const searchableBillNo = [
            sale.invoiceNo,
            sale.displayBillNo,
            sale.billNo,
            sale.modeBillNo,
        ].filter(Boolean).join(" ").toLowerCase();
        if (filters.invoiceNo && !searchableBillNo.includes(invoiceSearch)) return false;
        if (filters.billingMode && String(sale.billingMode || "CASH").toUpperCase() !== filters.billingMode) return false;

        const saleDate = sale.saleDate ? new Date(sale.saleDate).setHours(0, 0, 0, 0) : null; const from = filters.fromDate ? new Date(filters.fromDate).setHours(0, 0, 0, 0) : null;
        const to = filters.toDate ? new Date(filters.toDate).setHours(23, 59, 59, 999) : null;

        if (from && saleDate && saleDate < from) return false;
        if (to && saleDate && saleDate > to) return false;
        return true;
    }), [filters, sales]);
    const modeCounts = useMemo(() => sales.reduce((acc, sale) => {
        const mode = String(sale.billingMode || "CASH").toUpperCase();
        acc[mode] = (acc[mode] || 0) + 1;
        acc.ALL += 1;
        return acc;
    }, { ALL: 0, CASH: 0, ADVANCE: 0, CREDIT: 0 }), [sales]);

    if (loading) return <div className="card app-card"><div className="card-body">Loading sales invoices...</div></div>;
    if (error) return <div className="card app-card"><div className="card-body text-danger">Error: {error}</div></div>;

    return (
        <>
            <div className="page-header card">
                <div className="card-body">
                    <div>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-2">
                                <li className="breadcrumb-item"><a href="/dashboard">Home</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Sales</li>
                            </ol>
                        </nav>
                        <p className="section-label">Sales</p>
                        <h1>Sales Invoice</h1>
                        <p className="mb-0 text-muted">Create GST invoices with customer details, item rows, tax breakup, and payment terms.</p>
                    </div>
                    <div className="page-header-actions">
                        {[
                            ["", "All", modeCounts.ALL],
                            ["CASH", "Cash", modeCounts.CASH],
                            ["ADVANCE", "Advance", modeCounts.ADVANCE],
                            ["CREDIT", "Credit", modeCounts.CREDIT],
                        ].map(([mode, label, count]) => (
                            <button
                                key={label}
                                className={`btn btn_style ${filters.billingMode === mode ? "" : "inActive"}`}
                                type="button"
                                onClick={() => setFilters((current) => ({ ...current, billingMode: mode }))}
                            >
                                <span>{label} ({count})</span>
                            </button>
                        ))}
                        <span className="metric-pill"><i className="bx bx-check-circle"></i> Ready</span>
                        <button className="btn btn_style" type="button" onClick={() => navigate("/sales/pos")}>
                            <i className="bx bx-plus"></i><span>New</span>
                        </button>
                    </div>
                </div>
            </div>

            <section className="card app-card">
                <div className="card-header app-card-header">
                    <div>
                        <h2>Entry Details</h2>
                        <p>Use consistent master data so downstream billing and reporting stay clean.</p>
                    </div>
                </div>
                <div className="card-body">
                    <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Customer</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Enter Customer"
                                value={filters.customer}
                                onChange={(event) => setFilters({ ...filters, customer: event.target.value })}
                            />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Invoice No</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Enter Invoice No"
                                value={filters.invoiceNo}
                                onChange={(event) => setFilters({ ...filters, invoiceNo: event.target.value })}
                            />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">From Date</label>
                            <input
                                type="date"
                                className="form-control"
                                value={filters.fromDate}
                                onChange={(event) => setFilters({ ...filters, fromDate: event.target.value })}
                            />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">To Date</label>
                            <input
                                type="date"
                                className="form-control"
                                value={filters.toDate}
                                onChange={(event) => setFilters({ ...filters, toDate: event.target.value })}
                            />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Billing Mode</label>
                            <select className="form-select" value={filters.billingMode} onChange={(event) => setFilters({ ...filters, billingMode: event.target.value })}>
                                <option value="">All</option>
                                <option value="CASH">Cash</option>
                                <option value="ADVANCE">Advance</option>
                                <option value="CREDIT">Credit</option>
                            </select>
                        </div>
                        <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                            <button className="btn btn_style" type="button" onClick={() => setFilters((current) => ({ ...current, fromDate: todayIso(), toDate: todayIso() }))}><i className="bx bx-calendar"></i><span>Today</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={() => setFilters({ customer: "", invoiceNo: "", fromDate: "", toDate: "", billingMode: "" })}><i className="bx bx-reset"></i><span>Clear</span></button>
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
                                    <option>10</option>
                                    <option>25</option>
                                    <option>50</option>
                                </select>
                            </label>
                            <button className="btn btn_style datatable-create" type="button" onClick={() => navigate("/sales/pos")}>
                                <i className="bx bx-plus"></i><span>Create Sales Invoice</span>
                            </button>
                        </div>
                        <div className="datatable-toolbar-end">
                            <button className="btn btn_style inActive datatable-tool-btn" type="button">
                                <i className="bx bx-filter-alt"></i><span>Filters</span>
                            </button>
                            <div className="dropdown">
                                <button className="btn btn_style inActive datatable-tool-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <i className="bx bx-columns"></i><span>Columns</span>
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
                                    <i className="bx bx-export"></i><span>Export</span>
                                </button>
                                <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                    <a className="dropdown-item" href="#"><i className="bx bx-file me-2"></i>CSV</a>
                                    <a className="dropdown-item" href="#"><i className="bx bx-spreadsheet me-2"></i>Excel</a>
                                    <a className="dropdown-item" href="#"><i className="bx bx-printer me-2"></i>Print</a>
                                </div>
                            </div>
                            <div className="datatable-search">
                                <input
                                    type="text"
                                    placeholder="Search Sales Invoice"
                                    aria-label="Search Sales Invoice"
                                    value={filters.invoiceNo}
                                    onChange={(event) => setFilters({ ...filters, invoiceNo: event.target.value })}
                                />
                            </div>
                            <select className="form-select datatable-status-filter" aria-label="Filter status" defaultValue="Invoice Status">
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
                            <button className="btn btn_style inActive" type="button"><i className="bx bx-archive"></i><span>Archive</span></button>
                            <button className="btn btn_style inActive" type="button"><i className="bx bx-export"></i><span>Export</span></button>
                            <button className="btn btn_style inActive" type="button"><i className="bx bx-trash"></i><span>Delete</span></button>
                        </div>
                    </div>

                    <div className="table-responsive app-table-wrap datatable-wrap">
                        <table className="table app-table align-middle">
                            <thead>
                                <tr>
                                    <th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" aria-label="Select all rows" /></th>
                                    <th><span className="sortable-heading">Invoice No<i className="bx bx-sort-up"></i></span></th>
                                    <th><span className="sortable-heading">Mode<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Bill No<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Date<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Customer<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Payment Mode<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Items<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Returned<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Total Amount<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Status<i className="bx bx-sort"></i></span></th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSales.length === 0 ? (
                                    <tr className="table-state-row table-state-row-empty">
                                        <td colSpan="12">
                                            <div className="empty-state compact">
                                                <span className="empty-state-icon"><i className="bx bx-search-alt"></i></span>
                                                <h6>No matching records</h6>
                                                <p>Try changing filters or clearing the search field.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredSales.map((sale) => {
                                    const paidValue = Number(sale.totalPaid ?? sale.paidAmount ?? sale.paymentSummary?.receivedAmount ?? 0);
                                    const isDue = String(sale.paymentStatus || "").toUpperCase() === "PENDING"
                                        || String(sale.paymentStatus || "").toUpperCase() === "PARTIAL"
                                        || Number(sale.creditDue || sale.paymentSummary?.balanceAmount || 0) > 0
                                        || Number(sale.totalAmount || 0) > paidValue;
                                    return (
                                        <tr key={sale._id}>
                                            <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" /></td>
                                            <td>{sale.invoiceNo || "-"}</td>
                                            <td><span className="status-badge status-primary">{sale.billingMode || "CASH"}</span></td>
                                            <td>{sale.displayBillNo || sale.billNo || "-"}</td>
                                            <td>{sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : "-"}</td>
                                            <td>{sale.customer || "-"}</td>
                                            <td>{getPaymentModeSummary(sale)}</td>
                                            <td>{sale.items?.length || 0}</td>
                                            <td>Rs. {Number(sale.totalReturnedAmount || 0).toFixed(2)}</td>
                                            <td>Rs. {Number(sale.totalAmount || 0).toFixed(2)}</td>
                                            <td><span className={`status-badge ${isDue ? "status-danger" : "status-success"}`}>{isDue ? "Due" : "Paid"}</span></td>
                                            <td className="text-end">
                                                <div className="datatable-actions">
                                                    <button type="button" className="btn action-btn" aria-label="Edit" onClick={() => navigate("/sales/pos", { state: { editSale: sale } })}>
                                                        <i className="bx bx-edit-alt"></i>
                                                    </button>
                                                    <button type="button" className="btn action-btn" aria-label="Return" onClick={() => navigate("/sales/return", { state: { saleId: sale._id } })}>
                                                        <i className="bx bx-undo"></i>
                                                    </button>
                                                    <div className="dropdown">
                                                        <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions">
                                                            <i className="bx bx-dots-vertical-rounded"></i>
                                                        </button>
                                                        <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                                            <button className="dropdown-item" type="button" onClick={() => setViewInvoice(sale)}><i className="bx bx-show me-2"></i>View Invoice</button>
                                                            <button className="dropdown-item" type="button" onClick={() => navigate("/sales/pos", { state: { editSale: sale } })}>Edit</button>
                                                            <button className="dropdown-item" type="button" onClick={() => navigate("/sales/return", { state: { saleId: sale._id } })}>Return</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="pagination-row">
                        <span>Showing {filteredSales.length === 0 ? 0 : 1} to {filteredSales.length} of {filteredSales.length} entries</span>
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
            {viewInvoice ? (
                <div className="sales-invoice-preview-modal" onClick={() => setViewInvoice(null)}>
                    <div className="sales-invoice-preview-modal__dialog" onClick={(event) => event.stopPropagation()}>
                        <div className="sales-invoice-preview-modal__header">
                            <strong>Invoice {viewInvoice.invoiceNo || viewInvoice.billNo || ""}</strong>
                            <button type="button" className="app-btn app-btn--secondary" onClick={() => setViewInvoice(null)}>Close</button>
                        </div>
                        <SalesInvoiceBillPreview sale={viewInvoice} appSettings={appSettings} />
                    </div>
                </div>
            ) : null}
        </>
    );
};

const invoiceMoney = (value) => Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const invoiceNumber = (value) => Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const SalesInvoiceBillPreview = ({ sale, appSettings }) => {
    const saleDate = new Date(sale.saleDate || Date.now());
    const printableItems = (sale.items || []).filter((item) => (
        item?.barcode || item?.itemName || Number(item?.qty || 0) > 0 || Number(item?.displayQty || 0) > 0 || Number(item?.mtrQty || 0) > 0 || Number(item?.total || 0) > 0
    ));
    const totalQty = printableItems.reduce((sum, item) => sum + Number(item.displayQty || item.qty || 0), 0);
    const gstRate = Number(sale.gstRate || 0);
    const halfGstRate = gstRate ? invoiceNumber(gstRate / 2) : "0";
    const halfGstAmount = invoiceMoney((sale.gstAmount || 0) / 2);
    const companyName = appSettings.companyName || "LVVendora";
    const tagline = appSettings.companyTagline || "Fashion & Tradition";
    const companyAddress = appSettings.companyAddress || "26/A SHANIWAR PETH KARAD.";
    const companyPhone = appSettings.companyPhone || "7020447205, 9604249177, 8208442643";
    const gstin = appSettings.gstin || appSettings.gstNo || "27AAFFL3196B1ZF";
    const dateText = saleDate.toLocaleDateString("en-GB");
    const timeText = saleDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();

    return (
        <div className="sales-invoice-preview-modal__body">
            <style>{invoicePreviewCss}</style>
            <div className="sales-invoice-sheet">
                <div className="sales-invoice-sheet__head">
                    <div className="sales-invoice-sheet__brand">
                        <LotusMark />
                        <div>
                            <div className="sales-invoice-sheet__brand-name">{companyName}</div>
                            <div className="sales-invoice-sheet__brand-sub">{tagline}</div>
                        </div>
                    </div>
                    <div className="sales-invoice-sheet__title-wrap">
                        <div className="sales-invoice-sheet__title">{getInvoiceTitle(sale)}</div>
                        <div className="sales-invoice-sheet__rule" />
                    </div>
                    <div className="sales-invoice-sheet__bill-card"><span>{sale.billingMode || "CASH"}</span><strong>{sale.displayBillNo || sale.billNo || sale.invoiceNo || "-"}</strong></div>
                </div>

                <div className="sales-invoice-sheet__info">
                    <div className="sales-invoice-sheet__shop-lines">
                        <IconLine icon="location">{companyAddress}</IconLine>
                        <IconLine icon="phone">M: {companyPhone}</IconLine>
                        <IconLine icon="gst">GSTIN: {gstin}</IconLine>
                    </div>
                    <div className="sales-invoice-sheet__date-stack">
                        <IconLine icon="calendar"><span>Date<strong>{dateText}</strong></span></IconLine>
                        <IconLine icon="clock"><span>Time<strong>{timeText}</strong></span></IconLine>
                    </div>
                </div>

                <div className="sales-invoice-sheet__customer">
                    <Icon type="customer" />
                    <span>Customer :</span>
                    <span className="sales-invoice-sheet__customer-rule">{sale.customer === "Walk-in" ? "" : sale.customer || ""}</span>
                </div>

                <div className="sales-invoice-sheet__items-frame">
                    <table className="sales-invoice-sheet__table">
                        <thead>
                            <tr>
                                <th style={{ width: 58 }}>Sr</th>
                                <th style={{ width: 92 }}>Barcode</th>
                                <th>SL Description</th>
                                <th style={{ width: 64 }}>Qty</th>
                                <th style={{ width: 74 }}>Mtrs</th>
                                <th style={{ width: 88 }}>MRP</th>
                                <th style={{ width: 88 }}>Rate</th>
                                <th style={{ width: 108 }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {printableItems.map((item, index) => {
                                const meterItem = isMeterUnit(item.unit);
                                const pcsQty = Number(item.displayQty || (meterItem ? 0 : item.qty) || 0);
                                const mtrQty = meterItem ? Number(item.mtrQty || item.qty || 0) : 0;
                                return (
                                    <tr key={item._id || `${item.barcode}-${index}`}>
                                        <td className="center">{index + 1}</td>
                                        <td className="center">{item.barcode || "-"}</td>
                                        <td className="description-cell">{item.itemName || "-"}</td>
                                        <td className="center">{pcsQty ? invoiceNumber(pcsQty) : ""}</td>
                                        <td className="center">{mtrQty ? invoiceNumber(mtrQty) : ""}</td>
                                        <td className="right">{invoiceNumber(item.mrp)}</td>
                                        <td className="right">{invoiceNumber(item.sellingRate || item.saleRate)}</td>
                                        <td className="right">{invoiceMoney(item.total)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="sales-invoice-sheet__total-band">
                    <div className="sales-invoice-sheet__total-box dark"><div className="sales-invoice-sheet__total-icon">▤</div><div><div className="sales-invoice-sheet__total-label">Total Amount</div><div className="sales-invoice-sheet__total-value">₹ {invoiceMoney(sale.subtotal || sale.totalAmount || 0)}</div></div></div>
                    <div className="sales-invoice-sheet__total-box gst"><strong>GST {gstRate}%</strong><br />(CGST @ {halfGstRate}%: ₹{halfGstAmount})<br />(SGST @ {halfGstRate}%: ₹{halfGstAmount})</div>
                    <div className="sales-invoice-sheet__total-box teal"><div className="sales-invoice-sheet__total-icon">₹</div><div><div className="sales-invoice-sheet__total-label">Net Amount</div><div className="sales-invoice-sheet__total-value">₹ {invoiceMoney(sale.totalAmount || 0)}</div></div></div>
                </div>

                <div className="sales-invoice-sheet__meta-band">
                    <div className="sales-invoice-sheet__meta-panel"><Icon type="bag" /><div><div className="sales-invoice-sheet__meta-title">Total Qty</div><div className="sales-invoice-sheet__meta-big">{invoiceNumber(totalQty)}</div></div></div>
                    <div className="sales-invoice-sheet__meta-panel"><div><div className="sales-invoice-sheet__meta-title">Amount In Words</div><div className="sales-invoice-sheet__words">{amountToWords(sale.totalAmount || 0).toUpperCase()}</div></div></div>
                    <div className="sales-invoice-sheet__meta-panel qr"><div className="sales-invoice-sheet__meta-title">Scan To Pay</div><QRCodeSVG value={JSON.stringify({ billNo: sale.billNo, invoiceNo: sale.invoiceNo, totalAmount: sale.totalAmount })} size={92} /></div>
                </div>
                <div className="sales-invoice-sheet__bottom"><span><Icon type="bill" /> NO EXCHANGE NO RETURN</span><span>Powered by <strong>LVVendora</strong></span></div>
                <div className="sales-invoice-sheet__quote"><span>“</span><p>ekda ivaklaolaa maala prt Gaotlaa jaaNaar naahl.<br />AapNa Gaotlaolyaa maalavar Aamhl ksalahI ga^rnTI doj Sakt naahl</p><span>”</span></div>
            </div>
        </div>
    );
};

const LotusMark = () => (
    <svg className="sales-invoice-sheet__lotus" viewBox="0 0 100 100" aria-hidden="true">
        <g fill="none" stroke="#d08200" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M50 11c12 17 12 30 0 45-12-15-12-28 0-45z" />
            <path d="M31 21c15 9 23 20 19 35-16-6-23-18-19-35z" />
            <path d="M69 21c-15 9-23 20-19 35 16-6 23-18 19-35z" />
            <path d="M18 38c18 1 29 8 32 24-17 1-28-8-32-24z" />
            <path d="M82 38c-18 1-29 8-32 24 17 1 28-8 32-24z" />
            <path d="M14 62c21-3 34 1 36 16-19 6-31 1-36-16z" />
            <path d="M86 62c-21-3-34 1-36 16 19 6 31 1 36-16z" />
            <path d="M24 83h52" />
        </g>
    </svg>
);

const IconLine = ({ icon, children }) => (
    <div className="sales-invoice-sheet__icon-line"><Icon type={icon} /><span>{children}</span></div>
);

const Icon = ({ type }) => {
    const paths = {
        location: "M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z",
        phone: "M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.61 21 3 13.39 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.24.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z",
        gst: "M20 8h-3V4H7v4H4l-2 4 2 8h16l2-8-2-4zM9 6h6v2H9V6zm7 10h-3v3h-2v-3H8v-2h3v-3h2v3h3v2z",
        calendar: "M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2L2 6a2 2 0 0 1 2-2h3V2zm13 8H4v10h16V10z",
        clock: "M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22zm1 11h5v2h-7V6h2v6z",
        customer: "M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5C21 16.5 17 14 12 14z",
        bag: "M7 6V4a5 5 0 0 1 10 0v2h3v16H4V6h3zm2 0h6V4a3 3 0 0 0-6 0v2z",
        bill: "M3 5h14v10H3V5zm16 4h2v10H7v-2h12V9z",
    };
    return <span className="sales-invoice-sheet__icon"><svg viewBox="0 0 24 24"><path d={paths[type] || paths.bill} /></svg></span>;
};

const invoicePreviewCss = `
.sales-invoice-preview-modal{position:fixed;inset:0;z-index:1200;display:flex;align-items:flex-start;justify-content:center;padding:1.25rem;background:rgba(67,89,113,.55);overflow:auto}
.sales-invoice-preview-modal__dialog{width:min(100%,920px);background:#fff;border:1px solid rgba(217,222,227,.95);border-radius:8px;box-shadow:0 1rem 2.5rem rgba(35,52,70,.28)}
.sales-invoice-preview-modal__header{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.25rem;border-bottom:1px solid rgba(217,222,227,.75);color:#435971}
.sales-invoice-preview-modal__body{padding:16px;background:#f5f7fb;overflow:auto}
.sales-invoice-sheet{width:820px;margin:0 auto;border:1.5px solid #061735;border-radius:17px;padding:12px;background:#fff;color:#020d28;font-family:Arial,Helvetica,sans-serif;overflow:hidden}
.sales-invoice-sheet__head{display:grid;grid-template-columns:270px 1fr 146px;gap:16px;align-items:start}
.sales-invoice-sheet__brand{display:grid;grid-template-columns:62px 1fr;gap:8px;align-items:center}.sales-invoice-sheet__lotus{width:62px;height:62px}
.sales-invoice-sheet__brand-name{font-size:26px;font-weight:900;text-transform:uppercase;letter-spacing:-.01em;line-height:1}.sales-invoice-sheet__brand-sub{margin-top:6px;color:#d08200;font-size:10px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}
.sales-invoice-sheet__title-wrap{text-align:center;padding-top:10px}.sales-invoice-sheet__title{font-size:36px;font-weight:900;letter-spacing:.02em;line-height:1}.sales-invoice-sheet__rule{position:relative;width:200px;height:2px;margin:13px auto 0;background:#d08200}.sales-invoice-sheet__rule:before{content:"";position:absolute;left:50%;top:50%;width:15px;height:15px;border:3px solid #d08200;border-radius:50%;transform:translate(-50%,-50%);background:#fff}
.sales-invoice-sheet__bill-card{padding:10px 8px 11px;border-radius:8px;background:linear-gradient(135deg,#020d28,#08204c);color:#fff;text-align:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}.sales-invoice-sheet__bill-card span{display:block;font-size:15px;font-weight:800;text-transform:uppercase}.sales-invoice-sheet__bill-card strong{display:block;margin-top:4px;font-size:34px;line-height:1}
.sales-invoice-sheet__info{display:grid;grid-template-columns:1fr 156px;gap:16px;margin-top:24px}.sales-invoice-sheet__shop-lines{display:grid;gap:14px;font-size:16px}.sales-invoice-sheet__date-stack{display:grid;gap:22px;font-size:15px}
.sales-invoice-sheet__icon-line{display:grid;grid-template-columns:28px 1fr;align-items:center;gap:9px}.sales-invoice-sheet__icon{width:23px;height:23px;display:inline-grid;place-items:center}.sales-invoice-sheet__icon svg{width:23px;height:23px;fill:#020d28}.sales-invoice-sheet__date-stack strong{display:block;margin-top:2px;font-size:18px}
.sales-invoice-sheet__customer{display:grid;grid-template-columns:34px 96px 1fr;align-items:end;gap:8px;margin:27px 0 16px;font-size:16px;font-weight:800}.sales-invoice-sheet__customer-rule{min-height:20px;border-bottom:2px solid #1a2742}
.sales-invoice-sheet__items-frame{min-height:568px;border-left:1px solid #d8dde5;border-right:1px solid #d8dde5}.sales-invoice-sheet__table{width:100%;border-collapse:collapse;overflow:hidden}.sales-invoice-sheet__table th{padding:11px 8px;background:linear-gradient(135deg,#020d28,#08204c);color:#fff;font-size:14px;text-align:center;border-right:1px solid rgba(255,255,255,.38);line-height:1.15}.sales-invoice-sheet__table th:first-child{border-top-left-radius:7px}.sales-invoice-sheet__table th:last-child{border-top-right-radius:7px;border-right:0}.sales-invoice-sheet__table td{height:35px;padding:9px 10px;border:1px solid #d8dde5;border-top:0;font-size:14px;vertical-align:middle}.center{text-align:center}.right{text-align:right}.description-cell{text-transform:uppercase;font-weight:500}
.sales-invoice-sheet__total-band{display:grid;grid-template-columns:1fr 1.1fr 1.24fr}.sales-invoice-sheet__total-box{min-height:79px;display:flex;align-items:center;justify-content:center;gap:16px;padding:10px;border:1px solid #d8dde5;border-top:0}.sales-invoice-sheet__total-box.dark{justify-content:flex-start;padding-left:22px;background:linear-gradient(135deg,#020d28,#08204c);color:#fff}.sales-invoice-sheet__total-box.teal{justify-content:flex-start;padding-left:22px;background:linear-gradient(135deg,#087b73,#119985);color:#fff}.sales-invoice-sheet__total-box.gst{text-align:center;font-size:14px;line-height:1.8}.sales-invoice-sheet__total-icon{width:48px;height:48px;border:2px solid currentColor;border-radius:50%;display:grid;place-items:center;font-size:25px;font-weight:900}.sales-invoice-sheet__total-label{font-size:13px;font-weight:900;text-transform:uppercase}.sales-invoice-sheet__total-value{margin-top:7px;font-size:27px;font-weight:900;letter-spacing:.03em}
.sales-invoice-sheet__meta-band{display:grid;grid-template-columns:238px 1fr 164px;min-height:83px;border:1px solid #d8dde5;border-top:0;border-radius:0 0 7px 7px;overflow:hidden}.sales-invoice-sheet__meta-panel{display:flex;align-items:center;gap:14px;padding:12px 18px}.sales-invoice-sheet__meta-panel+.sales-invoice-sheet__meta-panel{border-left:1px solid #d8dde5}.sales-invoice-sheet__meta-title{font-size:14px;font-weight:900;text-transform:uppercase}.sales-invoice-sheet__meta-big{margin-top:6px;font-size:25px;font-weight:900}.sales-invoice-sheet__words{font-size:16px;line-height:1.45;text-transform:uppercase}.sales-invoice-sheet__meta-panel.qr{flex-direction:column;justify-content:center;text-align:center;gap:4px}
.sales-invoice-sheet__bottom{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px 10px 9px;border-bottom:1px solid #d8dde5;font-size:16px;font-weight:900}.sales-invoice-sheet__bottom strong{color:#087b73}.sales-invoice-sheet__quote{display:grid;grid-template-columns:42px 1fr 42px;align-items:center;gap:10px;padding:11px 14px;border:1px solid #8abac4;border-radius:10px;color:#020d28;text-align:center;font-size:16px}.sales-invoice-sheet__quote span{color:#087b73;font-size:36px;font-weight:900;line-height:1}.sales-invoice-sheet__quote p{margin:0}
@media(max-width:900px){.sales-invoice-preview-modal__body{padding:10px}.sales-invoice-sheet{transform:scale(.78);transform-origin:top left;margin-right:-180px;margin-bottom:-220px}}
`;

const styles = {
    page: { display: "grid", gap: 20 },
    hero: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        padding: 24,
        borderRadius: 28,
        background: "var(--hero-gradient-soft)",
        border: "1px solid var(--panel-border-soft)",
    },
    eyebrow: {
        color: "var(--text-soft)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: 12,
        fontWeight: 800,
    },
    title: {
        margin: "8px 0 10px",
        fontSize: "1.95rem",
        lineHeight: 1.08,
    },
    subtle: { color: "var(--text-soft)", margin: 0 },
    primaryButton: {
        border: "none",
        borderRadius: 16,
        padding: "12px 16px",
        background: "var(--button-primary)",
        color: "var(--button-primary-text)",
        fontWeight: 800,
        cursor: "pointer",
    },
    filterCard: { padding: 16 },
    filterGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 12,
    },
    input: {
        width: "100%",
        padding: "12px 14px",
        borderRadius: 14,
        border: "1px solid var(--line)",
        background: "var(--field-bg)",
        color: "var(--field-text)",
    },
    tableCard: { padding: 14 },
    rowButton: {
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "10px 12px",
        background: "var(--button-secondary-bg)",
        color: "var(--button-secondary-text)",
        fontWeight: 800,
        cursor: "pointer",
        marginRight: 8,
    },
    emptyCell: {
        textAlign: "center",
        padding: "28px 14px",
        color: "var(--text-soft)",
    },
};

export default SalesInvoice;
