import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    fetchCashSalesAdjustmentHistory,
    fetchSalesReport,
    previewCashSalesAdjustment,
    processCashSalesAdjustment,
    reverseCashSalesAdjustment,
} from "../../services/reportService";
import { exportReportToPDF } from "../../utils/pdfExport";
import useAppSettings from "../../hooks/useAppSettings";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ADJUSTMENT_MODES = [
    "REMOVE_FIXED_ITEMS",
    "REMOVE_BARCODE_AND_FIXED_ITEMS",
    "REMOVE_CTRL_K_ITEMS",
    "CHANGE_FIXED_ITEM",
    "DOWN_5R_TO_5",
];

const formatLocalDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const getSaleDateParts = (sale) => {
    const date = sale.saleDate ? new Date(sale.saleDate) : null;
    if (!date || Number.isNaN(date.getTime())) {
        return { year: "Unmapped", month: "", monthIndex: -1, day: "", dateLabel: "-" };
    }
    const year = String(date.getFullYear());
    const monthIndex = date.getMonth();
    const month = String(monthIndex + 1).padStart(2, "0");
    const day = formatLocalDateKey(date);
    return {
        year,
        month,
        monthIndex,
        day,
        dateLabel: date.toLocaleDateString("en-IN"),
    };
};

const getSaleAmount = (sale) => Number(sale.totalAmount || 0);
const getReturnAmount = (sale) => Number(sale.totalReturnedAmount || 0);
const getGstAmount = (sale) => Number(sale.gstAmount || 0);
const getItemCount = (sale) => sale.items?.length || 0;
const getCashSaleAmount = (sale) => {
    const cashBreakdown = (sale.paymentBreakdown || [])
        .filter((row) => String(row.mode || "").toLowerCase() === "cash")
        .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    if (cashBreakdown > 0) return cashBreakdown;
    return sale.billType === "cashpay" ? Number(sale.totalAmount || 0) : 0;
};
const getAdjustmentDateKey = (adjustment) => {
    const date = adjustment?.date ? new Date(adjustment.date) : null;
    return date && !Number.isNaN(date.getTime()) ? formatLocalDateKey(date) : "";
};
const getAdjustmentAmount = (adjustment) => Number(adjustment?.amountToReduce || 0);
const getAdjustmentTotalForSales = (sales, adjustments = []) => {
    const dateKeys = new Set(sales.map((sale) => getSaleDateParts(sale).day).filter(Boolean));
    return adjustments.reduce((sum, adjustment) => {
        if (adjustment.status && adjustment.status !== "PROCESSED") return sum;
        return dateKeys.has(getAdjustmentDateKey(adjustment)) ? sum + getAdjustmentAmount(adjustment) : sum;
    }, 0);
};

const createSummaryRow = ({ id, label, level, sortValue, sales, adjustments = [] }) => {
    const adjustmentAmount = getAdjustmentTotalForSales(sales, adjustments);
    const grossTotal = sales.reduce((sum, sale) => sum + getSaleAmount(sale), 0);
    const grossCashSales = sales.reduce((sum, sale) => sum + getCashSaleAmount(sale), 0);
    return {
        id,
        label,
        level,
        sortValue,
        invoiceCount: sales.length,
        itemCount: sales.reduce((sum, sale) => sum + getItemCount(sale), 0),
        gstAmount: sales.reduce((sum, sale) => sum + getGstAmount(sale), 0),
        returnAmount: sales.reduce((sum, sale) => sum + getReturnAmount(sale), 0),
        adjustmentAmount,
        originalTotalAmount: grossTotal,
        totalAmount: Math.max(grossTotal - adjustmentAmount, 0),
        cashSalesAmount: Math.max(grossCashSales - adjustmentAmount, 0),
    };
};

const groupSales = (sales, keyFn, rowFn) => {
    const grouped = sales.reduce((acc, sale) => {
        const key = keyFn(sale);
        if (!acc[key]) acc[key] = [];
        acc[key].push(sale);
        return acc;
    }, {});
    return Object.entries(grouped)
        .map(([key, rows]) => rowFn(key, rows))
        .sort((a, b) => String(b.sortValue).localeCompare(String(a.sortValue)));
};

const SalesReport = () => {
    const appSettings = useAppSettings();
    const navigate = useNavigate();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        fromDate: "",
        toDate: "",
        customer: "",
        invoiceNo: "",
        paymentMode: "",
        billingMode: "",
        search: "",
        status: "",
    });
    const [pageSize, setPageSize] = useState(10);
    const [drill, setDrill] = useState({ level: "year", year: "", month: "", day: "" });
    const [cashAdjustment, setCashAdjustment] = useState({
        date: "",
        cashSalesAmount: "",
        amountToReduce: "",
        saleRateFrom: "",
        saleRateTo: "",
        mode: "REMOVE_FIXED_ITEMS",
    });
    const [cashAdjustmentPreview, setCashAdjustmentPreview] = useState(null);
    const [cashAdjustmentHistory, setCashAdjustmentHistory] = useState([]);
    const [cashAdjustmentStatus, setCashAdjustmentStatus] = useState({ loading: false, error: "", success: "" });
    const [cashAdjustmentOpen, setCashAdjustmentOpen] = useState(false);
    const isSuperadmin = localStorage.getItem("role") === "superadmin";

    useEffect(() => {
        fetchSalesReport()
            .then((data) => setReport(data))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!isSuperadmin) return;
        fetchCashSalesAdjustmentHistory()
            .then((data) => setCashAdjustmentHistory(data.data || []))
            .catch(() => setCashAdjustmentHistory([]));
    }, [isSuperadmin]);

    useEffect(() => {
        if (!cashAdjustmentOpen || !cashAdjustment.date) return undefined;
        let active = true;
        previewCashSalesAdjustment({
            date: cashAdjustment.date,
            amountToReduce: Number(cashAdjustment.amountToReduce || 0),
            saleRateFrom: Number(cashAdjustment.saleRateFrom || 0),
            saleRateTo: Number(cashAdjustment.saleRateTo || 0),
            mode: cashAdjustment.mode,
        })
            .then((data) => {
                if (!active) return;
                setCashAdjustmentPreview(data.data);
                setCashAdjustment((current) => ({
                    ...current,
                    cashSalesAmount: Number(data.data?.cashSalesAmountBefore || 0).toFixed(2),
                }));
            })
            .catch((err) => {
                if (!active) return;
                setCashAdjustmentPreview(err.data || null);
                setCashAdjustment((current) => ({ ...current, cashSalesAmount: "" }));
                setCashAdjustmentStatus({ loading: false, error: err.message || "Failed to fetch cash sales amount for this date.", success: "" });
            });
        return () => {
            active = false;
        };
    }, [cashAdjustment.date, cashAdjustmentOpen]);

    const sales = Array.isArray(report?.data) ? report.data : [];
    const cashAdjustments = Array.isArray(report?.cashAdjustments) ? report.cashAdjustments : cashAdjustmentHistory.filter((row) => row.status === "PROCESSED");
    const filteredSales = useMemo(() => {
        const search = filters.search.trim().toLowerCase();
        return sales.filter((sale) => {
            const saleDate = sale.saleDate ? getSaleDateParts(sale).day : "";
            const paymentModes = (sale.paymentBreakdown || []).map((row) => String(row.mode || "").toLowerCase());
            const haystack = [
                sale.invoiceNo,
                saleDate,
                sale.customer || "Walk-in Customer",
                sale.items?.length || 0,
                sale.gstAmount,
                sale.totalReturnedAmount,
                sale.totalAmount,
                paymentModes.join(" "),
            ].join(" ").toLowerCase();

            if (filters.fromDate && saleDate && saleDate < filters.fromDate) return false;
            if (filters.toDate && saleDate && saleDate > filters.toDate) return false;
            if (filters.customer && !String(sale.customer || "Walk-in Customer").toLowerCase().includes(filters.customer.toLowerCase())) return false;
            if (filters.invoiceNo && !String(sale.invoiceNo || "").toLowerCase().includes(filters.invoiceNo.toLowerCase())) return false;
            if (filters.paymentMode && !paymentModes.includes(filters.paymentMode.toLowerCase())) return false;
            if (filters.billingMode && String(sale.billingMode || "CASH").toUpperCase() !== filters.billingMode) return false;
            if (filters.status && filters.status !== "Invoice Status" && !haystack.includes(filters.status.toLowerCase())) return false;
            if (search && !haystack.includes(search)) return false;
            return true;
        });
    }, [filters, sales]);
    const drillRows = useMemo(() => {
        if (drill.level === "year") {
            return groupSales(
                filteredSales,
                (sale) => getSaleDateParts(sale).year,
                (year, rows) => createSummaryRow({ id: `year-${year}`, label: year, level: "year", sortValue: year, sales: rows, adjustments: cashAdjustments }),
            );
        }

        if (drill.level === "month") {
            const rowsForYear = filteredSales.filter((sale) => getSaleDateParts(sale).year === drill.year);
            return groupSales(
                rowsForYear,
                (sale) => getSaleDateParts(sale).month,
                (month, rows) => {
                    const parts = getSaleDateParts(rows[0]);
                    return createSummaryRow({
                        id: `month-${drill.year}-${month}`,
                        label: `${MONTH_NAMES[parts.monthIndex] || month} ${drill.year}`,
                        level: "month",
                        sortValue: `${drill.year}-${month}`,
                        sales: rows,
                        adjustments: cashAdjustments,
                    });
                },
            );
        }

        if (drill.level === "day") {
            const rowsForMonth = filteredSales.filter((sale) => {
                const parts = getSaleDateParts(sale);
                return parts.year === drill.year && parts.month === drill.month;
            });
            return groupSales(
                rowsForMonth,
                (sale) => getSaleDateParts(sale).day,
                (day, rows) => createSummaryRow({
                    id: `day-${day}`,
                    label: getSaleDateParts(rows[0]).dateLabel,
                    level: "day",
                    sortValue: day,
                    sales: rows,
                    adjustments: cashAdjustments,
                }),
            );
        }

        return filteredSales
            .filter((sale) => getSaleDateParts(sale).day === drill.day)
            .sort((a, b) => new Date(b.saleDate || 0) - new Date(a.saleDate || 0));
    }, [cashAdjustments, drill, filteredSales]);
    const visibleRows = drillRows.slice(0, pageSize);
    const totalAdjustments = getAdjustmentTotalForSales(filteredSales, cashAdjustments);
    const totalSales = Math.max(filteredSales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0) - totalAdjustments, 0);
    const totalReturns = filteredSales.reduce((sum, sale) => sum + Number(sale.totalReturnedAmount || 0), 0);
    const byCustomer = Object.entries(filteredSales.reduce((acc, sale) => {
        const customer = sale.customer || "Walk-in Customer";
        acc[customer] = (acc[customer] || 0) + Number(sale.totalAmount || 0);
        return acc;
    }, {}))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    const byMode = Object.entries(filteredSales.reduce((acc, sale) => {
        (sale.paymentBreakdown || []).forEach((row) => {
            const mode = String(row.mode || "other").toUpperCase();
            acc[mode] = (acc[mode] || 0) + Number(row.amount || 0);
        });
        return acc;
    }, {})).map(([label, value]) => [label, label === "CASH" ? Math.max(value - totalAdjustments, 0) : value]);
    const clearFilters = () => setFilters({ fromDate: "", toDate: "", customer: "", invoiceNo: "", paymentMode: "", billingMode: "", search: "", status: "" });
    const exportRows = (format) => exportSalesToCsv(filteredSales, `sales-report.${format === "excel" ? "xls" : "csv"}`);
    const drillTitle = drill.level === "year"
        ? "Yearly Sales"
        : drill.level === "month"
            ? `Monthly Sales - ${drill.year}`
            : drill.level === "day"
                ? `Datewise Sales - ${MONTH_NAMES[Number(drill.month) - 1] || drill.month} ${drill.year}`
                : `Billwise Sales - ${drill.day}`;
    const drillHint = drill.level === "bill" ? "Double-click no longer drills further. Use the action button to open the bill." : "Double-click a row to drill down.";
    const goBack = () => {
        setDrill((current) => {
            if (current.level === "bill") return { level: "day", year: current.year, month: current.month, day: "" };
            if (current.level === "day") return { level: "month", year: current.year, month: "", day: "" };
            if (current.level === "month") return { level: "year", year: "", month: "", day: "" };
            return current;
        });
    };
    const openSummaryRow = (row) => {
        if (drill.level === "year") {
            setDrill({ level: "month", year: row.sortValue, month: "", day: "" });
            return;
        }
        if (drill.level === "month") {
            const [, month] = String(row.sortValue).split("-");
            setDrill({ level: "day", year: drill.year, month, day: "" });
            return;
        }
        if (drill.level === "day") {
            setDrill({ level: "bill", year: drill.year, month: drill.month, day: row.sortValue });
        }
    };
    const openCashAdjustment = (row = null) => {
        const selectedRow = row || (drill.level === "day" ? visibleRows[0] : null);
        setCashAdjustment({
            date: selectedRow?.sortValue || filters.toDate || filters.fromDate || formatLocalDateKey(new Date()),
            cashSalesAmount: selectedRow ? Number(selectedRow.cashSalesAmount || 0).toFixed(2) : "",
            amountToReduce: "",
            saleRateFrom: "",
            saleRateTo: "",
            mode: "REMOVE_FIXED_ITEMS",
        });
        setCashAdjustmentPreview(null);
        setCashAdjustmentStatus({ loading: false, error: "", success: "" });
        setCashAdjustmentOpen(true);
    };
    const buildCashAdjustmentPayload = () => ({
        date: cashAdjustment.date,
        amountToReduce: Number(cashAdjustment.amountToReduce || 0),
        saleRateFrom: Number(cashAdjustment.saleRateFrom || 0),
        saleRateTo: Number(cashAdjustment.saleRateTo || 0),
        mode: cashAdjustment.mode,
    });
    const refreshCashAdjustmentHistory = () => fetchCashSalesAdjustmentHistory()
        .then((data) => setCashAdjustmentHistory(data.data || []))
        .catch(() => {});
    const handleCashAdjustmentPreview = async () => {
        setCashAdjustmentStatus({ loading: true, error: "", success: "" });
        try {
            const data = await previewCashSalesAdjustment(buildCashAdjustmentPayload());
            setCashAdjustmentPreview(data.data);
            setCashAdjustment((current) => ({ ...current, cashSalesAmount: Number(data.data?.cashSalesAmountBefore || 0).toFixed(2) }));
            setCashAdjustmentStatus({ loading: false, error: "", success: "Preview ready. Review affected sales before processing." });
        } catch (err) {
            setCashAdjustmentPreview(err.data || null);
            setCashAdjustmentStatus({ loading: false, error: err.message || "Preview failed. Please check the backend server.", success: "" });
        }
    };
    const handleCashAdjustmentProcess = async () => {
        setCashAdjustmentStatus({ loading: true, error: "", success: "" });
        try {
            const data = await processCashSalesAdjustment(buildCashAdjustmentPayload());
            setCashAdjustmentPreview(null);
            setCashAdjustmentStatus({ loading: false, error: "", success: `Adjustment voucher ${data.data?.voucherNo || ""} processed.` });
            const freshReport = await fetchSalesReport();
            setReport(freshReport);
            await refreshCashAdjustmentHistory();
        } catch (err) {
            setCashAdjustmentPreview(err.data || cashAdjustmentPreview);
            setCashAdjustmentStatus({ loading: false, error: err.message || "Process failed. Please check the backend server.", success: "" });
        }
    };
    const handleCashAdjustmentReverse = async (adjustmentId) => {
        setCashAdjustmentStatus({ loading: true, error: "", success: "" });
        try {
            await reverseCashSalesAdjustment({ adjustmentId, reason: "Manual reversal from Sales Report" });
            setCashAdjustmentStatus({ loading: false, error: "", success: "Adjustment voucher reversed." });
            const freshReport = await fetchSalesReport();
            setReport(freshReport);
            await refreshCashAdjustmentHistory();
        } catch (err) {
            setCashAdjustmentStatus({ loading: false, error: err.message, success: "" });
        }
    };

    if (loading) return <div className="card app-card"><div className="card-body">Loading sales report...</div></div>;
    if (error) return <div className="card app-card"><div className="card-body text-danger">Error: {error}</div></div>;

    return (
        <>
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
                        <h1>Sales Report</h1>
                        <p className="mb-0 text-muted">Analyze sales by invoice, customer, item, category, salesman, payment mode, and GST rate.</p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-check-circle"></i> Ready</span>
                        <button className="btn btn_style" type="button" onClick={() => window.print()}>
                            <i className="bx bx-printer"></i><span>Print</span>
                        </button>
                        <button className="btn btn_style inActive" type="button" onClick={() => exportReportToPDF({ sales }, "Sales", appSettings)}>
                            <i className="bx bx-file"></i><span>Export PDF</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="row g-3 mb-3">
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card stat-card"><div className="card-body"><span className="stat-icon text-primary"><i className="bx bx-receipt"></i></span><p>Invoices</p><h3>{sales.length}</h3></div></div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card stat-card"><div className="card-body"><span className="stat-icon text-success"><i className="bx bx-trending-up"></i></span><p>Gross Sales</p><h3>Rs. {totalSales.toFixed(2)}</h3></div></div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card stat-card"><div className="card-body"><span className="stat-icon text-warning"><i className="bx bx-undo"></i></span><p>Returns</p><h3>Rs. {totalReturns.toFixed(2)}</h3></div></div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card stat-card"><div className="card-body"><span className="stat-icon text-info"><i className="bx bx-wallet"></i></span><p>Net Sales</p><h3>Rs. {(totalSales - totalReturns).toFixed(2)}</h3></div></div>
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
                        <div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor="sales-report-from-date">From Date</label><input type="date" className="form-control" id="sales-report-from-date" value={filters.fromDate} onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))} /></div>
                        <div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor="sales-report-to-date">To Date</label><input type="date" className="form-control" id="sales-report-to-date" value={filters.toDate} onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))} /></div>
                        <div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor="sales-report-customer">Customer</label><input type="text" className="form-control" id="sales-report-customer" placeholder="Enter Customer" value={filters.customer} onChange={(event) => setFilters((current) => ({ ...current, customer: event.target.value }))} /></div>
                        <div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor="sales-report-invoice-no">Invoice No</label><input type="text" className="form-control" id="sales-report-invoice-no" placeholder="Enter Invoice No" value={filters.invoiceNo} onChange={(event) => setFilters((current) => ({ ...current, invoiceNo: event.target.value }))} /></div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label" htmlFor="sales-report-payment-mode">Payment Mode</label>
                            <select className="form-select" id="sales-report-payment-mode" value={filters.paymentMode} onChange={(event) => setFilters((current) => ({ ...current, paymentMode: event.target.value }))}>
                                <option value="">Select Payment Mode</option>
                                <option value="cash">Cash</option>
                                <option value="card">Card</option>
                                <option value="upi">UPI</option>
                                <option value="credit">Credit</option>
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label" htmlFor="sales-report-billing-mode">Billing Mode</label>
                            <select className="form-select" id="sales-report-billing-mode" value={filters.billingMode} onChange={(event) => setFilters((current) => ({ ...current, billingMode: event.target.value }))}>
                                <option value="">All</option>
                                <option value="CASH">Cash</option>
                                <option value="ADVANCE">Advance</option>
                                <option value="CREDIT">Credit</option>
                            </select>
                        </div>
                        <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                            <button className="btn btn_style" type="submit"><i className="bx bx-search"></i><span>Apply</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={clearFilters}><i className="bx bx-reset"></i><span>Clear</span></button>
                        </div>
                    </form>
                </div>
            </section>

            <div className="row g-3 mb-3">
                <div className="col-12 col-xl-6">
                    <section className="card app-card h-100">
                        <div className="card-header app-card-header"><div><h2>Top Customers</h2><p>Top five customers by gross sale amount.</p></div></div>
                        <div className="card-body">
                            {byCustomer.length > 0 ? byCustomer.map(([label, value]) => (
                                <div className="summary-line" key={label}><span>{label}</span><strong>Rs. {value.toFixed(2)}</strong></div>
                            )) : <div className="text-muted">No customer sales found.</div>}
                        </div>
                    </section>
                </div>
                <div className="col-12 col-xl-6">
                    <section className="card app-card h-100">
                        <div className="card-header app-card-header"><div><h2>Payment Mix</h2><p>Sales amount grouped by payment mode.</p></div></div>
                        <div className="card-body">
                            {byMode.length > 0 ? byMode.map(([label, value]) => (
                                <div className="summary-line" key={label}><span>{label}</span><strong>Rs. {value.toFixed(2)}</strong></div>
                            )) : <div className="text-muted">No payment mix found.</div>}
                        </div>
                    </section>
                </div>
            </div>

            <section className="card app-card app-datatable-card print-safe-card">
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
                            <button className="btn btn_style datatable-create" type="button" onClick={() => navigate("/sales/pos")}>
                                <i className="bx bx-plus"></i><span>Create Sales</span>
                            </button>
                            {drill.level !== "year" ? (
                                <button className="btn btn_style inActive" type="button" onClick={goBack}>
                                    <i className="bx bx-arrow-back"></i><span>Back</span>
                                </button>
                            ) : null}
                        </div>
                        <div className="datatable-toolbar-end">
                            <button className="btn btn_style inActive datatable-tool-btn" type="button" data-bs-toggle="offcanvas" data-bs-target="#advancedFilterOffcanvas" aria-controls="advancedFilterOffcanvas">
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
                                    <button className="dropdown-item" type="button" onClick={() => exportRows("csv")}><i className="bx bx-file me-2"></i>CSV</button>
                                    <button className="dropdown-item" type="button" onClick={() => exportRows("excel")}><i className="bx bx-spreadsheet me-2"></i>Excel</button>
                                    <button className="dropdown-item" type="button" onClick={() => window.print()}><i className="bx bx-printer me-2"></i>Print</button>
                                    <button className="dropdown-item" type="button" onClick={() => exportReportToPDF({ sales }, "Sales", appSettings)}><i className="bx bx-file me-2"></i>PDF</button>
                                </div>
                            </div>
                            <div className="datatable-search">
                                <input type="text" placeholder="Search Sales Report" aria-label="Search Sales Report" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
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
                            <strong>{drillTitle}</strong>
                            <span>{drillHint}</span>
                        </div>
                        <div className="datatable-bulk-actions">
                            {isSuperadmin && drill.level === "day" ? (
                                <button className="btn btn_style inActive" type="button" disabled={!drillRows.length} onClick={() => openCashAdjustment()}>
                                    <i className="bx bx-slider-alt"></i><span>Cash Adjust</span>
                                </button>
                            ) : null}
                            <button className="btn btn_style inActive" type="button" disabled><i className="bx bx-archive"></i><span>Archive</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={() => exportRows("csv")}><i className="bx bx-export"></i><span>Export</span></button>
                            <button className="btn btn_style inActive" type="button" disabled><i className="bx bx-trash"></i><span>Delete</span></button>
                        </div>
                    </div>

                    {isSuperadmin && drill.level === "day" && cashAdjustmentOpen ? (
                        <CashSalesAdjustmentModule
                            form={cashAdjustment}
                            setForm={setCashAdjustment}
                            modes={ADJUSTMENT_MODES}
                            preview={cashAdjustmentPreview}
                            history={cashAdjustmentHistory}
                            status={cashAdjustmentStatus}
                            onPreview={handleCashAdjustmentPreview}
                            onProcess={handleCashAdjustmentProcess}
                            onReverse={handleCashAdjustmentReverse}
                            onClose={() => setCashAdjustmentOpen(false)}
                        />
                    ) : null}

                    <div className="table-responsive app-table-wrap datatable-wrap">
                        <table className="table app-table align-middle">
                            <thead>
                                <tr>
                                    {drill.level === "bill" ? <th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" aria-label="Select all rows" /></th> : null}
                                    <th><span className="sortable-heading">{drill.level === "bill" ? "Invoice" : drill.level === "year" ? "Year" : drill.level === "month" ? "Month" : "Date"}<i className="bx bx-sort-up"></i></span></th>
                                    {drill.level === "bill" ? <th><span className="sortable-heading">Mode<i className="bx bx-sort"></i></span></th> : null}
                                    {drill.level === "bill" ? <th><span className="sortable-heading">Bill No<i className="bx bx-sort"></i></span></th> : null}
                                    {drill.level === "bill" ? <th><span className="sortable-heading">Date<i className="bx bx-sort"></i></span></th> : null}
                                    {drill.level === "bill" ? <th><span className="sortable-heading">Customer<i className="bx bx-sort"></i></span></th> : null}
                                    <th><span className="sortable-heading">{drill.level === "bill" ? "Items" : "Invoices"}<i className="bx bx-sort"></i></span></th>
                                    {drill.level !== "bill" ? <th><span className="sortable-heading">Items<i className="bx bx-sort"></i></span></th> : null}
                                    <th><span className="sortable-heading">GST<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Returned<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Total<i className="bx bx-sort"></i></span></th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRows.length > 0 ? visibleRows.map((row) => (
                                    drill.level === "bill" ? (
                                        <tr key={row._id}>
                                            <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" /></td>
                                            <td>{row.invoiceNo}</td>
                                            <td><span className="status-badge status-primary">{row.billingMode || "CASH"}</span></td>
                                            <td>{row.displayBillNo || row.billNo || "-"}</td>
                                            <td>{row.saleDate ? new Date(row.saleDate).toLocaleDateString() : "-"}</td>
                                            <td>{row.customer || "Walk-in Customer"}</td>
                                            <td>{row.items?.length || 0}</td>
                                            <td>Rs. {Number(row.gstAmount || 0).toFixed(2)}</td>
                                            <td>Rs. {Number(row.totalReturnedAmount || 0).toFixed(2)}</td>
                                            <td><span className="status-badge status-primary">Rs. {Number(row.totalAmount || 0).toFixed(2)}</span></td>
                                            <td className="text-end"><SalesReportActions sale={row} appSettings={appSettings} navigate={navigate} /></td>
                                        </tr>
                                    ) : (
                                        <tr key={row.id} onDoubleClick={() => openSummaryRow(row)} style={{ cursor: "zoom-in" }}>
                                            <td><strong>{row.label}</strong></td>
                                            <td>{row.invoiceCount}</td>
                                            <td>{row.itemCount}</td>
                                            <td>Rs. {Number(row.gstAmount || 0).toFixed(2)}</td>
                                            <td>Rs. {Number(row.returnAmount || 0).toFixed(2)}</td>
                                            <td><span className="status-badge status-primary">Rs. {Number(row.totalAmount || 0).toFixed(2)}</span></td>
                                            <td className="text-end">
                                                <button className="btn action-btn" type="button" aria-label="Drill down" onClick={() => openSummaryRow(row)}>
                                                    <i className="bx bx-show"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                )) : (
                                    <tr className="table-state-row table-state-row-empty">
                                        <td colSpan={drill.level === "bill" ? 9 : 7}>
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
                        <span>Showing {drillRows.length === 0 ? 0 : 1} to {Math.min(drillRows.length, pageSize)} of {drillRows.length} entries</span>
                        <nav aria-label="Table pagination">
                            <ul className="pagination pagination-sm mb-0">
                                <li className="page-item disabled"><button className="page-link" type="button" aria-label="Previous" disabled><i className="bx bx-chevron-left"></i></button></li>
                                <li className="page-item active"><button className="page-link" type="button" disabled>1</button></li>
                                <li className="page-item disabled"><button className="page-link" type="button" aria-label="Next" disabled><i className="bx bx-chevron-right"></i></button></li>
                            </ul>
                        </nav>
                    </div>
                </div>
            </section>

            <div className="modal fade" id="pageActionModal" tabIndex="-1" aria-hidden="true">
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">New Sales Report</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            <p className="text-muted mb-3">Use the page form or table action menu to continue this workflow.</p>
                            <div className="quick-action-list">
                                <button className="quick-action" type="button" onClick={() => navigate("/sales/pos")}><i className="bx bx-plus"></i><span>Create record</span></button>
                                <button className="quick-action" type="button" disabled><i className="bx bx-import"></i><span>Import data</span></button>
                                <button className="quick-action" type="button" onClick={() => window.print()}><i className="bx bx-printer"></i><span>Print view</span></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};


const CashSalesAdjustmentModule = ({
    form,
    setForm,
    modes,
    preview,
    history,
    status,
    onPreview,
    onProcess,
    onReverse,
    onClose,
}) => (
    <div className="cash-adjustment-modal" role="dialog" aria-modal="true" aria-labelledby="cash-adjustment-title">
        <button type="button" className="cash-adjustment-modal__backdrop" aria-label="Close cash adjustment" onClick={onClose}></button>
        <section className="cash-adjustment-modal__dialog">
            <div className="cash-adjustment-modal__header">
                <h5 id="cash-adjustment-title">Cash Sales Amount Adjustment</h5>
                <button type="button" className="cash-adjustment-modal__close" aria-label="Close" onClick={onClose}>
                    <i className="bx bx-x"></i>
                </button>
            </div>
            <div className="cash-adjustment-modal__body">
                {status.error ? <div className="alert alert-danger py-2">{status.error}</div> : null}
                {status.success ? <div className="alert alert-success py-2">{status.success}</div> : null}

                <form className="cash-adjustment-form" onSubmit={(event) => event.preventDefault()}>
                    <div className="cash-adjustment-form__date">
                        <label className="form-label" htmlFor="cash-adjustment-date">Date</label>
                        <input id="cash-adjustment-date" className="form-control" type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value, cashSalesAmount: "", amountToReduce: "" }))} />
                    </div>
                    <div className="cash-adjustment-form__cash">
                        <label className="form-label" htmlFor="cash-adjustment-cash-sales">Sales Amount (Cash)</label>
                        <div className="input-group cash-adjustment-cash-input">
                            <input id="cash-adjustment-cash-sales" className="form-control bg-label-warning fw-bold text-end" type="number" min="0" step="0.01" value={form.cashSalesAmount} readOnly placeholder="0.00" />
                            <button className="btn btn_style inActive" type="button" disabled={status.loading || !form.date} onClick={onPreview} title="Preview">
                                <i className="bx bx-down-arrow-alt"></i>
                            </button>
                        </div>
                    </div>
                    <div className="cash-adjustment-form__utility">
                        <div className="metric-pill justify-content-center w-100"><i className="bx bx-shield-quarter"></i> Superadmin Voucher Utility</div>
                    </div>

                    <div className="cash-adjustment-form__shop">
                        LAXMI VISHNU CLOTH<br />SHOP
                    </div>
                    <div className="cash-adjustment-form__reduce">
                        <label className="form-label" htmlFor="cash-adjustment-reduce">Amount To Reduce</label>
                        <input id="cash-adjustment-reduce" className="form-control" type="number" min="0" step="0.01" value={form.amountToReduce} onChange={(event) => setForm((current) => ({ ...current, amountToReduce: event.target.value }))} />
                    </div>
                    <div className="cash-adjustment-form__range">
                        <label className="form-label">Sale Rate Range</label>
                        <div className="input-group">
                            <input className="form-control" aria-label="Sale rate from" type="number" min="0" step="0.01" value={form.saleRateFrom} onChange={(event) => setForm((current) => ({ ...current, saleRateFrom: event.target.value }))} />
                            <span className="input-group-text">to</span>
                            <input className="form-control" aria-label="Sale rate to" type="number" min="0" step="0.01" value={form.saleRateTo} onChange={(event) => setForm((current) => ({ ...current, saleRateTo: event.target.value }))} />
                            <button className="btn btn_style inActive" type="button" onClick={() => setForm((current) => ({ ...current, saleRateFrom: "", saleRateTo: "" }))}>All</button>
                        </div>
                    </div>
                    <div className="cash-adjustment-form__modes">
                        {modes.map((mode) => (
                            <label className="form-check" key={mode}>
                                <input className="form-check-input" type="radio" name="cashAdjustmentMode" value={mode} checked={form.mode === mode} onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value }))} />
                                <span className="form-check-label">{formatAdjustmentMode(mode)}</span>
                            </label>
                        ))}
                    </div>
                </form>

                {preview ? (
                    <div className="row g-3 mt-3">
                        <div className="col-12 col-xl-4">
                            <div className="summary-line"><span>Raw Cash Sales</span><strong>Rs. {Number(preview.rawCashSalesAmount || preview.cashSalesAmountBefore || 0).toFixed(2)}</strong></div>
                            <div className="summary-line"><span>Previous Adjustments</span><strong>Rs. {Number(preview.activeReduction || 0).toFixed(2)}</strong></div>
                            <div className="summary-line"><span>Cash Sales Before</span><strong>Rs. {Number(preview.cashSalesAmountBefore || 0).toFixed(2)}</strong></div>
                            <div className="summary-line"><span>Amount To Reduce</span><strong>Rs. {Number(preview.amountToReduce || 0).toFixed(2)}</strong></div>
                            <div className="summary-line"><span>Cash Sales After</span><strong>Rs. {Number(preview.cashSalesAmountAfter || 0).toFixed(2)}</strong></div>
                            <div className="summary-line"><span>Possible Reduction</span><strong>Rs. {Number(preview.possibleReduction || 0).toFixed(2)}</strong></div>
                        </div>
                        <div className="col-12 col-xl-8">
                            <div className="table-responsive app-table-wrap">
                                <table className="table app-table align-middle mb-0">
                                    <thead><tr><th>Invoice</th><th>Customer</th><th>Cash</th><th>Matched Items</th><th>Matched Amount</th></tr></thead>
                                    <tbody>
                                        {(preview.affectedSales || []).length ? preview.affectedSales.slice(0, 6).map((sale) => (
                                            <tr key={sale.saleId}>
                                                <td>{sale.invoiceNo || sale.billNo || "-"}</td>
                                                <td>{sale.customer || "Walk-in Customer"}</td>
                                                <td>Rs. {Number(sale.cashAmount || 0).toFixed(2)}</td>
                                                <td>{sale.matchedItemCount || 0}</td>
                                                <td>Rs. {Number(sale.matchedItemAmount || 0).toFixed(2)}</td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan={5} className="text-muted text-center">No affected cash sales matched these filters.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : null}

                    <details className="mt-3">
                    <summary className="fw-semibold">Adjustment History</summary>
                    <div className="table-responsive app-table-wrap mt-2">
                        <table className="table app-table align-middle mb-0">
                            <thead><tr><th>Voucher</th><th>Date</th><th>Mode</th><th>Reduce</th><th>Status</th><th className="text-end">Action</th></tr></thead>
                            <tbody>
                                {history.length ? history.slice(0, 5).map((row) => (
                                    <tr key={row._id}>
                                        <td>{row.voucherNo}</td>
                                        <td>{row.date ? new Date(row.date).toLocaleDateString("en-IN") : "-"}</td>
                                        <td>{formatAdjustmentMode(row.mode)}</td>
                                        <td>Rs. {Number(row.amountToReduce || 0).toFixed(2)}</td>
                                        <td><span className={`status-badge ${row.status === "REVERSED" ? "status-warning" : "status-success"}`}>{row.status}</span></td>
                                        <td className="text-end">
                                            <button className="btn action-btn" type="button" aria-label="Reverse adjustment" disabled={row.status === "REVERSED" || status.loading} onClick={() => onReverse(row._id)}>
                                                <i className="bx bx-undo"></i>
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={6} className="text-muted text-center">No adjustment vouchers yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </details>
            </div>
            <div className="cash-adjustment-modal__footer">
                <button className="btn btn_style" type="button" disabled={status.loading || !form.date || Number(form.amountToReduce || 0) <= 0} onClick={onProcess}>
                    <i className="bx bx-check"></i><span>Process</span>
                </button>
                <button className="btn btn_style inActive" type="button" onClick={onClose}>
                    <i className="bx bx-x"></i><span>Exit</span>
                </button>
            </div>
        </section>
    </div>
);

const formatAdjustmentMode = (mode = "") => mode
    .toLowerCase()
    .split("_")
    .map((part) => part === "ctrl" ? "Ctrl" : part === "k" ? "K" : part === "5r" ? "5%(R)" : part === "5" ? "5%" : part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const SalesReportActions = ({ sale, appSettings, navigate }) => (
    <div className="datatable-actions">
        <button type="button" className="btn action-btn" aria-label="Delete" disabled><i className="bx bx-trash"></i></button>
        <button type="button" className="btn action-btn" aria-label="View" onClick={() => navigate(`/sales/invoice?id=${sale._id}`)}><i className="bx bx-show"></i></button>
        <div className="dropdown">
            <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions">
                <i className="bx bx-dots-vertical-rounded"></i>
            </button>
            <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                <button className="dropdown-item" type="button" onClick={() => exportReportToPDF({ sales: [sale] }, `Sales ${sale.invoiceNo || ""}`, appSettings)}>Download</button>
                <button className="dropdown-item" type="button" onClick={() => navigate(`/sales/invoice?id=${sale._id}`)}>Edit</button>
                <button className="dropdown-item" type="button" onClick={() => navigate("/sales/pos")}>Duplicate</button>
            </div>
        </div>
    </div>
);

export default SalesReport;

function exportSalesToCsv(rows, filename) {
    const columns = ["Invoice", "Date", "Customer", "Items", "GST", "Returned", "Total"];
    const body = rows.map((sale) => [
        sale.invoiceNo || "",
        sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : "",
        sale.customer || "Walk-in Customer",
        sale.items?.length || 0,
        Number(sale.gstAmount || 0).toFixed(2),
        Number(sale.totalReturnedAmount || 0).toFixed(2),
        Number(sale.totalAmount || 0).toFixed(2),
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
