import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../../app/axios";
import { getApiErrorMessage } from "../../../utils/api";
import { notifyError, notifySuccess } from "../../../utils/notify";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const normalize = (value = "") => String(value || "").trim();
const initials = (name = "Customer") => normalize(name).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CU";
const customerCode = (customer) => `#${String(customer?._id || "").slice(-6).toUpperCase() || "NEW"}`;
const customerLocation = (customer) => customer.state || customer.city || customer.location || "India";
const locationCode = (customer) => normalize(customer.stateCode || customer.state || customer.city || "IN").slice(0, 2).toUpperCase();
const getCustomerId = (value) => String(value?._id || value || "");

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  customerType: "retail",
  creditLimit: "",
  segmentTags: "",
  loyaltyCardNo: "",
  applyLoyalty: false,
  city: "",
  state: "",
  gstNo: "",
};

export default function CustomerList() {
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    try {
      const [customerRes, salesRes] = await Promise.all([
        api.get("/parties", { params: { type: "customer" } }),
        api.get("/reports/sales").catch(() => ({ data: { data: [] } })),
      ]);
      setCustomers(customerRes.data?.data || []);
      setSales(salesRes.data?.data || []);
    } catch (error) {
      notifyError(getApiErrorMessage(error, "Failed to load customers"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const salesByCustomer = useMemo(() => {
    const map = new Map();
    sales.forEach((sale) => {
      const keys = [
        getCustomerId(sale.customerId),
        normalize(sale.customerPhone),
        normalize(sale.customer).toLowerCase(),
      ].filter(Boolean);
      keys.forEach((key) => {
        const current = map.get(key) || { orders: 0, spent: 0 };
        map.set(key, {
          orders: current.orders + 1,
          spent: current.spent + Number(sale.totalAmount || 0),
        });
      });
    });
    return map;
  }, [sales]);

  const getCustomerStats = (customer) => (
    salesByCustomer.get(String(customer._id))
    || salesByCustomer.get(normalize(customer.phone))
    || salesByCustomer.get(normalize(customer.name).toLowerCase())
    || { orders: 0, spent: Number(customer.ledgerBalance || 0) }
  );

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = query
      ? customers.filter((customer) => [
        customer.name,
        customer.phone,
        customer.email,
        customer.customerType,
        customer.segmentTags?.join(" "),
        customer.city,
        customer.state,
        customer.gstNo,
      ].join(" ").toLowerCase().includes(query))
      : customers;
    return [...rows].sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));
  }, [customers, search]);

  const visibleCustomers = filteredCustomers.slice(0, pageSize);

  const saveCustomer = async () => {
    const name = normalize(form.name);
    if (!name) {
      notifyError("Customer name is required");
      return;
    }
    try {
      await api.post("/parties", {
        ...form,
        name,
        creditLimit: Number(form.creditLimit || 0),
        segmentTags: String(form.segmentTags || "").split(",").map((tag) => tag.trim()).filter(Boolean),
        applyLoyalty: Boolean(form.applyLoyalty),
        partyType: "customer",
      });
      setForm(emptyForm);
      notifySuccess("Customer created successfully");
      await loadData();
    } catch (error) {
      notifyError(getApiErrorMessage(error, "Failed to create customer"));
    }
  };

  const exportCsv = () => {
    const rows = [
      ["Customer", "Phone", "Email", "Type", "Credit Limit", "Segments", "Location", "Orders", "Total Spent"],
      ...filteredCustomers.map((customer) => {
        const stats = getCustomerStats(customer);
        return [customer.name || "", customer.phone || "", customer.email || "", customer.customerType || "retail", customer.creditLimit || 0, (customer.segmentTags || []).join(", "), customerLocation(customer), stats.orders, stats.spent];
      }),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "customers.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="container-fluid p-0 flex-grow-1">
        <div className="page-header card">
          <div className="card-body">
            <div>
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb mb-2">
                  <li className="breadcrumb-item"><Link to="/">Home</Link></li>
                  <li className="breadcrumb-item active" aria-current="page">Customers</li>
                </ol>
              </nav>
              <p className="section-label">Customers</p>
              <h1>All Customers</h1>
              <p className="mb-0 text-muted">Review customer profiles, order count, country, and lifetime spend from one customer desk.</p>
            </div>
            <div className="page-header-actions">
              <span className="metric-pill"><i className="bx bx-check-circle"></i> {loading ? "Loading" : `${filteredCustomers.length} Customers`}</span>
              <button className="btn btn_style" type="button" data-bs-toggle="modal" data-bs-target="#pageActionModal">
                <i className="bx bx-plus"></i><span>New</span>
              </button>
            </div>
          </div>
        </div>

        <section className="card app-card customer-list-card">
          <div className="customer-table-toolbar">
            <div className="datatable-search customer-search">
              <input type="text" placeholder="Search Customer" aria-label="Search Customer" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <div className="customer-toolbar-actions">
              <select className="form-select datatable-page-size" aria-label="Customers per page" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select>
              <div className="dropdown">
                <button className="btn btn_style inActive dropdown-toggle" type="button" data-bs-toggle="dropdown"><i className="bx bx-export"></i><span>Export</span></button>
                <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                  <button className="dropdown-item" type="button" onClick={exportCsv}><i className="bx bx-file me-2"></i>CSV</button>
                  <button className="dropdown-item" type="button" onClick={exportCsv}><i className="bx bx-spreadsheet me-2"></i>Excel</button>
                  <button className="dropdown-item" type="button" onClick={() => window.print()}><i className="bx bx-printer me-2"></i>Print</button>
                </div>
              </div>
              <button className="btn btn_style customer-add-btn" type="button" data-bs-toggle="modal" data-bs-target="#pageActionModal"><i className="bx bx-plus"></i><span>Add Customer</span></button>
            </div>
          </div>
          <div className="table-responsive app-table-wrap">
            <table className="table app-table customer-table align-middle mb-0">
              <thead>
                <tr>
                  <th className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select all customers" /></th>
                  <th>Customer</th>
                  <th>Customer ID</th>
                  <th>Type</th>
                  <th>Credit Limit</th>
                  <th>Country</th>
                  <th>Order</th>
                  <th>Total Spent</th>
                </tr>
              </thead>
              <tbody>
                {visibleCustomers.length ? visibleCustomers.map((customer) => {
                  const stats = getCustomerStats(customer);
                  const overviewPath = `/masters/customers/overview?id=${customer._id}`;
                  return (
                    <tr key={customer._id}>
                      <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label={`Select ${customer.name}`} /></td>
                      <td>
                        <Link className="customer-cell" to={overviewPath}>
                          <span className="customer-avatar customer-avatar-fallback">{initials(customer.name)}</span>
                          <span><strong>{customer.name || "Unnamed Customer"}</strong><small>{customer.email || customer.phone || "No contact saved"}</small></span>
                        </Link>
                      </td>
                      <td><Link className="customer-id-link" to={overviewPath}>{customerCode(customer)}</Link></td>
                      <td><span className="status-badge status-primary">{customer.customerType || "retail"}</span></td>
                      <td>{money(customer.creditLimit || 0)}</td>
                      <td><span className="country-dot">{locationCode(customer)}</span>{customerLocation(customer)}</td>
                      <td>{stats.orders}</td>
                      <td><strong>{money(stats.spent)}</strong></td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan="8" className="text-center text-muted py-4">{loading ? "Loading customers..." : "No customers found."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="pagination-row customer-pagination">
            <span>Showing {visibleCustomers.length === 0 ? 0 : 1} to {visibleCustomers.length} of {filteredCustomers.length} entries</span>
            <nav aria-label="Customers pagination">
              <ul className="pagination mb-0">
                <li className="page-item disabled"><button className="page-link" type="button" aria-label="Previous"><i className="bx bx-chevron-left"></i></button></li>
                <li className="page-item active"><button className="page-link" type="button">1</button></li>
                <li className="page-item disabled"><button className="page-link" type="button" aria-label="Next"><i className="bx bx-chevron-right"></i></button></li>
              </ul>
            </nav>
          </div>
        </section>
      </div>

      <div className="modal fade" id="pageActionModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">New Customer</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                <div className="col-12"><label className="form-label">Name</label><input className="form-control" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></div>
                <div className="col-12 col-md-6"><label className="form-label">Phone</label><input className="form-control" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></div>
                <div className="col-12 col-md-6"><label className="form-label">Email</label><input className="form-control" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></div>
                <div className="col-12 col-md-6"><label className="form-label">Customer Type</label><select className="form-select" value={form.customerType} onChange={(event) => setForm((current) => ({ ...current, customerType: event.target.value }))}><option value="retail">Retail</option><option value="wholesale">Wholesale</option><option value="vip">VIP</option></select></div>
                <div className="col-12 col-md-6"><label className="form-label">Credit Limit</label><input className="form-control" type="number" value={form.creditLimit} onChange={(event) => setForm((current) => ({ ...current, creditLimit: event.target.value }))} /></div>
                <div className="col-12 col-md-6"><label className="form-label">Loyalty Card No</label><input className="form-control" value={form.loyaltyCardNo || (form.applyLoyalty ? "Auto on save" : "")} readOnly placeholder="Auto on apply" /></div>
                <div className="col-12 col-md-6"><label className="form-label">Apply Loyalty</label><label className="form-check d-flex align-items-center gap-2 mt-2"><input className="form-check-input" type="checkbox" checked={Boolean(form.applyLoyalty)} onChange={(event) => setForm((current) => ({ ...current, applyLoyalty: event.target.checked }))} /><span className="form-check-label">Generate loyalty card on save</span></label></div>
                <div className="col-12 col-md-6"><label className="form-label">Segments</label><input className="form-control" value={form.segmentTags} onChange={(event) => setForm((current) => ({ ...current, segmentTags: event.target.value }))} placeholder="VIP, Birthday, Wholesale" /></div>
                <div className="col-12 col-md-6"><label className="form-label">City</label><input className="form-control" value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} /></div>
                <div className="col-12 col-md-6"><label className="form-label">State</label><input className="form-control" value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))} /></div>
                <div className="col-12"><label className="form-label">GST No</label><input className="form-control" value={form.gstNo} onChange={(event) => setForm((current) => ({ ...current, gstNo: event.target.value.toUpperCase() }))} /></div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn_style inActive" type="button" data-bs-dismiss="modal">Cancel</button>
              <button className="btn btn_style" type="button" onClick={saveCustomer}>Save Customer</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
