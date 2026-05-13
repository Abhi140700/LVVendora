import Inventory from "../models/Inventory.js";
import Sales from "../models/Sales.js";
import Purchase from "../models/Purchase.js";
import CashEntry from "../models/CashEntry.js";
import CustomerLedger from "../models/CustomerLedger.js";
import POSSession from "../models/POSSession.js";
import CashSalesAdjustment from "../models/CashSalesAdjustment.js";

const clampNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};
const round2 = (value) => Math.round(clampNumber(value) * 100) / 100;

const parseLocalDateInput = (value) => {
  if (!value) {
    return new Date();
  }

  if (value instanceof Date) {
    return new Date(value);
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
};

const buildRange = (from, to) => {
  const start = parseLocalDateInput(from);
  start.setHours(0, 0, 0, 0);
  const end = parseLocalDateInput(to || start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const formatPaymentMode = (mode = "") => {
  const normalized = String(mode || "").trim().toLowerCase();
  if (normalized === "upi") return "UPI";
  if (normalized === "cash") return "Cash";
  if (normalized === "card") return "Card";
  if (normalized === "bank") return "Bank";
  return normalized ? normalized.toUpperCase() : "Cash";
};

const getPartyName = (value, fallback = "Unmapped") => {
  if (!value) return fallback;
  if (typeof value === "string") return value || fallback;
  return value.name || value.partyName || fallback;
};

const groupRows = (rows, keyFn, valueFn) => Object.entries(rows.reduce((acc, row) => {
  const key = keyFn(row) || "Unmapped";
  const value = valueFn(row);
  if (!acc[key]) {
    acc[key] = { label: key, count: 0, amount: 0, qty: 0 };
  }
  acc[key].count += 1;
  acc[key].amount += Number(value.amount || 0);
  acc[key].qty += Number(value.qty || 0);
  return acc;
}, {})).map(([, value]) => value).sort((a, b) => b.amount - a.amount);

const normalizePeriodKey = (value, fallbackDate = new Date()) => {
  const date = value ? new Date(value) : fallbackDate;
  if (Number.isNaN(date.getTime())) return fallbackDate.toISOString().slice(0, 7);
  return date.toISOString().slice(0, 7);
};

// Dashboard summary
export const getDashboardReport = async (req, res) => {
  try {
    const totalInventory = await Inventory.aggregate([
      {
        $group: {
          _id: null,
          totalStock: { $sum: "$stock" },
          totalValue: { $sum: "$stockValue" }
        }
      }
    ]);

    const totalSales = await Sales.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$totalAmount" }
        }
      }
    ]);

    const totalPurchases = await Purchase.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$totalAmount" }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        inventory: totalInventory[0] || { totalStock: 0, totalValue: 0 },
        sales: totalSales[0] || { totalAmount: 0 },
        purchases: totalPurchases[0] || { totalAmount: 0 }
      }
    });

  } catch (err) {
    console.error("Dashboard Report Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to generate report"
    });
  }
};

// Sales report
export const getSalesReport = async (req, res) => {
  try {
    const [sales, cashAdjustments] = await Promise.all([
      Sales.find()
        .populate("items.itemId", "name")
        .sort({ saleDate: -1 })
        .lean(),
      CashSalesAdjustment.find({ status: "PROCESSED" })
        .sort({ date: -1, createdAt: -1 })
        .lean()
    ]);

    res.status(200).json({
      success: true,
      count: sales.length,
      data: sales,
      cashAdjustments
    });

  } catch (err) {
    console.error("Sales Report Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales report"
    });
  }
};

// Purchase report
export const getPurchaseReport = async (req, res) => {
  try {
    const purchases = await Purchase.find()
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: purchases.length,
      data: purchases
    });

  } catch (err) {
    console.error("Purchase Report Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch purchase report"
    });
  }
};

export const getStockReport = async (req, res) => {
  try {
    const inventory = await Inventory.find()
      .populate("category", "name")
      .populate("brand", "name")
      .sort({ updatedAt: -1 })
      .lean();

    const totals = inventory.reduce(
      (summary, item) => {
        const stock = Number(item.stock || 0);
        const rate = Number(item.avgPurchaseRate || item.purchaseRate || 0);
        summary.totalStock += stock;
        summary.totalValue += stock * rate;
        return summary;
      },
      { totalStock: 0, totalValue: 0 }
    );

    return res.status(200).json({
      success: true,
      count: inventory.length,
      summary: totals,
      data: inventory
    });
  } catch (err) {
    console.error("Stock Report Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch stock report"
    });
  }
};

export const getGstReport = async (req, res) => {
  try {
    const sales = await Sales.find()
      .sort({ saleDate: -1 })
      .lean();

    const purchases = await Purchase.find()
      .sort({ billDate: -1 })
      .lean();

    const salesEntries = sales.map((sale) => ({
      type: "sale",
      date: sale.saleDate,
      refNo: sale.invoiceNo,
      party: sale.customer || "Walk-in Customer",
      taxableAmount: Number(sale.subtotal || 0),
      gstRate: Number(sale.gstRate || 0),
      gstAmount: Number(sale.gstAmount || 0),
      totalAmount: Number(sale.totalAmount || 0)
    }));

    const purchaseEntries = purchases.map((purchase) => ({
      type: "purchase",
      date: purchase.billDate,
      refNo: purchase.billNo,
      party: purchase.party || "-",
      taxableAmount: Number(purchase.taxableAmount || purchase.subtotal || 0),
      gstRate: Number(purchase.gstRate || 0),
      gstAmount: Number(purchase.totalGst || purchase.cgst || 0) + Number(purchase.sgst || 0) + Number(purchase.igst || 0),
      totalAmount: Number(purchase.finalTotal || purchase.billAmount || 0)
    }));

    const combined = [...salesEntries, ...purchaseEntries].sort(
      (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
    );

    const summary = combined.reduce(
      (acc, entry) => {
        if (entry.type === "sale") {
          acc.salesTaxable += entry.taxableAmount;
          acc.outputGst += entry.gstAmount;
        } else {
          acc.purchaseTaxable += entry.taxableAmount;
          acc.inputGst += entry.gstAmount;
        }
        return acc;
      },
      { salesTaxable: 0, purchaseTaxable: 0, outputGst: 0, inputGst: 0 }
    );

    return res.status(200).json({
      success: true,
      summary: {
        ...summary,
        gstPayable: summary.outputGst - summary.inputGst
      },
      data: combined
    });
  } catch (err) {
    console.error("GST Report Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch GST report"
    });
  }
};

export const getAdvancedReport = async (req, res) => {
  try {
    const type = String(req.params.type || "").trim();
    const [sales, purchases, inventory] = await Promise.all([
      Sales.find().sort({ saleDate: -1 }).lean(),
      Purchase.find().sort({ billDate: -1 }).lean(),
      Inventory.find().populate("category", "name").populate("brand", "name").lean()
    ]);

    const inventoryById = new Map(inventory.map((item) => [String(item._id), item]));
    const inventoryByItemId = new Map(inventory.filter((item) => item.itemId).map((item) => [String(item.itemId), item]));
    const inventoryByBarcode = new Map(inventory.filter((item) => item.barcode).map((item) => [String(item.barcode), item]));
    const saleLines = sales.flatMap((sale) => (sale.items || []).map((line) => {
      const matchedInventory = inventoryById.get(String(line.inventoryId || ""))
        || inventoryByItemId.get(String(line.itemId || ""))
        || inventoryByBarcode.get(String(line.barcode || ""));
      const qty = Number(line.qty || 0);
      const salesAmount = Number(line.total || 0) || qty * Number(line.sellingRate || line.netRate || 0);
      const costRate = Number(matchedInventory?.avgPurchaseRate || matchedInventory?.purchaseRate || 0);
      const costAmount = qty * costRate;
      return {
        saleId: sale._id,
        invoiceNo: sale.invoiceNo || sale.billNo,
        date: sale.saleDate,
        customer: sale.customer || "Walk-in Customer",
        salesman: sale.salesman || "Unassigned",
        itemName: line.itemName || matchedInventory?.name || "Unknown Item",
        category: line.categoryName || matchedInventory?.category?.name || "Unmapped",
        brand: line.brandName || matchedInventory?.brand?.name || "-",
        qty,
        salesAmount,
        costAmount,
        marginAmount: salesAmount - costAmount,
        marginPercent: salesAmount ? ((salesAmount - costAmount) / salesAmount) * 100 : 0
      };
    }));

    const purchaseLines = purchases.flatMap((purchase) => (purchase.items || []).map((line) => ({
      purchaseId: purchase._id,
      billNo: purchase.billNo,
      grnNo: purchase.grnNo,
      date: purchase.billDate || purchase.createdAt,
      vendor: getPartyName(purchase.party, "Unknown Vendor"),
      itemName: line.name || "Unknown Item",
      qty: Number(line.qty || 0),
      amount: Number(line.total || 0)
    })));

    if (type === "margin") {
      return res.status(200).json({
        success: true,
        type,
        title: "Margin Report",
        summary: {
          salesAmount: round2(saleLines.reduce((sum, row) => sum + row.salesAmount, 0)),
          costAmount: round2(saleLines.reduce((sum, row) => sum + row.costAmount, 0)),
          marginAmount: round2(saleLines.reduce((sum, row) => sum + row.marginAmount, 0))
        },
        data: saleLines.sort((a, b) => b.marginAmount - a.marginAmount)
      });
    }

    if (type === "salesman") {
      return res.status(200).json({
        success: true,
        type,
        title: "Salesman Report",
        summary: { rows: sales.length, salesAmount: round2(sales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0)) },
        data: groupRows(sales, (sale) => sale.salesman || "Unassigned", (sale) => ({ amount: sale.totalAmount, qty: sale.items?.length || 0 }))
      });
    }

    if (type === "vendor-performance") {
      return res.status(200).json({
        success: true,
        type,
        title: "Vendor Performance Report",
        summary: { rows: purchases.length, purchaseAmount: round2(purchases.reduce((sum, purchase) => sum + Number(purchase.finalTotal || purchase.billAmount || 0), 0)) },
        data: groupRows(purchases, (purchase) => getPartyName(purchase.party, "Unknown Vendor"), (purchase) => ({ amount: purchase.finalTotal || purchase.billAmount, qty: purchase.netQty || purchase.items?.length || 0 }))
      });
    }

    if (type === "customer-performance") {
      return res.status(200).json({
        success: true,
        type,
        title: "Customer Performance Report",
        summary: { rows: sales.length, salesAmount: round2(sales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0)) },
        data: groupRows(sales, (sale) => sale.customer || "Walk-in Customer", (sale) => ({ amount: sale.totalAmount, qty: sale.items?.length || 0 }))
      });
    }

    if (type === "inventory-ageing") {
      const now = Date.now();
      const data = inventory.map((item) => {
        const lastDate = item.lastPurchaseDate || item.updatedAt || item.createdAt;
        const ageDays = lastDate ? Math.max(0, Math.floor((now - new Date(lastDate).getTime()) / 86400000)) : 0;
        return {
          itemId: item._id,
          itemName: item.name,
          category: item.category?.name || "Unmapped",
          brand: item.brand?.name || "-",
          stock: Number(item.stock || 0),
          value: round2(Number(item.stock || 0) * Number(item.avgPurchaseRate || item.purchaseRate || 0)),
          lastPurchaseDate: lastDate,
          ageDays,
          bucket: ageDays > 180 ? "180+ days" : ageDays > 90 ? "91-180 days" : ageDays > 30 ? "31-90 days" : "0-30 days"
        };
      }).sort((a, b) => b.ageDays - a.ageDays);
      return res.status(200).json({
        success: true,
        type,
        title: "Inventory Ageing Report",
        summary: { rows: data.length, stockValue: round2(data.reduce((sum, row) => sum + row.value, 0)) },
        data
      });
    }

    if (type === "comparative") {
      const periods = {};
      sales.forEach((sale) => {
        const key = normalizePeriodKey(sale.saleDate);
        periods[key] = periods[key] || { period: key, salesAmount: 0, purchaseAmount: 0, profitEstimate: 0 };
        periods[key].salesAmount += Number(sale.totalAmount || 0);
      });
      purchases.forEach((purchase) => {
        const key = normalizePeriodKey(purchase.billDate || purchase.createdAt);
        periods[key] = periods[key] || { period: key, salesAmount: 0, purchaseAmount: 0, profitEstimate: 0 };
        periods[key].purchaseAmount += Number(purchase.finalTotal || purchase.billAmount || 0);
      });
      const data = Object.values(periods).map((row) => ({
        ...row,
        salesAmount: round2(row.salesAmount),
        purchaseAmount: round2(row.purchaseAmount),
        profitEstimate: round2(row.salesAmount - row.purchaseAmount)
      })).sort((a, b) => b.period.localeCompare(a.period));
      return res.status(200).json({
        success: true,
        type,
        title: "Comparative Report",
        summary: { periods: data.length },
        data
      });
    }

    return res.status(404).json({ success: false, message: "Unknown report type" });
  } catch (err) {
    console.error("Advanced Report Error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch advanced report" });
  }
};

export const getGstComplianceReport = async (req, res) => {
  try {
    const [sales, purchases] = await Promise.all([
      Sales.find().sort({ saleDate: -1 }).lean(),
      Purchase.find().sort({ billDate: -1 }).lean()
    ]);

    const outward = sales.reduce((acc, sale) => {
      acc.taxable += Number(sale.subtotal || 0);
      acc.tax += Number(sale.gstAmount || 0);
      acc.total += Number(sale.totalAmount || 0);
      return acc;
    }, { taxable: 0, tax: 0, total: 0 });
    const inward = purchases.reduce((acc, purchase) => {
      acc.taxable += Number(purchase.taxableAmount || purchase.subtotal || 0);
      acc.tax += Number(purchase.totalGst || 0) || (Number(purchase.cgst || 0) + Number(purchase.sgst || 0) + Number(purchase.igst || 0));
      acc.total += Number(purchase.finalTotal || purchase.billAmount || 0);
      return acc;
    }, { taxable: 0, tax: 0, total: 0 });

    const hsnMap = {};
    [...sales.flatMap((sale) => sale.items || []), ...purchases.flatMap((purchase) => purchase.items || [])].forEach((item) => {
      const hsn = item.hsn || "UNMAPPED";
      hsnMap[hsn] = hsnMap[hsn] || { hsn, qty: 0, taxableAmount: 0, gstAmount: 0, totalAmount: 0 };
      hsnMap[hsn].qty += Number(item.qty || 0);
      hsnMap[hsn].taxableAmount += Number(item.total || 0);
      hsnMap[hsn].gstAmount += Number(item.gstAmount || 0);
      hsnMap[hsn].totalAmount += Number(item.total || 0) + Number(item.gstAmount || 0);
    });

    const slabMap = {};
    [...sales, ...purchases].forEach((entry) => {
      const rate = Number(entry.gstRate || 0);
      slabMap[rate] = slabMap[rate] || { rate, taxableAmount: 0, gstAmount: 0, transactions: 0 };
      slabMap[rate].taxableAmount += Number(entry.taxableAmount || entry.subtotal || 0);
      slabMap[rate].gstAmount += Number(entry.gstAmount || entry.totalGst || 0);
      slabMap[rate].transactions += 1;
    });

    const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
    const mismatchRows = purchases
      .filter((purchase) => purchase.gstNo && !gstinPattern.test(String(purchase.gstNo).toUpperCase()))
      .map((purchase) => ({ refNo: purchase.billNo, party: purchase.party, issue: "Invalid GSTIN format", gstNo: purchase.gstNo }));

    return res.status(200).json({
      success: true,
      data: {
        gstr1: {
          taxableOutwardSupply: round2(outward.taxable),
          outputTax: round2(outward.tax),
          invoiceValue: round2(outward.total),
          invoiceCount: sales.length
        },
        gstr3b: {
          outwardTaxable: round2(outward.taxable),
          outputTax: round2(outward.tax),
          eligibleItc: round2(inward.tax),
          netTaxPayable: round2(outward.tax - inward.tax)
        },
        hsnSummary: Object.values(hsnMap).sort((a, b) => b.taxableAmount - a.taxableAmount),
        itcTracking: {
          purchaseTaxable: round2(inward.taxable),
          eligibleItc: round2(inward.tax),
          purchaseInvoiceCount: purchases.length
        },
        mismatchRows,
        reverseCharge: { taxableAmount: 0, taxAmount: 0, note: "Reverse charge flag is not captured on transactions yet." },
        taxSlabs: Object.values(slabMap).sort((a, b) => a.rate - b.rate),
        eInvoiceReadiness: {
          readyInvoices: sales.filter((sale) => Number(sale.totalAmount || 0) > 0 && (sale.customer || sale.customerId)).length,
          missingGstin: sales.filter((sale) => Number(sale.totalAmount || 0) > 0 && !sale.customerId).length,
          note: "E-invoice payload generation still needs IRP credentials and invoice schema mapping."
        }
      }
    });
  } catch (err) {
    console.error("GST Compliance Report Error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch GST compliance report" });
  }
};

export const getProfitLossReport = async (req, res) => {
  try {
    const sales = await Sales.find().lean();
    const purchases = await Purchase.find().lean();

    const totalSales = sales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
    const totalSalesReturns = sales.reduce((sum, sale) => sum + Number(sale.totalReturnedAmount || 0), 0);
    const totalPurchases = purchases.reduce((sum, purchase) => sum + Number(purchase.finalTotal || purchase.billAmount || 0), 0);
    const totalPurchaseDiscount = purchases.reduce((sum, purchase) => sum + Number(purchase.discountTotal || 0), 0);
    const netSales = totalSales - totalSalesReturns;
    const netPurchases = totalPurchases - totalPurchaseDiscount;
    const grossProfitEstimate = netSales - netPurchases;

    return res.status(200).json({
      success: true,
      data: {
        totalSales,
        totalSalesReturns,
        netSales,
        totalPurchases,
        totalPurchaseDiscount,
        netPurchases,
        grossProfitEstimate
      }
    });
  } catch (err) {
    console.error("Profit Loss Report Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch profit and loss report"
    });
  }
};

export const getCashBookReport = async (req, res) => {
  try {
    const { start, end } = buildRange(req.query.from, req.query.to);

    const [sales, ledgerEntries, cashEntries, sessions, activeSession] = await Promise.all([
      Sales.find({ saleDate: { $gte: start, $lte: end } }).sort({ saleDate: -1 }).lean(),
      CustomerLedger.find({
        createdAt: { $gte: start, $lte: end }
      }).sort({ createdAt: -1 }).lean(),
      CashEntry.find({
        entryDate: { $gte: start, $lte: end }
      }).sort({ entryDate: -1, createdAt: -1 }).lean(),
      POSSession.find({
        $or: [
          { openedAt: { $gte: start, $lte: end } },
          { lastDayEndAt: { $gte: start, $lte: end } },
          { closedAt: { $gte: start, $lte: end } }
        ]
      }).sort({ openedAt: -1 }).lean(),
      POSSession.findOne({ status: "open" }).sort({ openedAt: -1 }).lean()
    ]);

    const paymentModeTotals = sales.reduce((summary, sale) => {
      (sale.paymentBreakdown || []).forEach((row) => {
        const mode = String(row.mode || "").toLowerCase();
        const amount = round2(row.amount);
        if (mode === "cash") summary.cash += amount;
        if (mode === "card") summary.card += amount;
        if (mode === "upi") summary.upi += amount;
        if (mode === "bank") summary.bank += amount;
      });
      return summary;
    }, { cash: 0, card: 0, upi: 0, bank: 0 });

    const nonCashSales = sales.filter((sale) => (
      round2((sale.paymentBreakdown || [])
        .filter((row) => ["card", "upi", "bank"].includes(String(row.mode || "").toLowerCase()))
        .reduce((sum, row) => sum + round2(row.amount), 0)) > 0
    ));

    const salesSummary = sales.reduce((acc, sale) => {
      acc.salesAmount += round2(sale.totalAmount);
      acc.cashSales += round2((sale.paymentBreakdown || [])
        .filter((row) => String(row.mode || "").toLowerCase() === "cash")
        .reduce((sum, row) => sum + round2(row.amount), 0));
      acc.creditSales += round2(sale.creditDue);
      acc.advanceSales += round2(sale.advanceAmount);
      acc.salesReturn += round2(sale.totalReturnedAmount);
      return acc;
    }, {
      salesAmount: 0,
      cashSales: 0,
      creditSales: 0,
      advanceSales: 0,
      salesReturn: 0
    });

    const receipts = ledgerEntries.filter((entry) => entry.entryType === "payment" && entry.direction === "credit");
    const receiptAmount = receipts
      .filter((entry) => entry.entryType === "payment" && entry.direction === "credit")
      .reduce((sum, entry) => sum + round2(entry.amount), 0);
    const ledgerPayout = ledgerEntries
      .filter((entry) => entry.entryType === "adjustment" && entry.direction === "debit")
      .reduce((sum, entry) => sum + round2(entry.amount), 0);
    const receiptCash = receipts
      .filter((entry) => formatPaymentMode(entry.paymentMode || entry.referenceNo) === "Cash")
      .reduce((sum, entry) => sum + round2(entry.amount), 0);
    const receiptBank = receipts
      .filter((entry) => formatPaymentMode(entry.paymentMode || entry.referenceNo) !== "Cash")
      .reduce((sum, entry) => sum + round2(entry.amount), 0);

    const expenseRows = cashEntries.filter((entry) => entry.entryType === "expense");
    const bankDepositRows = cashEntries.filter((entry) => entry.entryType === "bank-deposit");
    const bankWithdrawalRows = cashEntries.filter((entry) => entry.entryType === "bank-withdrawal");
    const cashAdjustmentRows = cashEntries.filter((entry) => entry.entryType === "cash-adjustment");

    const cashExpenses = expenseRows
      .filter((entry) => formatPaymentMode(entry.paymentMode) === "Cash")
      .reduce((sum, entry) => sum + round2(entry.amount), 0);
    const bankExpenses = expenseRows
      .filter((entry) => formatPaymentMode(entry.paymentMode) !== "Cash")
      .reduce((sum, entry) => sum + round2(entry.amount), 0);
    const bankDeposits = bankDepositRows.reduce((sum, entry) => sum + round2(entry.amount), 0);
    const bankWithdrawals = bankWithdrawalRows.reduce((sum, entry) => sum + round2(entry.amount), 0);
    const cashAdjustmentsNet = cashAdjustmentRows.reduce((sum, entry) => (
      sum + (entry.direction === "in" ? round2(entry.amount) : -round2(entry.amount))
    ), 0);

    const openingCash = sessions.reduce((sum, session) => sum + round2(session.openingCash), 0);
    const expenseAmount = sessions.reduce((sum, session) => sum + round2(session.expenseAmount), 0);
    const closingCash = sessions.reduce((sum, session) => sum + round2(session.closingCash), 0);
    const expectedCash = sessions.reduce((sum, session) => sum + round2(session.expectedCash), 0);
    const netCashSales = round2(salesSummary.cashSales - salesSummary.salesReturn);
    const totalCashOut = round2(expenseAmount + ledgerPayout + cashExpenses + bankDeposits);
    const totalCashIn = round2(openingCash + salesSummary.cashSales + receiptCash + bankWithdrawals + Math.max(cashAdjustmentsNet, 0));
    const cashInHand = round2(totalCashIn - totalCashOut + Math.min(cashAdjustmentsNet, 0));

    const modeBreakdown = Object.entries(paymentModeTotals)
      .filter(([, amount]) => round2(amount) > 0)
      .map(([mode, amount]) => ({
        paymentMode: formatPaymentMode(mode),
        salesAmt: round2(amount)
      }));

    const receiptBreakdown = receipts.reduce((rows, entry) => {
      const key = formatPaymentMode(entry.paymentMode || entry.referenceNo);
      rows[key] = round2((rows[key] || 0) + entry.amount);
      return rows;
    }, {});

    const detailPanels = {
      "CASH SALES": sales
        .filter((sale) => round2((sale.paymentBreakdown || []).filter((row) => String(row.mode || "").toLowerCase() === "cash").reduce((sum, row) => sum + round2(row.amount), 0)) > 0)
        .map((sale) => ({
          refNo: sale.billNo || sale.invoiceNo,
          party: sale.customer || "Walk-in",
          amount: round2((sale.paymentBreakdown || []).filter((row) => String(row.mode || "").toLowerCase() === "cash").reduce((sum, row) => sum + round2(row.amount), 0))
        })),
      "CARD/UPI SALES": modeBreakdown,
      "ADV.MEMO": sales.filter((sale) => round2(sale.advanceAmount) > 0).map((sale) => ({
        refNo: sale.billNo || sale.invoiceNo,
        party: sale.customer || "Walk-in",
        amount: round2(sale.advanceAmount)
      })),
      "RECEIPT": Object.entries(receiptBreakdown).map(([paymentMode, amount]) => ({
        paymentMode,
        salesAmt: round2(amount)
      })),
      "CASH EXPENSES": expenseRows.map((entry) => ({
        refNo: entry.referenceNo || "-",
        party: entry.category || entry.accountLabel || "Expense",
        amount: round2(entry.amount)
      })),
      "PARTY PAID": ledgerEntries
        .filter((entry) => entry.entryType === "adjustment" && entry.direction === "debit")
        .map((entry) => ({
          refNo: entry.referenceNo || entry.billNo || "-",
          party: entry.customerName || "-",
          amount: round2(entry.amount)
        })),
      "CASH SALES RET": sales
        .filter((sale) => round2(sale.totalReturnedAmount) > 0)
        .map((sale) => ({
          refNo: sale.billNo || sale.invoiceNo,
          party: sale.customer || "Walk-in",
          amount: round2(sale.totalReturnedAmount)
        })),
      "PENDING P-SLIP": sales
        .filter((sale) => round2(sale.creditDue) > 0)
        .map((sale) => ({
          refNo: sale.billNo || sale.invoiceNo,
          party: sale.customer || "Walk-in",
          amount: round2(sale.creditDue)
        }))
    };

    const summaryRows = [
      { key: "DATE", label: `${start.toLocaleDateString("en-IN")} All`, cnt: sales.length, cr: salesSummary.salesAmount, dr: 0 },
      { key: "CASH SALES", label: "CASH SALES", cnt: sales.filter((sale) => round2((sale.paymentBreakdown || []).filter((row) => String(row.mode || "").toLowerCase() === "cash").reduce((sum, row) => sum + round2(row.amount), 0)) > 0).length, cr: salesSummary.cashSales, dr: 0 },
      { key: "CARD/UPI SALES", label: "CARD/UPI SALES", cnt: nonCashSales.length, cr: round2(paymentModeTotals.card + paymentModeTotals.upi + paymentModeTotals.bank), dr: 0 },
      { key: "ADV.MEMO", label: "ADV.MEMO", cnt: sales.filter((sale) => round2(sale.advanceAmount) > 0).length, cr: salesSummary.advanceSales, dr: 0 },
      { key: "ADV.MEMO(BANK)", label: "ADV.MEMO(BANK)", cnt: 0, cr: 0, dr: 0 },
      { key: "RECEIPT", label: "RECEIPT", cnt: receipts.length, cr: receiptCash, dr: 0 },
      { key: "RECEIPT(BANK)", label: "RECEIPT(BANK)", cnt: receipts.length, cr: receiptBank, dr: 0 },
      { key: "BULK TRANSFER", label: "BULK TRANSFER", cnt: bankDepositRows.length, cr: 0, dr: bankDeposits },
      { key: "BANK", label: "BANK", cnt: bankWithdrawalRows.length, cr: bankWithdrawals, dr: 0 },
      { key: "CASH EXPENSES", label: "CASH EXPENSES", cnt: expenseRows.length, cr: 0, dr: cashExpenses + bankExpenses },
      { key: "PARTY PAID", label: "PARTY PAID", cnt: ledgerEntries.filter((entry) => entry.entryType === "adjustment" && entry.direction === "debit").length, cr: 0, dr: ledgerPayout },
      { key: "CASH SALES RET", label: "CASH SALES RET", cnt: sales.filter((sale) => round2(sale.totalReturnedAmount) > 0).length, cr: 0, dr: salesSummary.salesReturn },
      { key: "ADV. MEMO RET", label: "ADV. MEMO RET", cnt: 0, cr: 0, dr: 0 },
      { key: "TOTAL CASH", label: "TOTAL CASH", cnt: 0, cr: round2(openingCash + salesSummary.cashSales + receiptCash + bankWithdrawals), dr: round2(expenseAmount + cashExpenses + ledgerPayout + bankDeposits) },
      { key: "CASH-IN-HAND", label: "CASH-IN-HAND", cnt: 0, cr: cashInHand, dr: 0 },
      { key: "NET SALES", label: "NET SALES", cnt: sales.length, cr: netCashSales, dr: 0 },
      { key: "CREDIT SALES", label: "CREDIT SALES", cnt: sales.filter((sale) => round2(sale.creditDue) > 0).length, cr: salesSummary.creditSales, dr: 0 },
      { key: "PENDING P-SLIP", label: "PENDING P-SLIP", cnt: sales.filter((sale) => round2(sale.creditDue) > 0).length, cr: 0, dr: salesSummary.creditSales }
    ];

    const transactionRows = [
      ...sales.map((sale) => ({
        type: "sale",
        date: sale.saleDate,
        refNo: sale.billNo || sale.invoiceNo,
        party: sale.customer || "Walk-in",
        mode: sale.billType,
        amount: round2(sale.totalAmount),
        cashComponent: round2((sale.paymentBreakdown || [])
          .filter((row) => String(row.mode || "").toLowerCase() === "cash")
          .reduce((sum, row) => sum + round2(row.amount), 0))
      })),
      ...ledgerEntries.map((entry) => ({
        type: entry.entryType === "payment" ? "receipt" : "adjustment",
        date: entry.createdAt,
        refNo: entry.referenceNo || entry.billNo || "-",
        party: entry.customerName || "-",
        mode: entry.paymentMode || entry.direction,
        amount: round2(entry.amount),
        cashComponent: round2(formatPaymentMode(entry.paymentMode || entry.referenceNo) === "Cash"
          ? (entry.direction === "debit" ? -entry.amount : entry.amount)
          : 0)
      })),
      ...cashEntries.map((entry) => ({
        type: entry.entryType,
        date: entry.entryDate,
        refNo: entry.referenceNo || "-",
        party: entry.category || entry.accountLabel || "-",
        mode: entry.paymentMode || "-",
        amount: round2(entry.amount),
        cashComponent: round2(formatPaymentMode(entry.paymentMode) === "Cash"
          ? (entry.direction === "in" ? entry.amount : -entry.amount)
          : 0)
      }))
    ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return res.status(200).json({
      success: true,
      data: {
        range: { from: start, to: end },
        summary: {
          openingCash,
          expenseAmount: round2(expenseAmount + ledgerPayout + cashExpenses + bankExpenses),
          receiptAmount,
          closingCash,
          expectedCash,
          cashInHand,
          bankDeposits,
          bankWithdrawals,
          receiptCash,
          receiptBank,
          cashExpenses,
          ledgerPayout,
          ...salesSummary,
          ...paymentModeTotals
        },
        summaryRows,
        detailPanels,
        detailLists: {
          sales,
          receipts,
          expenses: cashEntries,
          pendingPSlips: detailPanels["PENDING P-SLIP"],
          salesReturns: detailPanels["CASH SALES RET"],
          sessions
        },
        sessions,
        transactions: transactionRows,
        activeSession
      }
    });
  } catch (err) {
    console.error("Cash Book Report Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch cash book report"
    });
  }
};
