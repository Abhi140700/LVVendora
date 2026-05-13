import CashSalesAdjustment from "../models/CashSalesAdjustment.js";
import Sales from "../models/Sales.js";
import { createAuditLog } from "../services/auditService.js";

const ADJUSTMENT_MODES = [
  "REMOVE_FIXED_ITEMS",
  "REMOVE_BARCODE_AND_FIXED_ITEMS",
  "REMOVE_CTRL_K_ITEMS",
  "CHANGE_FIXED_ITEM",
  "DOWN_5R_TO_5"
];

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

const parseLocalDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
};

const getDayRange = (value) => {
  const date = parseLocalDate(value);
  if (!date || Number.isNaN(date.getTime())) {
    throw new Error("Valid date is required");
  }
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { date: start, start, end };
};

const getCashAmount = (sale) => {
  const cashBreakdown = (sale.paymentBreakdown || [])
    .filter((row) => String(row.mode || "").trim().toLowerCase() === "cash")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  if (cashBreakdown > 0) return round2(cashBreakdown);
  return sale.billType === "cashpay" ? round2(sale.totalAmount) : 0;
};

const isFixedItem = (item) => {
  const barcode = String(item.barcode || "").trim().toLowerCase();
  const name = String(item.itemName || "").trim().toLowerCase();
  return !barcode || barcode.startsWith("fixed") || barcode.startsWith("manual") || name.includes("fixed");
};

const isBarcodeItem = (item) => Boolean(String(item.barcode || "").trim());

const isCtrlKItem = (item) => {
  const source = String(item.entrySource || item.source || "").trim().toLowerCase();
  return Boolean(item.ctrlK || item.isCtrlK || source === "ctrl_k" || source === "ctrl-k");
};

const matchesMode = (item, mode) => {
  if (mode === "REMOVE_FIXED_ITEMS") return isFixedItem(item);
  if (mode === "REMOVE_BARCODE_AND_FIXED_ITEMS") return isBarcodeItem(item) || isFixedItem(item);
  if (mode === "REMOVE_CTRL_K_ITEMS") return isCtrlKItem(item);
  if (mode === "CHANGE_FIXED_ITEM") return isFixedItem(item);
  if (mode === "DOWN_5R_TO_5") {
    const rate = Number(item.sellingRate || item.netRate || 0);
    return rate >= 5 && rate % 10 > 5;
  }
  return false;
};

const matchesRate = (item, saleRateFrom, saleRateTo) => {
  const rate = Number(item.sellingRate || item.netRate || item.originalSaleRate || 0);
  if (saleRateFrom && rate < saleRateFrom) return false;
  if (saleRateTo && rate > saleRateTo) return false;
  return true;
};

const buildPreview = async ({ date, amountToReduce = 0, saleRateFrom = 0, saleRateTo = 0, mode }) => {
  if (!ADJUSTMENT_MODES.includes(mode)) {
    throw new Error("Valid adjustment mode is required");
  }

  const reduction = round2(amountToReduce);
  const minRate = round2(saleRateFrom);
  const maxRate = round2(saleRateTo);
  if (maxRate > 0 && minRate > maxRate) {
    throw new Error("Sale Rate From cannot be greater than Sale Rate To");
  }

  const { date: voucherDate, start, end } = getDayRange(date);
  const [sales, activeAdjustments] = await Promise.all([
    Sales.find({ saleDate: { $gte: start, $lte: end } }).sort({ saleDate: 1 }).lean(),
    CashSalesAdjustment.find({ date: { $gte: start, $lte: end }, status: "PROCESSED" }).lean()
  ]);
  const cashSales = sales
    .map((sale) => ({ sale, cashAmount: getCashAmount(sale) }))
    .filter((row) => row.cashAmount > 0);

  const matchedAffectedSales = cashSales.map(({ sale, cashAmount }) => {
    const matchedItems = (sale.items || []).filter((item) => matchesMode(item, mode) && matchesRate(item, minRate, maxRate));
    return {
      saleId: sale._id,
      invoiceNo: sale.invoiceNo,
      billNo: sale.billNo,
      saleDate: sale.saleDate,
      customer: sale.customer || "Walk-in Customer",
      cashAmount,
      matchedItemCount: matchedItems.length,
      matchedItemAmount: round2(matchedItems.reduce((sum, item) => sum + Number(item.total || 0), 0))
    };
  }).filter((row) => row.matchedItemCount > 0);
  const affectedSales = matchedAffectedSales.length ? matchedAffectedSales : cashSales.map(({ sale, cashAmount }) => ({
    saleId: sale._id,
    invoiceNo: sale.invoiceNo,
    billNo: sale.billNo,
    saleDate: sale.saleDate,
    customer: sale.customer || "Walk-in Customer",
    cashAmount,
    matchedItemCount: 0,
    matchedItemAmount: 0
  }));

  const activeReduction = round2(activeAdjustments.reduce((sum, row) => sum + Number(row.amountToReduce || 0), 0));
  const rawCashSalesAmount = round2(cashSales.reduce((sum, row) => sum + row.cashAmount, 0));
  const rawMatchedReduction = round2(matchedAffectedSales.reduce((sum, row) => sum + Math.min(row.cashAmount, row.matchedItemAmount), 0));
  const rawPossibleReduction = rawMatchedReduction > 0 ? rawMatchedReduction : rawCashSalesAmount;
  const cashSalesAmountBefore = round2(Math.max(rawCashSalesAmount - activeReduction, 0));
  const possibleReduction = round2(Math.max(rawPossibleReduction - activeReduction, 0));
  const cashSalesAmountAfter = round2(Math.max(cashSalesAmountBefore - reduction, 0));

  return {
    date: voucherDate,
    rawCashSalesAmount,
    activeReduction,
    cashSalesAmountBefore,
    amountToReduce: reduction,
    cashSalesAmountAfter,
    saleRateFrom: minRate,
    saleRateTo: maxRate,
    mode,
    affectedSales,
    matchedFilterApplied: matchedAffectedSales.length > 0,
    possibleReduction,
    canProcess: reduction > 0 && reduction <= cashSalesAmountBefore && reduction <= possibleReduction
  };
};

const getNextVoucherNo = async (date) => {
  const dayKey = date.toISOString().slice(0, 10).replace(/-/g, "");
  const count = await CashSalesAdjustment.countDocuments({
    voucherNo: new RegExp(`^CSA-${dayKey}-`)
  });
  return `CSA-${dayKey}-${String(count + 1).padStart(3, "0")}`;
};

export const previewCashSalesAdjustment = async (req, res) => {
  try {
    const preview = await buildPreview(req.body || {});
    return res.status(200).json({ success: true, data: preview });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const processCashSalesAdjustment = async (req, res) => {
  try {
    const preview = await buildPreview(req.body || {});
    if (!preview.canProcess) {
      return res.status(400).json({
        success: false,
        message: "Enter a reduction amount within the available cash sales amount for this date.",
        data: preview
      });
    }

    const adjustment = await CashSalesAdjustment.create({
      voucherNo: await getNextVoucherNo(preview.date),
      date: preview.date,
      cashSalesAmountBefore: preview.cashSalesAmountBefore,
      amountToReduce: preview.amountToReduce,
      cashSalesAmountAfter: preview.cashSalesAmountAfter,
      saleRateFrom: preview.saleRateFrom,
      saleRateTo: preview.saleRateTo,
      mode: preview.mode,
      affectedSales: preview.affectedSales,
      status: "PROCESSED",
      createdBy: req.user?._id,
      createdByName: req.user?.username || ""
    });

    await createAuditLog({
      module: "sales",
      action: "cash-adjustment-process",
      entityType: "CashSalesAdjustment",
      entityId: adjustment._id,
      summary: `Cash sales adjustment ${adjustment.voucherNo} processed`,
      after: adjustment.toObject(),
      metadata: { route: "/api/sales/cash-adjustment/process" },
      user: req.user
    });

    return res.status(201).json({ success: true, data: adjustment });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const getCashSalesAdjustmentHistory = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 25), 100);
    const history = await CashSalesAdjustment.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return res.status(200).json({ success: true, data: history });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch cash adjustment history" });
  }
};

export const reverseCashSalesAdjustment = async (req, res) => {
  try {
    const adjustment = await CashSalesAdjustment.findById(req.body.adjustmentId);
    if (!adjustment) {
      return res.status(404).json({ success: false, message: "Adjustment voucher not found" });
    }
    if (adjustment.status === "REVERSED") {
      return res.status(400).json({ success: false, message: "Adjustment voucher is already reversed" });
    }

    const before = adjustment.toObject();
    adjustment.status = "REVERSED";
    adjustment.reversedAt = new Date();
    adjustment.reversedBy = req.user?._id;
    adjustment.reversalReason = req.body.reason || "Manual reversal";
    await adjustment.save();

    const reversal = await CashSalesAdjustment.create({
      voucherNo: `${adjustment.voucherNo}-R`,
      date: adjustment.date,
      cashSalesAmountBefore: adjustment.cashSalesAmountAfter,
      amountToReduce: adjustment.amountToReduce,
      cashSalesAmountAfter: adjustment.cashSalesAmountBefore,
      saleRateFrom: adjustment.saleRateFrom,
      saleRateTo: adjustment.saleRateTo,
      mode: adjustment.mode,
      affectedSales: adjustment.affectedSales,
      status: "REVERSED",
      reversalOf: adjustment._id,
      createdBy: req.user?._id,
      createdByName: req.user?.username || ""
    });

    await createAuditLog({
      module: "sales",
      action: "cash-adjustment-reverse",
      entityType: "CashSalesAdjustment",
      entityId: adjustment._id,
      summary: `Cash sales adjustment ${adjustment.voucherNo} reversed`,
      before,
      after: adjustment.toObject(),
      metadata: { reversalVoucherId: reversal._id, reason: adjustment.reversalReason },
      user: req.user
    });

    return res.status(200).json({ success: true, data: adjustment, reversal });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
