# Migration Map

Backend source: `/private/tmp/pos-system-inspect/pos-system/server` -> `server/`

Frontend logic source: `/private/tmp/pos-system-inspect/pos-system/admin/src` -> `admin/src`

| Old logic file | New target file | Backend API used |
| --- | --- | --- |
| `src/api/axios.js`, `src/app/axios.js`, `src/utils/api.js` | `admin/src/api/axios.js`, `admin/src/app/axios.js`, `admin/src/utils/api.js` | Base `/api`, bearer token from `localStorage.token` |
| `src/redux/*.js`, `src/app/store.js`, `src/app/rootReducer.js` | `admin/src/redux/*.js`, `admin/src/app/store.js`, `admin/src/app/rootReducer.js` | Auth, party, item, purchase, sales, inventory state |
| `src/pages/auth/*` | `admin/src/pages/auth/*` | `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password` |
| `src/pages/dashboard/Dashboard.jsx` | `admin/src/pages/dashboard/Dashboard.jsx` | `/api/sales`, `/api/purchases`, `/api/inventory`, `/api/reports`, `/api/sales/workbench` |
| `src/pages/masters/party/*` | `admin/src/pages/masters/party/*` | `/api/parties`, `/api/parties/next-code`, `/api/parties/gst/:gstNo` |
| `src/pages/masters/category/*` | `admin/src/pages/masters/category/*` | `/api/categories` |
| `src/pages/masters/item/*` | `admin/src/pages/masters/item/*` | `/api/inventory`, `/api/categories`, `/api/brands`, `/api/label/next-barcode` |
| `src/pages/masters/warehouse/*` | `admin/src/pages/masters/warehouse/*` | Local warehouse UI logic retained |
| `src/pages/purchase/*` | `admin/src/pages/purchase/*` | `/api/purchases`, `/api/purchases/next-grn`, `/api/purchases/next-lr-id`, `/api/purchases/lr-entry`, `/api/purchase-returns` |
| `src/pages/sales/*` | `admin/src/pages/sales/*` | `/api/sales`, `/api/sales/workbench`, `/api/sales/next-bill-no`, `/api/sales/session/*`, `/api/sales/draft`, `/api/sales/hold`, `/api/sales/customers`, `/api/sales/return/:saleId` |
| `src/pages/accounting/*` | `admin/src/pages/accounting/*` | `/api/accounting/customers`, `/api/accounting/receipts`, `/api/accounting/ledger/:customerId`, `/api/accounting/ledger-adjustments`, `/api/accounting/expense-entries`, `/api/reports/cash-book` |
| `src/pages/inventory/*` | `admin/src/pages/inventory/*` | `/api/inventory`, `/api/inventory/adjust`, `/api/inventory/transfer`, `/api/inventory/batches`, `/api/inventory/lookup/:barcode` |
| `src/pages/manageReceive/ManageReceive.jsx` | `admin/src/pages/manageReceive/ManageReceive.jsx` | `/api/purchases`, `/api/purchases/:billId/receive`, `/api/purchases/:billId/lr-details` |
| `src/pages/labelPrinting/*` | `admin/src/pages/labelPrinting/*` | `/api/label/create`, `/api/label/reprint/:labelId`, `/api/label/next-barcode`, `/api/label/history/:billId`, `/api/label/item/:itemId` |
| `src/pages/reports/*` | `admin/src/pages/reports/*` | `/api/reports`, `/api/reports/sales`, `/api/reports/purchase`, `/api/reports/stock`, `/api/reports/gst`, `/api/reports/profit-loss` |
| `src/pages/settings/*`, `src/utils/appSettings.js` | `admin/src/pages/settings/*`, `admin/src/utils/appSettings.js` | Local app settings plus `/api/settings` service support |
| `src/pages/tally/*` | `admin/src/pages/tally/*` | `/api/tally/snapshot`, `/api/tally/logs`, `/api/tally/settings`, `/api/tally/prepare`, `/api/tally/export/json`, `/api/tally/export/xml` |
| `src/pages/users/*` | `admin/src/pages/users/*` | `/api/users` |

Layout preservation: current `admin/src/components/layout/MainLayout.jsx`, `Navbar.jsx`, `Sidebar.jsx`, and `sidebarConfig.js` remain the new UI shell. They were adapted only to host React Router outlet content and preserve the requested Sneat POS sidebar structure.
