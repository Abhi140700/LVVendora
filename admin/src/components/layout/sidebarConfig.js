import { ROLE_GROUPS } from "../../utils/permissions";

export const sidebarSections = [
  {
    header: "Main",
    items: [
      { label: "Dashboard", icon: "bx bx-home-circle", path: "/" },
    ],
  },
  {
    header: "Operations",
    items: [
      {
        label: "Masters",
        icon: "bx bx-customize",
        id: "submenuMasters",
        allowedRoles: ROLE_GROUPS.stockOps,
        children: [
          { label: "Party", path: "/masters/party", allowedRoles: ROLE_GROUPS.stockOps },
          { label: "Category", path: "/masters/category", allowedRoles: ROLE_GROUPS.adminOnly },
          { label: "Items", path: "/masters/items", allowedRoles: ROLE_GROUPS.adminOnly },
          { label: "Warehouse", path: "/masters/warehouse", allowedRoles: ROLE_GROUPS.stockOps },
        ],
      },
      {
        label: "Purchase",
        icon: "bx bx-cart-add",
        id: "submenuPurchase",
        allowedRoles: ROLE_GROUPS.stockOps,
        children: [
          { label: "Purchase List", path: "/purchase/list", allowedRoles: ROLE_GROUPS.stockOps },
          { label: "New Purchase", path: "/purchase/entry", allowedRoles: ROLE_GROUPS.stockOps },
          { label: "LR ID Lookup", path: "/purchase/lr-id-lookup", allowedRoles: ROLE_GROUPS.stockOps },
          { label: "Purchase Return", path: "/purchase/return", allowedRoles: ROLE_GROUPS.stockOps },
          { label: "Return Register", path: "/purchase/return-register", allowedRoles: ROLE_GROUPS.stockOps },
        ],
      },
      { label: "Label Printing", icon: "bx bx-printer", path: "/label-printing", allowedRoles: ROLE_GROUPS.stockOps },
      { label: "Manage Receive", icon: "bx bx-package", path: "/manage-receive", allowedRoles: ROLE_GROUPS.stockOps },
      {
        label: "Sales",
        icon: "bx bx-store-alt",
        id: "submenuSales",
        allowedRoles: ROLE_GROUPS.salesRead,
        children: [
          { label: "POS Billing", path: "/sales/pos", allowedRoles: ROLE_GROUPS.salesOps },
          { label: "Sales Invoice", path: "/sales/invoice", allowedRoles: ROLE_GROUPS.salesRead },
          { label: "Quotations", path: "/sales/quotations", allowedRoles: ROLE_GROUPS.salesRead },
          { label: "Sales Return", path: "/sales/return", allowedRoles: ROLE_GROUPS.salesOps },
        ],
      },
      {
        label: "Customers",
        icon: "bx bx-user-circle",
        id: "submenuCustomers",
        allowedRoles: ROLE_GROUPS.stockOps,
        children: [
          { label: "All Customers", path: "/masters/customers", allowedRoles: ROLE_GROUPS.stockOps },
          { label: "Customer Overview", path: "/masters/customers/overview", allowedRoles: ROLE_GROUPS.stockOps },
        ],
      },
    ],
  },
  {
    header: "Inventory",
    items: [
      {
        label: "Inventory",
        icon: "bx bx-box",
        id: "submenuInventory",
        allowedRoles: ROLE_GROUPS.stockOps,
        children: [
          { label: "Inventory", path: "/inventory", allowedRoles: ROLE_GROUPS.stockOps },
          { label: "Stock Adjustment", path: "/inventory/stock-adjustment", allowedRoles: ROLE_GROUPS.stockOps },
          { label: "Stock Dashboard", path: "/inventory/stock-dashboard", allowedRoles: ROLE_GROUPS.stockOps },
          { label: "Batch Management", path: "/inventory/batch-management", allowedRoles: ROLE_GROUPS.stockOps },
          { label: "Stock Transfer", path: "/inventory/stock-transfer", allowedRoles: ROLE_GROUPS.stockOps },
        ],
      },
    ],
  },
  {
    header: "Finance",
    items: [
      {
        label: "Accounting",
        icon: "bx bx-receipt",
        id: "submenuAccounting",
        allowedRoles: ROLE_GROUPS.financeOps,
        children: [
          { label: "Receipt Entry", path: "/accounting/receipt-entry", allowedRoles: ROLE_GROUPS.financeOps },
          { label: "Cash Book", path: "/accounting/cash-book", allowedRoles: ROLE_GROUPS.financeOps },
          { label: "Payment Entry", path: "/accounting/payment-entry", allowedRoles: ROLE_GROUPS.financeOps },
          { label: "Expense Entry", path: "/accounting/expense-entry", allowedRoles: ROLE_GROUPS.financeOps },
          { label: "Journal Entry", path: "/accounting/journal-entry", allowedRoles: ROLE_GROUPS.financeOps },
          { label: "Ledger List", path: "/accounting/ledger-list", allowedRoles: ROLE_GROUPS.financeOps },
        ],
      },
      {
        label: "Reports",
        icon: "bx bx-bar-chart-alt-2",
        id: "submenuReports",
        allowedRoles: ROLE_GROUPS.financeRead,
        children: [
          { label: "Reports Hub", path: "/reports", allowedRoles: ROLE_GROUPS.financeRead },
          { label: "Sales Report", path: "/reports/sales", allowedRoles: ROLE_GROUPS.financeRead },
          { label: "Purchase Report", path: "/reports/purchase", allowedRoles: ROLE_GROUPS.financeRead },
          { label: "Stock Report", path: "/reports/stock", allowedRoles: ROLE_GROUPS.financeRead },
          { label: "GST Report", path: "/reports/gst", allowedRoles: ROLE_GROUPS.financeRead },
          { label: "GST Compliance", path: "/reports/gst-compliance", allowedRoles: ROLE_GROUPS.financeRead },
          { label: "Profit & Loss", path: "/reports/profit-loss", allowedRoles: ROLE_GROUPS.financeRead },
          { label: "Margin Report", path: "/reports/margin", allowedRoles: ROLE_GROUPS.financeRead },
          { label: "Salesman Report", path: "/reports/salesman", allowedRoles: ROLE_GROUPS.financeRead },
          { label: "Vendor Performance", path: "/reports/vendor-performance", allowedRoles: ROLE_GROUPS.financeRead },
          { label: "Customer Performance", path: "/reports/customer-performance", allowedRoles: ROLE_GROUPS.financeRead },
          { label: "Inventory Ageing", path: "/reports/inventory-ageing", allowedRoles: ROLE_GROUPS.financeRead },
          { label: "Comparative Report", path: "/reports/comparative", allowedRoles: ROLE_GROUPS.financeRead },
        ],
      },
      {
        label: "Tally",
        icon: "bx bx-sync",
        id: "submenuTally",
        allowedRoles: ROLE_GROUPS.tallyOps,
        children: [
          { label: "Tally Sync", path: "/tally/sync", allowedRoles: ROLE_GROUPS.tallyOps },
          { label: "Tally Logs", path: "/tally/logs", allowedRoles: ROLE_GROUPS.tallyOps },
          { label: "Tally Settings", path: "/tally/settings", allowedRoles: ROLE_GROUPS.tallyOps },
        ],
      },
    ],
  },
  {
    header: "Admin",
    items: [
      {
        label: "Settings",
        icon: "bx bx-cog",
        id: "submenuSettings",
        allowedRoles: ROLE_GROUPS.settingsOps,
        children: [
          { label: "Settings Desk", path: "/settings", allowedRoles: ROLE_GROUPS.settingsOps },
          { label: "Company Settings", path: "/settings/company", allowedRoles: ROLE_GROUPS.settingsOps },
          { label: "GST Settings", path: "/settings/gst", allowedRoles: ROLE_GROUPS.settingsOps },
          { label: "Printer Settings", path: "/settings/printer", allowedRoles: ROLE_GROUPS.settingsOps },
          { label: "Backup Settings", path: "/settings/backup", allowedRoles: ROLE_GROUPS.settingsOps },
        ],
      },
      {
        label: "Users",
        icon: "bx bx-user-check",
        id: "submenuUsers",
        allowedRoles: ROLE_GROUPS.adminOnly,
        children: [
          { label: "User List", path: "/users", allowedRoles: ROLE_GROUPS.adminOnly },
          { label: "Role Management", path: "/users/roles", allowedRoles: ROLE_GROUPS.adminOnly },
          { label: "Permission Matrix", path: "/users/permissions", allowedRoles: ROLE_GROUPS.adminOnly },
        ],
      },
    ],
  },
];
