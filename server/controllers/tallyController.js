import Sales from "../models/Sales.js";
import Purchase from "../models/Purchase.js";
import CashEntry from "../models/CashEntry.js";
import CustomerLedger from "../models/CustomerLedger.js";
import TallySettings from "../models/TallySettings.js";
import TallySyncLog from "../models/TallySyncLog.js";

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const xmlEscape = (value = "") => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

const DEFAULT_SETTINGS = {
  companyName: "",
  companyAlias: "",
  fromDate: null,
  toDate: null,
  voucherTypes: {
    sales: "Sales",
    purchase: "Purchase",
    receipt: "Receipt",
    payment: "Payment",
    journal: "Journal"
  },
  ledgers: {
    salesLedger: "Sales Account",
    purchaseLedger: "Purchase Account",
    cashLedger: "Cash",
    customerLedgerControl: "Customer Ledger Control",
    roundOffLedger: "Round Off",
    gstOutputLedger: "Output GST",
    gstInputLedger: "Input GST"
  },
  exportBehavior: {
    markSalesAsExported: true,
    markPurchasesAsExported: true,
    onlyUnexportedByDefault: true
  },
  xmlFormat: "tally-import-v1"
};

const normalizeSettings = (settingsDoc) => ({
  ...DEFAULT_SETTINGS,
  ...(settingsDoc || {}),
  voucherTypes: {
    ...DEFAULT_SETTINGS.voucherTypes,
    ...(settingsDoc?.voucherTypes || {})
  },
  ledgers: {
    ...DEFAULT_SETTINGS.ledgers,
    ...(settingsDoc?.ledgers || {})
  },
  exportBehavior: {
    ...DEFAULT_SETTINGS.exportBehavior,
    ...(settingsDoc?.exportBehavior || {})
  }
});

const formatDate = (value) => {
  const date = new Date(value || Date.now());
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
};

const tallyAmount = (value) => round2(value).toFixed(2);

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildDateRangeFilter = (fieldName, fromDate, toDate) => {
  const from = parseDate(fromDate);
  const to = parseDate(toDate);
  if (!from && !to) return {};

  const range = {};
  if (from) {
    from.setHours(0, 0, 0, 0);
    range.$gte = from;
  }
  if (to) {
    to.setHours(23, 59, 59, 999);
    range.$lte = to;
  }

  return { [fieldName]: range };
};

const buildExportFilter = (fieldName, options, settings) => {
  const filter = buildDateRangeFilter(fieldName, options.fromDate || settings.fromDate, options.toDate || settings.toDate);
  if (options.onlyUnexported ?? settings.exportBehavior.onlyUnexportedByDefault) {
    filter["tallyExport.exported"] = { $ne: true };
  }
  return filter;
};

const voucherLedgerLine = (ledgerName, amount, isDeemedPositive) => ({
  ledgerName,
  amount: round2(amount),
  isDeemedPositive
});

const buildSalesVoucher = (sale, settings) => {
  const lines = [
    voucherLedgerLine(sale.customer || "Cash Sales", sale.totalAmount || 0, "No"),
    voucherLedgerLine(settings.ledgers.salesLedger, (sale.totalAmount || 0) * -1, "Yes")
  ];

  if (Number(sale.gstAmount || 0) > 0) {
    lines.push(voucherLedgerLine(settings.ledgers.gstOutputLedger, (sale.gstAmount || 0) * -1, "Yes"));
  }

  return {
    type: "sales",
    sourceId: sale._id,
    voucherType: settings.voucherTypes.sales,
    voucherNo: sale.billNo || sale.invoiceNo || String(sale._id),
    date: sale.saleDate,
    party: sale.customer || "Walk-in Customer",
    amount: round2(sale.totalAmount || 0),
    referenceNo: sale.referenceNo || "",
    narration: sale.note || "",
    ledgerLines: lines
  };
};

const buildPurchaseVoucher = (purchase, settings) => {
  const lines = [
    voucherLedgerLine(purchase.party || "Purchase Party", (purchase.finalTotal || purchase.billAmount || 0) * -1, "Yes"),
    voucherLedgerLine(settings.ledgers.purchaseLedger, purchase.taxableAmount || purchase.subtotal || 0, "No")
  ];

  if (Number(purchase.totalGst || 0) > 0) {
    lines.push(voucherLedgerLine(settings.ledgers.gstInputLedger, purchase.totalGst || 0, "No"));
  }

  return {
    type: "purchase",
    sourceId: purchase._id,
    voucherType: settings.voucherTypes.purchase,
    voucherNo: purchase.billNo || purchase.grnNo || String(purchase._id),
    date: purchase.billDate || purchase.receiveDate,
    party: purchase.party || "Purchase Party",
    amount: round2(purchase.finalTotal || purchase.billAmount || 0),
    referenceNo: purchase.lrNo || "",
    narration: purchase.narration || "",
    ledgerLines: lines
  };
};

const buildLedgerVoucher = (entry, settings) => ({
  type: "ledger",
  sourceId: entry._id,
  voucherType: entry.entryType === "payment" ? settings.voucherTypes.receipt : settings.voucherTypes.journal,
  voucherNo: entry.billNo || entry.referenceNo || String(entry._id),
  date: entry.createdAt,
  party: entry.customerName || "Ledger Party",
  amount: round2(entry.amount || 0),
  referenceNo: entry.referenceNo || "",
  narration: entry.note || "",
  ledgerLines: [
    voucherLedgerLine(
      entry.customerName || "Ledger Party",
      entry.direction === "debit" ? entry.amount : (entry.amount * -1),
      entry.direction === "debit" ? "No" : "Yes"
    ),
    voucherLedgerLine(
      settings.ledgers.customerLedgerControl,
      entry.direction === "debit" ? (entry.amount * -1) : entry.amount,
      entry.direction === "debit" ? "Yes" : "No"
    )
  ]
});

const buildCashVoucher = (entry, settings) => ({
  type: "cash",
  sourceId: entry._id,
  voucherType: entry.direction === "in" ? settings.voucherTypes.receipt : settings.voucherTypes.payment,
  voucherNo: entry.referenceNo || String(entry._id),
  date: entry.entryDate,
  party: entry.accountLabel || entry.category || "Cash Entry",
  amount: round2(entry.amount || 0),
  referenceNo: entry.referenceNo || "",
  narration: entry.note || "",
  ledgerLines: [
    voucherLedgerLine(
      entry.accountLabel || entry.category || "Cash Entry",
      entry.direction === "out" ? entry.amount : (entry.amount * -1),
      entry.direction === "out" ? "Yes" : "No"
    ),
    voucherLedgerLine(
      settings.ledgers.cashLedger,
      entry.direction === "out" ? (entry.amount * -1) : entry.amount,
      entry.direction === "out" ? "No" : "Yes"
    )
  ]
});

const buildVoucherXml = (voucher, settings) => {
  const base = [
    `<DATE>${formatDate(voucher.date)}</DATE>`,
    `<VOUCHERTYPENAME>${xmlEscape(voucher.voucherType)}</VOUCHERTYPENAME>`,
    `<VOUCHERNUMBER>${xmlEscape(voucher.voucherNo)}</VOUCHERNUMBER>`,
    `<PARTYLEDGERNAME>${xmlEscape(voucher.party)}</PARTYLEDGERNAME>`,
    `<REFERENCE>${xmlEscape(voucher.referenceNo || "")}</REFERENCE>`,
    `<NARRATION>${xmlEscape(voucher.narration || "")}</NARRATION>`,
  ];

  if (settings.xmlFormat === "tally-import-v2") {
    base.push(`<ISINVOICE>Yes</ISINVOICE>`);
  }

  const ledgerLines = voucher.ledgerLines.map((line) => `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${xmlEscape(line.ledgerName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>${line.isDeemedPositive}</ISDEEMEDPOSITIVE>
        <AMOUNT>${tallyAmount(line.amount)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
    `).join("");

  return `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <VOUCHER VCHTYPE="${xmlEscape(voucher.voucherType)}" ACTION="Create">
        ${base.join("")}
        ${ledgerLines}
      </VOUCHER>
    </TALLYMESSAGE>
  `;
};

const buildTallyXml = (payload, settings) => `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        ${settings.companyName ? `<STATICVARIABLES><SVCURRENTCOMPANY>${xmlEscape(settings.companyName)}</SVCURRENTCOMPANY></STATICVARIABLES>` : ""}
      </REQUESTDESC>
      <REQUESTDATA>
        ${payload.vouchers.map((voucher) => buildVoucherXml(voucher, settings)).join("")}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

const loadSettings = async () => {
  const settingsDoc = await TallySettings.findOne().sort({ updatedAt: -1 }).lean();
  return normalizeSettings(settingsDoc);
};

const createLog = async ({ runType, status, summary, detail, counts, userId }) => TallySyncLog.create({
  runType,
  status,
  summary,
  detail,
  counts,
  createdBy: userId,
  exportedAt: new Date()
});

const exportedTallySet = (now, runType, batchId) => ({
  "tallyExport.exported": true,
  "tallyExport.exportedAt": now,
  "tallyExport.exportRunType": runType,
  "tallyExport.exportBatchId": batchId,
  "tallyExport.status": "exported",
  "tallyExport.lastError": ""
});

const markExports = async (payload, runType, batchId, settings) => {
  const now = new Date();
  const ops = [];

  if (settings.exportBehavior.markSalesAsExported && payload.salesIds.length > 0) {
    ops.push(Sales.updateMany(
      { _id: { $in: payload.salesIds } },
      { $set: exportedTallySet(now, runType, batchId) }
    ));
  }

  if (settings.exportBehavior.markPurchasesAsExported && payload.purchaseIds.length > 0) {
    ops.push(Purchase.updateMany(
      { _id: { $in: payload.purchaseIds } },
      { $set: exportedTallySet(now, runType, batchId) }
    ));
  }

  if (payload.ledgerIds.length > 0) {
    ops.push(CustomerLedger.updateMany(
      { _id: { $in: payload.ledgerIds } },
      { $set: exportedTallySet(now, runType, batchId) }
    ));
  }

  if (payload.cashIds.length > 0) {
    ops.push(CashEntry.updateMany(
      { _id: { $in: payload.cashIds } },
      { $set: exportedTallySet(now, runType, batchId) }
    ));
  }

  if (ops.length > 0) {
    await Promise.all(ops);
  }
};

const buildPayload = async (options = {}) => {
  const settings = await loadSettings();
  const salesFilter = buildExportFilter("saleDate", options, settings);
  const purchaseFilter = buildExportFilter("billDate", options, settings);
  const ledgerFilter = buildExportFilter("createdAt", options, settings);
  const cashFilter = buildExportFilter("entryDate", options, settings);

  const [sales, purchases, ledgerEntries, cashEntries] = await Promise.all([
    Sales.find(salesFilter).sort({ saleDate: -1 }).lean(),
    Purchase.find(purchaseFilter).sort({ billDate: -1, createdAt: -1 }).lean(),
    CustomerLedger.find(ledgerFilter).sort({ createdAt: -1 }).lean(),
    CashEntry.find(cashFilter).sort({ entryDate: -1 }).lean()
  ]);

  const vouchers = [
    ...sales.map((sale) => buildSalesVoucher(sale, settings)),
    ...purchases.map((purchase) => buildPurchaseVoucher(purchase, settings)),
    ...ledgerEntries.map((entry) => buildLedgerVoucher(entry, settings)),
    ...cashEntries.map((entry) => buildCashVoucher(entry, settings))
  ];

  const gstSummary = {
    outputGst: round2(sales.reduce((sum, sale) => sum + Number(sale.gstAmount || 0), 0)),
    inputGst: round2(purchases.reduce((sum, purchase) => sum + Number(purchase.totalGst || 0), 0))
  };
  gstSummary.gstPayable = round2(gstSummary.outputGst - gstSummary.inputGst);

  return {
    exportedAt: new Date().toISOString(),
    mode: "backend-export",
    filters: {
      fromDate: options.fromDate || settings.fromDate || null,
      toDate: options.toDate || settings.toDate || null,
      onlyUnexported: options.onlyUnexported ?? settings.exportBehavior.onlyUnexportedByDefault
    },
    settings,
    salesCount: sales.length,
    purchaseCount: purchases.length,
    ledgerCount: ledgerEntries.length,
    cashCount: cashEntries.length,
    gstSummary,
    queue: [
      { module: "Sales", count: sales.length, status: sales.length ? "Ready" : "Empty" },
      { module: "Purchases", count: purchases.length, status: purchases.length ? "Ready" : "Empty" },
      { module: "Customer Ledger", count: ledgerEntries.length, status: ledgerEntries.length ? "Ready" : "Empty" },
      { module: "Cash Entries", count: cashEntries.length, status: cashEntries.length ? "Ready" : "Empty" },
      { module: "GST", count: sales.length + purchases.length, status: "Review" }
    ],
    vouchers,
    salesIds: sales.map((entry) => entry._id),
    purchaseIds: purchases.map((entry) => entry._id),
    ledgerIds: ledgerEntries.map((entry) => entry._id),
    cashIds: cashEntries.map((entry) => entry._id)
  };
};

const summarizeCounts = (payload) => ({
  sales: payload.salesCount,
  purchases: payload.purchaseCount,
  ledgerEntries: payload.ledgerCount,
  cashEntries: payload.cashCount
});

export const getTallySettings = async (req, res) => {
  try {
    const settings = await loadSettings();
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error("Get Tally Settings Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch Tally settings", error: error.message });
  }
};

export const updateTallySettings = async (req, res) => {
  try {
    const payload = normalizeSettings({
      ...req.body,
      updatedBy: req.user?._id
    });
    const existing = await TallySettings.findOne().sort({ updatedAt: -1 });
    if (existing) {
      Object.assign(existing, payload, { updatedBy: req.user?._id });
      await existing.save();
      return res.status(200).json({ success: true, message: "Tally settings updated successfully", data: normalizeSettings(existing.toObject()) });
    }

    const created = await TallySettings.create({ ...payload, updatedBy: req.user?._id });
    return res.status(201).json({ success: true, message: "Tally settings saved successfully", data: normalizeSettings(created.toObject()) });
  } catch (error) {
    console.error("Update Tally Settings Error:", error);
    return res.status(500).json({ success: false, message: "Failed to save Tally settings", error: error.message });
  }
};

export const getTallySnapshot = async (req, res) => {
  try {
    const payload = await buildPayload(req.query || {});
    return res.status(200).json({ success: true, data: payload });
  } catch (error) {
    console.error("Tally Snapshot Error:", error);
    return res.status(500).json({ success: false, message: "Failed to build Tally snapshot", error: error.message });
  }
};

export const getTallyLogs = async (req, res) => {
  try {
    const logs = await TallySyncLog.find().sort({ exportedAt: -1, createdAt: -1 }).limit(50).lean();
    return res.status(200).json({
      success: true,
      data: logs.map((log) => ({
        id: log._id,
        when: log.exportedAt || log.createdAt,
        module: "Tally",
        status: log.status === "success" ? "Success" : "Failed",
        detail: log.summary,
        runType: log.runType,
        counts: log.counts || {}
      }))
    });
  } catch (error) {
    console.error("Tally Logs Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch Tally logs", error: error.message });
  }
};

export const prepareTallySync = async (req, res) => {
  try {
    const payload = await buildPayload(req.body || {});
    await createLog({
      runType: "prepare",
      status: "success",
      summary: `Prepared Tally payload with ${payload.salesCount} sales, ${payload.purchaseCount} purchases, ${payload.ledgerCount} ledger entries, and ${payload.cashCount} cash entries.`,
      detail: "Payload prepared for review/export.",
      counts: summarizeCounts(payload),
      userId: req.user?._id
    });
    return res.status(200).json({ success: true, message: "Tally payload prepared successfully.", data: payload });
  } catch (error) {
    console.error("Prepare Tally Error:", error);
    await createLog({
      runType: "prepare",
      status: "failed",
      summary: "Failed to prepare Tally payload.",
      detail: error.message,
      counts: {},
      userId: req.user?._id
    }).catch(() => {});
    return res.status(500).json({ success: false, message: "Failed to prepare Tally payload", error: error.message });
  }
};

export const exportTallyJson = async (req, res) => {
  try {
    const payload = await buildPayload(req.query || {});
    const settings = payload.settings;
    const batchId = `json-${Date.now()}`;
    await markExports(payload, "export-json", batchId, settings);
    await createLog({
      runType: "export-json",
      status: "success",
      summary: `Exported Tally JSON with ${payload.vouchers.length} vouchers.`,
      detail: "JSON export generated from backend payload.",
      counts: summarizeCounts(payload),
      userId: req.user?._id
    });
    return res.status(200).json({ success: true, data: payload });
  } catch (error) {
    console.error("Export Tally JSON Error:", error);
    return res.status(500).json({ success: false, message: "Failed to export Tally JSON", error: error.message });
  }
};

export const exportTallyXml = async (req, res) => {
  try {
    const payload = await buildPayload(req.query || {});
    const settings = payload.settings;
    const batchId = `xml-${Date.now()}`;
    const xml = buildTallyXml(payload, settings);
    await markExports(payload, "export-xml", batchId, settings);
    await createLog({
      runType: "export-xml",
      status: "success",
      summary: `Exported Tally XML with ${payload.vouchers.length} vouchers.`,
      detail: "XML export generated for Tally import.",
      counts: summarizeCounts(payload),
      userId: req.user?._id
    });
    return res.status(200).json({
      success: true,
      data: {
        fileName: `tally-export-${new Date().toISOString().slice(0, 10)}.xml`,
        xml,
        xmlFormat: settings.xmlFormat
      }
    });
  } catch (error) {
    console.error("Export Tally XML Error:", error);
    return res.status(500).json({ success: false, message: "Failed to export Tally XML", error: error.message });
  }
};
