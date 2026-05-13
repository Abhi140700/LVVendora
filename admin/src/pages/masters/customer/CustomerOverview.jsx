import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../../app/axios";
import { getApiErrorMessage } from "../../../utils/api";
import { notifyError, notifySuccess } from "../../../utils/notify";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const normalize = (value = "") => String(value || "").trim();
const initials = (name = "Customer") => normalize(name).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CU";
const customerCode = (customer) => `#${String(customer?._id || "").slice(-6).toUpperCase() || "NEW"}`;
const formatDate = (value) => value ? new Date(value).toLocaleDateString("en-IN") : "-";
const getCustomerId = (value) => String(value?._id || value || "");

const emptyCustomer = {
  name: "Customer",
  phone: "",
  email: "",
  city: "",
  state: "",
  gstNo: "",
  addressLine1: "",
  addressLine2: "",
  pincode: "",
  ledgerBalance: 0,
};

const matchesCustomer = (sale, customer) => {
  if (!customer) return false;
  return getCustomerId(sale.customerId) === String(customer._id || "")
    || (customer.phone && String(sale.customerPhone || "") === String(customer.phone))
    || normalize(sale.customer).toLowerCase() === normalize(customer.name).toLowerCase();
};

export default function CustomerOverview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get("id") || "";
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editForm, setEditForm] = useState(emptyCustomer);
  const [orderSearch, setOrderSearch] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [customersRes, salesRes] = await Promise.all([
        api.get("/parties", { params: { type: "customer" } }),
        api.get("/reports/sales").catch(() => ({ data: { data: [] } })),
      ]);
      setCustomers(customersRes.data?.data || []);
      setSales(salesRes.data?.data || []);
    } catch (error) {
      notifyError(getApiErrorMessage(error, "Failed to load customer overview"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const customer = useMemo(() => (
    customers.find((row) => String(row._id) === String(customerId))
    || customers[0]
    || emptyCustomer
  ), [customerId, customers]);

  useEffect(() => {
    setEditForm({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      city: customer.city || "",
      state: customer.state || "",
      gstNo: customer.gstNo || "",
      addressLine1: customer.addressLine1 || "",
      addressLine2: customer.addressLine2 || "",
      pincode: customer.pincode || "",
      notes: customer.notes || "",
    });
  }, [customer]);

  const customerSales = useMemo(() => (
    sales
      .filter((sale) => matchesCustomer(sale, customer))
      .sort((a, b) => new Date(b.saleDate || 0) - new Date(a.saleDate || 0))
  ), [customer, sales]);

  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();
    return query
      ? customerSales.filter((sale) => [sale.invoiceNo, sale.billNo, sale.saleDate, sale.totalAmount].join(" ").toLowerCase().includes(query))
      : customerSales;
  }, [customerSales, orderSearch]);

  const totalSpent = customerSales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
  const returnedAmount = customerSales.reduce((sum, sale) => sum + Number(sale.totalReturnedAmount || 0), 0);
  const loyaltyEarned = customerSales.reduce((sum, sale) => sum + Number(sale.loyaltyPointsEarned || 0), 0);
  const loyaltyRedeemed = customerSales.reduce((sum, sale) => sum + Number(sale.loyaltyPointsRedeemed || 0), 0);
  const loyaltyBalance = Math.max(0, loyaltyEarned - loyaltyRedeemed);

  const saveCustomer = async () => {
    if (!customer._id) return;
    try {
      await api.put(`/parties/${customer._id}`, { ...editForm, partyType: "customer" });
      notifySuccess("Customer updated successfully");
      await loadData();
    } catch (error) {
      notifyError(getApiErrorMessage(error, "Failed to update customer"));
    }
  };

  const deleteCustomer = async () => {
    if (!customer._id || !window.confirm(`Delete ${customer.name || "this customer"}?`)) return;
    try {
      await api.delete(`/parties/${customer._id}`);
      notifySuccess("Customer deleted successfully");
      navigate("/masters/customers");
    } catch (error) {
      notifyError(getApiErrorMessage(error, "Failed to delete customer"));
    }
  };

  return (
    <>
      <div className="container-fluid p-0 flex-grow-1">
        <div className="customer-overview-page">
          <div className="customer-overview-head">
            <div>
              <h1>Customer ID {customerCode(customer)}</h1>
              <p>{loading ? "Loading..." : `Created ${formatDate(customer.createdAt)}`}</p>
            </div>
            <button className="btn customer-danger-btn" type="button" onClick={deleteCustomer}><i className="bx bx-trash"></i><span>Delete Customer</span></button>
          </div>
          <div className="customer-overview-layout">
            <aside className="customer-profile-stack">
              <section className="card app-card customer-profile-card">
                <div className="card-body">
                  <span className="customer-profile-photo customer-avatar-fallback d-inline-flex align-items-center justify-content-center">{initials(customer.name)}</span>
                  <h2>{customer.name || "Customer"}</h2>
                  <p>Customer ID {customerCode(customer)}</p>
                  <div className="customer-profile-stats">
                    <span><i className="bx bx-cart"></i><strong>{customerSales.length}</strong><small>Orders</small></span>
                    <span><i className="bx bx-rupee"></i><strong>{money(totalSpent)}</strong><small>Spent</small></span>
                  </div>
                  <div className="customer-detail-list">
                    <h3>Details</h3>
                    <dl>
                      <dt>Username:</dt><dd>{customer.name || "-"}</dd>
                      <dt>Email:</dt><dd>{customer.email || "-"}</dd>
                      <dt>Status:</dt><dd><span className="status-badge status-success">Active</span></dd>
                      <dt>Contact:</dt><dd>{customer.phone || "-"}</dd>
                      <dt>Country:</dt><dd>{customer.state || customer.city || "India"}</dd>
                    </dl>
                  </div>
                  <button className="btn btn_style w-100" type="button" data-bs-toggle="modal" data-bs-target="#pageActionModal">Edit Details</button>
                </div>
              </section>
              <section className="customer-premium-card">
                <div>
                  <h2>Customer Ledger</h2>
                  <p>{money(customer.ledgerBalance || 0)} current balance from customer ledger.</p>
                  <Link className="btn" to="/accounting/ledger-list">Open ledger</Link>
                </div>
                <i className="bx bx-book"></i>
              </section>
            </aside>
            <main className="customer-overview-main">
              <ul className="nav nav-pills customer-overview-tabs" role="tablist">
                <li className="nav-item" role="presentation"><button className="nav-link active" data-bs-toggle="pill" data-bs-target="#customer-overview-pane" type="button" role="tab"><i className="bx bx-user"></i>Overview</button></li><li className="nav-item" role="presentation"><button className="nav-link " data-bs-toggle="pill" data-bs-target="#customer-security-pane" type="button" role="tab"><i className="bx bx-lock"></i>Security</button></li><li className="nav-item" role="presentation"><button className="nav-link " data-bs-toggle="pill" data-bs-target="#customer-address-pane" type="button" role="tab"><i className="bx bx-map"></i>Address & Billing</button></li><li className="nav-item" role="presentation"><button className="nav-link " data-bs-toggle="pill" data-bs-target="#customer-notifications-pane" type="button" role="tab"><i className="bx bx-bell"></i>Notifications</button></li>
              </ul>
              <div className="tab-content customer-overview-tab-content">
                <div className="tab-pane fade show active" id="customer-overview-pane" role="tabpanel" tabIndex="0">
                  <div className="customer-metric-grid">
                    <section className="card app-card customer-metric-card"><div className="card-body"><span className="customer-metric-icon text-warning"><i className="bx bx-wallet"></i></span><h2>Account Balance</h2><p><strong>{money(customer.ledgerBalance || 0)}</strong> Ledger</p><small>Current customer ledger balance</small></div></section>
                    <section className="card app-card customer-metric-card"><div className="card-body"><span className="customer-metric-icon text-success"><i className="bx bx-gift"></i></span><h2>Loyalty Program</h2><p><strong>{loyaltyBalance}</strong> points</p><small>{loyaltyEarned} earned, {loyaltyRedeemed} redeemed</small></div></section>
                    <section className="card app-card customer-metric-card"><div className="card-body"><span className="customer-metric-icon text-warning"><i className="bx bx-undo"></i></span><h2>Returns</h2><p><strong>{money(returnedAmount)}</strong></p><small>Returned sale value captured in bills</small></div></section>
                    <section className="card app-card customer-metric-card"><div className="card-body"><span className="customer-metric-icon text-info"><i className="bx bx-receipt"></i></span><h2>Invoices</h2><p><strong>{customerSales.length}</strong> bills</p><small>Sales linked by customer id, phone, or name</small></div></section>
                  </div>
                  <section className="card app-card app-datatable-card customer-orders-card">
                    <div className="card-header app-card-header">
                      <div><h2>Orders placed</h2></div>
                      <div className="datatable-search"><input type="text" placeholder="Search order" aria-label="Search order" value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} /></div>
                    </div>
                    <div className="table-responsive app-table-wrap">
                      <table className="table app-table align-middle mb-0">
                        <thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Spent</th><th className="text-end">Actions</th></tr></thead>
                        <tbody>
                          {filteredOrders.slice(0, 8).length ? filteredOrders.slice(0, 8).map((sale) => (
                            <tr key={sale._id}>
                              <td><Link className="customer-id-link" to={`/sales/invoice?id=${sale._id}`}>{sale.invoiceNo || sale.billNo || "-"}</Link></td>
                              <td>{formatDate(sale.saleDate)}</td>
                              <td><span className={`status-badge ${Number(sale.totalReturnedAmount || 0) > 0 ? "status-warning" : "status-success"}`}>{Number(sale.totalReturnedAmount || 0) > 0 ? "Return" : "Billed"}</span></td>
                              <td>{money(sale.totalAmount)}</td>
                              <td className="text-end"><Link className="action-btn" to={`/sales/invoice?id=${sale._id}`} aria-label="View"><i className="bx bx-show"></i></Link></td>
                            </tr>
                          )) : (
                            <tr><td colSpan="5" className="text-center text-muted py-4">No sales found for this customer.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="pagination-row customer-pagination">
                      <span>Showing {filteredOrders.length === 0 ? 0 : 1} to {Math.min(filteredOrders.length, 8)} of {filteredOrders.length} entries</span>
                      <nav aria-label="Customer order pagination"><ul className="pagination mb-0"><li className="page-item disabled"><button className="page-link" type="button"><i className="bx bx-chevron-left"></i></button></li><li className="page-item active"><button className="page-link" type="button">1</button></li><li className="page-item disabled"><button className="page-link" type="button"><i className="bx bx-chevron-right"></i></button></li></ul></nav>
                    </div>
                  </section>
                </div>
                <div className="tab-pane fade" id="customer-security-pane" role="tabpanel" tabIndex="0">
                  <section className="card app-card"><div className="card-header app-card-header"><div><h2>Security</h2><p>Customer access is managed through POS/customer master records.</p></div></div><div className="card-body"><form className="row g-3"><div className="col-12 col-sm-6 col-xl-3"><label className="form-label">Customer Record</label><input type="text" className="form-control" value={customerCode(customer)} readOnly /></div><div className="col-12 col-sm-6 col-xl-3"><label className="form-label">Status</label><input type="text" className="form-control" value="Active" readOnly /></div><div className="col-12 col-sm-6 col-xl-3"><label className="form-label">Last Updated</label><input type="text" className="form-control" value={formatDate(customer.updatedAt)} readOnly /></div><div className="col-12 col-sm-6 col-xl-3"><label className="form-label">Device</label><input type="text" className="form-control" value="POS" readOnly /></div></form></div></section>
                </div>
                <div className="tab-pane fade" id="customer-address-pane" role="tabpanel" tabIndex="0">
                  <section className="card app-card"><div className="card-header app-card-header"><div><h2>Address &amp; Billing</h2><p>Billing details from the customer master.</p></div></div><div className="card-body"><form className="row g-3"><div className="col-12 col-sm-6 col-xl-3"><label className="form-label">Billing Address</label><input type="text" className="form-control" value={customer.addressLine1 || ""} readOnly /></div><div className="col-12 col-sm-6 col-xl-3"><label className="form-label">Shipping Address</label><input type="text" className="form-control" value={customer.addressLine2 || customer.location || ""} readOnly /></div><div className="col-12 col-sm-6 col-xl-3"><label className="form-label">City</label><input type="text" className="form-control" value={customer.city || ""} readOnly /></div><div className="col-12 col-sm-6 col-xl-3"><label className="form-label">State</label><input type="text" className="form-control" value={customer.state || ""} readOnly /></div><div className="col-12 col-sm-6 col-xl-3"><label className="form-label">Country</label><input type="text" className="form-control" value="India" readOnly /></div><div className="col-12 col-sm-6 col-xl-3"><label className="form-label">GST No</label><input type="text" className="form-control" value={customer.gstNo || ""} readOnly /></div></form></div></section>
                </div>
                <div className="tab-pane fade" id="customer-notifications-pane" role="tabpanel" tabIndex="0">
                  <section className="card app-card"><div className="card-header app-card-header"><div><h2>Notifications</h2><p>Customer communication settings from master data.</p></div></div><div className="card-body"><form className="row g-3"><div className="col-12 col-sm-6 col-xl-3"><label className="form-label">Email Alerts</label><input type="text" className="form-control" value={customer.email ? "Available" : "No email"} readOnly /></div><div className="col-12 col-sm-6 col-xl-3"><label className="form-label">SMS Alerts</label><input type="text" className="form-control" value={customer.phone ? "Available" : "No phone"} readOnly /></div><div className="col-12 col-sm-6 col-xl-3"><label className="form-label">WhatsApp</label><input type="text" className="form-control" value={customer.whatsappOptIn ? "Opted In" : "Not opted in"} readOnly /></div><div className="col-12 col-sm-6 col-xl-3"><label className="form-label">Invoice Copies</label><input type="text" className="form-control" value={customer.email || customer.phone ? "Enabled manually" : "Unavailable"} readOnly /></div></form></div></section>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>

      <div className="modal fade" id="pageActionModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Edit Customer</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                <div className="col-12"><label className="form-label">Name</label><input className="form-control" value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} /></div>
                <div className="col-12 col-md-6"><label className="form-label">Phone</label><input className="form-control" value={editForm.phone} onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))} /></div>
                <div className="col-12 col-md-6"><label className="form-label">Email</label><input className="form-control" type="email" value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} /></div>
                <div className="col-12"><label className="form-label">Address Line 1</label><input className="form-control" value={editForm.addressLine1} onChange={(event) => setEditForm((current) => ({ ...current, addressLine1: event.target.value }))} /></div>
                <div className="col-12"><label className="form-label">Address Line 2</label><input className="form-control" value={editForm.addressLine2} onChange={(event) => setEditForm((current) => ({ ...current, addressLine2: event.target.value }))} /></div>
                <div className="col-12 col-md-4"><label className="form-label">City</label><input className="form-control" value={editForm.city} onChange={(event) => setEditForm((current) => ({ ...current, city: event.target.value }))} /></div>
                <div className="col-12 col-md-4"><label className="form-label">State</label><input className="form-control" value={editForm.state} onChange={(event) => setEditForm((current) => ({ ...current, state: event.target.value }))} /></div>
                <div className="col-12 col-md-4"><label className="form-label">GST No</label><input className="form-control" value={editForm.gstNo} onChange={(event) => setEditForm((current) => ({ ...current, gstNo: event.target.value.toUpperCase() }))} /></div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn_style inActive" type="button" data-bs-dismiss="modal">Cancel</button>
              <button className="btn btn_style" type="button" onClick={saveCustomer}>Save</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
