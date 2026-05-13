import CustomerLedger from "../models/CustomerLedger.js";
import CashEntry from "../models/CashEntry.js";
import Party from "../models/Party.js";
import POSSession from "../models/POSSession.js";
import { createAuditLog } from "../services/auditService.js";

const normalizeText = (value = "") => String(value).trim();
const clampNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};
const round2 = (value) => Math.round(clampNumber(value) * 100) / 100;
const startOfDay = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const serializeCustomer = (customer) => ({
  _id: customer._id,
  name: customer.name || "",
  phone: customer.phone || "",
  city: customer.city || "",
  ledgerBalance: round2(customer.ledgerBalance || 0)
});

const syncLedgerBalance = async (customerId) => {
  if (!customerId) {
    return 0;
  }

  const entries = await CustomerLedger.find({ customerId }).lean();
  const balance = entries.reduce((sum, entry) => (
    entry.direction === "debit"
      ? sum + clampNumber(entry.amount)
      : sum - clampNumber(entry.amount)
  ), 0);

  await Party.findByIdAndUpdate(customerId, { ledgerBalance: round2(balance) });
  return round2(balance);
};

const findOrCreateCustomer = async ({ customerId, customerName, customerPhone }) => {
  const normalizedCustomerId = normalizeText(customerId);
  const normalizedName = normalizeText(customerName);
  const normalizedPhone = normalizeText(customerPhone);

  let customer = null;

  if (normalizedCustomerId) {
    customer = await Party.findOne({ _id: normalizedCustomerId, partyType: "customer" });
  }

  if (!customer && normalizedPhone) {
    customer = await Party.findOne({ partyType: "customer", phone: normalizedPhone });
  }

  if (!customer && normalizedName) {
    customer = await Party.findOne({ partyType: "customer", name: normalizedName });
  }

  if (customer) {
    if (normalizedPhone && !customer.phone) {
      customer.phone = normalizedPhone;
      await customer.save();
    }
    return customer;
  }

  if (!normalizedName && !normalizedPhone) {
    return null;
  }

  return Party.create({
    name: normalizedName || normalizedPhone,
    phone: normalizedPhone,
    partyType: "customer"
  });
};

export const getAccountingCustomers = async (req, res) => {
  try {
    const query = normalizeText(req.query.q).toLowerCase();
    const customers = await Party.find({ partyType: "customer" })
      .sort({ updatedAt: -1 })
      .limit(query ? 100 : 40)
      .lean();

    const filtered = query
      ? customers.filter((customer) => (
        String(customer.name || "").toLowerCase().includes(query)
        || String(customer.phone || "").toLowerCase().includes(query)
      ))
      : customers;

    return res.status(200).json({
      success: true,
      data: filtered.map(serializeCustomer)
    });
  } catch (err) {
    console.error("Get Accounting Customers Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: err.message
    });
  }
};

export const getReceipts = async (req, res) => {
  try {
    const query = normalizeText(req.query.q).toLowerCase();
    const receipts = await CustomerLedger.find({
      entryType: "payment",
      direction: "credit"
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const filtered = query
      ? receipts.filter((receipt) => (
        String(receipt.customerName || "").toLowerCase().includes(query)
        || String(receipt.customerPhone || "").toLowerCase().includes(query)
        || String(receipt.referenceNo || "").toLowerCase().includes(query)
        || String(receipt.billNo || "").toLowerCase().includes(query)
      ))
      : receipts;

    return res.status(200).json({
      success: true,
      data: filtered
    });
  } catch (err) {
    console.error("Get Receipts Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch receipts",
      error: err.message
    });
  }
};

export const getExpenseEntries = async (req, res) => {
  try {
    const query = normalizeText(req.query.q).toLowerCase();
    const entries = await CashEntry.find()
      .sort({ entryDate: -1, createdAt: -1 })
      .limit(150)
      .lean();

    const filtered = query
      ? entries.filter((entry) => (
        String(entry.category || "").toLowerCase().includes(query)
        || String(entry.accountLabel || "").toLowerCase().includes(query)
        || String(entry.referenceNo || "").toLowerCase().includes(query)
        || String(entry.note || "").toLowerCase().includes(query)
      ))
      : entries;

    return res.status(200).json({
      success: true,
      data: filtered
    });
  } catch (err) {
    console.error("Get Expense Entries Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch expense entries",
      error: err.message
    });
  }
};

export const createLedgerAdjustment = async (req, res) => {
  try {
    const amount = round2(req.body.amount);
    const direction = normalizeText(req.body.direction || "debit").toLowerCase();

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than zero"
      });
    }

    if (!["debit", "credit"].includes(direction)) {
      return res.status(400).json({
        success: false,
        message: "Direction must be debit or credit"
      });
    }

    const customer = await findOrCreateCustomer({
      customerId: req.body.customerId,
      customerName: req.body.customerName,
      customerPhone: req.body.customerPhone
    });

    if (!customer) {
      return res.status(400).json({
        success: false,
        message: "Customer name or phone is required"
      });
    }

    const entryDate = req.body.entryDate ? new Date(req.body.entryDate) : new Date();
    const entry = await CustomerLedger.create({
      customerId: customer._id,
      customerName: customer.name,
      customerPhone: normalizeText(req.body.customerPhone) || customer.phone || "",
      entryType: "adjustment",
      direction,
      amount,
      paymentMode: normalizeText(req.body.paymentMode),
      billNo: normalizeText(req.body.billNo),
      referenceNo: normalizeText(req.body.referenceNo || req.body.paymentMode || req.body.voucherType),
      note: normalizeText(req.body.note),
      createdBy: req.user?._id,
      createdAt: entryDate,
      updatedAt: entryDate
    });

    const ledgerBalance = await syncLedgerBalance(customer._id);

    await createAuditLog({
      module: "accounting",
      action: "LEDGER_ADJUSTMENT_CREATE",
      entityType: "CustomerLedger",
      entityId: entry._id,
      summary: `Created ${direction} adjustment for ${customer.name}`,
      after: entry.toObject(),
      metadata: {
        amount,
        ledgerBalance,
        direction
      },
      user: req.user
    });

    return res.status(201).json({
      success: true,
      message: "Ledger adjustment saved successfully",
      data: {
        entry,
        customer: {
          ...serializeCustomer(customer.toObject ? customer.toObject() : customer),
          ledgerBalance
        }
      }
    });
  } catch (err) {
    console.error("Create Ledger Adjustment Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to save ledger adjustment",
      error: err.message
    });
  }
};

export const createReceipt = async (req, res) => {
  try {
    const amount = round2(req.body.amount);
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Receipt amount must be greater than zero"
      });
    }

    const customer = await findOrCreateCustomer({
      customerId: req.body.customerId,
      customerName: req.body.customerName,
      customerPhone: req.body.customerPhone
    });

    if (!customer) {
      return res.status(400).json({
        success: false,
        message: "Customer name or phone is required"
      });
    }

    const receiptDate = req.body.receiptDate ? new Date(req.body.receiptDate) : new Date();
    const receipt = await CustomerLedger.create({
      customerId: customer._id,
      customerName: customer.name,
      customerPhone: normalizeText(req.body.customerPhone) || customer.phone || "",
      entryType: "payment",
      direction: "credit",
      amount,
      paymentMode: normalizeText(req.body.paymentMode) || "Cash",
      billNo: normalizeText(req.body.billNo),
      referenceNo: normalizeText(req.body.referenceNo || req.body.paymentMode),
      note: normalizeText(req.body.note),
      createdBy: req.user?._id,
      createdAt: receiptDate,
      updatedAt: receiptDate
    });

    const ledgerBalance = await syncLedgerBalance(customer._id);

    await createAuditLog({
      module: "accounting",
      action: "RECEIPT_CREATE",
      entityType: "CustomerLedger",
      entityId: receipt._id,
      summary: `Created receipt for ${customer.name}`,
      after: receipt.toObject(),
      metadata: {
        amount,
        ledgerBalance
      },
      user: req.user
    });

    return res.status(201).json({
      success: true,
      message: "Receipt saved successfully",
      data: {
        receipt,
        customer: {
          ...serializeCustomer(customer.toObject ? customer.toObject() : customer),
          ledgerBalance
        }
      }
    });
  } catch (err) {
    console.error("Create Receipt Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to save receipt",
      error: err.message
    });
  }
};

export const createExpenseEntry = async (req, res) => {
  try {
    const amount = round2(req.body.amount);
    const entryType = normalizeText(req.body.entryType || "expense").toLowerCase();
    const allowedTypes = ["expense", "bank-deposit", "bank-withdrawal", "cash-adjustment"];
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than zero"
      });
    }

    if (!allowedTypes.includes(entryType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid cash entry type"
      });
    }

    const paymentMode = normalizeText(req.body.paymentMode) || (entryType === "bank-deposit" || entryType === "bank-withdrawal" ? "Bank" : "Cash");
    const entryDate = req.body.entryDate ? new Date(req.body.entryDate) : new Date();
    const activeSession = await POSSession.findOne({ status: "open" }).sort({ openedAt: -1 }).lean();
    const businessDate = startOfDay(req.body.businessDate || activeSession?.businessDate || entryDate);
    const direction = entryType === "bank-withdrawal" ? "in" : (normalizeText(req.body.direction) === "in" ? "in" : "out");

    const entry = await CashEntry.create({
      entryDate,
      businessDate,
      entryType,
      direction,
      amount,
      paymentMode,
      category: normalizeText(req.body.category || req.body.accountLabel || entryType),
      accountLabel: normalizeText(req.body.accountLabel || req.body.category),
      referenceNo: normalizeText(req.body.referenceNo),
      note: normalizeText(req.body.note),
      posSessionId: req.body.posSessionId || activeSession?._id,
      createdBy: req.user?._id
    });

    await createAuditLog({
      module: "accounting",
      action: "CASH_ENTRY_CREATE",
      entityType: "CashEntry",
      entityId: entry._id,
      summary: `Created ${entryType} entry for Rs. ${amount.toFixed(2)}`,
      after: entry.toObject(),
      metadata: {
        entryType,
        direction,
        paymentMode,
        businessDate
      },
      user: req.user
    });

    return res.status(201).json({
      success: true,
      message: "Expense entry saved successfully",
      data: entry
    });
  } catch (err) {
    console.error("Create Expense Entry Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to save expense entry",
      error: err.message
    });
  }
};

export const getCustomerLedgerEntries = async (req, res) => {
  try {
    const entries = await CustomerLedger.find({ customerId: req.params.customerId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: entries
    });
  } catch (err) {
    console.error("Get Customer Ledger Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch customer ledger",
      error: err.message
    });
  }
};
