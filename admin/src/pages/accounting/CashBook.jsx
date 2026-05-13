import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    closePosSession,
    dayEndPosSession,
    fetchCashBookReport,
    openPosSession,
    undoDayEndPosSession,
} from "../../services/accountingService";
import { notifyError, notifySuccess } from "../../utils/notify";
import { ROLE_GROUPS, hasRole } from "../../utils/permissions";

const toLocalDateInput = (value = new Date()) => {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const today = toLocalDateInput();
const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const addDays = (value, days) => {
    const next = new Date(value);
    next.setDate(next.getDate() + days);
    return next;
};
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN") : "-");
const formatDateTime = (value) => (value ? new Date(value).toLocaleString("en-IN") : "-");
const formatCurrency = (value) => round2(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MAIN_TABS = [
    { id: "summary", label: "Summary" },
    { id: "detailed", label: "Detailed" },
    { id: "full", label: "Full List" },
];

const SIDE_TABS = [
    { id: "sales", label: "Sales" },
    { id: "advMemo", label: "Adv.Memo" },
    { id: "receipt", label: "Receipt" },
];

const EMPTY_SESSION_FORM = {
    openingCash: "",
    closingCash: "",
    expenseAmount: "",
    expenseNote: "",
};

const exportRowsAsCsv = (rows, fileName) => {
    const csv = rows
        .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
};

const CashBook = () => {
    const navigate = useNavigate();
    const [filters, setFilters] = useState({ from: today, to: today });
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [statusMessage, setStatusMessage] = useState("");
    const [mainTab, setMainTab] = useState("summary");
    const [sideTab, setSideTab] = useState("sales");
    const [selectedSummaryKey, setSelectedSummaryKey] = useState("CASH SALES");
    const [sessionForm, setSessionForm] = useState(EMPTY_SESSION_FORM);
    const [dialog, setDialog] = useState("");
    const [didSyncSessionDate, setDidSyncSessionDate] = useState(false);
    const userRole = localStorage.getItem("role") || "guest";
    const canManageSession = hasRole(userRole, ROLE_GROUPS.tallyOps);
    const canUndoDayEnd = userRole === "superadmin";

    const loadReport = useCallback(async (nextFilters) => {
        setLoading(true);
        try {
            const data = await fetchCashBookReport(nextFilters);
            setReport(data.data || null);
            setError("");
        } catch (err) {
            const message = err.message || "Failed to load cash book report.";
            notifyError(message);
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadReport({ from: today, to: today });
    }, [loadReport]);

    const summary = report?.summary || {};
    const summaryRows = report?.summaryRows || [];
    const detailPanels = report?.detailPanels || {};
    const detailLists = report?.detailLists || {};
    const transactions = report?.transactions || [];
    const sessions = report?.sessions || [];
    const activeSession = report?.activeSession || null;
    const currentBusinessDate = activeSession?.businessDate || filters.to;
    const lastDayEndDate = activeSession?.lastDayEndDate || sessions.find((session) => session.lastDayEndDate)?.lastDayEndDate || null;
    const activeSessionDateInput = activeSession?.businessDate ? toLocalDateInput(activeSession.businessDate) : "";

    useEffect(() => {
        if (!selectedSummaryKey && summaryRows[0]?.key) {
            setSelectedSummaryKey(summaryRows[0].key);
        }
    }, [selectedSummaryKey, summaryRows]);

    useEffect(() => {
        if (!activeSessionDateInput || didSyncSessionDate) {
            return;
        }

        if (filters.from === activeSessionDateInput && filters.to === activeSessionDateInput) {
            setDidSyncSessionDate(true);
            return;
        }

        const nextFilters = { from: activeSessionDateInput, to: activeSessionDateInput };
        setDidSyncSessionDate(true);
        setFilters(nextFilters);
        loadReport(nextFilters);
    }, [activeSessionDateInput, didSyncSessionDate, filters.from, filters.to, loadReport]);

    const selectedSummaryRows = useMemo(() => {
        if (mainTab === "summary") {
            return summaryRows;
        }
        if (mainTab === "detailed") {
            return transactions.map((row) => ({
                key: `${row.type}-${row.refNo}-${row.date}`,
                label: `${String(row.type || "").replace(/-/g, " ").toUpperCase()} ${row.party ? `• ${row.party}` : ""}`.trim(),
                cnt: "",
                cr: round2(row.cashComponent) > 0 ? round2(row.cashComponent) : 0,
                dr: round2(row.cashComponent) < 0 ? Math.abs(round2(row.cashComponent)) : 0,
                meta: row,
            }));
        }
        return [
            ...(detailLists.sales || []).map((sale) => ({
                key: `bill-${sale._id}`,
                label: sale.billNo || sale.invoiceNo || "Bill",
                cnt: (sale.items || []).length,
                cr: round2(sale.totalAmount),
                dr: round2(sale.creditDue),
                meta: sale,
            })),
            ...(detailLists.expenses || []).map((entry) => ({
                key: `expense-${entry._id}`,
                label: `${String(entry.entryType || "").replace(/-/g, " ").toUpperCase()} ${entry.category ? `• ${entry.category}` : ""}`.trim(),
                cnt: "",
                cr: entry.direction === "in" ? round2(entry.amount) : 0,
                dr: entry.direction === "out" ? round2(entry.amount) : 0,
                meta: entry,
            })),
        ];
    }, [detailLists.expenses, detailLists.sales, mainTab, summaryRows, transactions]);

    const sideRows = useMemo(() => {
        if (sideTab === "sales") {
            return detailPanels[selectedSummaryKey] || detailPanels["CARD/UPI SALES"] || [];
        }
        if (sideTab === "advMemo") {
            return detailPanels["ADV.MEMO"] || [];
        }
        return detailPanels.RECEIPT || [];
    }, [detailPanels, selectedSummaryKey, sideTab]);

    const sideTotal = useMemo(() => sideRows.reduce((sum, row) => sum + round2(row.salesAmt ?? row.amount), 0), [sideRows]);

    const actionSummaryText = useMemo(() => {
        const lines = [
            `Cash Book for ${formatDate(filters.from)} to ${formatDate(filters.to)}`,
            `Cash Sales: Rs. ${formatCurrency(summary.cashSales)}`,
            `Receipts: Rs. ${formatCurrency(summary.receiptAmount)}`,
            `Expenses: Rs. ${formatCurrency(summary.expenseAmount)}`,
            `Cash In Hand: Rs. ${formatCurrency(summary.cashInHand)}`,
        ];
        return lines.join("\n");
    }, [filters.from, filters.to, summary.cashInHand, summary.cashSales, summary.expenseAmount, summary.receiptAmount]);

    const applyFilters = () => loadReport(filters);

    const openSessionNow = async () => {
        try {
            setSaving(true);
            const data = await openPosSession({ openingCash: round2(sessionForm.openingCash) });
            const successMessage = data.message || "Opening cash saved.";
            notifySuccess(successMessage);
            setStatusMessage(successMessage);
            setDialog("");
            setSessionForm(EMPTY_SESSION_FORM);
            await loadReport(filters);
        } catch (err) {
            const message = err.message || "Failed to open session.";
            notifyError(message);
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    const closeSessionNow = async () => {
        if (!canManageSession) {
            const message = "Only admin, manager, or accountant users can close POS sessions.";
            notifyError(message);
            setError(message);
            return;
        }

        try {
            setSaving(true);
            const data = await closePosSession({
                closingCash: round2(sessionForm.closingCash),
                expenseAmount: round2(sessionForm.expenseAmount),
                expenseNote: sessionForm.expenseNote,
            });
            const successMessage = data.message || "Cash handover saved.";
            notifySuccess(successMessage);
            setStatusMessage(successMessage);
            setDialog("");
            setSessionForm(EMPTY_SESSION_FORM);
            await loadReport(filters);
        } catch (err) {
            const message = err.message || "Failed to close session.";
            notifyError(message);
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    const runDayEnd = async () => {
        if (!canManageSession) {
            const message = "Only admin, manager, or accountant users can run day end.";
            notifyError(message);
            setError(message);
            return;
        }

        if (!activeSession) {
            const message = "No active session found for day end.";
            notifyError(message);
            setError(message);
            return;
        }
        try {
            setSaving(true);
            setError("");
            const data = await dayEndPosSession();
            const successMessage = data.message || "Day end completed.";
            const nextBusinessDate = data.data?.businessDate || activeSession.businessDate || new Date();
            const nextDateInput = toLocalDateInput(nextBusinessDate);
            const nextFilters = { from: nextDateInput, to: nextDateInput };
            notifySuccess(successMessage);
            setStatusMessage(successMessage);
            setDialog("");
            setFilters(nextFilters);
            setDidSyncSessionDate(true);
            setMainTab("summary");
            setSideTab("sales");
            setSelectedSummaryKey("CASH SALES");
            await loadReport(nextFilters);
        } catch (err) {
            const message = err.message || "Failed to complete day end.";
            notifyError(message);
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    const runUndoDayEnd = async () => {
        try {
            setSaving(true);
            setError("");
            const data = await undoDayEndPosSession();
            const successMessage = data.message || "Day end undone.";
            const restoredBusinessDate = data.data?.businessDate || new Date();
            const restoredDateInput = toLocalDateInput(restoredBusinessDate);
            const nextFilters = { from: restoredDateInput, to: restoredDateInput };
            notifySuccess(successMessage);
            setStatusMessage(successMessage);
            setDialog("");
            setFilters(nextFilters);
            setDidSyncSessionDate(true);
            setMainTab("summary");
            setSideTab("sales");
            setSelectedSummaryKey("CASH SALES");
            await loadReport(nextFilters);
        } catch (err) {
            const message = err.message || "Failed to undo day end.";
            notifyError(message);
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    const handlePrint = () => {
        const popup = window.open("", "_blank", "width=1100,height=820");
        if (!popup) {
            return;
        }

        const rows = selectedSummaryRows.map((row) => `
            <tr>
                <td>${row.label || "-"}</td>
                <td style="text-align:right;">${row.cnt || ""}</td>
                <td style="text-align:right;">${row.cr ? formatCurrency(row.cr) : ""}</td>
                <td style="text-align:right;">${row.dr ? formatCurrency(row.dr) : ""}</td>
            </tr>
        `).join("");

        popup.document.write(`
            <html>
                <head>
                    <title>Cash Book</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
                        h1 { margin: 0 0 8px; }
                        p { margin: 0 0 16px; color: #666; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #cfcfcf; padding: 8px 10px; font-size: 14px; }
                        th { background: #f1f1f1; }
                    </style>
                </head>
                <body>
                    <h1>Cash Book & Day End</h1>
                    <p>${formatDate(filters.from)} to ${formatDate(filters.to)}</p>
                    <table>
                        <thead>
                            <tr>
                                <th>All</th>
                                <th>Cnt</th>
                                <th>Cr. (In)</th>
                                <th>Dr. (Out)</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <script>window.print();</script>
                </body>
            </html>
        `);
        popup.document.close();
    };

    const handleExport = () => {
        exportRowsAsCsv([
            ["All", "Cnt", "Cr. (In)", "Dr. (Out)"],
            ...selectedSummaryRows.map((row) => [row.label || "", row.cnt || "", row.cr || "", row.dr || ""]),
        ], `cash-book-${filters.from}-${filters.to}.csv`);
        const message = "Cash book exported.";
        notifySuccess(message);
        setStatusMessage(message);
    };

    const sendEmail = () => {
        window.location.href = `mailto:?subject=${encodeURIComponent("Cash Book Summary")}&body=${encodeURIComponent(actionSummaryText)}`;
    };

    const sendWhatsapp = () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(actionSummaryText)}`, "_blank", "noopener,noreferrer");
    };

    const triggerShortcutView = (shortcut) => {
        if (shortcut === "counterwise") {
            setSelectedSummaryKey("CARD/UPI SALES");
            setSideTab("sales");
            setMainTab("summary");
            setStatusMessage("Payment-mode breakdown loaded.");
            return;
        }
        if (shortcut === "bills") {
            setMainTab("full");
            setStatusMessage("Bill-wise list loaded.");
            return;
        }
        if (shortcut === "pending") {
            setSelectedSummaryKey("PENDING P-SLIP");
            setMainTab("summary");
            setStatusMessage("Pending P-slip entries loaded.");
            return;
        }
        if (shortcut === "returns") {
            setSelectedSummaryKey("CASH SALES RET");
            setMainTab("summary");
            setStatusMessage("Sales return items loaded.");
        }
    };

    if (loading) return <div className="card app-card"><div className="card-body">Loading cash book...</div></div>;

    return (
        <>
            <div className="page-header card">
                <div className="card-body">
                    <div>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-2">
                                <li className="breadcrumb-item"><a href="/dashboard">Home</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Accounting</li>
                            </ol>
                        </nav>
                        <p className="section-label">Accounting</p>
                        <h1>Cash Book</h1>
                        <p className="mb-0 text-muted">Review cash inflow, outflow, opening balance, closing balance, and daily counter movements.</p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-check-circle"></i> Ready</span>
                        <button className="btn btn_style" type="button" onClick={() => setDialog("open")}>
                            <i className="bx bx-plus"></i><span>New</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="cash-book-page">
                <section className="cash-session-grid">
                    <div className="card cash-session-card">
                        <div className="card-body"><span className="stat-icon text-primary"><i className="bx bx-wallet"></i></span><span>Opening Cash</span><strong>Rs. {formatCurrency(activeSession?.openingCash || 0)}</strong></div>
                    </div>
                    <div className="card cash-session-card">
                        <div className="card-body"><span className="stat-icon text-success"><i className="bx bx-trending-up"></i></span><span>Cash In</span><strong>Rs. {formatCurrency(round2(summary.cashSales) + round2(summary.receiptAmount))}</strong></div>
                    </div>
                    <div className="card cash-session-card">
                        <div className="card-body"><span className="stat-icon text-danger"><i className="bx bx-trending-down"></i></span><span>Cash Out</span><strong>Rs. {formatCurrency(summary.expenseAmount)}</strong></div>
                    </div>
                    <div className="card cash-session-card">
                        <div className="card-body"><span className="stat-icon text-warning"><i className="bx bx-lock-alt"></i></span><span>Cash In Hand</span><strong>Rs. {formatCurrency(summary.cashInHand)}</strong></div>
                    </div>
                </section>

                <section className="card app-card cash-filter-card">
                    <div className="card-body">
                        <div className="cash-filter-head">
                            <div>
                                <p className="section-label mb-1">Session</p>
                                <h2>Cash Book & Day End</h2>
                                <p>Business Date: {formatDate(currentBusinessDate)} • User: {localStorage.getItem("username") || "Operator"}</p>
                            </div>
                            <div className="cash-filter-actions">
                                <span className="metric-pill">{activeSession?.sessionNo || "Session Closed"}</span>
                                <button className="btn btn_style" type="button" onClick={() => setDialog("open")} disabled={Boolean(activeSession)}>Opening Cash</button>
                                {canManageSession ? <button className="btn btn_style inActive" type="button" onClick={() => setDialog("handover")} disabled={!activeSession}>Cash Handover</button> : null}
                            </div>
                        </div>

                        <div className="cash-command-strip">
                            <div className="row g-3 align-items-end">
                                <div className="col-12 col-md-3">
                                    <label className="form-label">From</label>
                                    <input className="form-control" type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} />
                                </div>
                                <div className="col-12 col-md-3">
                                    <label className="form-label">To</label>
                                    <input className="form-control" type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} />
                                </div>
                                <div className="col-12 col-md-3">
                                    <label className="form-label">Counter</label>
                                    <select className="form-select" defaultValue="Main Counter">
                                        <option>Main Counter</option>
                                        <option>Counter 2</option>
                                    </select>
                                </div>
                                <div className="col-12 col-md-3">
                                    <label className="form-label">Mode</label>
                                    <select className="form-select" defaultValue="All Modes">
                                        <option>All Modes</option>
                                        <option>Cash</option>
                                        <option>UPI</option>
                                        <option>Card</option>
                                    </select>
                                </div>
                                <div className="col-12 d-flex flex-wrap gap-2">
                                    <button className="btn btn_style" type="button" onClick={applyFilters}><i className="bx bx-search"></i><span>Show</span></button>
                                    <button className="btn btn_style inActive" type="button" onClick={() => setFilters({ from: today, to: today })}><i className="bx bx-reset"></i><span>Clear</span></button>
                                    <button className="btn btn_style inActive ms-sm-auto" type="button" onClick={() => navigate("/")}><i className="bx bx-log-out"></i><span>Exit</span></button>
                                </div>
                            </div>
                        </div>

                        <div className="cash-status-note">
                            <i className="bx bx-info-circle"></i><span>{error || statusMessage || "Cash book loaded for the active POS session. Review handover totals before day end."}</span>
                        </div>
                    </div>
                </section>

                <div className="cash-book-layout">
                    <section className="card app-card cash-panel cash-summary-panel">
                        <div className="card-header app-card-header">
                            <div><h2>Daily Summary</h2><p>Cash inflow and outflow by source.</p></div>
                            <ul className="nav nav-pills cash-tabs" role="tablist" aria-label="Daily summary views">
                                {MAIN_TABS.map((tab) => (
                                    <li className="nav-item" role="presentation" key={tab.id}>
                                        <button className={`nav-link ${mainTab === tab.id ? "active" : ""}`} type="button" role="tab" aria-selected={mainTab === tab.id} onClick={() => setMainTab(tab.id)}>{tab.label}</button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="card-body p-0">
                            <div className="tab-content cash-tab-content">
                                <div className="tab-pane fade show active" role="tabpanel" tabIndex="0">
                                    <div className="table-responsive app-table-wrap">
                                        <table className="table app-table cash-summary-table align-middle">
                                            <thead><tr><th>Particulars</th><th>Cnt</th><th className="text-end">Cr. (In)</th><th className="text-end">Dr. (Out)</th></tr></thead>
                                            <tbody>
                                                {selectedSummaryRows.length > 0 ? selectedSummaryRows.map((row) => (
                                                    <tr key={row.key} onClick={() => row.key && setSelectedSummaryKey(row.key)} className={selectedSummaryKey === row.key ? "table-active" : ""}>
                                                        <td>{row.label}</td>
                                                        <td>{row.cnt || ""}</td>
                                                        <td className="text-end">{row.cr ? formatCurrency(row.cr) : ""}</td>
                                                        <td className="text-end">{row.dr ? formatCurrency(row.dr) : ""}</td>
                                                    </tr>
                                                )) : (
                                                    <tr><td colSpan="4" className="text-center text-muted py-4">No rows found in this range.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <aside className="cash-side-stack">
                        <section className="card app-card cash-panel">
                            <div className="card-header app-card-header"><div><h2>Payment Split</h2><p>Sales amount by mode.</p></div></div>
                            <div className="card-body">
                                <ul className="nav nav-pills cash-tabs mb-3" role="tablist" aria-label="Payment split views">
                                    {SIDE_TABS.map((tab) => (
                                        <li className="nav-item" role="presentation" key={tab.id}>
                                            <button className={`nav-link ${sideTab === tab.id ? "active" : ""}`} type="button" role="tab" aria-selected={sideTab === tab.id} onClick={() => setSideTab(tab.id)}>{tab.label}</button>
                                        </li>
                                    ))}
                                </ul>
                                <div className="tab-content cash-tab-content">
                                    <div className="tab-pane fade show active" role="tabpanel" tabIndex="0">
                                        <div className="cash-breakdown-list">
                                            {sideRows.length > 0 ? sideRows.map((row, index) => (
                                                <div className="cash-breakdown-row" key={`${row.paymentMode || row.refNo || row.party || "row"}-${index}`}>
                                                    <span>{row.paymentMode || row.refNo || row.party || "-"}</span>
                                                    <strong>Rs. {formatCurrency(row.salesAmt ?? row.amount)}</strong>
                                                </div>
                                            )) : (
                                                <div className="cash-breakdown-row"><span>No details available.</span><strong>Rs. 0.00</strong></div>
                                            )}
                                            <div className="cash-breakdown-total"><span>Total Amt</span><strong>Rs. {formatCurrency(sideTotal)}</strong></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="card app-card cash-panel">
                            <div className="card-header app-card-header"><div><h2>Memo & Receipt</h2><p>Advance memo and receipt snapshot.</p></div></div>
                            <div className="card-body">
                                <div className="cash-mini-table">
                                    <h6>Advance Memo</h6>
                                    {(detailPanels["ADV.MEMO"] || []).length > 0 ? (detailPanels["ADV.MEMO"] || []).slice(0, 3).map((row, index) => (
                                        <div key={`adv-${index}`}><span>{row.refNo || row.paymentMode || "Memo"}</span><strong>{row.party || "-"}</strong><em>Rs. {formatCurrency(row.salesAmt ?? row.amount)}</em></div>
                                    )) : <div><span>-</span><strong>No advance memo</strong><em>Rs. 0.00</em></div>}
                                </div>
                                <div className="cash-mini-table mt-3">
                                    <h6>Receipt</h6>
                                    {(detailPanels.RECEIPT || []).length > 0 ? (detailPanels.RECEIPT || []).slice(0, 3).map((row, index) => (
                                        <div key={`receipt-${index}`}><span>{row.paymentMode || row.refNo || "Receipt"}</span><em>Rs. {formatCurrency(row.salesAmt ?? row.amount)}</em></div>
                                    )) : <div><span>-</span><em>Rs. 0.00</em></div>}
                                </div>
                            </div>
                        </section>

                        <section className="card app-card cash-panel day-end-panel">
                            <div className="card-body">
                                <div className="summary-line"><span>Last Day End Date</span><strong>{formatDate(lastDayEndDate)}</strong></div>
                                <div className="cash-day-actions">
                                    <button className="btn btn_style inActive" type="button" onClick={sendEmail}>Send Email</button>
                                    <button className="btn btn_style inActive" type="button" onClick={sendWhatsapp}>Send Whatsapp</button>
                                    {canUndoDayEnd ? <button className="btn btn_style inActive" type="button" onClick={() => setDialog("undo-day-end")} disabled={!lastDayEndDate || saving}>Undo Day End</button> : null}
                                    {canManageSession ? <button className="btn btn_style" type="button" onClick={() => setDialog("day-end")} disabled={!activeSession || saving}>Day End For {formatDate(currentBusinessDate)}</button> : null}
                                </div>
                            </div>
                        </section>
                    </aside>
                </div>

                <section className="card app-card app-datatable-card cash-transactions-card">
                    <div className="card-header app-card-header">
                        <div><h2>Cash Movements</h2><p>Review sales, receipts, deposits, expenses, and cash component impact.</p></div>
                    </div>
                    <div className="card-body p-0">
                        <div className="datatable-toolbar cashbook-datatable-toolbar">
                            <div className="datatable-toolbar-start">
                                <label className="datatable-length"><span>Show</span>
                                    <select className="form-select datatable-page-size" aria-label="Rows per page" defaultValue="10">
                                        <option>10</option><option>25</option><option>50</option>
                                    </select>
                                </label>
                                <button className="btn btn_style datatable-create" type="button" onClick={handleExport}><i className="bx bx-export"></i><span>Export Cash Book</span></button>
                            </div>
                            <div className="datatable-toolbar-end">
                                <div className="datatable-search"><input type="search" placeholder="Search Cash Book" aria-label="Search Cash Book" readOnly /></div>
                                <select className="form-select datatable-status-filter" aria-label="Cash book status" defaultValue="All Status">
                                    <option>All Status</option><option>Sales</option><option>Receipt</option><option>Expense</option><option>Day End</option>
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
                                <button className="btn btn_style inActive" type="button" onClick={handleExport}><i className="bx bx-export"></i><span>Export</span></button>
                                <button className="btn btn_style inActive" type="button"><i className="bx bx-trash"></i><span>Delete</span></button>
                            </div>
                        </div>

                        <div className="table-responsive app-table-wrap">
                            <table className="table app-table align-middle">
                                <thead>
                                    <tr>
                                        <th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" aria-label="Select all cash book rows" /></th>
                                        <th>Type</th><th>Date</th><th>Ref No</th><th>Party</th><th>Mode</th><th className="text-end">Amount</th><th className="text-end">Cash Component</th><th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.length > 0 ? transactions.map((row, index) => (
                                        <tr key={`${row.type}-${row.refNo}-${row.date}-${index}`}>
                                            <td className="datatable-check-cell"><input className="form-check-input datatable-row-check" type="checkbox" aria-label="Select cash book row" /></td>
                                            <td>{String(row.type || "-").replace(/-/g, " ")}</td>
                                            <td>{formatDate(row.date)}</td>
                                            <td>{row.refNo || "-"}</td>
                                            <td>{row.party || "-"}</td>
                                            <td>{row.paymentMode || row.mode || "-"}</td>
                                            <td className="text-end">{formatCurrency(row.amount)}</td>
                                            <td className="text-end">{formatCurrency(row.cashComponent)}</td>
                                            <td className="text-end"><div className="datatable-actions"><button className="action-btn" type="button" aria-label="View"><i className="bx bx-show"></i></button><button className="action-btn" type="button" aria-label="More"><i className="bx bx-dots-vertical-rounded"></i></button></div></td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan="9" className="text-center text-muted py-4">No cash movements found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="cash-action-strip">
                            <button className="btn btn_style inActive" type="button" onClick={handlePrint}>Print</button>
                            <button className="btn btn_style inActive" type="button" onClick={handleExport}>Export</button>
                            <button className="btn btn_style inActive" type="button" onClick={() => triggerShortcutView("counterwise")}>Counterwise</button>
                            <button className="btn btn_style inActive" type="button" onClick={() => triggerShortcutView("bills")}>List of Bills</button>
                            <button className="btn btn_style inActive" type="button" onClick={() => triggerShortcutView("pending")}>Pending P-Slip</button>
                            <button className="btn btn_style inActive" type="button" onClick={() => triggerShortcutView("returns")}>Sales Return Items</button>
                            <button className="btn btn_style" type="button" onClick={() => navigate("/accounting/expense")}>Expense Entry</button>
                        </div>

                        <div className="pagination-row">
                            <span>Showing {transactions.length ? 1 : 0} to {transactions.length} of {transactions.length} entries</span>
                            <nav aria-label="Cash book pagination">
                                <ul className="pagination mb-0">
                                    <li className="page-item disabled"><a className="page-link" href="#" aria-label="Previous"><i className="bx bx-chevron-left"></i></a></li>
                                    <li className="page-item active"><a className="page-link" href="#">1</a></li>
                                    <li className="page-item disabled"><a className="page-link" href="#" aria-label="Next"><i className="bx bx-chevron-right"></i></a></li>
                                </ul>
                            </nav>
                        </div>
                    </div>
                </section>
            </div>

            {dialog ? (
                <ModalShell title={dialog === "open" ? "Opening Cash" : dialog === "handover" ? "Cash Handover" : dialog === "undo-day-end" ? "Undo Day End" : "Confirm Day End"} onClose={() => setDialog("")}>
                    {dialog === "open" ? (
                        <>
                            <div className="modal-body">
                                <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                                    <div className="col-12 col-md-6">
                                        <label className="form-label">Opening Cash</label>
                                        <input className="form-control" type="number" value={sessionForm.openingCash} onChange={(event) => setSessionForm((current) => ({ ...current, openingCash: event.target.value }))} placeholder="Enter opening cash" />
                                    </div>
                                </form>
                            </div>
                            <div className="modal-footer"><button type="button" className="btn btn_style inActive" onClick={() => setDialog("")}>Cancel</button><button type="button" className="btn btn_style" onClick={openSessionNow} disabled={saving}>{saving ? "Saving..." : "Start Session"}</button></div>
                        </>
                    ) : null}

                    {dialog === "handover" ? (
                        <>
                            <div className="modal-body">
                                <div className="summary-line"><span>Session</span><strong>{activeSession?.sessionNo || "-"}</strong></div>
                                <div className="summary-line"><span>Opened At</span><strong>{formatDateTime(activeSession?.openedAt)}</strong></div>
                                <div className="summary-line"><span>Expected Cash</span><strong>Rs. {formatCurrency(summary.cashInHand)}</strong></div>
                                <form className="row g-3 mt-1" onSubmit={(event) => event.preventDefault()}>
                                    <div className="col-12 col-md-6"><label className="form-label">Closing Cash</label><input className="form-control" type="number" value={sessionForm.closingCash} onChange={(event) => setSessionForm((current) => ({ ...current, closingCash: event.target.value }))} placeholder="Enter closing cash" /></div>
                                    <div className="col-12 col-md-6"><label className="form-label">Expenses</label><input className="form-control" type="number" value={sessionForm.expenseAmount} onChange={(event) => setSessionForm((current) => ({ ...current, expenseAmount: event.target.value }))} placeholder="Enter expenses" /></div>
                                    <div className="col-12"><label className="form-label">Expense Note</label><textarea className="form-control" rows="3" value={sessionForm.expenseNote} onChange={(event) => setSessionForm((current) => ({ ...current, expenseNote: event.target.value }))} placeholder="Enter expense note"></textarea></div>
                                </form>
                            </div>
                            <div className="modal-footer"><button type="button" className="btn btn_style inActive" onClick={() => setDialog("")}>Cancel</button><button type="button" className="btn btn_style" onClick={closeSessionNow} disabled={saving}>{saving ? "Saving..." : "Save Cash Handover"}</button></div>
                        </>
                    ) : null}

                    {dialog === "day-end" ? (
                        <>
                            <div className="modal-body"><p className="text-muted mb-0">Day end will move the running POS business date from {formatDate(activeSession?.businessDate)} to {formatDate(addDays(new Date(activeSession?.businessDate || new Date()), 1))}. New bills after this will use the next day date.</p></div>
                            <div className="modal-footer"><button type="button" className="btn btn_style inActive" onClick={() => setDialog("")}>Cancel</button><button type="button" className="btn btn_style" onClick={runDayEnd} disabled={saving}>{saving ? "Updating..." : "Confirm Day End"}</button></div>
                        </>
                    ) : null}

                    {dialog === "undo-day-end" ? (
                        <>
                            <div className="modal-body"><p className="text-muted mb-0">This will restore the POS business date back from {formatDate(activeSession?.businessDate)} to the previous day-end date. Only superadmin can perform this action.</p></div>
                            <div className="modal-footer"><button type="button" className="btn btn_style inActive" onClick={() => setDialog("")}>Cancel</button><button type="button" className="btn btn_style" onClick={runUndoDayEnd} disabled={saving}>{saving ? "Updating..." : "Confirm Undo"}</button></div>
                        </>
                    ) : null}
                </ModalShell>
            ) : null}
        </>
    );
};

const ModalShell = ({ title, children, onClose }) => (
    <>
        <div className="modal-backdrop fade show"></div>
        <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" aria-hidden="false" onClick={onClose}>
            <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(event) => event.stopPropagation()}>
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">{title}</h5>
                        <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    </>
);

const DateField = ({ label, value, onChange }) => (
    <label style={styles.dateField}>
        <span style={styles.dateLabel}>{label}</span>
        <input type="date" value={value} onChange={(event) => onChange(event.target.value)} style={styles.dateInput} />
    </label>
);

const ToolbarButton = ({ label, onClick, active = false }) => (
    <button type="button" onClick={onClick} style={active ? styles.toolbarButtonActive : styles.toolbarButton}>{label}</button>
);

const BottomAction = ({ label, onClick, accent = false }) => (
    <button type="button" onClick={onClick} style={accent ? styles.bottomActionAccent : styles.bottomAction}>{label}</button>
);

const Field = ({ label, value, onChange, type = "text", as = "input" }) => (
    <label style={styles.field}>
        <span style={styles.fieldLabel}>{label}</span>
        {as === "textarea" ? (
            <textarea value={value} onChange={(event) => onChange(event.target.value)} style={styles.textarea} />
        ) : (
            <input type={type} value={value} onChange={(event) => onChange(event.target.value)} style={styles.input} />
        )}
    </label>
);

const SummaryLine = ({ label, value }) => (
    <div style={styles.summaryLine}>
        <span>{label}</span>
        <strong>{value}</strong>
    </div>
);

const styles = {
    page: { display: "grid", gap: 16 },
    windowShell: {
        background: "var(--panel-gradient)",
        border: "1px solid var(--panel-border)",
        boxShadow: "var(--shadow)",
        borderRadius: 30,
        padding: 18,
        display: "grid",
        gap: 16,
    },
    titleBar: {
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "start",
        flexWrap: "wrap",
        padding: "4px 4px 0",
    },
    pageEyebrow: { color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 12, fontWeight: 800, marginBottom: 6 },
    titleText: { fontWeight: 800, fontSize: "1.85rem", lineHeight: 1.04 },
    titleMeta: { display: "flex", gap: 10, flexWrap: "wrap", color: "var(--text-soft)", fontSize: 12, alignItems: "center" },
    metaPill: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 12px",
        borderRadius: 999,
        background: "var(--surface)",
        border: "1px solid var(--line)",
        boxShadow: "0 8px 18px rgba(24, 34, 28, 0.05)",
    },
    commandStrip: { display: "grid", gridTemplateColumns: "1.2fr auto auto", gap: 12, alignItems: "start" },
    filterBlock: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        padding: 12,
        borderRadius: 22,
        background: "var(--surface-soft)",
        border: "1px solid var(--line)",
    },
    dateField: { display: "grid", gap: 6, minWidth: 156 },
    dateLabel: { fontWeight: 700, fontSize: 12, color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.06em" },
    dateInput: { padding: "11px 12px", borderRadius: 14, border: "1px solid var(--field-border)", background: "var(--field-bg)", minWidth: 138, color: "var(--field-text)" },
    topButtons: { display: "flex", gap: 8, alignItems: "center" },
    sessionButtons: { display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" },
    toolbarButton: {
        padding: "11px 16px",
        borderRadius: 16,
        border: "1px solid var(--button-secondary-border)",
        background: "var(--button-secondary-bg)",
        color: "var(--button-secondary-text)",
        cursor: "pointer",
        fontWeight: 700,
        minWidth: 92,
        boxShadow: "0 8px 16px rgba(24, 34, 28, 0.04)",
    },
    toolbarButtonActive: {
        padding: "11px 16px",
        borderRadius: 16,
        border: "1px solid color-mix(in srgb, var(--accent) 48%, var(--line))",
        background: "color-mix(in srgb, var(--accent) 34%, var(--surface))",
        color: "var(--text-main)",
        cursor: "pointer",
        fontWeight: 800,
        minWidth: 92,
        boxShadow: "0 10px 20px rgba(24, 34, 28, 0.06)",
    },
    errorBanner: { padding: "10px 12px", background: "#ffe8e4", color: "#aa2e1a", border: "1px solid #ebc1b8" },
    statusBanner: { padding: "10px 12px", background: "color-mix(in srgb, var(--accent) 18%, #f8faf1)", color: "var(--text-main)", border: "1px solid color-mix(in srgb, var(--accent) 28%, var(--line))" },
    contentGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 350px", gap: 12, alignItems: "start" },
    leftPane: { minWidth: 0 },
    rightPane: { display: "grid", gap: 12 },
    tabRow: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" },
    tabButton: {
        padding: "8px 12px",
        border: "1px solid var(--line)",
        borderRadius: 14,
        background: "var(--surface-soft)",
        color: "var(--text-soft)",
        cursor: "pointer",
        fontWeight: 700,
    },
    activeTab: {
        padding: "8px 12px",
        border: "1px solid color-mix(in srgb, var(--accent) 52%, var(--line))",
        borderRadius: 14,
        background: "var(--surface)",
        color: "var(--text-main)",
        cursor: "pointer",
        fontWeight: 800,
        boxShadow: "0 8px 18px rgba(24, 34, 28, 0.05)",
    },
    tableShell: {
        border: "1px solid var(--line)",
        background: "var(--surface)",
        borderRadius: 24,
        minHeight: "100%",
        maxHeight: "100%",
        overflow: "auto",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
        padding: "1rem",
    },
    sideCard: { padding: 12, display: "grid", gap: 10, borderRadius: 24, background: "var(--panel-gradient-soft)", border: "1px solid var(--panel-border-soft)" },
    sideTableWrap: { border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 18, minHeight: 228, maxHeight: 228, overflow: "auto", padding: "1rem" },
    actionPanel: { padding: 14, display: "grid", gap: 12, minHeight: 214, borderRadius: 24, background: "var(--panel-gradient-soft)", border: "1px solid var(--panel-border-soft)" },
    actionButtons: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
    dayEndCard: {
        marginTop: "auto",
        border: "1px solid var(--line)",
        background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 18%, var(--surface)) 0%, var(--surface) 100%)",
        borderRadius: 20,
        padding: 12,
        display: "grid",
        gap: 10,
        boxShadow: "0 12px 24px rgba(24, 34, 28, 0.06)",
    },
    dayEndMeta: { display: "grid", gap: 4, textAlign: "center" },
    dayEndLabel: { fontSize: 12, color: "var(--text-soft)" },
    dayEndButton: {
        border: "1px solid color-mix(in srgb, var(--accent) 48%, var(--line))",
        borderRadius: 18,
        background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 60%, #fbfddf) 0%, color-mix(in srgb, var(--accent) 22%, var(--surface)) 100%)",
        padding: "16px 12px",
        fontWeight: 800,
        cursor: "pointer",
        lineHeight: 1.4,
        color: "var(--accent-deep)",
    },
    undoDayEndButton: {
        border: "1px solid rgba(191, 165, 87, 0.52)",
        borderRadius: 16,
        background: "linear-gradient(180deg, #fff8e4 0%, #f3e4aa 100%)",
        padding: "10px 12px",
        fontWeight: 800,
        cursor: "pointer",
        color: "#6d4f08",
    },
    bottomBar: {
        display: "grid",
        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
        gap: 8,
        borderTop: "1px solid var(--line)",
        paddingTop: 12,
    },
    bottomAction: {
        border: "1px solid var(--button-secondary-border)",
        borderRadius: 18,
        background: "var(--button-secondary-bg)",
        color: "var(--button-secondary-text)",
        padding: "11px 10px",
        fontWeight: 700,
        cursor: "pointer",
    },
    bottomActionAccent: {
        border: "1px solid color-mix(in srgb, var(--accent) 48%, var(--line))",
        borderRadius: 18,
        background: "color-mix(in srgb, var(--accent) 30%, var(--surface))",
        color: "var(--accent-deep)",
        padding: "11px 10px",
        fontWeight: 800,
        cursor: "pointer",
    },
    numericCell: { textAlign: "right" },
    selectedRow: { background: "linear-gradient(135deg, var(--accent-deep) 0%, color-mix(in srgb, var(--accent-deep) 84%, #314a3d) 100%)", color: "white" },
    emptyCell: { textAlign: "center", padding: 22, color: "var(--text-soft)" },
    footerCell: { fontWeight: 700, background: "var(--surface-soft)" },
    secondaryButton: {
        border: "1px solid var(--button-secondary-border)",
        borderRadius: 16,
        background: "var(--button-secondary-bg)",
        color: "var(--button-secondary-text)",
        padding: "10px 12px",
        fontWeight: 700,
        cursor: "pointer",
    },
    primaryButton: {
        border: "none",
        borderRadius: 16,
        background: "var(--button-primary)",
        color: "var(--button-primary-text)",
        padding: "11px 16px",
        fontWeight: 800,
        cursor: "pointer",
    },
    modalBackdrop: { position: "fixed", inset: 0, background: "rgba(15, 18, 20, 0.38)", display: "grid", placeItems: "center", padding: 16, zIndex: 40 },
    modalCard: { width: "min(520px, 100%)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 24, boxShadow: "0 24px 48px rgba(20, 22, 24, 0.22)", display: "grid", gap: 14, padding: 18 },
    modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
    closeIcon: { border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-soft)", width: 32, height: 32, cursor: "pointer" },
    modalBody: { display: "grid", gap: 14 },
    field: { display: "grid", gap: 6 },
    fieldLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-soft)", fontWeight: 800 },
    input: { width: "100%", padding: "12px 14px", borderRadius: 14, border: "1px solid var(--field-border)", background: "var(--field-bg)", color: "var(--field-text)" },
    textarea: { width: "100%", minHeight: 100, padding: "12px 14px", borderRadius: 14, border: "1px solid var(--field-border)", background: "var(--field-bg)", color: "var(--field-text)", resize: "vertical" },
    summaryLine: { display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--line)" },
    confirmText: { margin: 0, lineHeight: 1.6, color: "var(--text-main)" },
    actions: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },
};

export default CashBook;
