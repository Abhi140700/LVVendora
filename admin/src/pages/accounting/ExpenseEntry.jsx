import React, { useEffect, useMemo, useState } from "react";
import { createExpenseEntry, fetchExpenseEntries } from "../../services/accountingService";
import { notifyError, notifySuccess } from "../../utils/notify";

const today = new Date().toISOString().slice(0, 10);
const ENTRY_TYPES = [
  { value: "expense", label: "Expense", direction: "out", mode: "Cash" },
  { value: "bank-deposit", label: "Cash Deposit To Bank", direction: "out", mode: "Bank" },
  { value: "bank-withdrawal", label: "Bank Withdrawal", direction: "in", mode: "Bank" },
  { value: "cash-adjustment", label: "Cash Adjustment", direction: "out", mode: "Cash" },
];

const EMPTY_FORM = {
  entryDate: today,
  entryType: "expense",
  direction: "out",
  paymentMode: "Cash",
  amount: "",
  category: "",
  accountLabel: "",
  referenceNo: "",
  note: "",
};

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

export default function ExpenseEntry() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [records, setRecords] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadRecords = async (nextQuery = "") => {
    setLoading(true);
    setMessage("");
    try {
      const data = await fetchExpenseEntries(nextQuery);
      setRecords(data.data || []);
    } catch (error) {
      const nextMessage = error.message || "Failed to load expense entries.";
      notifyError(nextMessage);
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadRecords(query);
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  const totals = useMemo(() => records.reduce((summary, record) => {
    if (record.direction === "in") summary.cashIn += round2(record.amount);
    else summary.cashOut += round2(record.amount);
    return summary;
  }, { cashIn: 0, cashOut: 0 }), [records]);

  const update = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "entryType") {
        const selectedType = ENTRY_TYPES.find((entry) => entry.value === value);
        if (selectedType) {
          next.direction = selectedType.direction;
          next.paymentMode = selectedType.mode;
          if (!next.category) next.category = selectedType.label;
        }
      }
      return next;
    });
  };

  const save = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      const nextMessage = "Amount must be greater than zero.";
      notifyError(nextMessage);
      setMessage(nextMessage);
      return;
    }

    if (!form.category.trim() && !form.accountLabel.trim()) {
      const nextMessage = "Category or account label is required.";
      notifyError(nextMessage);
      setMessage(nextMessage);
      return;
    }

    try {
      setSaving(true);
      const data = await createExpenseEntry({ ...form, amount: round2(form.amount) });
      setRecords((current) => [data.data, ...current]);
      setForm((current) => ({ ...EMPTY_FORM, entryDate: current.entryDate }));
      const successMessage = data.message || "Expense entry saved.";
      notifySuccess(successMessage);
      setMessage(successMessage);
    } catch (error) {
      const nextMessage = error.message || "Failed to save expense entry.";
      notifyError(nextMessage);
      setMessage(nextMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid p-0 flex-grow-1">
      <div className="page-header card">
        <div className="card-body">
          <div>
            <nav aria-label="breadcrumb">
              <ol className="breadcrumb mb-2">
                <li className="breadcrumb-item"><a href="/">Home</a></li>
                <li className="breadcrumb-item active" aria-current="page">Accounting</li>
              </ol>
            </nav>
            <p className="section-label">Accounting</p>
            <h1>Expense Entry</h1>
            <p className="mb-0 text-muted">Log daily expenses, cash deposits, withdrawals, and cash adjustments for Cash Book and Day End.</p>
          </div>
          <div className="page-header-actions">
            <span className="metric-pill"><i className="bx bx-trending-up"></i> Cash In Rs. {totals.cashIn.toFixed(2)}</span>
            <span className="metric-pill"><i className="bx bx-trending-down"></i> Cash Out Rs. {totals.cashOut.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <section className="card app-card">
        <div className="card-header app-card-header">
          <div>
            <h2>New Entry</h2>
            <p>Capture daily cash movement outside customer receipts using the existing backend expense API.</p>
          </div>
        </div>
        <div className="card-body pt-1">
          <form className="row g-3" onSubmit={(event) => { event.preventDefault(); save(); }}>
            <Field className="col-12 col-sm-6 col-xl-3" label="Date" type="date" value={form.entryDate} onChange={(value) => update("entryDate", value)} />
            <div className="col-12 col-sm-6 col-xl-3">
              <label className="form-label" htmlFor="expense-entry-type">Entry Type</label>
              <select className="form-select" id="expense-entry-type" value={form.entryType} onChange={(event) => update("entryType", event.target.value)}>
                {ENTRY_TYPES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
              </select>
            </div>
            <div className="col-12 col-sm-6 col-xl-3">
              <label className="form-label" htmlFor="expense-direction">Direction</label>
              <select className="form-select" id="expense-direction" value={form.direction} onChange={(event) => update("direction", event.target.value)}>
                <option value="out">Cash Out</option>
                <option value="in">Cash In</option>
              </select>
            </div>
            <div className="col-12 col-sm-6 col-xl-3">
              <label className="form-label" htmlFor="expense-payment-mode">Payment Mode</label>
              <select className="form-select" id="expense-payment-mode" value={form.paymentMode} onChange={(event) => update("paymentMode", event.target.value)}>
                <option value="Cash">Cash</option>
                <option value="Bank">Bank</option>
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
              </select>
            </div>
            <Field className="col-12 col-sm-6 col-xl-3" label="Amount" type="number" value={form.amount} onChange={(value) => update("amount", value)} />
            <Field className="col-12 col-sm-6 col-xl-3" label="Category" value={form.category} onChange={(value) => update("category", value)} />
            <Field className="col-12 col-sm-6 col-xl-3" label="Account / Counter" value={form.accountLabel} onChange={(value) => update("accountLabel", value)} />
            <Field className="col-12 col-sm-6 col-xl-3" label="Reference No" value={form.referenceNo} onChange={(value) => update("referenceNo", value)} />
            <Field className="col-12" label="Note" value={form.note} onChange={(value) => update("note", value)} />
            <div className="col-12 d-flex flex-wrap gap-2 pt-2">
              <button className="btn btn_style" type="submit" disabled={saving}><i className="bx bx-save"></i><span>{saving ? "Saving..." : "Save Entry"}</span></button>
              <button className="btn btn_style inActive" type="button" onClick={() => setForm(EMPTY_FORM)}><i className="bx bx-reset"></i><span>Clear</span></button>
            </div>
            {message ? <div className="col-12"><div className="alert alert-info mb-0">{message}</div></div> : null}
          </form>
        </div>
      </section>

      <section className="card app-card app-datatable-card">
        <div className="card-body">
          <div className="datatable-toolbar">
            <div className="datatable-toolbar-start">
              <label className="datatable-length">
                <span>Show</span>
                <select className="form-select form-select-sm datatable-page-size" aria-label="Rows per page" defaultValue="10">
                  <option>10</option>
                  <option>25</option>
                  <option>50</option>
                </select>
              </label>
            </div>
            <div className="datatable-toolbar-end">
              <div className="datatable-search">
                <input type="text" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Expense Entry" aria-label="Search Expense Entry" />
              </div>
            </div>
          </div>
          <div className="table-responsive app-table-wrap">
            <table className="table app-table align-middle">
              <thead>
                <tr><th>Date</th><th>Type</th><th>Mode</th><th>Category</th><th>Direction</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {!loading && records.length > 0 ? records.map((record) => (
                  <tr key={record._id}>
                    <td>{new Date(record.entryDate).toLocaleDateString()}</td>
                    <td className="text-capitalize">{String(record.entryType || "").replace(/-/g, " ")}</td>
                    <td>{record.paymentMode || "-"}</td>
                    <td>{record.category || record.accountLabel || "-"}</td>
                    <td><span className={`status-badge ${record.direction === "in" ? "status-success" : "status-warning"}`}>{record.direction === "in" ? "Cash In" : "Cash Out"}</span></td>
                    <td>Rs. {round2(record.amount).toFixed(2)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" className="text-center text-muted py-4">{loading ? "Loading entries..." : "No entries found."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ className, label, value, onChange, type = "text" }) {
  const id = `expense-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className={className}>
      <label className="form-label" htmlFor={id}>{label}</label>
      <input className="form-control" id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
