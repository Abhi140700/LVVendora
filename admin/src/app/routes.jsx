import { BrowserRouter, Route, Routes } from "react-router-dom";

import Login from "../pages/auth/Login";
import ForgotPassword from "../pages/auth/ForgotPassword";
import ResetPassword from "../pages/auth/ResetPassword";
import Dashboard from "../pages/dashboard/Dashboard";

import PartyList from "../pages/masters/party/PartyList";
import CategoryList from "../pages/masters/category/CategoryList";
import ItemList from "../pages/masters/item/ItemList";
import WarehouseList from "../pages/masters/warehouse/WarehouseList";
import CustomerList from "../pages/masters/customer/CustomerList";
import CustomerOverview from "../pages/masters/customer/CustomerOverview";
import PurchaseList from "../pages/purchase/PurchaseList";
import PurchaseEntry from "../pages/purchase/PurchaseEntry";
import LrIdLookup from "../pages/purchase/LrIdLookup";
import PurchaseReturn from "../pages/purchase/PurchaseReturn";
import PurchaseReturnRegister from "../pages/purchase/PurchaseReturnRegister";

import SalesPOS from "../pages/sales/SalesPOS";
import SalesInvoice from "../pages/sales/SalesInvoice";
import Quotations from "../pages/sales/Quotations";
import SalesReturn from "../pages/sales/SalesReturn";

import Inventory from "../pages/inventory/Inventory";
import StockAdjustment from "../pages/inventory/StockAdjustment";
import StockDashboard from "../pages/inventory/StockDashboard";
import BatchManagement from "../pages/inventory/BatchManagement";
import StockTransfer from "../pages/inventory/StockTransfer";

import LabelPrintScreen from "../pages/labelPrinting/LabelPrintScreen";
import ManageReceive from "../pages/manageReceive/ManageReceive";
import ReportsHome from "../pages/reports/ReportsHome";
import SalesReport from "../pages/reports/SalesReport";
import PurchaseReport from "../pages/reports/PurchaseReport";
import StockReport from "../pages/reports/StockReport";
import GSTReport from "../pages/reports/GSTReport";
import ProfitLoss from "../pages/reports/ProfitLoss";
import AdvancedReport from "../pages/reports/AdvancedReport";
import ReceiptEntry from "../pages/accounting/ReceiptEntry";
import CashBook from "../pages/accounting/CashBook";
import PaymentEntry from "../pages/accounting/PaymentEntry";
import JournalEntry from "../pages/accounting/JournalEntry";
import LedgerList from "../pages/accounting/LedgerList";
import ExpenseEntry from "../pages/accounting/ExpenseEntry";
import TallySync from "../pages/tally/TallySync";
import TallyLogs from "../pages/tally/TallyLogs";
import TallySettings from "../pages/tally/TallySettings";
import SettingsDesk from "../pages/settings/SettingsDesk";
import CompanySettings from "../pages/settings/CompanySettings";
import GSTSettings from "../pages/settings/GstSettings";
import PrinterSettings from "../pages/settings/PrinterSettings";
import BackupSettings from "../pages/settings/BackupSettings";
import UserList from "../pages/users/UserList";
import RoleManagement from "../pages/users/RoleManagement";
import PermissionMatrix from "../pages/users/PermissionMatrix";

import MainLayout from "../components/layout/MainLayout";
import PrivateRoute from "../routes/PrivateRoute";

function AppRoutes() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                <Route element={<PrivateRoute />}>
                    <Route path="/" element={<MainLayout />}>
                        <Route index element={<Dashboard />} />

                        <Route element={<PrivateRoute allowedRoles={["admin", "stock"]} />}>
                            <Route path="masters/party" element={<PartyList />} />
                            <Route path="masters/warehouse" element={<WarehouseList />} />
                            <Route path="masters/customers" element={<CustomerList />} />
                            <Route path="masters/customers/overview" element={<CustomerOverview />} />
                        </Route>

                        <Route element={<PrivateRoute allowedRoles={["admin"]} />}>
                            <Route path="masters/category" element={<CategoryList />} />
                            <Route path="masters/items" element={<ItemList />} />
                            <Route path="masters/item" element={<ItemList />} />
                        </Route>

                        <Route element={<PrivateRoute allowedRoles={["admin", "stock"]} />}>
                            <Route path="purchase">
                                <Route index element={<PurchaseList />} />
                                <Route path="list" element={<PurchaseList />} />
                                <Route path="new" element={<PurchaseEntry />} />
                                <Route path="entry" element={<PurchaseEntry />} />
                                <Route path="lr-id" element={<LrIdLookup />} />
                                <Route path="lr-id-lookup" element={<LrIdLookup />} />
                                <Route path="edit/:id" element={<PurchaseEntry />} />
                                <Route path="return" element={<PurchaseReturn />} />
                                <Route path="return-register" element={<PurchaseReturnRegister />} />
                            </Route>

                            <Route path="inventory">
                                <Route index element={<Inventory />} />
                                <Route path="stock" element={<Inventory />} />
                                <Route path="adjustment" element={<StockAdjustment />} />
                                <Route path="stock-adjustment" element={<StockAdjustment />} />
                                <Route path="dashboard" element={<StockDashboard />} />
                                <Route path="stock-dashboard" element={<StockDashboard />} />
                                <Route path="batch" element={<BatchManagement />} />
                                <Route path="batch-management" element={<BatchManagement />} />
                                <Route path="transfer" element={<StockTransfer />} />
                                <Route path="stock-transfer" element={<StockTransfer />} />
                                <Route path="manage-receive" element={<ManageReceive />} />
                            </Route>
                            <Route path="label-printing" element={<LabelPrintScreen />} />
                            <Route path="manage-receive" element={<ManageReceive />} />
                        </Route>

                        <Route element={<PrivateRoute allowedRoles={["admin", "sales", "manager"]} />}>
                            <Route path="sales">
                                <Route index element={<SalesPOS />} />
                                <Route path="pos" element={<SalesPOS />} />
                                <Route path="return" element={<SalesReturn />} />
                            </Route>
                        </Route>

                        <Route element={<PrivateRoute allowedRoles={["admin", "sales", "manager", "accountant"]} />}>
                            <Route path="sales">
                                <Route path="invoice" element={<SalesInvoice />} />
                                <Route path="quotations" element={<Quotations />} />
                            </Route>
                        </Route>

                        <Route element={<PrivateRoute allowedRoles={["admin", "accountant", "manager", "sales"]} />}>
                            <Route path="reports">
                                <Route index element={<ReportsHome />} />
                                <Route path="sales" element={<SalesReport />} />
                                <Route path="purchase" element={<PurchaseReport />} />
                                <Route path="stock" element={<StockReport />} />
                                <Route path="gst" element={<GSTReport />} />
                                <Route path="gst-compliance" element={<GSTReport complianceMode />} />
                                <Route path="profit-loss" element={<ProfitLoss />} />
                                <Route path="margin" element={<AdvancedReport type="margin" />} />
                                <Route path="salesman" element={<AdvancedReport type="salesman" />} />
                                <Route path="vendor-performance" element={<AdvancedReport type="vendor-performance" />} />
                                <Route path="customer-performance" element={<AdvancedReport type="customer-performance" />} />
                                <Route path="inventory-ageing" element={<AdvancedReport type="inventory-ageing" />} />
                                <Route path="comparative" element={<AdvancedReport type="comparative" />} />
                            </Route>

                        </Route>

                        <Route element={<PrivateRoute allowedRoles={["admin", "accountant", "manager"]} />}>
                            <Route path="tally">
                                <Route path="sync" element={<TallySync />} />
                                <Route path="logs" element={<TallyLogs />} />
                                <Route path="settings" element={<TallySettings />} />
                            </Route>
                        </Route>

                        <Route element={<PrivateRoute allowedRoles={["admin", "accountant", "manager", "sales"]} />}>
                            <Route path="accounting">
                                <Route path="receipt" element={<ReceiptEntry />} />
                                <Route path="receipt-entry" element={<ReceiptEntry />} />
                                <Route path="cash-book" element={<CashBook />} />
                                <Route path="payment" element={<PaymentEntry />} />
                                <Route path="payment-entry" element={<PaymentEntry />} />
                                <Route path="expense" element={<ExpenseEntry />} />
                                <Route path="expense-entry" element={<ExpenseEntry />} />
                                <Route path="journal" element={<JournalEntry />} />
                                <Route path="journal-entry" element={<JournalEntry />} />
                                <Route path="ledger-list" element={<LedgerList />} />
                            </Route>
                        </Route>

                        <Route element={<PrivateRoute allowedRoles={["admin", "manager"]} />}>
                            <Route path="settings" element={<SettingsDesk />} />
                            <Route path="settings/company" element={<CompanySettings />} />
                            <Route path="settings/gst" element={<GSTSettings />} />
                            <Route path="settings/printer" element={<PrinterSettings />} />
                            <Route path="settings/backup" element={<BackupSettings />} />
                        </Route>

                        <Route element={<PrivateRoute allowedRoles={["admin"]} />}>
                            <Route path="users" element={<UserList />} />
                            <Route path="users/roles" element={<RoleManagement />} />
                            <Route path="users/permissions" element={<PermissionMatrix />} />
                        </Route>
                    </Route>
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default AppRoutes;
