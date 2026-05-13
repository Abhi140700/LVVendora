import CustomerLedger from "../models/CustomerLedger.js";
import Inventory from "../models/Inventory.js";
import Party from "../models/Party.js";
import POSDraft from "../models/POSDraft.js";
import POSSession from "../models/POSSession.js";
import Sales from "../models/Sales.js";
import SalesReturnEntry from "../models/SalesReturnEntry.js";
import AuditLog from "../models/AuditLog.js";
import { createAuditLog } from "../services/auditService.js";
import { getWhatsAppStatus } from "../services/whatsappService.js";
import { calculateExpectedCash } from "../utils/posSession.js";
import { getRoleRules } from "../utils/permissionRules.js";
import { getSystemSettings } from "../services/systemSettingsService.js";
import { completeSale } from "../services/salesService.js";
import { deductInventoryItems, restockInventoryItems } from "../services/inventoryService.js";
import { recomputeSaleTotals } from "../utils/salesValidation.js";
import { runInTransaction } from "../utils/transaction.js";

const BILL_TYPES = ["cashpay", "exchange", "return", "card-upi", "hold", "recall", "credit", "advance"];
const PAYMENT_MODE_OPTIONS = ["Cash", "Card", "UPI", "Bank", "PAYTM", "HDFC", "IDFC"];
const COMPANY_NAME = process.env.COMPANY_NAME || "LAXMI VISHNU CLOTH SHOP";

const clampNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const round2 = (value) => Math.round(clampNumber(value) * 100) / 100;
const calculateEarnedPoints = (totalAmount) => Math.floor(clampNumber(totalAmount) / 100);
const normalizeText = (value = "") => String(value).trim();
const buildAcronym = (value = "") => normalizeText(value)
  .split(/\s+/)
  .filter(Boolean)
  .map((word) => word[0]?.toUpperCase() || "")
  .join("") || "POS";
const BILL_PREFIX = buildAcronym(COMPANY_NAME);

const buildDayRange = (referenceDate = new Date()) => {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(referenceDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const buildDateStamp = (referenceDate = new Date()) => {
  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, "0");
  const day = String(referenceDate.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const startOfDay = (referenceDate = new Date()) => {
  const nextDate = new Date(referenceDate);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const addDays = (referenceDate = new Date(), days = 0) => {
  const nextDate = new Date(referenceDate);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const mergeBusinessDateWithNow = (businessDate, now = new Date()) => {
  const merged = new Date(businessDate || now);
  merged.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return merged;
};

const getActivePosSessionQuery = () => POSSession.findOne({ status: "open" }).sort({ openedAt: -1 });

const serializeSaleForList = (sale) => ({
  ...sale,
  items: (sale.items || []).map((item) => ({
    ...item,
    remainingQty: Math.max(0, clampNumber(item.qty) - clampNumber(item.returnedQty))
  }))
});

const serializeCustomer = (customer) => {
  if (!customer) {
    return customer;
  }

  const rawId = String(customer._id || "");
  return {
    ...customer,
    customerCode: `${BILL_PREFIX}-${rawId.slice(-6).toUpperCase()}`
  };
};

const buildSaleLookup = async (saleIds, session = null) => {
  if (!saleIds.length) {
    return new Map();
  }

  const sales = await Sales.find({ _id: { $in: saleIds } }).session(session).lean();
  return new Map(sales.map((sale) => [String(sale._id), sale]));
};

const sanitizePaymentRows = (rows = []) => rows
  .map((row) => ({
    mode: PAYMENT_MODE_OPTIONS.includes(row.mode) ? row.mode : "Cash",
    amount: round2(row.amount),
    reference: normalizeText(row.reference)
  }))
  .filter((row) => row.amount > 0);

const buildFinalPaymentBreakdown = (billType, paymentBreakdown, payableAmount) => {
  if (billType === "cashpay") {
    return payableAmount > 0 ? [{ mode: "Cash", amount: round2(payableAmount), reference: "" }] : [];
  }

  if (billType === "credit") {
    return [];
  }

  return paymentBreakdown;
};

const isMeaningfulDraft = (payload = {}) => {
  if ((payload.items || []).length > 0) {
    return true;
  }

  return Boolean(
    normalizeText(payload.customer) ||
    normalizeText(payload.customerPhone) ||
    normalizeText(payload.note) ||
    normalizeText(payload.referenceNo)
  );
};

const getNextInvoiceNo = async (saleDate = new Date()) => {
  const stamp = buildDateStamp(saleDate);
  const { start, end } = buildDayRange(saleDate);
  const count = await Sales.countDocuments({
    saleDate: { $gte: start, $lte: end }
  });
  return `INV-${stamp}-${String(count + 1).padStart(3, "0")}`;
};

const getNextBillNo = async () => {
  const [sales, drafts] = await Promise.all([
    Sales.find({ billNo: new RegExp(`^${BILL_PREFIX}/\\d+$`) }).select("billNo").lean(),
    POSDraft.find({ billNo: new RegExp(`^${BILL_PREFIX}/\\d+$`) }).select("billNo").lean()
  ]);

  const nextNumber = [...sales, ...drafts]
    .map((entry) => Number(String(entry.billNo || "").split("/")[1] || 0))
    .reduce((max, value) => (value > max ? value : max), 0) + 1;

  return `${BILL_PREFIX}/${nextNumber}`;
};

const getNextSessionNo = async (openedAt = new Date()) => {
  const stamp = buildDateStamp(openedAt);
  const { start, end } = buildDayRange(openedAt);
  const count = await POSSession.countDocuments({ openedAt: { $gte: start, $lte: end } });
  return `SHIFT-${stamp}-${String(count + 1).padStart(3, "0")}`;
};

const buildDraftPayload = async (payload = {}, userId) => {
  const saleDate = payload.saleDate ? new Date(payload.saleDate) : new Date();

  return {
    billNo: normalizeText(payload.billNo) || await getNextBillNo(saleDate),
    billType: BILL_TYPES.includes(payload.billType) ? payload.billType : "cashpay",
    customerId: payload.customerId || undefined,
    customer: normalizeText(payload.customer),
    customerPhone: normalizeText(payload.customerPhone),
    salespersonId: payload.salespersonId || undefined,
    salesman: normalizeText(payload.salesman),
    note: normalizeText(payload.note),
    deliveryInfo: normalizeText(payload.deliveryInfo),
    referenceNo: normalizeText(payload.referenceNo),
    discountPercent: round2(payload.discountPercent),
    discountAmount: round2(payload.discountAmount),
    subtotal: round2(payload.subtotal),
    exchangeAmount: round2(payload.exchangeAmount),
    payableAmount: round2(payload.payableAmount),
    advanceAmount: round2(payload.advanceAmount),
    creditDue: round2(payload.creditDue),
    paymentBreakdown: sanitizePaymentRows(payload.paymentBreakdown),
    exchangeItems: Array.isArray(payload.exchangeItems) ? payload.exchangeItems.map((item) => ({
      saleId: item.saleId || undefined,
      saleItemId: item.saleItemId || undefined,
      billNo: normalizeText(item.billNo),
      itemName: normalizeText(item.itemName),
      barcode: normalizeText(item.barcode),
      qty: Math.max(1, clampNumber(item.qty, 1)),
      amount: round2(item.amount)
    })) : [],
    items: Array.isArray(payload.items) ? payload.items.map((item) => ({
      inventoryId: item.inventoryId || undefined,
      itemId: item.itemId || undefined,
      barcode: normalizeText(item.barcode),
      itemName: normalizeText(item.itemName),
      category: item.category || undefined,
      categoryName: normalizeText(item.categoryName),
      brand: item.brand || undefined,
      brandName: normalizeText(item.brandName),
      salesmanNumber: normalizeText(item.salesmanNumber),
      qty: Math.max(1, clampNumber(item.qty, 1)),
      displayQty: Math.max(0, clampNumber(item.displayQty)),
      mtrQty: Math.max(0, clampNumber(item.mtrQty)),
      stock: Math.max(0, clampNumber(item.stock)),
      mrp: round2(item.mrp),
      saleRate: round2(item.saleRate),
      originalSaleRate: round2(item.originalSaleRate ?? item.saleRate),
      lineDiscountPercent: round2(item.lineDiscountPercent),
      lineTotal: round2(item.lineTotal),
      unit: normalizeText(item.unit) || "PC"
    })) : [],
    lastTouchedAt: new Date(),
    createdBy: userId
  };
};

const upsertCustomer = async ({
  customerId,
  customer,
  customerPhone,
  location,
  dateOfBirth,
  anniversary,
  deliveryInfo,
  note,
  session = null
}) => {
  const normalizedCustomerId = normalizeText(customerId);
  const normalizedName = normalizeText(customer);
  const normalizedPhone = normalizeText(customerPhone);

  if (!normalizedCustomerId && !normalizedName && !normalizedPhone) {
    return null;
  }

  let existing = null;

  if (normalizedCustomerId) {
    existing = await Party.findById(normalizedCustomerId).session(session);
  }

  if (!existing && normalizedPhone) {
    existing = await Party.findOne({ partyType: "customer", phone: normalizedPhone }).session(session);
  }

  if (!existing && normalizedName) {
    existing = await Party.findOne({ partyType: "customer", name: normalizedName }).session(session);
  }

  if (existing) {
    const duplicateByName = normalizedName
      ? await Party.findOne({
        partyType: "customer",
        name: normalizedName,
        _id: { $ne: existing._id }
      }).session(session)
      : null;

    const targetCustomer = duplicateByName || existing;

    if (duplicateByName && normalizedPhone && !targetCustomer.phone) {
      targetCustomer.phone = normalizedPhone;
    }

    existing.partyType = "customer";
    targetCustomer.partyType = "customer";
    targetCustomer.name = normalizedName || targetCustomer.name;
    targetCustomer.phone = normalizedPhone || targetCustomer.phone;
    targetCustomer.location = normalizeText(location) || targetCustomer.location;
    targetCustomer.dateOfBirth = dateOfBirth || targetCustomer.dateOfBirth;
    targetCustomer.anniversary = anniversary || targetCustomer.anniversary;
    targetCustomer.addressLine1 = deliveryInfo || targetCustomer.addressLine1;
    targetCustomer.notes = note || targetCustomer.notes;
    await targetCustomer.save({ session });
    return targetCustomer;
  }

  if (!normalizedName && !normalizedPhone) {
    return null;
  }

  try {
    const created = await Party.create([{
      name: normalizedName || normalizedPhone,
      phone: normalizedPhone,
      location: normalizeText(location),
      dateOfBirth: dateOfBirth || undefined,
      anniversary: anniversary || undefined,
      partyType: "customer",
      addressLine1: deliveryInfo,
      notes: note
    }], { session });
    return created[0];
  } catch (error) {
    if (error?.code === 11000) {
      const duplicateCustomer = await Party.findOne({
        partyType: "customer",
        $or: [
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
          ...(normalizedName ? [{ name: normalizedName }] : [])
        ]
      }).session(session);

      if (duplicateCustomer) {
        duplicateCustomer.phone = normalizedPhone || duplicateCustomer.phone;
        duplicateCustomer.location = normalizeText(location) || duplicateCustomer.location;
        duplicateCustomer.dateOfBirth = dateOfBirth || duplicateCustomer.dateOfBirth;
        duplicateCustomer.anniversary = anniversary || duplicateCustomer.anniversary;
        duplicateCustomer.addressLine1 = deliveryInfo || duplicateCustomer.addressLine1;
        duplicateCustomer.notes = note || duplicateCustomer.notes;
        await duplicateCustomer.save({ session });
        return duplicateCustomer;
      }
    }

    throw error;
  }
};

const validateExchangeItems = async (exchangeItems = [], session = null) => {
  const items = Array.isArray(exchangeItems) ? exchangeItems : [];
  const saleIds = [...new Set(items.map((item) => normalizeText(item.saleId)).filter(Boolean))];
  const salesLookup = await buildSaleLookup(saleIds, session);
  const processed = [];

  for (const exchangeItem of items) {
    const sale = salesLookup.get(normalizeText(exchangeItem.saleId));
    if (!sale) {
      throw new Error("Linked exchange sale not found");
    }

    const saleItem = (sale.items || []).find((item) => String(item._id) === String(exchangeItem.saleItemId));
    if (!saleItem) {
      throw new Error("Linked exchange item not found");
    }

    const qty = Math.max(1, clampNumber(exchangeItem.qty, 1));
    const remainingQty = Math.max(0, clampNumber(saleItem.qty) - clampNumber(saleItem.returnedQty));

    if (qty > remainingQty) {
      throw new Error(`Exchange quantity exceeds remaining quantity for ${saleItem.itemName || saleItem.barcode || "item"}`);
    }

    const rate = round2(saleItem.sellingRate || saleItem.total / Math.max(1, saleItem.qty));

    processed.push({
      sale,
      saleItem,
      qty,
      amount: round2(exchangeItem.amount || qty * rate),
      billNo: exchangeItem.billNo || sale.billNo || sale.invoiceNo || "",
      itemName: exchangeItem.itemName || saleItem.itemName || "",
      barcode: exchangeItem.barcode || saleItem.barcode || ""
    });
  }

  return processed;
};

const validateAndBuildSaleItems = async (items = [], roleRules, session = null) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("At least one line item is required");
  }

  const builtItems = [];
  const stockWarnings = [];

  for (const incomingItem of items) {
    const inventoryMatch = incomingItem.inventoryId
      ? await Inventory.findById(incomingItem.inventoryId).session(session)
      : await Inventory.findOne({
        $or: [
          { itemId: incomingItem.itemId || undefined },
          { barcode: normalizeText(incomingItem.barcode) || "__missing__" }
        ]
      }).session(session);

    if (!inventoryMatch) {
      throw new Error(`Inventory item not found for ${incomingItem.itemName || incomingItem.barcode || "line item"}`);
    }

    const qty = Math.max(1, clampNumber(incomingItem.qty, 1));
    const availableStock = clampNumber(inventoryMatch.stock);
    if (qty > availableStock) {
      stockWarnings.push({
        itemName: incomingItem.itemName || inventoryMatch.name,
        requestedQty: qty,
        availableStock
      });
      continue;
    }

    const defaultSaleRate = round2(inventoryMatch.sellingRate);
    const requestedSaleRate = round2(incomingItem.sellingRate ?? incomingItem.saleRate ?? defaultSaleRate);
    const requestedMrp = round2(incomingItem.mrp ?? inventoryMatch.mrp ?? defaultSaleRate);
    const originalSaleRate = defaultSaleRate || requestedSaleRate;
    const lineDiscountPercent = originalSaleRate > 0
      ? round2(((originalSaleRate - requestedSaleRate) / originalSaleRate) * 100)
      : 0;

    if (lineDiscountPercent > roleRules.maxLineDiscountPercent) {
      throw new Error(`Line discount exceeds ${roleRules.maxLineDiscountPercent}% limit`);
    }

    const priceChanged = Math.abs(requestedSaleRate - defaultSaleRate) > 0.009 || Math.abs(requestedMrp - round2(inventoryMatch.mrp)) > 0.009;
    if (priceChanged && !roleRules.allowPriceOverride && lineDiscountPercent > 0) {
      throw new Error("Your role is not allowed to override item price");
    }

    builtItems.push({
      inventoryId: inventoryMatch._id,
      itemId: inventoryMatch.itemId,
      itemName: incomingItem.itemName || inventoryMatch.name,
      salesmanNumber: normalizeText(incomingItem.salesmanNumber),
      category: incomingItem.category || inventoryMatch.category || undefined,
      categoryName: normalizeText(incomingItem.categoryName),
      brand: incomingItem.brand || inventoryMatch.brand || undefined,
      brandName: normalizeText(incomingItem.brandName),
      barcode: normalizeText(incomingItem.barcode) || normalizeText(inventoryMatch.barcode),
      qty,
      displayQty: Math.max(0, clampNumber(incomingItem.displayQty)),
      mtrQty: Math.max(0, clampNumber(incomingItem.mtrQty)),
      unit: normalizeText(incomingItem.unit) || inventoryMatch.unit || "PC",
      mrp: requestedMrp,
      sellingRate: requestedSaleRate,
      originalSaleRate,
      lineDiscountPercent: Math.max(0, lineDiscountPercent),
      netRate: requestedSaleRate,
      total: round2(qty * requestedSaleRate)
    });
  }

  if (stockWarnings.length > 0) {
    const firstWarning = stockWarnings[0];
    throw new Error(`Insufficient stock for ${firstWarning.itemName}. Requested ${firstWarning.requestedQty}, available ${firstWarning.availableStock}.`);
  }

  return builtItems;
};

const validateSettlement = ({
  billType,
  customer,
  paymentBreakdown,
  subtotal,
  discountAmount,
  exchangeAmount,
  advanceAmount,
  creditDue
}) => {
  const payable = round2(Math.max(0, subtotal - discountAmount - exchangeAmount));
  const paidAmount = round2((paymentBreakdown || []).reduce((sum, row) => sum + clampNumber(row.amount), 0));
  const normalizedAdvance = round2(advanceAmount);
  const totalSettled = round2(paidAmount + normalizedAdvance);
  const customerRequired = ["credit", "advance"].includes(billType);

  if (customerRequired && !normalizeText(customer)) {
    throw new Error("Customer is required for credit and advance bills");
  }

  if (billType === "cashpay" || billType === "card-upi" || billType === "return") {
    if (Math.abs(totalSettled - payable) > 0.01) {
      throw new Error("Full payment is required for the selected bill mode");
    }
  }

  if (billType === "card-upi" && paymentBreakdown.length === 0) {
    throw new Error("Add at least one payment row for Card / UPI bills");
  }

  if (billType === "credit") {
    if (totalSettled > payable + 0.01) {
      throw new Error("Credit bill payments cannot exceed the payable total");
    }
  }

  if (billType === "advance") {
    if (normalizedAdvance <= 0 && paidAmount <= 0) {
      throw new Error("Advance amount is required for advance bills");
    }
    if (totalSettled > payable + 0.01) {
      throw new Error("Advance bill settlement cannot exceed the payable total");
    }
  }

  const computedCreditDue = billType === "credit" || billType === "advance"
    ? round2(Math.max(0, payable - totalSettled))
    : 0;

  if ((billType === "credit" || billType === "advance") && Math.abs(round2(creditDue) - computedCreditDue) > 0.01) {
    return {
      payable,
      paidAmount,
      advanceAmount: normalizedAdvance,
      creditDue: computedCreditDue
    };
  }

  return {
    payable,
    paidAmount,
    advanceAmount: normalizedAdvance,
    creditDue: computedCreditDue
  };
};

const applyInventoryDeduction = async (items) => {
  for (const item of items) {
    const inventoryItem = await Inventory.findById(item.inventoryId);
    if (!inventoryItem) {
      throw new Error(`Inventory item missing for ${item.itemName}`);
    }

    if (clampNumber(item.qty) > clampNumber(inventoryItem.stock)) {
      throw new Error(`Stock changed before billing for ${item.itemName}. Please reload the bill.`);
    }

    inventoryItem.stock = round2(Math.max(0, clampNumber(inventoryItem.stock) - clampNumber(item.qty)));
    await inventoryItem.save();
  }
};

const applyExchangeReturns = async (exchangeItems, linkedSaleId, customer, customerPhone, customerId, createdBy, session = null) => {
  if (!exchangeItems.length) {
    return null;
  }

  let totalAmount = 0;
  const entryItems = [];

  for (const exchangeItem of exchangeItems) {
    const sale = await Sales.findById(exchangeItem.sale._id).session(session);
    if (!sale) {
      throw new Error("Source exchange sale no longer exists");
    }

    const saleItem = sale.items.id(exchangeItem.saleItem._id);
    if (!saleItem) {
      throw new Error("Source exchange line no longer exists");
    }

    const remainingQty = clampNumber(saleItem.qty) - clampNumber(saleItem.returnedQty);
    if (exchangeItem.qty > remainingQty) {
      throw new Error(`Exchange quantity exceeds remaining quantity for ${saleItem.itemName || saleItem.barcode || "item"}`);
    }

    await restockInventoryItems([{
      itemId: saleItem.itemId,
      barcode: saleItem.barcode,
      qty: exchangeItem.qty,
      itemName: saleItem.itemName
    }], { session });

    saleItem.returnedQty = clampNumber(saleItem.returnedQty) + exchangeItem.qty;
    sale.totalReturnedAmount = round2(clampNumber(sale.totalReturnedAmount) + exchangeItem.amount);
    await sale.save({ session });

    totalAmount += exchangeItem.amount;
    entryItems.push({
      sourceSaleId: sale._id,
      sourceSaleItemId: saleItem._id,
      sourceBillNo: sale.billNo || sale.invoiceNo,
      itemId: saleItem.itemId,
      itemName: saleItem.itemName,
      barcode: saleItem.barcode,
      qty: exchangeItem.qty,
      rate: round2(saleItem.sellingRate),
      amount: exchangeItem.amount
    });
  }

  const createdEntries = await SalesReturnEntry.create([{
    entryType: "exchange-return",
    linkedSaleId,
    customerId: customerId || undefined,
    customerName: customer,
    customerPhone,
    totalAmount: round2(totalAmount),
    items: entryItems,
    createdBy
  }], { session });

  return createdEntries[0];
};

const syncLedgerBalance = async (customerId, session = null) => {
  if (!customerId) {
    return;
  }

  const entries = await CustomerLedger.find({ customerId }).session(session).lean();
  const balance = entries.reduce((sum, entry) => (
    entry.direction === "debit"
      ? sum + clampNumber(entry.amount)
      : sum - clampNumber(entry.amount)
  ), 0);

  await Party.findByIdAndUpdate(customerId, { ledgerBalance: round2(balance) }, { session });
};

const createLedgerEntries = async ({
  sale,
  customer,
  customerPhone,
  customerId,
  paidAmount,
  advanceAmount,
  creditDue,
  exchangeAmount,
  createdBy,
  session = null
}) => {
  if (!customerId) {
    return;
  }

  const entries = [];

  if (creditDue > 0) {
    entries.push({
      customerId,
      customerName: customer,
      customerPhone,
      entryType: sale.billType === "advance" ? "advance-sale" : "credit-sale",
      direction: "debit",
      amount: round2(creditDue),
      saleId: sale._id,
      billNo: sale.billNo,
      referenceNo: sale.referenceNo,
      note: sale.note,
      createdBy
    });
  }

  if (advanceAmount > 0) {
    entries.push({
      customerId,
      customerName: customer,
      customerPhone,
      entryType: "advance-sale",
      direction: "credit",
      amount: round2(advanceAmount),
      saleId: sale._id,
      billNo: sale.billNo,
      referenceNo: sale.referenceNo,
      note: "Advance received",
      createdBy
    });
  }

  if (sale.billType === "exchange" && exchangeAmount > 0) {
    entries.push({
      customerId,
      customerName: customer,
      customerPhone,
      entryType: "exchange-return",
      direction: "credit",
      amount: round2(exchangeAmount),
      saleId: sale._id,
      billNo: sale.billNo,
      referenceNo: sale.referenceNo,
      note: "Exchange value adjusted",
      createdBy
    });
  }

  if (paidAmount > 0 && ["credit", "advance"].includes(sale.billType)) {
    entries.push({
      customerId,
      customerName: customer,
      customerPhone,
      entryType: "payment",
      direction: "credit",
      amount: round2(paidAmount),
      saleId: sale._id,
      billNo: sale.billNo,
      referenceNo: sale.referenceNo,
      note: "Payment received",
      createdBy
    });
  }

  if (entries.length > 0) {
    await CustomerLedger.insertMany(entries, { session });
    await syncLedgerBalance(customerId, session);
  }
};

export const getSalesWorkbench = async (req, res) => {
  try {
    const whatsappStatus = getWhatsAppStatus();
    const [draft, holds, recentSales, customers, salespeople, nextBillNo, activeSession] = await Promise.all([
      POSDraft.findOne({ createdBy: req.user._id, status: "draft" }).sort({ updatedAt: -1 }).lean(),
      POSDraft.find({ createdBy: req.user._id, status: "hold" }).sort({ updatedAt: -1 }).limit(20).lean(),
      Sales.find().sort({ saleDate: -1 }).limit(12).lean(),
      Party.find({ partyType: "customer" }).sort({ updatedAt: -1 }).limit(30).lean(),
      Party.find({ partyType: "salesman" }).select("name phone location salesmanCode").sort({ salesmanCode: 1, name: 1 }).lean(),
      getNextBillNo(),
      getActivePosSessionQuery().lean()
    ]);

    return res.status(200).json({
      success: true,
        data: {
        draft,
        holds,
        recentSales: recentSales.map(serializeSaleForList),
        customers: customers.map(serializeCustomer),
        salespeople: salespeople.map((person) => ({
          _id: person._id,
          name: person.name,
          phone: person.phone || "",
          location: person.location || "",
          salesmanCode: Number(person.salesmanCode || 0),
        })),
        nextBillNo,
        permissionRules: getRoleRules(req.user.role),
        activeSession,
        whatsapp: {
          ...whatsappStatus,
          message: whatsappStatus.enabled
            ? "WhatsApp is connected."
            : (whatsappStatus.latestError || "WhatsApp integration will become active after whatsapp-web.js is installed and connected.")
        }
      }
    });
  } catch (err) {
    console.error("Get Sales Workbench Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load sales workbench",
      error: err.message
    });
  }
};

export const getSales = async (req, res) => {
  try {
    const sales = await Sales.find()
      .sort({ saleDate: -1 })
      .populate("items.itemId", "name")
      .lean();

    return res.status(200).json({
      success: true,
      data: sales.map(serializeSaleForList)
    });
  } catch (err) {
    console.error("Get Sales Error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch sales", error: err.message });
  }
};

export const getNextSalesBillNo = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        billNo: await getNextBillNo(),
        invoiceNo: await getNextInvoiceNo()
      }
    });
  } catch (err) {
    console.error("Get Next Sales Bill No Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to generate next bill number",
      error: err.message
    });
  }
};

export const upsertSalesDraft = async (req, res) => {
  try {
    const payload = await buildDraftPayload(req.body, req.user._id);
    const existingDraft = await POSDraft.findOne({ createdBy: req.user._id, status: "draft" });

    if (!isMeaningfulDraft(payload)) {
      await POSDraft.findOneAndDelete({ createdBy: req.user._id, status: "draft" });
      return res.status(200).json({
        success: true,
        message: "Empty draft cleared",
        data: null
      });
    }

    const draft = await POSDraft.findOneAndUpdate(
      { createdBy: req.user._id, status: "draft" },
      payload,
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
    );

    const discountChanged = existingDraft
      && (
        round2(existingDraft.discountPercent) !== round2(payload.discountPercent)
        || round2(existingDraft.discountAmount) !== round2(payload.discountAmount)
      );
    if (discountChanged) {
      await createAuditLog({
        module: "sales",
        action: "DISCOUNT_CHANGE",
        entityType: "POSDraft",
        entityId: draft._id,
        summary: `Discount changed for draft ${draft.billNo || ""}`.trim(),
        before: {
          discountPercent: existingDraft.discountPercent,
          discountAmount: existingDraft.discountAmount,
        },
        after: {
          discountPercent: draft.discountPercent,
          discountAmount: draft.discountAmount,
        },
        user: req.user
      });
    }

    return res.status(200).json({
      success: true,
      data: draft
    });
  } catch (err) {
    console.error("Upsert Sales Draft Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to save draft",
      error: err.message
    });
  }
};

export const clearSalesDraft = async (req, res) => {
  try {
    const deletedDraft = await POSDraft.findOneAndDelete({ createdBy: req.user._id, status: "draft" });
    if (deletedDraft) {
      await createAuditLog({
        module: "sales",
        action: "DELETE_DRAFT",
        entityType: "POSDraft",
        entityId: deletedDraft._id,
        summary: `Deleted draft bill ${deletedDraft.billNo || ""}`.trim(),
        before: deletedDraft.toObject(),
        user: req.user
      });
    }
    return res.status(200).json({
      success: true,
      message: "Draft cleared"
    });
  } catch (err) {
    console.error("Clear Sales Draft Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to clear draft",
      error: err.message
    });
  }
};

export const holdSalesDraft = async (req, res) => {
  try {
    const payload = await buildDraftPayload(req.body, req.user._id);

    if (!isMeaningfulDraft(payload)) {
      return res.status(400).json({
        success: false,
        message: "There is no active bill to hold"
      });
    }

    const heldDraft = await POSDraft.create({
      ...payload,
      status: "hold",
      lastTouchedAt: new Date()
    });

    await POSDraft.findOneAndDelete({ createdBy: req.user._id, status: "draft" });
    await createAuditLog({
      module: "sales",
      action: "HOLD",
      entityType: "POSDraft",
      entityId: heldDraft._id,
      summary: `Held bill ${heldDraft.billNo}`,
      after: heldDraft.toObject(),
      user: req.user
    });

    return res.status(201).json({
      success: true,
      message: "Bill placed on hold",
      data: heldDraft
    });
  } catch (err) {
    console.error("Hold Sales Draft Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to hold bill",
      error: err.message
    });
  }
};

export const recallHeldDraft = async (req, res) => {
  try {
    const heldDraft = await POSDraft.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
      status: "hold"
    });

    if (!heldDraft) {
      return res.status(404).json({
        success: false,
        message: "Held bill not found"
      });
    }

    await POSDraft.findOneAndDelete({ createdBy: req.user._id, status: "draft" });
    heldDraft.status = "draft";
    heldDraft.billType = heldDraft.billType === "hold" ? "cashpay" : heldDraft.billType;
    heldDraft.lastTouchedAt = new Date();
    await heldDraft.save();
    await createAuditLog({
      module: "sales",
      action: "RECALL",
      entityType: "POSDraft",
      entityId: heldDraft._id,
      summary: `Recalled bill ${heldDraft.billNo}`,
      after: heldDraft.toObject(),
      user: req.user
    });

    return res.status(200).json({
      success: true,
      message: "Held bill recalled",
      data: heldDraft
    });
  } catch (err) {
    console.error("Recall Held Draft Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to recall bill",
      error: err.message
    });
  }
};

export const createOrLookupCustomer = async (req, res) => {
  try {
    const customer = await upsertCustomer(req.body);

    if (!customer) {
      return res.status(400).json({
        success: false,
        message: "Customer name or phone is required"
      });
    }

    return res.status(200).json({
      success: true,
      data: serializeCustomer(customer)
    });
  } catch (err) {
    console.error("Create Or Lookup Customer Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to save customer",
      error: err.message
    });
  }
};

export const getSalesCustomers = async (req, res) => {
  try {
    const query = normalizeText(req.query.q).toLowerCase();
    const customers = await Party.find({ partyType: "customer" }).sort({ updatedAt: -1 }).lean();
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
    console.error("Get Sales Customers Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: err.message
    });
  }
};

export const updateSalesCustomer = async (req, res) => {
  try {
    const customer = await Party.findOne({ _id: req.params.id, partyType: "customer" });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    customer.name = normalizeText(req.body.customer || req.body.name) || customer.name;
    customer.phone = normalizeText(req.body.customerPhone || req.body.phone) || customer.phone;
    customer.location = normalizeText(req.body.location) || customer.location;
    customer.dateOfBirth = req.body.dateOfBirth || customer.dateOfBirth;
    customer.anniversary = req.body.anniversary || customer.anniversary;
    customer.addressLine1 = normalizeText(req.body.deliveryInfo || req.body.addressLine1) || customer.addressLine1;
    customer.city = normalizeText(req.body.city) || customer.city;
    customer.pincode = normalizeText(req.body.pincode) || customer.pincode;
    customer.gstNo = normalizeText(req.body.gstin || req.body.gstNo).toUpperCase() || customer.gstNo;
    customer.notes = normalizeText(req.body.note || req.body.notes) || customer.notes;
    await customer.save();

    return res.status(200).json({
      success: true,
      data: serializeCustomer(customer.toObject())
    });
  } catch (err) {
    console.error("Update Sales Customer Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update customer",
      error: err.message
    });
  }
};

export const deleteSalesCustomer = async (req, res) => {
  try {
    const customer = await Party.findOneAndDelete({ _id: req.params.id, partyType: "customer" });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Customer deleted"
    });
  } catch (err) {
    console.error("Delete Sales Customer Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete customer",
      error: err.message
    });
  }
};

export const openPosSession = async (req, res) => {
  try {
    const existingSession = await getActivePosSessionQuery();
    if (existingSession) {
      return res.status(200).json({
        success: true,
        message: "POS session already open",
        data: existingSession
      });
    }

    const openingCash = round2(req.body.openingCash);
    const businessDate = startOfDay(req.body.businessDate || new Date());
    const session = await POSSession.create({
      sessionNo: await getNextSessionNo(),
      openingCash,
      businessDate,
      openedBy: req.user._id
    });

    await createAuditLog({
      module: "sales",
      action: "SESSION_OPEN",
      entityType: "POSSession",
      entityId: session._id,
      summary: `Opened POS session ${session.sessionNo}`,
      after: session.toObject(),
      user: req.user
    });

    return res.status(201).json({
      success: true,
      message: "POS session opened",
      data: session
    });
  } catch (err) {
    console.error("Open POS Session Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to open POS session",
      error: err.message
    });
  }
};

export const dayEndPosSession = async (req, res) => {
  try {
    const session = await getActivePosSessionQuery();
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "No open POS session found"
      });
    }

    const currentBusinessDate = startOfDay(session.businessDate || session.openedAt || new Date());
    const nextBusinessDate = startOfDay(req.body.nextBusinessDate || addDays(currentBusinessDate, 1));
    const beforeSnapshot = session.toObject();

    if (nextBusinessDate <= currentBusinessDate) {
      return res.status(400).json({
        success: false,
        message: "Day end must move the session date forward"
      });
    }

    session.lastDayEndDate = currentBusinessDate;
    session.lastDayEndAt = new Date();
    session.businessDate = nextBusinessDate;
    await session.save();

    await createAuditLog({
      module: "sales",
      action: "SESSION_DAY_END",
      entityType: "POSSession",
      entityId: session._id,
      summary: `Moved business date from ${currentBusinessDate.toLocaleDateString()} to ${nextBusinessDate.toLocaleDateString()}`,
      before: beforeSnapshot,
      after: session.toObject(),
      metadata: {
        previousBusinessDate: currentBusinessDate,
        nextBusinessDate
      },
      user: req.user
    });

    return res.status(200).json({
      success: true,
      message: `Day end completed. Billing date changed to ${nextBusinessDate.toLocaleDateString("en-IN")}.`,
      data: session
    });
  } catch (err) {
    console.error("Day End POS Session Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to run day end",
      error: err.message
    });
  }
};

export const undoDayEndPosSession = async (req, res) => {
  try {
    const session = await getActivePosSessionQuery();
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "No open POS session found"
      });
    }

    const dayEndLog = await AuditLog.findOne({
      action: "SESSION_DAY_END",
      entityType: "POSSession",
      entityId: String(session._id)
    }).sort({ createdAt: -1, _id: -1 });

    if (!dayEndLog) {
      return res.status(404).json({
        success: false,
        message: "No day end action found to undo"
      });
    }

    const beforeSnapshot = dayEndLog.before || {};
    if (!beforeSnapshot.businessDate) {
      return res.status(400).json({
        success: false,
        message: "This day end entry cannot be undone"
      });
    }

    const sessionBeforeUndo = session.toObject();
    session.businessDate = beforeSnapshot.businessDate;
    session.lastDayEndDate = beforeSnapshot.lastDayEndDate ?? undefined;
    session.lastDayEndAt = beforeSnapshot.lastDayEndAt ?? undefined;
    await session.save();

    await createAuditLog({
      module: "sales",
      action: "SESSION_DAY_END_UNDO",
      entityType: "POSSession",
      entityId: session._id,
      summary: `Rolled back business date to ${new Date(session.businessDate).toLocaleDateString("en-IN")}`,
      before: sessionBeforeUndo,
      after: session.toObject(),
      metadata: {
        revertedAuditLogId: dayEndLog._id,
        restoredBusinessDate: session.businessDate
      },
      user: req.user
    });

    await dayEndLog.deleteOne();

    return res.status(200).json({
      success: true,
      message: `Day end undone. Billing date restored to ${new Date(session.businessDate).toLocaleDateString("en-IN")}.`,
      data: session
    });
  } catch (err) {
    console.error("Undo Day End POS Session Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to undo day end",
      error: err.message
    });
  }
};

export const closePosSession = async (req, res) => {
  try {
    const roleRules = getRoleRules(req.user.role);
    if (!roleRules.canCloseSession) {
      return res.status(403).json({
        success: false,
        message: "Your role cannot close POS sessions"
      });
    }

    const session = await getActivePosSessionQuery();
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "No open POS session found"
      });
    }

    const cashSales = await Sales.find({
      posSessionId: session._id,
      saleDate: { $gte: session.openedAt, $lte: new Date() }
    }).lean();

    const closingCash = round2(req.body.closingCash);
    const expenseAmount = round2(req.body.expenseAmount);
    session.expectedCash = calculateExpectedCash({
      openingCash: session.openingCash,
      expenseAmount,
      sales: cashSales
    });
    session.expenseAmount = expenseAmount;
    session.expenseNote = normalizeText(req.body.expenseNote);
    session.closingCash = closingCash;
    session.cashDifference = round2(closingCash - session.expectedCash);
    session.closedAt = new Date();
    session.closedBy = req.user._id;
    session.status = "closed";
    await session.save();

    await createAuditLog({
      module: "sales",
      action: "SESSION_CLOSE",
      entityType: "POSSession",
      entityId: session._id,
      summary: `Closed POS session ${session.sessionNo}`,
      after: session.toObject(),
      user: req.user
    });

    return res.status(200).json({
      success: true,
      message: "POS session closed",
      data: session
    });
  } catch (err) {
    console.error("Close POS Session Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to close POS session",
      error: err.message
    });
  }
};

export const createSale = async (req, res) => {
  try {
    const roleRules = getRoleRules(req.user.role);
    const activeSession = await getActivePosSessionQuery();
    const baseSaleDate = activeSession?.businessDate || req.body.saleDate || new Date();
    const saleDate = mergeBusinessDateWithNow(baseSaleDate, new Date());
    const discountPercent = round2(req.body.discountPercent);

    if (discountPercent > roleRules.maxBillDiscountPercent) {
      return res.status(400).json({
        success: false,
        message: `Bill discount exceeds ${roleRules.maxBillDiscountPercent}% limit`
      });
    }

    const systemSettings = await getSystemSettings();
    const allowedPaymentModes = systemSettings.paymentModes || PAYMENT_MODE_OPTIONS;
    const requestedPaymentBreakdown = sanitizePaymentRows(req.body.paymentBreakdown)
      .filter((row) => allowedPaymentModes.includes(row.mode));
    const billType = BILL_TYPES.includes(req.body.billType) ? req.body.billType : "cashpay";
    const saleItems = await validateAndBuildSaleItems(req.body.items, roleRules);
    const exchangeItems = await validateExchangeItems(req.body.exchangeItems);
    const totals = recomputeSaleTotals({
      items: saleItems,
      discountPercent,
      discountAmount: req.body.discountAmount,
      exchangeItems,
      advanceAmount: req.body.advanceAmount,
      creditDue: req.body.creditDue,
      paymentBreakdown: requestedPaymentBreakdown,
      billType
    });
    const settlement = validateSettlement({
      billType,
      customer: req.body.customer,
      paymentBreakdown: requestedPaymentBreakdown,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      exchangeAmount: totals.exchangeAmount,
      advanceAmount: req.body.advanceAmount,
      creditDue: req.body.creditDue
    });
    const paymentBreakdown = buildFinalPaymentBreakdown(billType, requestedPaymentBreakdown, settlement.payable);

    const salePayload = {
      invoiceNo: normalizeText(req.body.invoiceNo) || await getNextInvoiceNo(saleDate),
      billNo: normalizeText(req.body.billNo) || await getNextBillNo(saleDate),
      saleDate,
      customer: normalizeText(req.body.customer),
      customerId: req.body.customerId || undefined,
      customerPhone: normalizeText(req.body.customerPhone),
      salesman: normalizeText(req.body.salesman),
      salespersonId: req.body.salespersonId || undefined,
      billType,
      note: normalizeText(req.body.note),
      deliveryInfo: normalizeText(req.body.deliveryInfo),
      referenceNo: normalizeText(req.body.referenceNo),
      counterName: normalizeText(req.body.counterName),
      items: saleItems,
      subtotal: totals.subtotal,
      gstRate: 0,
      gstAmount: 0,
      discount: totals.discountAmount,
      discountPercent,
      exchangeAmount: totals.exchangeAmount,
      advanceAmount: settlement.advanceAmount,
      creditDue: settlement.creditDue,
      paidAmount: settlement.paidAmount,
      paymentBreakdown,
      exchangeItems: exchangeItems.map((item) => ({
        saleId: item.sale._id,
        saleItemId: item.saleItem._id,
        billNo: item.billNo,
        itemName: item.itemName,
        barcode: item.barcode,
        amount: item.amount
      })),
      loyaltyPointsEarned: calculateEarnedPoints(settlement.payable),
      totalAmount: settlement.payable,
      posSessionId: activeSession?._id
    };

    const sale = await completeSale({
      salePayload,
      createdBy: req.user._id,
      afterCreate: async ({ sale, session }) => {
        const customerRecord = await upsertCustomer({
          customerId: req.body.customerId,
          customer: req.body.customer,
          customerPhone: req.body.customerPhone,
          location: req.body.location,
          dateOfBirth: req.body.dateOfBirth,
          anniversary: req.body.anniversary,
          deliveryInfo: req.body.deliveryInfo,
          note: req.body.note,
          session
        });

        if (customerRecord?._id) {
          sale.customerId = customerRecord._id;
          await sale.save({ session });
        }

        await deductInventoryItems(saleItems, {
          session,
          allowNegativeStock: Boolean(systemSettings.allowNegativeStock)
        });

        const exchangeEntry = await applyExchangeReturns(
          exchangeItems,
          sale._id,
          sale.customer,
          sale.customerPhone,
          sale.customerId,
          req.user._id,
          session
        );

        await createLedgerEntries({
          sale,
          customer: sale.customer,
          customerPhone: sale.customerPhone,
          customerId: sale.customerId,
          paidAmount: settlement.paidAmount,
          advanceAmount: settlement.advanceAmount,
          creditDue: settlement.creditDue,
          exchangeAmount: totals.exchangeAmount,
          createdBy: req.user._id,
          session
        });

        sale._exchangeEntry = exchangeEntry;
      }
    });
    await createAuditLog({
      module: "sales",
      action: "CREATE",
      entityType: "Sale",
      entityId: sale._id,
      summary: `Sale ${sale.billNo} created`,
      after: sale.toObject(),
      metadata: {
        totalAmount: sale.totalAmount,
        billType: sale.billType
      },
      user: req.user
    });

    return res.status(201).json({
      success: true,
      message: sale._exchangeEntry ? "Sale created with linked exchange return" : "Sale created successfully",
      data: sale
    });
  } catch (err) {
    console.error("Create Sale Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to create sale",
      error: err.message
    });
  }
};

export const getLoyaltySummary = async (req, res) => {
  try {
    const customerPhone = normalizeText(req.params.customerPhone);

    if (!customerPhone) {
      return res.status(400).json({
        success: false,
        message: "Customer phone is required"
      });
    }

    const sales = await Sales.find({ customerPhone }).lean();
    const earned = sales.reduce((sum, sale) => sum + clampNumber(sale.loyaltyPointsEarned), 0);
    const redeemed = sales.reduce((sum, sale) => sum + clampNumber(sale.loyaltyPointsRedeemed), 0);

    return res.status(200).json({
      success: true,
      data: {
        customerPhone,
        visits: sales.length,
        earned,
        redeemed,
        balance: Math.max(0, earned - redeemed)
      }
    });
  } catch (err) {
    console.error("Get Loyalty Summary Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch loyalty summary",
      error: err.message
    });
  }
};

export const processSalesReturn = async (req, res) => {
  try {
    const sale = await Sales.findById(req.params.saleId);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found"
      });
    }

    const requestItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (requestItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Return items are required"
      });
    }

    const updatedSale = await runInTransaction(async (session) => {
      const saleRecord = await Sales.findById(req.params.saleId).session(session);
      if (!saleRecord) {
        throw new Error("Sale not found");
      }

      let totalReturnedAmount = clampNumber(saleRecord.totalReturnedAmount);
      const entryItems = [];
      const restockItems = [];

      for (const returnItem of requestItems) {
        const saleItem = saleRecord.items.id(returnItem.id);
        if (!saleItem) {
          continue;
        }

        const returnQty = clampNumber(returnItem.qty);
        if (returnQty <= 0) {
          continue;
        }

        const alreadyReturned = clampNumber(saleItem.returnedQty);
        const remainingQty = clampNumber(saleItem.qty) - alreadyReturned;
        if (returnQty > remainingQty) {
          throw new Error(`Return quantity exceeds remaining quantity for item ${saleItem.itemName || saleItem.barcode || saleItem.itemId}`);
        }

        saleItem.returnedQty = alreadyReturned + returnQty;
        const amount = round2(returnQty * clampNumber(saleItem.sellingRate));
        totalReturnedAmount += amount;

        restockItems.push({
          itemId: saleItem.itemId,
          barcode: saleItem.barcode,
          qty: returnQty,
          itemName: saleItem.itemName
        });

        entryItems.push({
          sourceSaleId: saleRecord._id,
          sourceSaleItemId: saleItem._id,
          sourceBillNo: saleRecord.billNo || saleRecord.invoiceNo,
          itemId: saleItem.itemId,
          itemName: saleItem.itemName,
          barcode: saleItem.barcode,
          qty: returnQty,
          rate: round2(saleItem.sellingRate),
          amount
        });
      }

      await restockInventoryItems(restockItems, { session });

      saleRecord.totalReturnedAmount = round2(totalReturnedAmount);
      await saleRecord.save({ session });

      if (entryItems.length > 0) {
        await SalesReturnEntry.create([{
          entryType: "manual-return",
          linkedSaleId: saleRecord._id,
          customerId: saleRecord.customerId,
          customerName: saleRecord.customer,
          customerPhone: saleRecord.customerPhone,
          totalAmount: round2(entryItems.reduce((sum, item) => sum + item.amount, 0)),
          items: entryItems,
          createdBy: req.user._id
        }], { session });
      }

      return saleRecord;
    });

    return res.status(200).json({
      success: true,
      message: "Sales return processed successfully",
      data: updatedSale
    });
  } catch (err) {
    console.error("Process Sales Return Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to process sales return",
      error: err.message
    });
  }
};
