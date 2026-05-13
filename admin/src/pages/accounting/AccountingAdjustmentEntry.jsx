import React, { useState } from "react";
import { createLedgerAdjustment } from "../../services/accountingService";
import { notifyError, notifySuccess } from "../../utils/notify";

const today = new Date().toISOString().slice(0, 10);

const makeInitialForm = (direction) => ({
  entryDate: today,
  customerName: "",
  customerPhone: "",
  amount: "",
  referenceNo: "",
  billNo: "",
  note: "",
  direction,
});

export default function AccountingAdjustmentEntry({
  title,
  description,
  formTitle,
  saveLabel,
  successMessage,
  defaultDirection,
  allowDirectionChange = false,
}) {
  const [form, setForm] = useState(() => makeInitialForm(defaultDirection));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const save = async () => {
    if (!form.customerName.trim() && !form.customerPhone.trim()) {
      const validationMessage = "Customer name or phone is required.";
      notifyError(validationMessage);
      setMessage(validationMessage);
      return;
    }

    if (Number(form.amount) <= 0) {
      const validationMessage = "Amount must be greater than zero.";
      notifyError(validationMessage);
      setMessage(validationMessage);
      return;
    }

    try {
      setSaving(true);
      await createLedgerAdjustment(form);
      notifySuccess(successMessage);
      setMessage(successMessage);
      setForm(makeInitialForm(defaultDirection));
    } catch (error) {
      const errorMessage = error.message || `Failed to save ${title.toLowerCase()}.`;
      notifyError(errorMessage);
      setMessage(errorMessage);
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
            <h1>{title}</h1>
            <p className="mb-0 text-muted">{description}</p>
          </div>
          <div className="page-header-actions">
            <span className="metric-pill"><i className="bx bx-check-circle"></i> Ready</span>
            <button className="btn btn_style" type="button" onClick={save} disabled={saving}>
              <i className="bx bx-save"></i><span>{saving ? "Saving" : "Save"}</span>
            </button>
          </div>
        </div>
      </div>

      <section className="card app-card">
        <div className="card-header app-card-header">
          <div>
            <h2>{formTitle}</h2>
            <p>Use the same customer ledger payload and validation rules from the working React accounting flow.</p>
          </div>
        </div>
        <div className="card-body pt-1">
          <form className="row g-3" onSubmit={(event) => { event.preventDefault(); save(); }}>
            <Field className="col-12 col-sm-6 col-xl-3" label="Entry Date" type="date" value={form.entryDate} onChange={(value) => update("entryDate", value)} />
            <Field className="col-12 col-sm-6 col-xl-3" label="Customer Name" value={form.customerName} onChange={(value) => update("customerName", value)} />
            <Field className="col-12 col-sm-6 col-xl-3" label="Customer Phone" value={form.customerPhone} onChange={(value) => update("customerPhone", value)} />
            <Field className="col-12 col-sm-6 col-xl-3" label="Amount" type="number" value={form.amount} onChange={(value) => update("amount", value)} />
            {allowDirectionChange ? (
              <div className="col-12 col-sm-6 col-xl-3">
                <label className="form-label" htmlFor="accounting-direction">Direction</label>
                <select className="form-select" id="accounting-direction" value={form.direction} onChange={(event) => update("direction", event.target.value)}>
                  <option value="credit">Credit</option>
                  <option value="debit">Debit</option>
                </select>
              </div>
            ) : null}
            <Field className="col-12 col-sm-6 col-xl-3" label="Reference No" value={form.referenceNo} onChange={(value) => update("referenceNo", value)} />
            <Field className="col-12 col-sm-6 col-xl-3" label="Bill No" value={form.billNo} onChange={(value) => update("billNo", value)} />
            <Field className="col-12 col-xl-6" label="Note" value={form.note} onChange={(value) => update("note", value)} />
            <div className="col-12 d-flex flex-wrap gap-2 pt-2">
              <button className="btn btn_style" type="submit" disabled={saving}>
                <i className="bx bx-save"></i><span>{saving ? "Saving..." : saveLabel}</span>
              </button>
              <button className="btn btn_style inActive" type="button" onClick={() => setForm(makeInitialForm(defaultDirection))}>
                <i className="bx bx-reset"></i><span>Clear</span>
              </button>
            </div>
            {message ? <div className="col-12"><div className="alert alert-info mb-0">{message}</div></div> : null}
          </form>
        </div>
      </section>
    </div>
  );
}

function Field({ className, label, value, onChange, type = "text" }) {
  const id = `accounting-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className={className}>
      <label className="form-label" htmlFor={id}>{label}</label>
      <input className="form-control" id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
