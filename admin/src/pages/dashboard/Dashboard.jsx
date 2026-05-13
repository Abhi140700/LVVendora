import React, { useEffect, useMemo, useRef, useState } from "react";
import ApexCharts from "apexcharts";
import { Link } from "react-router-dom";
import api from "../../app/axios";
import chartSuccessIcon from "../../assets/img/icons/chart-success.png";
import ccPrimaryIcon from "../../assets/img/icons/cc-primary.png";
import gamificationAvatar from "../../assets/img/man-with-laptop-light.png";
import paypalIcon from "../../assets/img/icons/paypal.png";
import walletInfoIcon from "../../assets/img/icons/wallet-info.png";

const REPORT_ROLES = ["superadmin", "admin", "accountant", "manager"];
const WORKBENCH_ROLES = ["superadmin", "admin", "sales", "manager"];
const STOCK_ROLES = ["superadmin", "admin", "stock", "manager"];
const FINANCE_ROLES = ["superadmin", "admin", "accountant", "manager"];

const fetchWithAuth = async (path) => {
    const { data } = await api.get(path);
    return data;
};

const isSameDay = (value, reference = new Date()) => {
    if (!value) return false;
    const date = new Date(value);
    return date.getFullYear() === reference.getFullYear()
        && date.getMonth() === reference.getMonth()
        && date.getDate() === reference.getDate();
};

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const getPartyName = (value, fallback = "Walk-in Customer") => {
    if (!value) return fallback;
    if (typeof value === "string") return value;
    return value.name || value.partyName || fallback;
};

const sumBy = (rows, keyFn, valueFn) => Object.entries(rows.reduce((acc, row) => {
    const key = keyFn(row);
    acc[key] = (acc[key] || 0) + Number(valueFn(row) || 0);
    return acc;
}, {})).sort((a, b) => b[1] - a[1]);

const ROLE_DASHBOARD = {
    superadmin: {
        title: "Command Center",
        copy: "Full-system health across sales, purchase, finance, stock, and security.",
        primary: "/reports",
        primaryLabel: "View Reports",
    },
    admin: {
        title: "Business Control",
        copy: "Monitor cash, GST, purchase receiving, stock, and counter activity in one place.",
        primary: "/reports",
        primaryLabel: "View Reports",
    },
    manager: {
        title: "Operations Overview",
        copy: "Track today’s counters, pending tasks, receiving, and business movement.",
        primary: "/sales/pos",
        primaryLabel: "Open POS",
    },
    sales: {
        title: "Sales Desk",
        copy: "Focus on today’s bills, held counters, customers, returns, and pending labels.",
        primary: "/sales/pos",
        primaryLabel: "Start Billing",
    },
    stock: {
        title: "Stock Desk",
        copy: "Keep receiving, low-stock items, labels, and purchase tasks moving.",
        primary: "/manage-receive",
        primaryLabel: "Manage Receive",
    },
    accountant: {
        title: "Finance Desk",
        copy: "Review GST payable, cash balance, profit, receipts, and pending credit work.",
        primary: "/accounting/cash-book",
        primaryLabel: "Open Cash Book",
    },
    guest: {
        title: "Dashboard",
        copy: "Your business overview will appear here after login permissions load.",
        primary: "/dashboard",
        primaryLabel: "Refresh",
    },
};

const Dashboard = () => {
    const role = localStorage.getItem("role") || "guest";
    const username = localStorage.getItem("username") || "User";
    const [loading, setLoading] = useState(true);
    const [sales, setSales] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [reports, setReports] = useState(null);
    const [workbench, setWorkbench] = useState(null);
    const [gstReport, setGstReport] = useState(null);
    const [profitLoss, setProfitLoss] = useState(null);
    const [cashBook, setCashBook] = useState(null);
    const [purchaseReturns, setPurchaseReturns] = useState([]);

    useEffect(() => {
        let active = true;
        const loadDashboard = async () => {
            setLoading(true);
            try {
                const [salesRes, purchasesRes, inventoryRes, reportsRes, workbenchRes, gstRes, profitRes, cashRes, purchaseReturnsRes] = await Promise.all([
                    fetchWithAuth("/sales").catch(() => ({ data: [] })),
                    fetchWithAuth("/purchases").catch(() => ({ data: [] })),
                    fetchWithAuth("/inventory").catch(() => ({ data: [] })),
                    REPORT_ROLES.includes(role) ? fetchWithAuth("/reports").catch(() => ({ data: null })) : Promise.resolve({ data: null }),
                    WORKBENCH_ROLES.includes(role) ? fetchWithAuth("/sales/workbench").catch(() => ({ data: null })) : Promise.resolve({ data: null }),
                    FINANCE_ROLES.includes(role) ? fetchWithAuth("/reports/gst").catch(() => ({ summary: null })) : Promise.resolve({ summary: null }),
                    FINANCE_ROLES.includes(role) ? fetchWithAuth("/reports/profit-loss").catch(() => ({ data: null })) : Promise.resolve({ data: null }),
                    FINANCE_ROLES.includes(role) ? fetchWithAuth("/reports/cash-book").catch(() => ({ data: null })) : Promise.resolve({ data: null }),
                    STOCK_ROLES.includes(role) ? fetchWithAuth("/purchase-returns").catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
                ]);
                if (!active) return;
                setSales(salesRes.data || []);
                setPurchases(purchasesRes.data || []);
                setInventory(inventoryRes.data || []);
                setReports(reportsRes.data || null);
                setWorkbench(workbenchRes.data || null);
                setGstReport(gstRes.summary || null);
                setProfitLoss(profitRes.data || null);
                setCashBook(cashRes.data || null);
                setPurchaseReturns(purchaseReturnsRes.data || []);
            } finally {
                if (active) setLoading(false);
            }
        };
        loadDashboard();
        return () => { active = false; };
    }, [role]);

    const data = useMemo(() => {
        const today = new Date();
        const todaySales = sales.filter((sale) => isSameDay(sale.saleDate, today));
        const todayPurchases = purchases.filter((purchase) => isSameDay(purchase.billDate, today));
        const todayReturns = purchaseReturns.filter((entry) => isSameDay(entry.returnDate, today));
        const todaySalesAmount = todaySales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
        const todayPurchaseAmount = todayPurchases.reduce((sum, purchase) => sum + Number(purchase.finalTotal || purchase.billAmount || 0), 0);
        const currentMonthSales = sales
            .filter((sale) => {
                const date = new Date(sale.saleDate);
                return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
            })
            .reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
        const pendingLabels = purchases.filter((purchase) => !purchase.labelsPrinted).length;
        const pendingReceive = purchases.filter((purchase) => !purchase.received).length;
        const lowStockItems = inventory
            .filter((item) => Number(item.stock || 0) <= Number(item.reorderLevel || item.minimumStock || 5))
            .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));
        const lowStock = lowStockItems.length;
        const heldBills = workbench?.holds?.length || 0;
        const activeCustomers = workbench?.customers?.length || 0;
        const totalRevenue = reports?.sales?.totalAmount || todaySalesAmount;
        const totalPurchaseValue = purchases.reduce((sum, purchase) => sum + Number(purchase.finalTotal || purchase.billAmount || 0), 0);
        const cashBalance = cashBook?.summary?.cashInHand || 0;
        const gstPayable = gstReport?.gstPayable || 0;
        const profitEstimate = profitLoss?.grossProfitEstimate || (totalRevenue - totalPurchaseValue);
        const totalOrders = todaySales.length || sales.length;
        const pendingSalesReturns = sales.filter((sale) => Number(sale.totalReturnedAmount || 0) > 0).length;
        const pendingReturns = todayReturns.length + pendingSalesReturns;
        const monthlyTarget = Math.max(currentMonthSales, todaySalesAmount * 24, 100000);
        const salesTargetPercent = Math.min(100, Math.round((currentMonthSales / monthlyTarget) * 100));
        const completedTasks = [pendingReceive, pendingLabels, lowStock, pendingReturns].filter((value) => Number(value || 0) === 0).length;
        const openTasks = pendingReceive + pendingLabels + lowStock + pendingReturns;
        const recentSevenDays = Array.from({ length: 7 }, (_, index) => {
            const date = new Date();
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() - (6 - index));
            return date;
        });
        const salesTrend = recentSevenDays.map((date) =>
            sales.reduce((sum, sale) => isSameDay(sale.saleDate, date) ? sum + Number(sale.totalAmount || 0) : sum, 0)
        );
        const purchaseTrend = recentSevenDays.map((date) =>
            purchases.reduce((sum, purchase) => isSameDay(purchase.billDate, date) ? sum + Number(purchase.finalTotal || purchase.billAmount || 0) : sum, 0)
        );
        const profitTrend = salesTrend.map((value, index) => value - purchaseTrend[index]);
        const topCustomers = sumBy(sales, (sale) => getPartyName(sale.customer), (sale) => sale.totalAmount).slice(0, 5);
        const topVendors = sumBy(purchases, (purchase) => getPartyName(purchase.party, "Unknown Vendor"), (purchase) => purchase.finalTotal || purchase.billAmount).slice(0, 5);
        const topItems = sumBy(
            sales.flatMap((sale) => (sale.items || []).map((item) => ({ ...item, sale }))),
            (item) => item.name || item.itemName || item.itemId?.name || "Unknown Item",
            (item) => Number(item.qty || 0) * Number(item.sellingRate || item.saleRate || item.rate || 0),
        ).slice(0, 5);
        const alerts = [
            lowStock ? { tone: "warning", icon: "bx bx-error-circle", title: "Low stock attention", detail: `${lowStock} item(s) are at or below reorder level.`, to: "/inventory" } : null,
            pendingReceive ? { tone: "info", icon: "bx bx-package", title: "Pending purchase receive", detail: `${pendingReceive} purchase bill(s) still need receiving.`, to: "/manage-receive" } : null,
            pendingLabels ? { tone: "primary", icon: "bx bx-printer", title: "Label queue", detail: `${pendingLabels} bill(s) need barcode labels.`, to: "/label-printing" } : null,
            gstPayable > 0 ? { tone: "danger", icon: "bx bx-receipt", title: "GST payable", detail: `${money(gstPayable)} output GST net payable.`, to: "/reports/gst" } : null,
            pendingReturns ? { tone: "warning", icon: "bx bx-undo", title: "Returns activity", detail: `${pendingReturns} return-related item(s) need review.`, to: "/purchase/return-register" } : null,
        ].filter(Boolean);
        const taskCards = [
            { label: "Receive purchases", count: pendingReceive, to: "/manage-receive", icon: "bx bx-package" },
            { label: "Print pending labels", count: pendingLabels, to: "/label-printing", icon: "bx bx-printer" },
            { label: "Review low stock", count: lowStock, to: "/inventory", icon: "bx bx-box" },
            { label: "Check cash", count: money(cashBalance), to: "/accounting/cash-book", icon: "bx bx-wallet" },
            { label: "GST payable", count: money(gstPayable), to: "/reports/gst", icon: "bx bx-receipt" },
        ];

        return {
            todaySales,
            todayPurchases,
            todayReturns,
            todaySalesAmount,
            todayPurchaseAmount,
            currentMonthSales,
            monthlyTarget,
            salesTargetPercent,
            completedTasks,
            openTasks,
            pendingLabels,
            pendingReceive,
            lowStock,
            lowStockItems,
            heldBills,
            activeCustomers,
            totalRevenue,
            totalPurchaseValue,
            cashBalance,
            gstPayable,
            profitEstimate,
            totalOrders,
            pendingReturns,
            paymentDelta: todayPurchaseAmount > todaySalesAmount ? "-14.82%" : "+12.40%",
            revenueDelta: reports?.sales?.growthPercentage ? `${reports.sales.growthPercentage}%` : "+28.14%",
            salesTrend,
            purchaseTrend,
            profitTrend,
            weekLabels: recentSevenDays.map((date) => date.toLocaleDateString("en-IN", { weekday: "short" })),
            topCustomers,
            topVendors,
            topItems,
            alerts,
            taskCards,
        };
    }, [cashBook, gstReport, inventory, profitLoss, purchaseReturns, purchases, reports, sales, workbench]);

    if (loading) {
        return (
            <div className="container-fluid p-0 flex-grow-1">
                <div className="card"><div className="card-body">Loading dashboard...</div></div>
            </div>
        );
    }

    const roleProfile = ROLE_DASHBOARD[role] || ROLE_DASHBOARD.guest;
    const showFinance = FINANCE_ROLES.includes(role) || role === "superadmin";
    const showStock = STOCK_ROLES.includes(role) || role === "superadmin";
    const showSales = WORKBENCH_ROLES.includes(role) || role === "superadmin";

    const orderRows = [
        { label: "Inventory SKUs", value: inventory.length, icon: "bx bx-box", tone: "primary" },
        { label: "Low Stock", value: data.lowStock, icon: "bx bx-error-circle", tone: "warning" },
        { label: "Label Queue", value: data.pendingLabels, icon: "bx bx-printer", tone: "info" },
        { label: "Receiving", value: data.pendingReceive, icon: "bx bx-package", tone: "success" },
    ];

    const transactionRows = [
        { label: "Sales Today", detail: `${data.todaySales.length} bills`, value: money(data.todaySalesAmount), icon: paypalIcon },
        { label: "Purchases Today", detail: `${data.todayPurchases.length} bills`, value: money(data.todayPurchaseAmount), icon: walletInfoIcon },
        { label: "Held Bills", detail: "POS workbench", value: data.heldBills, icon: chartSuccessIcon },
        { label: "Customers", detail: "Workbench contacts", value: data.activeCustomers, icon: ccPrimaryIcon },
    ];

    return (
        <div className="container-fluid p-0 flex-grow-1">
            <div className="page-header card">
                <div className="card-body">
                    <div>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-2">
                                <li className="breadcrumb-item"><Link to="/">Home</Link></li>
                                <li className="breadcrumb-item active" aria-current="page">Dashboard</li>
                            </ol>
                        </nav>
                        <p className="section-label">Dashboard</p>
                        <h1>{roleProfile.title}</h1>
                        <p className="mb-0 text-muted">
                            {roleProfile.copy} Today: {data.todaySales.length} sales, {data.todayPurchases.length} purchases, {data.lowStock} low-stock alerts.
                        </p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-user-check" /> {username}</span>
                        <Link className="btn btn_style" to={roleProfile.primary}><i className="bx bx-right-arrow-alt" /><span>{roleProfile.primaryLabel}</span></Link>
                    </div>
                </div>
            </div>

            <div className="row g-3 mb-3">
                <GamificationCard
                    className="col-12 col-xl-4"
                    title={`Congratulations ${username}`}
                    subtitle="Monthly sales progress"
                    amount={money(data.currentMonthSales)}
                    progress={`${data.salesTargetPercent}% of target`}
                    icon="bx bx-trophy"
                    cta="View Sales"
                    to="/reports/sales"
                    tone="warning"
                />
                <GamificationCard
                    className="col-12 col-xl-8"
                    title="Today’s Counter Badge"
                    subtitle={`${data.todaySales.length} bills completed today. ${data.openTasks} action item(s) still need attention.`}
                    amount={money(data.todaySalesAmount)}
                    progress={`${data.completedTasks}/4 task groups clear`}
                    icon="bx bx-badge-check"
                    cta="Open POS"
                    to="/sales/pos"
                    tone="primary"
                    wide
                    image={gamificationAvatar}
                />
            </div>

            <div className="row g-3 mb-3">
                <MetricCard className="col-12 col-sm-6 col-xl-3" icon={chartSuccessIcon} label="Revenue" value={money(data.totalRevenue)} delta={data.revenueDelta} positive />
                <MetricCard className="col-12 col-sm-6 col-xl-3" icon={walletInfoIcon} label={showFinance ? "Cash Balance" : "Purchases"} value={showFinance ? money(data.cashBalance) : money(data.todayPurchaseAmount)} delta={showFinance ? money(data.gstPayable) : data.paymentDelta} positive={showFinance ? data.cashBalance >= 0 : data.paymentDelta.startsWith("+")} />
                <MetricCard className="col-12 col-sm-6 col-xl-3" icon={paypalIcon} label="POS Holds" value={data.heldBills} delta={`${data.pendingLabels} labels`} positive={data.pendingLabels === 0} />
                <MetricCard className="col-12 col-sm-6 col-xl-3" icon={ccPrimaryIcon} label="Transactions" value={data.totalOrders} delta={`${data.todaySales.length} today`} positive />
            </div>

            <div className="row g-3 mb-4">
                {showSales ? <DashboardTile label="Today's Sales" value={money(data.todaySalesAmount)} detail={`${data.todaySales.length} bills`} icon="bx bx-store-alt" to="/sales/pos" tone="success" /> : null}
                {showStock ? <DashboardTile label="Today's Purchase" value={money(data.todayPurchaseAmount)} detail={`${data.todayPurchases.length} bills`} icon="bx bx-cart-add" to="/purchase" tone="primary" /> : null}
                {showStock ? <DashboardTile label="Low Stock" value={data.lowStock} detail={data.lowStockItems[0]?.name || "No item below level"} icon="bx bx-error" to="/inventory" tone="warning" /> : null}
                {showFinance ? <DashboardTile label="GST Payable" value={money(data.gstPayable)} detail={`Output minus input GST`} icon="bx bx-receipt" to="/reports/gst" tone={data.gstPayable > 0 ? "danger" : "success"} /> : null}
                {showFinance ? <DashboardTile label="Profit Estimate" value={money(data.profitEstimate)} detail="Net sales minus net purchases" icon="bx bx-line-chart" to="/reports/profit-loss" tone={data.profitEstimate >= 0 ? "success" : "danger"} /> : null}
                <DashboardTile label="Pending Returns" value={data.pendingReturns} detail={`${data.todayReturns.length} purchase returns today`} icon="bx bx-undo" to="/purchase/return-register" tone="info" />
            </div>

            <div className="row">
                <div className="col-12 col-lg-8 order-2 order-md-3 order-lg-2 mb-4">
                    <div className="card app-card">
                        <div className="row row-bordered g-0">
                            <div className="col-md-8">
                                <div className="card-header app-card-header">
                                    <div>
                                        <h2>Sales & Purchase Trend</h2>
                                        <p>Seven-day movement from live bills.</p>
                                    </div>
                                </div>
                                <ApexChart
                                    className="px-2"
                                    height={310}
                                    type="bar"
                                    options={{
                                        chart: { toolbar: { show: false }, stacked: false },
                                        plotOptions: { bar: { borderRadius: 6, columnWidth: "36%" } },
                                        dataLabels: { enabled: false },
                                        colors: ["#696cff", "#03c3ec"],
                                        xaxis: { categories: data.weekLabels },
                                        yaxis: { labels: { formatter: (value) => `${Math.round(value / 1000)}k` } },
                                        grid: { borderColor: "#eceef1", strokeDashArray: 3 },
                                        legend: { position: "top", horizontalAlign: "left" },
                                    }}
                                    series={[
                                        { name: "Sales", data: data.salesTrend },
                                        { name: "Purchases", data: data.purchaseTrend },
                                    ]}
                                />
                            </div>
                            <div className="col-md-4">
                                <div className="card-body text-center">
                                    <span className="metric-pill">Today</span>
                                </div>
                                <ApexChart
                                    height={150}
                                    type="radialBar"
                                    options={{
                                        chart: { sparkline: { enabled: true } },
                                        colors: ["#696cff"],
                                        plotOptions: {
                                            radialBar: {
                                                hollow: { size: "58%" },
                                                dataLabels: { name: { show: false }, value: { formatter: (value) => `${Math.round(value)}%` } },
                                            },
                                        },
                                    }}
                                    series={[Math.min(Math.max(data.todaySales.length * 10, 8), 100)]}
                                />
                                <div className="text-center fw-semibold pt-3 mb-2">{data.revenueDelta} Company Growth</div>
                                <div className="d-flex px-xxl-4 px-lg-2 p-4 gap-3 justify-content-between">
                                    <MiniFigure label="Sales" value={money(data.todaySalesAmount)} icon="bx bx-rupee" />
                                    <MiniFigure label="Purchase" value={money(data.todayPurchaseAmount)} icon="bx bx-cart" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-lg-4 order-3 order-md-2 mb-4">
                    <div className="card app-card h-100">
                        <div className="card-body">
                            <div className="d-flex justify-content-between flex-sm-row flex-column gap-3">
                                <div className="d-flex flex-sm-column flex-row align-items-start justify-content-between">
                                    <div className="card-title">
                                        <h5 className="text-nowrap mb-2">{showFinance ? "Profit Trend" : "Revenue Trend"}</h5>
                                        <span className="badge bg-label-warning rounded-pill">Live</span>
                                    </div>
                                    <div className="mt-sm-auto">
                                        <small className="text-success text-nowrap fw-semibold"><i className="bx bx-chevron-up" /> {data.revenueDelta}</small>
                                        <h3 className="mb-0">{money(showFinance ? data.profitEstimate : data.totalRevenue)}</h3>
                                    </div>
                                </div>
                                <ApexChart
                                    height={90}
                                    width={140}
                                    type="line"
                                    options={{ chart: { sparkline: { enabled: true } }, stroke: { width: 4, curve: "smooth" }, colors: ["#ffab00"], tooltip: { enabled: false } }}
                                    series={[{ name: showFinance ? "Profit" : "Revenue", data: showFinance ? data.profitTrend : data.salesTrend }]}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="content-wrapper">
                <div className="flex-grow-1">
                    <div className="row">
                        <div className="col-md-6 col-lg-4 col-xl-4 order-0 mb-4">
                            <div className="card app-card h-100">
                                <div className="card-header d-flex align-items-center justify-content-between pb-0">
                                    <div className="card-title mb-0">
                                        <h5 className="m-0 me-2">Operational Statistics</h5>
                                        <small className="text-muted">{money(data.totalRevenue)} Total Sales</small>
                                    </div>
                                </div>
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <div className="d-flex flex-column align-items-center gap-1">
                                            <h2 className="mb-2">{data.totalOrders}</h2>
                                            <span>Total Orders</span>
                                        </div>
                                        <ApexChart
                                            height={120}
                                            width={120}
                                            type="donut"
                                            options={{
                                                chart: { sparkline: { enabled: true } },
                                                labels: ["Sales", "Purchase", "Pending"],
                                                colors: ["#696cff", "#03c3ec", "#ffab00"],
                                                legend: { show: false },
                                                dataLabels: { enabled: false },
                                            }}
                                            series={[Math.max(data.todaySales.length, 1), Math.max(data.todayPurchases.length, 1), Math.max(data.pendingReceive, 1)]}
                                        />
                                    </div>
                                    <ul className="p-0 m-0">
                                        {orderRows.map((row) => (
                                            <li className="d-flex mb-4 pb-1" key={row.label}>
                                                <div className="avatar flex-shrink-0 me-3"><span className={`avatar-initial rounded bg-label-${row.tone}`}><i className={row.icon} /></span></div>
                                                <div className="d-flex w-100 flex-wrap align-items-center justify-content-between gap-2">
                                                    <div className="me-2"><h6 className="mb-0">{row.label}</h6></div>
                                                    <div className="user-progress"><small className="fw-semibold">{row.value}</small></div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6 col-lg-4 order-1 mb-4">
                            <div className="card app-card h-100">
                                <div className="card-header app-card-header">
                                    <div>
                                        <h2>Cash & Profit</h2>
                                        <p>Cash balance and recent movement.</p>
                                    </div>
                                </div>
                                <div className="card-body">
                                    <div className="d-flex p-4 pt-3">
                                        <div className="avatar flex-shrink-0 me-3"><img src={walletInfoIcon} alt="" className="img-fluid w-50" /></div>
                                        <div>
                                            <small className="text-muted d-block">Cash Balance</small>
                                            <div className="d-flex align-items-center">
                                                <h6 className="mb-0 me-1">{money(data.cashBalance)}</h6>
                                                <small className={`${data.profitEstimate >= 0 ? "text-success" : "text-danger"} fw-semibold`}><i className="bx bx-chevron-up" /> {money(data.profitEstimate)}</small>
                                            </div>
                                        </div>
                                    </div>
                                    <ApexChart
                                        height={170}
                                        type="area"
                                        options={{
                                            chart: { toolbar: { show: false }, sparkline: { enabled: false } },
                                            stroke: { curve: "smooth", width: 3 },
                                            colors: ["#696cff"],
                                            dataLabels: { enabled: false },
                                            xaxis: { categories: data.weekLabels },
                                            grid: { borderColor: "#eceef1", strokeDashArray: 3 },
                                        }}
                                        series={[{ name: "Profit", data: data.profitTrend }]}
                                    />
                                    <div className="d-flex justify-content-center pt-4 gap-2">
                                        <div className="flex-shrink-0"><span className="badge bg-label-primary p-3"><i className="bx bx-wallet" /></span></div>
                                        <div><p className="mb-n1 mt-1">Expenses This Week</p><small className="text-muted">{money(data.todayPurchaseAmount)} purchase value today</small></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6 col-lg-4 order-2 mb-4">
                            <div className="card app-card h-100">
                                <div className="card-header d-flex align-items-center justify-content-between">
                                    <h5 className="card-title m-0 me-2">Transactions</h5>
                                </div>
                                <div className="card-body">
                                    <ul className="p-0 m-0">
                                        {transactionRows.map((row) => (
                                            <li className="d-flex mb-4 pb-1" key={row.label}>
                                                <div className="avatar flex-shrink-0 me-3"><img src={row.icon} alt="" className="rounded" /></div>
                                                <div className="d-flex w-100 flex-wrap align-items-center justify-content-between gap-2">
                                                    <div className="me-2"><small className="text-muted d-block mb-1">{row.label}</small><h6 className="mb-0">{row.detail}</h6></div>
                                                    <div className="user-progress d-flex align-items-center gap-1"><h6 className="mb-0">{row.value}</h6></div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row g-3">
                <div className="col-12 col-xl-4">
                    <InfoListCard title="Alerts" subtitle="Items needing attention now" rows={data.alerts} empty="No urgent alerts right now." />
                </div>
                <div className="col-12 col-xl-4">
                    <TaskCard rows={data.taskCards} />
                </div>
                <div className="col-12 col-xl-4">
                    <TopListCard title={showStock ? "Top Vendors" : "Top Customers"} rows={showStock ? data.topVendors : data.topCustomers} fallbackRows={data.topItems} />
                </div>
            </div>
        </div>
    );
};

const DashboardTile = ({ label, value, detail, icon, to, tone }) => (
    <div className="col-12 col-sm-6 col-xl-2">
        <Link className="card app-card h-100 text-decoration-none" to={to}>
            <div className="card-body">
                <span className={`avatar-initial rounded bg-label-${tone} d-inline-flex mb-3 p-2`}><i className={icon} /></span>
                <span className="text-muted d-block mb-1">{label}</span>
                <h4 className="mb-1 text-body">{value}</h4>
                <small className="text-muted">{detail}</small>
            </div>
        </Link>
    </div>
);

const GamificationCard = ({
    className = "col-12 col-xl-4",
    title,
    subtitle,
    amount,
    progress,
    icon,
    cta,
    to,
    tone = "primary",
    wide = false,
    image = null,
}) => (
    <div className={className}>
        <section className={`card app-card dashboard-game-card dashboard-game-card--${tone} ${wide ? "dashboard-game-card--wide" : ""}`}>
            <div className="dashboard-game-card__body">
                <div className="dashboard-game-card__copy">
                    <span className={`dashboard-game-card__badge bg-label-${tone}`}>
                        <i className={icon} />
                    </span>
                    <h2>{title}</h2>
                    <p>{subtitle}</p>
                    <strong>{amount}</strong>
                    <span>{progress}</span>
                    <Link className="btn btn-sm btn_style dashboard-game-card__button" to={to}>
                        <i className="bx bx-right-arrow-alt" />
                        <span>{cta}</span>
                    </Link>
                </div>
                <div className="dashboard-game-card__art" aria-hidden="true">
                    {image ? (
                        <img src={image} alt="" />
                    ) : (
                        <span className="dashboard-game-card__trophy"><i className="bx bx-trophy" /></span>
                    )}
                </div>
            </div>
        </section>
    </div>
);

const InfoListCard = ({ title, subtitle, rows, empty }) => (
    <section className="card app-card h-100">
        <div className="card-header app-card-header"><div><h2>{title}</h2><p>{subtitle}</p></div></div>
        <div className="card-body">
            {rows.length ? rows.map((row) => (
                <Link className="quick-action mb-2 text-decoration-none" to={row.to} key={row.title}>
                    <span className={`avatar-initial rounded bg-label-${row.tone} me-2`}><i className={row.icon} /></span>
                    <span className="d-grid"><strong>{row.title}</strong><small className="text-muted">{row.detail}</small></span>
                </Link>
            )) : <div className="text-muted">{empty}</div>}
        </div>
    </section>
);

const TaskCard = ({ rows }) => (
    <section className="card app-card h-100">
        <div className="card-header app-card-header"><div><h2>Task Cards</h2><p>Shortcuts for daily follow-up.</p></div></div>
        <div className="card-body">
            {rows.map((row) => (
                <Link className="summary-line text-decoration-none" to={row.to} key={row.label}>
                    <span><i className={`${row.icon} me-2`} />{row.label}</span>
                    <strong>{row.count}</strong>
                </Link>
            ))}
        </div>
    </section>
);

const TopListCard = ({ title, rows, fallbackRows }) => {
    const list = rows.length ? rows : fallbackRows;
    return (
        <section className="card app-card h-100">
            <div className="card-header app-card-header"><div><h2>{title}</h2><p>{rows.length ? "Ranked by value." : "Top items by sale value."}</p></div></div>
            <div className="card-body">
                {list.length ? list.map(([label, value], index) => (
                    <div className="summary-line" key={`${label}-${index}`}>
                        <span>{index + 1}. {label}</span>
                        <strong>{money(value)}</strong>
                    </div>
                )) : <div className="text-muted">No ranking data yet.</div>}
            </div>
        </section>
    );
};

const MetricCard = ({ className = "col-lg-2 col-md-6", icon, label, value, delta, positive }) => (
    <div className={className}>
        <div className="card app-card h-100">
            <div className="card-body">
                <div className="card-title d-flex align-items-start justify-content-between mb-3">
                    <div className="avatar flex-shrink-0"><img src={icon} alt="" className="rounded" /></div>
                </div>
                <span className="d-block mb-1">{label}</span>
                <h3 className="card-title text-nowrap mb-2">{value}</h3>
                <small className={`${positive ? "text-success" : "text-danger"} fw-semibold`}>
                    <i className={`bx ${positive ? "bx-up-arrow-alt" : "bx-down-arrow-alt"}`} /> {delta}
                </small>
            </div>
        </div>
    </div>
);

const MiniFigure = ({ label, value, icon }) => (
    <div className="d-flex">
        <div className="me-2"><span className="badge bg-label-primary p-2"><i className={`${icon} text-primary`} /></span></div>
        <div className="d-flex flex-column"><small>{label}</small><h6 className="mb-0">{value}</h6></div>
    </div>
);

const ApexChart = ({ type, series, options, height, width, className = "" }) => {
    const chartRef = useRef(null);

    useEffect(() => {
        if (!chartRef.current) return undefined;
        const chart = new ApexCharts(chartRef.current, {
            ...options,
            chart: {
                ...(options.chart || {}),
                type,
                height,
                width,
                fontFamily: "Public Sans, sans-serif",
            },
            series,
        });
        chart.render();
        return () => chart.destroy();
    }, [height, options, series, type, width]);

    return <div ref={chartRef} className={className} />;
};

export default Dashboard;
