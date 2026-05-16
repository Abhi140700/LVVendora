import CustomerLedger from "../models/CustomerLedger.js";
import CustomerLoyaltyLedger from "../models/CustomerLoyaltyLedger.js";
import CustomerCommunicationLog from "../models/CustomerCommunicationLog.js";
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
import { enrollCustomerInLoyalty } from "../services/loyaltyService.js";
import { completeSale } from "../services/salesService.js";
import { getNextBillNo as getNextModeBillNo, normalizeBillingMode } from "../services/billCounterService.js";
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
const calculateEarnedPoints = (totalAmount, loyaltySettings = {}) => {
  if (loyaltySettings.enabled === false) {
    return 0;
  }
  const earnPerAmount = Math.max(1, clampNumber(loyaltySettings.earnPerAmount, 100));
  const pointsPerStep = Math.max(0, clampNumber(loyaltySettings.pointsPerStep, 1));
  return Math.floor(clampNumber(totalAmount) / earnPerAmount) * pointsPerStep;
};
const calculateRedeemAmount = (points = 0, loyaltySettings = {}) => round2(
  Math.max(0, clampNumber(points)) * Math.max(0, clampNumber(loyaltySettings.redeemValuePerPoint, 1))
);
const getLoyaltyBalanceForCustomer = async ({ customerId, customerPhone }, session = null) => {
  const filter = [];
  if (customerId) filter.push({ customerId });
  if (normalizeText(customerPhone)) filter.push({ customerPhone: normalizeText(customerPhone) });
  if (!filter.length) return 0;

  const rows = await CustomerLoyaltyLedger.find({ $or: filter }).session(session).select("points").lean();
  return Math.max(0, rows.reduce((sum, row) => sum + clampNumber(row.points), 0));
};
const normalizeText = (value = "") => String(value).trim();
const normalizeTags = (value = []) => {
  const rawTags = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(rawTags.map((tag) => normalizeText(tag)).filter(Boolean))];
};
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
    return paymentBreakdown.length > 0
      ? paymentBreakdown
      : (payableAmount > 0 ? [{ mode: "Cash", amount: round2(payableAmount), reference: "" }] : []);
  }

  return paymentBreakdown;
};

const getBillingModeFromBillType = (billType = "cashpay", requestedMode = "") => {
  if (requestedMode) return normalizeBillingMode(requestedMode);
  if (billType === "advance") return "ADVANCE";
  if (billType === "credit") return "CREDIT";
  return "CASH";
};

const buildPaymentSummary = ({ paymentBreakdown = [], billingMode = "CASH", payableAmount = 0, creditDue = 0 }) => {
  const summary = paymentBreakdown.reduce((totals, row) => {
    const mode = normalizeText(row.mode).toLowerCase();
    const amount = round2(row.amount);
    if (mode === "cash") totals.cash += amount;
    else if (mode === "card") totals.card += amount;
    else if (mode === "upi") totals.upi += amount;
    return totals;
  }, {
    cash: 0,
    card: 0,
    upi: 0,
    advanceUsed: 0,
    creditAmount: 0,
    receivedAmount: 0,
    balanceAmount: 0
  });

  summary.receivedAmount = round2(paymentBreakdown.reduce((sum, row) => sum + round2(row.amount), 0));
  summary.balanceAmount = round2(Math.max(0, creditDue));
  summary.creditAmount = billingMode === "CREDIT" ? summary.balanceAmount : 0;
  summary.advanceUsed = billingMode === "ADVANCE" ? summary.receivedAmount : 0;
  return summary;
};

const getPaymentStatus = ({ billingMode = "CASH", payableAmount = 0, receivedAmount = 0, balanceAmount = 0 }) => {
  if (billingMode === "CASH") return "PAID";
  if (round2(balanceAmount) <= 0 && round2(receivedAmount) >= round2(payableAmount)) return "PAID";
  if (round2(receivedAmount) > 0) return "PARTIAL";
  return "PENDING";
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
  const prefix = `INV-${stamp}-`;
  const sales = await Sales.find({ invoiceNo: new RegExp(`^${prefix}\\d+$`) }).select("invoiceNo").lean();
  const nextNumber = sales
    .map((entry) => Number(String(entry.invoiceNo || "").split("-").pop() || 0))
    .reduce((max, value) => (value > max ? value : max), 0) + 1;
  return `${prefix}${String(nextNumber).padStart(3, "0")}`;
};

const getNextBillNo = async (mode = "CASH", saleDate = new Date(), companyName = COMPANY_NAME) => {
  const counter = await getNextModeBillNo({ mode, saleDate, companyName });
  return counter.displayBillNo;
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
    billNo: normalizeText(payload.billNo) || await getNextBillNo(payload.billingMode || payload.billType || "CASH", saleDate),
    billType: BILL_TYPES.includes(payload.billType) ? payload.billType : "cashpay",
    billingMode: getBillingModeFromBillType(payload.billType, payload.billingMode),
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
    advanceDetails: payload.advanceDetails || undefined,
    creditDetails: payload.creditDetails || undefined,
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
  loyaltyCardNo,
  customerType,
  creditLimit,
  segmentTags,
  applyLoyalty,
  createdBy,
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

  const systemSettings = applyLoyalty ? await getSystemSettings() : null;

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
    targetCustomer.loyaltyCardNo = normalizeText(loyaltyCardNo) || targetCustomer.loyaltyCardNo;
    targetCustomer.customerType = ["retail", "wholesale", "vip"].includes(customerType) ? customerType : targetCustomer.customerType;
    targetCustomer.creditLimit = Math.max(0, clampNumber(creditLimit, targetCustomer.creditLimit || 0));
    const nextSegmentTags = normalizeTags(segmentTags);
    if (nextSegmentTags.length) targetCustomer.segmentTags = nextSegmentTags;
    targetCustomer.addressLine1 = deliveryInfo || targetCustomer.addressLine1;
    targetCustomer.notes = note || targetCustomer.notes;
    await targetCustomer.save({ session });
    if (applyLoyalty) {
      await enrollCustomerInLoyalty({ customer: targetCustomer, settings: systemSettings, createdBy, session });
    }
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
      loyaltyCardNo: normalizeText(loyaltyCardNo) || undefined,
      customerType: ["retail", "wholesale", "vip"].includes(customerType) ? customerType : "retail",
      creditLimit: Math.max(0, clampNumber(creditLimit)),
      segmentTags: normalizeTags(segmentTags),
      partyType: "customer",
      addressLine1: deliveryInfo,
      notes: note
    }], { session });
    if (applyLoyalty) {
      await enrollCustomerInLoyalty({ customer: created[0], settings: systemSettings, createdBy, session });
    }
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
        duplicateCustomer.loyaltyCardNo = normalizeText(loyaltyCardNo) || duplicateCustomer.loyaltyCardNo;
        duplicateCustomer.customerType = ["retail", "wholesale", "vip"].includes(customerType) ? customerType : duplicateCustomer.customerType;
        duplicateCustomer.creditLimit = Math.max(0, clampNumber(creditLimit, duplicateCustomer.creditLimit || 0));
        const nextSegmentTags = normalizeTags(segmentTags);
        if (nextSegmentTags.length) duplicateCustomer.segmentTags = nextSegmentTags;
        duplicateCustomer.addressLine1 = deliveryInfo || duplicateCustomer.addressLine1;
        duplicateCustomer.notes = note || duplicateCustomer.notes;
        await duplicateCustomer.save({ session });
        if (applyLoyalty) {
          await enrollCustomerInLoyalty({ customer: duplicateCustomer, settings: systemSettings, createdBy, session });
        }
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
  creditDue
}) => {
  const payable = round2(Math.max(0, subtotal - discountAmount - exchangeAmount));
  const paidAmount = round2((paymentBreakdown || []).reduce((sum, row) => sum + clampNumber(row.amount), 0));
  const normalizedAdvance = billType === "advance"
    ? round2((paymentBreakdown || [])
      .filter((row) => normalizeText(row.mode).toLowerCase() !== "loyalty")
      .reduce((sum, row) => sum + clampNumber(row.amount), 0))
    : 0;
  const customerRequired = ["credit", "advance"].includes(billType);

  if (customerRequired && !normalizeText(customer)) {
    throw new Error("Customer is required for credit and advance bills");
  }

  if (billType === "cashpay" || billType === "card-upi" || billType === "return") {
    if (Math.abs(paidAmount - payable) > 0.01) {
      throw new Error("Full payment is required for the selected bill mode");
    }
  }

  if (billType === "card-upi" && paymentBreakdown.length === 0) {
    throw new Error("Add at least one payment row for Card / UPI bills");
  }

  if (billType === "credit") {
    if (paidAmount > payable + 0.01) {
      throw new Error("Credit bill payments cannot exceed the payable total");
    }
  }

  if (billType === "advance") {
    if (paidAmount <= 0) {
      throw new Error("Advance amount is required for advance bills");
    }
    if (paidAmount > payable + 0.01) {
      throw new Error("Advance bill settlement cannot exceed the payable total");
    }
  }

  const computedCreditDue = billType === "credit" || billType === "advance"
    ? round2(Math.max(0, payable - paidAmount))
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

  if (entries.length > 0) {
    await CustomerLedger.insertMany(entries, { session });
    await syncLedgerBalance(customerId, session);
  }
};

const createLoyaltyLedgerEntries = async ({
  sale,
  earnedPoints = 0,
  redeemedPoints = 0,
  redeemedAmount = 0,
  createdBy,
  session
}) => {
  const customerId = sale.customerId;
  const customerPhone = normalizeText(sale.customerPhone);
  if (!customerId && !customerPhone) return;

  const entries = [];
  let runningBalance = await getLoyaltyBalanceForCustomer({ customerId, customerPhone }, session);

  if (redeemedPoints > 0) {
    runningBalance = Math.max(0, runningBalance - redeemedPoints);
    entries.push({
      customerId,
      customerName: sale.customer,
      customerPhone,
      saleId: sale._id,
      billNo: sale.billNo,
      invoiceNo: sale.invoiceNo,
      entryType: "redeem",
      points: -redeemedPoints,
      amountValue: redeemedAmount,
      balanceAfter: runningBalance,
      note: "Redeemed on POS bill",
      createdBy
    });
  }

  if (earnedPoints > 0) {
    runningBalance += earnedPoints;
    entries.push({
      customerId,
      customerName: sale.customer,
      customerPhone,
      saleId: sale._id,
      billNo: sale.billNo,
      invoiceNo: sale.invoiceNo,
      entryType: "earn",
      points: earnedPoints,
      amountValue: 0,
      balanceAfter: runningBalance,
      note: "Earned on POS bill",
      createdBy
    });
  }

  if (entries.length) {
    await CustomerLoyaltyLedger.insertMany(entries, { session });
  }
};

export const getSalesWorkbench = async (req, res) => {
  try {
    const whatsappStatus = getWhatsAppStatus();
    const systemSettings = await getSystemSettings();
    const [draft, holds, recentSales, customers, salespeople, nextBillNo, activeSession] = await Promise.all([
      POSDraft.findOne({ createdBy: req.user._id, status: "draft" }).sort({ updatedAt: -1 }).lean(),
      POSDraft.find({ createdBy: req.user._id, status: "hold" }).sort({ updatedAt: -1 }).limit(20).lean(),
      Sales.find().sort({ saleDate: -1 }).limit(12).lean(),
      Party.find({ partyType: "customer" }).sort({ updatedAt: -1 }).limit(30).lean(),
      Party.find({ partyType: "salesman" }).select("name phone location salesmanCode").sort({ salesmanCode: 1, name: 1 }).lean(),
      getNextBillNo("CASH", new Date(), systemSettings.companyName || COMPANY_NAME),
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
    const filter = {};
    if (req.query.billingMode && String(req.query.billingMode).toLowerCase() !== "all") {
      filter.billingMode = normalizeBillingMode(req.query.billingMode);
    }

    const sales = await Sales.find(filter)
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
    const systemSettings = await getSystemSettings();
    const billingMode = normalizeBillingMode(req.query.mode || "CASH");
    const counter = await getNextModeBillNo({
      mode: billingMode,
      saleDate: new Date(),
      companyName: systemSettings.companyName || COMPANY_NAME
    });
    return res.status(200).json({
      success: true,
      data: {
        billingMode,
        modeBillNo: counter.modeBillNo,
        displayBillNo: counter.displayBillNo,
        billNo: counter.displayBillNo,
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
    const customer = await upsertCustomer({ ...req.body, createdBy: req.user?._id });

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
    customer.loyaltyCardNo = normalizeText(req.body.loyaltyCardNo) || customer.loyaltyCardNo;
    customer.customerType = ["retail", "wholesale", "vip"].includes(req.body.customerType) ? req.body.customerType : customer.customerType;
    customer.creditLimit = Math.max(0, clampNumber(req.body.creditLimit, customer.creditLimit || 0));
    const nextSegmentTags = normalizeTags(req.body.segmentTags);
    if (nextSegmentTags.length || Array.isArray(req.body.segmentTags)) {
      customer.segmentTags = nextSegmentTags;
    }
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
    const requestedBillingMode = normalizeBillingMode(req.body.billingMode || req.body.billType || "CASH");
    const requestedBillType = BILL_TYPES.includes(req.body.billType) ? req.body.billType : "cashpay";
    const billType = requestedBillingMode === "ADVANCE"
      ? "advance"
      : requestedBillingMode === "CREDIT"
        ? "credit"
        : requestedBillType;
    const billingMode = getBillingModeFromBillType(billType, requestedBillingMode);
    const saleItems = await validateAndBuildSaleItems(req.body.items, roleRules);
    const exchangeItems = await validateExchangeItems(req.body.exchangeItems);
    const totals = recomputeSaleTotals({
	      items: saleItems,
	      discountPercent,
	      discountAmount: req.body.discountAmount,
	      exchangeItems,
	      creditDue: req.body.creditDue,
	      paymentBreakdown: requestedPaymentBreakdown,
	      billType
	    });
    const requestedRedeemPoints = Math.floor(Math.max(0, clampNumber(req.body.loyaltyPointsRedeemed)));
    let loyaltyRedeemedAmount = 0;
    if (requestedRedeemPoints > 0) {
      if (systemSettings.loyalty?.enabled === false) {
        return res.status(400).json({ success: false, message: "Loyalty redemption is disabled" });
      }
      if (!req.body.customerId && !normalizeText(req.body.customerPhone)) {
        return res.status(400).json({ success: false, message: "Select a customer before redeeming loyalty points" });
      }
      const currentLoyaltyBalance = await getLoyaltyBalanceForCustomer({
        customerId: req.body.customerId,
        customerPhone: req.body.customerPhone
      });
      if (requestedRedeemPoints > currentLoyaltyBalance) {
        return res.status(400).json({ success: false, message: `Only ${currentLoyaltyBalance} loyalty points are available` });
      }
      const minRedeemPoints = Math.max(0, clampNumber(systemSettings.loyalty?.minRedeemPoints));
      if (requestedRedeemPoints < minRedeemPoints) {
        return res.status(400).json({ success: false, message: `Minimum ${minRedeemPoints} points required to redeem` });
      }
      loyaltyRedeemedAmount = calculateRedeemAmount(requestedRedeemPoints, systemSettings.loyalty);
      const maxRedeemAmount = round2((totals.payable * Math.min(100, Math.max(0, clampNumber(systemSettings.loyalty?.maxRedeemPercent, 20)))) / 100);
      if (loyaltyRedeemedAmount > maxRedeemAmount) {
        return res.status(400).json({ success: false, message: `Loyalty redemption cannot exceed Rs. ${maxRedeemAmount.toFixed(2)} for this bill` });
      }
      requestedPaymentBreakdown.push({
        mode: "Loyalty",
        amount: loyaltyRedeemedAmount,
        reference: `${requestedRedeemPoints} points`
      });
    }
    const settlement = validateSettlement({
      billType,
      customer: req.body.customer,
      paymentBreakdown: requestedPaymentBreakdown,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      exchangeAmount: totals.exchangeAmount,
      creditDue: req.body.creditDue
	    });
    const paymentBreakdown = buildFinalPaymentBreakdown(billType, requestedPaymentBreakdown, settlement.payable);
    const paymentSummary = buildPaymentSummary({
      paymentBreakdown,
      billingMode,
      payableAmount: settlement.payable,
      creditDue: settlement.creditDue
    });
    const paymentStatus = getPaymentStatus({
      billingMode,
      payableAmount: settlement.payable,
      receivedAmount: paymentSummary.receivedAmount,
      balanceAmount: paymentSummary.balanceAmount
    });
    if (settlement.creditDue > 0 && req.body.customerId) {
      const customerRecord = await Party.findOne({ _id: req.body.customerId, partyType: "customer" }).lean();
      const creditLimit = clampNumber(customerRecord?.creditLimit);
      if (creditLimit > 0) {
        const ledgerBalance = clampNumber(customerRecord?.ledgerBalance);
        const availableCredit = round2(creditLimit - ledgerBalance);
        if (settlement.creditDue > availableCredit) {
          return res.status(400).json({
            success: false,
            message: `Credit limit exceeded. Available credit Rs. ${Math.max(0, availableCredit).toFixed(2)}`
          });
        }
      }
    }

    const buildAuthoritativeSalePayload = async ({ session } = {}) => {
      const counter = await getNextModeBillNo({
        mode: billingMode,
        saleDate,
        companyName: systemSettings.companyName || COMPANY_NAME,
        increment: true,
        session
      });

      return {
      invoiceNo: await getNextInvoiceNo(saleDate),
      billNo: counter.displayBillNo,
      billingMode,
      modeBillNo: counter.modeBillNo,
      displayBillNo: counter.displayBillNo,
      paymentStatus,
      paymentSummary,
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
      advanceDetails: billingMode === "ADVANCE" ? {
        advanceAmount: settlement.advanceAmount,
        remainingAmount: settlement.creditDue,
        deliveryStatus: req.body.advanceDetails?.deliveryStatus || "DELIVERED",
        expectedDeliveryDate: req.body.advanceDetails?.expectedDeliveryDate || undefined,
        remarks: normalizeText(req.body.advanceDetails?.remarks)
      } : undefined,
      creditDetails: billingMode === "CREDIT" ? {
        creditAmount: settlement.creditDue,
        dueDate: req.body.creditDetails?.dueDate || undefined,
        creditDays: clampNumber(req.body.creditDetails?.creditDays),
        remarks: normalizeText(req.body.creditDetails?.remarks)
      } : undefined,
      paymentBreakdown,
      exchangeItems: exchangeItems.map((item) => ({
        saleId: item.sale._id,
        saleItemId: item.saleItem._id,
        billNo: item.billNo,
        itemName: item.itemName,
        barcode: item.barcode,
        amount: item.amount
      })),
      loyaltyPointsEarned: (req.body.customerId || normalizeText(req.body.customerPhone))
        ? calculateEarnedPoints(settlement.payable, systemSettings.loyalty)
        : 0,
      loyaltyPointsRedeemed: requestedRedeemPoints,
      loyaltyRedeemedAmount,
      totalAmount: settlement.payable,
      posSessionId: activeSession?._id
      };
    };

    let sale = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        sale = await completeSale({
          salePayload: buildAuthoritativeSalePayload,
          createdBy: req.user._id,
          afterCreate: async ({ sale, session }) => {
            const customerRecord = await upsertCustomer({
              customerId: req.body.customerId,
              customer: req.body.customer,
              customerPhone: req.body.customerPhone,
              location: req.body.location,
              dateOfBirth: req.body.dateOfBirth,
              anniversary: req.body.anniversary,
              loyaltyCardNo: req.body.loyaltyCardNo,
              customerType: req.body.customerType,
              creditLimit: req.body.creditLimit,
              segmentTags: req.body.segmentTags,
              applyLoyalty: req.body.applyLoyalty,
              createdBy: req.user._id,
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

            await createLoyaltyLedgerEntries({
              sale,
              earnedPoints: sale.loyaltyPointsEarned,
              redeemedPoints: requestedRedeemPoints,
              redeemedAmount: loyaltyRedeemedAmount,
              createdBy: req.user._id,
              session
            });

        sale._exchangeEntry = exchangeEntry;
          }
        });
        break;
      } catch (error) {
        if (error?.code === 11000 && attempt < 3) {
          continue;
        }
        throw error;
      }
    }
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
    const customerId = normalizeText(req.query.customerId);

    if (!customerPhone && !customerId) {
      return res.status(400).json({
        success: false,
        message: "Customer phone or id is required"
      });
    }

    const filter = [];
    if (customerId) filter.push({ customerId });
    if (customerPhone) filter.push({ customerPhone });
    const ledger = await CustomerLoyaltyLedger.find({ $or: filter }).sort({ createdAt: -1 }).lean();
    const earned = ledger
      .filter((row) => row.entryType === "earn")
      .reduce((sum, row) => sum + clampNumber(row.points), 0);
    const redeemed = Math.abs(ledger
      .filter((row) => row.entryType === "redeem")
      .reduce((sum, row) => sum + clampNumber(row.points), 0));

    return res.status(200).json({
      success: true,
      data: {
        customerId,
        customerPhone,
        visits: new Set(ledger.map((row) => String(row.saleId || "")).filter(Boolean)).size,
        earned,
        redeemed,
        balance: Math.max(0, earned - redeemed),
        history: ledger.slice(0, 50)
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

export const getCustomerCommunicationHistory = async (req, res) => {
  try {
    const customerId = normalizeText(req.query.customerId);
    const customerPhone = normalizeText(req.query.customerPhone);
    if (!customerId && !customerPhone) {
      return res.status(400).json({ success: false, message: "Customer id or phone is required" });
    }

    const filter = [];
    if (customerId) filter.push({ customerId });
    if (customerPhone) filter.push({ customerPhone });
    const history = await CustomerCommunicationLog.find({ $or: filter }).sort({ createdAt: -1 }).limit(50).lean();
    return res.status(200).json({ success: true, data: history });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch customer communication history", error: err.message });
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
