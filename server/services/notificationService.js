import Inventory from "../models/Inventory.js";
import Purchase from "../models/Purchase.js";
import PurchaseReturn from "../models/PurchaseReturn.js";
import Sales from "../models/Sales.js";
import TallySyncLog from "../models/TallySyncLog.js";
import { getWhatsAppStatus } from "./whatsappService.js";

const LOW_STOCK_LIMIT = 5;

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const makeNotification = ({
  id,
  type,
  severity = "info",
  title,
  message,
  to,
  icon = "bx bx-bell",
  createdAt = new Date(),
  channels = [],
  roles = ["admin", "manager", "superadmin"]
}) => ({
  id,
  type,
  severity,
  title,
  message,
  to,
  icon,
  createdAt,
  channels,
  roles,
  read: false
});

const roleCanSee = (notification, role) => {
  if (role === "superadmin") return true;
  return notification.roles.includes(role);
};

export const buildSystemNotifications = async ({ role = "guest" } = {}) => {
  const [
    lowStockItems,
    dueSales,
    pendingPurchases,
    recentReturns,
    failedTallyLog
  ] = await Promise.all([
    Inventory.find({ stock: { $lte: LOW_STOCK_LIMIT } }).sort({ stock: 1 }).limit(5).lean(),
    Sales.find({ creditDue: { $gt: 0 } }).sort({ saleDate: -1 }).limit(10).lean(),
    Purchase.find({ received: { $ne: true } }).sort({ billDate: -1 }).limit(10).lean(),
    PurchaseReturn.find({}).sort({ returnDate: -1 }).limit(10).lean(),
    TallySyncLog.findOne({ status: "failed" }).sort({ exportedAt: -1, createdAt: -1 }).lean()
  ]);

  const notifications = [];

  if (lowStockItems.length) {
    notifications.push(makeNotification({
      id: "low-stock",
      type: "low-stock",
      severity: "warning",
      title: "Low-stock alert",
      message: `${lowStockItems.length} item(s) are at or below ${LOW_STOCK_LIMIT} units. ${lowStockItems[0].name} has ${lowStockItems[0].stock || 0} ${lowStockItems[0].unit || "PCS"}.`,
      to: "/inventory",
      icon: "bx bx-error-circle",
      channels: ["system", "email", "sms", "whatsapp"],
      roles: ["admin", "manager", "stock"]
    }));
  }

  const totalDue = dueSales.reduce((sum, sale) => sum + Number(sale.creditDue || 0), 0);
  if (totalDue > 0) {
    notifications.push(makeNotification({
      id: "payment-due",
      type: "payment-due",
      severity: "danger",
      title: "Payment due alert",
      message: `${dueSales.length} bill(s) have pending dues totaling ${money(totalDue)}.`,
      to: "/accounting/payment-entry",
      icon: "bx bx-credit-card",
      channels: ["system", "email", "sms", "whatsapp"],
      roles: ["admin", "manager", "sales", "accountant"]
    }));
  }

  if (pendingPurchases.length) {
    notifications.push(makeNotification({
      id: "purchase-pending",
      type: "purchase-pending",
      severity: "info",
      title: "Purchase pending alert",
      message: `${pendingPurchases.length} purchase bill(s) are waiting for receive. Latest: ${pendingPurchases[0].billNo || pendingPurchases[0].grnNo || "purchase bill"}.`,
      to: "/manage-receive",
      icon: "bx bx-package",
      channels: ["system", "email", "whatsapp"],
      roles: ["admin", "manager", "stock"]
    }));
  }

  if (recentReturns.length) {
    notifications.push(makeNotification({
      id: "return-pending",
      type: "return-pending",
      severity: "warning",
      title: "Return pending alert",
      message: `${recentReturns.length} purchase return(s) need review. Latest: ${recentReturns[0].returnNo || recentReturns[0].party || "return"}.`,
      to: "/purchase/return-register",
      icon: "bx bx-undo",
      channels: ["system", "email"],
      roles: ["admin", "manager", "stock", "accountant"]
    }));
  }

  if (failedTallyLog) {
    notifications.push(makeNotification({
      id: `failed-tally-${failedTallyLog._id}`,
      type: "failed-tally-sync",
      severity: "danger",
      title: "Failed Tally sync alert",
      message: failedTallyLog.summary || "The latest Tally sync failed.",
      to: "/tally/logs",
      icon: "bx bx-sync",
      createdAt: failedTallyLog.exportedAt || failedTallyLog.createdAt,
      channels: ["system", "email"],
      roles: ["admin", "manager", "accountant"]
    }));
  }

  const whatsappStatus = getWhatsAppStatus();
  if (whatsappStatus.latestError || whatsappStatus.status === "auth_failed" || whatsappStatus.status === "disconnected") {
    notifications.push(makeNotification({
      id: "whatsapp-failure",
      type: "whatsapp-failure",
      severity: "danger",
      title: "WhatsApp failure alert",
      message: whatsappStatus.latestError || "WhatsApp client is disconnected. Reconnect before sending bills or alerts.",
      to: "/settings",
      icon: "bx bxl-whatsapp",
      channels: ["system"],
      roles: ["admin", "manager", "sales"]
    }));
  }

  const filtered = notifications.filter((notification) => roleCanSee(notification, role));

  return {
    unreadCount: filtered.length,
    channels: {
      system: true,
      email: false,
      sms: false,
      whatsapp: whatsappStatus.ready
    },
    items: filtered
  };
};
