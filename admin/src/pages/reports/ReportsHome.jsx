import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchReportSummary } from "../../services/reportService";

const reportCards = [
    { to: "/reports/sales", icon: "bx bx-line-chart", title: "Sales Report", key: "sales", detail: "Invoice list, returns, and totals." },
    { to: "/reports/purchase", icon: "bx bx-cart", title: "Purchase Report", key: "purchases", detail: "Bills, receiving, and supplier spend." },
    { to: "/reports/stock", icon: "bx bx-package", title: "Stock Report", key: "inventory", detail: "Current on-hand quantities and value." },
    { to: "/reports/gst", icon: "bx bx-receipt", title: "GST Report", key: "gst", detail: "Input and output GST summaries." },
    { to: "/reports/gst-compliance", icon: "bx bx-file-find", title: "GST Compliance", key: "gstCompliance", detail: "GSTR-1, GSTR-3B, HSN, ITC, and mismatch checks." },
    { to: "/reports/profit-loss", icon: "bx bx-trending-up", title: "Profit & Loss", key: "profitLoss", detail: "Quick profitability snapshot." },
    { to: "/reports/comparative", icon: "bx bx-git-compare", title: "Comparative Report", key: "comparative", detail: "Month-wise sales, purchase, and profit movement." },
    { to: "/reports/margin", icon: "bx bx-line-chart-down", title: "Margin Report", key: "margin", detail: "Item margin estimate with bill drill-down." },
    { to: "/reports/salesman", icon: "bx bx-user-voice", title: "Salesman Report", key: "salesman", detail: "Sales grouped by counter staff." },
    { to: "/reports/vendor-performance", icon: "bx bx-store", title: "Vendor Performance", key: "vendor", detail: "Supplier bill count, quantity, and spend." },
    { to: "/reports/customer-performance", icon: "bx bx-user-check", title: "Customer Performance", key: "customer", detail: "Customer value and repeat contribution." },
    { to: "/reports/inventory-ageing", icon: "bx bx-time-five", title: "Inventory Ageing", key: "ageing", detail: "Stock age buckets and blocked value." },
    { to: "/accounting/ledger-list", icon: "bx bx-book", title: "Ledger List", key: "ledger", detail: "Customer and party ledgers." },
];

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const ReportsHome = () => {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchReportSummary()
            .then((data) => {
                setSummary(data.data || data);
                setError(null);
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const stats = useMemo(() => ([
        { label: "Inventory Stock", value: summary?.inventory?.totalStock || 0 },
        { label: "Inventory Value", value: money(summary?.inventory?.totalValue) },
        { label: "Sales Total", value: money(summary?.sales?.totalAmount) },
        { label: "Purchase Total", value: money(summary?.purchases?.totalAmount) },
    ]), [summary]);

    return (
        <div className="container-fluid p-0 flex-grow-1">
            <div className="page-header card">
                <div className="card-body">
                    <div>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-2">
                                <li className="breadcrumb-item"><Link to="/">Home</Link></li>
                                <li className="breadcrumb-item active" aria-current="page">Reports</li>
                            </ol>
                        </nav>
                        <p className="section-label">Reports</p>
                        <h1>Reports Hub</h1>
                        <p className="mb-0 text-muted">Launch operational, sales, purchase, inventory, GST, accounting, and profit reports.</p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-check-circle" /> {loading ? "Loading" : "Ready"}</span>
                        <button className="btn btn_style" type="button" onClick={() => window.print()}><i className="bx bx-printer" /><span>Print</span></button>
                    </div>
                </div>
            </div>

            {error ? <div className="alert alert-danger">{error}</div> : null}

            <div className="row g-3 mb-3">
                {stats.map((stat) => (
                    <div className="col-12 col-sm-6 col-xl-3" key={stat.label}>
                        <div className="card app-card h-100">
                            <div className="card-body">
                                <span className="text-muted d-block mb-1">{stat.label}</span>
                                <h3 className="mb-0">{stat.value}</h3>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="row g-3">
                {reportCards.map((card) => (
                    <div className="col-12 col-sm-6 col-xl-4" key={card.to}>
                        <Link className="module-card" to={card.to}>
                            <i className={card.icon} />
                            <span>{card.title}</span>
                            <small>{card.detail}</small>
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ReportsHome;
