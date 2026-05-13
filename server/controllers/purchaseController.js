import mongoose from "mongoose";
import Brand from "../models/Brand.js";
import Category from "../models/Category.js";
import Inventory from "../models/Inventory.js";
import Item from "../models/Item.js";
import Label from "../models/Label.js";
import LrEntry from "../models/LrEntry.js";
import Party from "../models/Party.js";
import Purchase from "../models/Purchase.js";
import { adjustStock } from "./inventoryController.js";
import { createAuditLog } from "../services/auditService.js";
import { createPurchaseRecord } from "../services/purchaseService.js";
import { runInTransaction } from "../utils/transaction.js";
import { receivePurchaseIntoInventory } from "../services/purchaseInventoryService.js";
import { normalizeUnit } from "../utils/unit.js";
import { normalizeScanText, parsePurchaseBillScanSource, runLocalPurchaseBillOcr } from "../utils/purchaseBillScanner.js";

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const normalizeText = (value = "") => String(value).trim();
const extractNumericIdentifier = (value = "") => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return 0;
  }

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  const trailingMatch = normalized.match(/(\d+)$/);
  return trailingMatch ? Number(trailingMatch[1]) : 0;
};

const getNextNumericIdentifier = async (Model, fieldName) => {
  const records = await Model.find({ [fieldName]: { $exists: true, $ne: null } })
    .select(fieldName)
    .lean();

  const maxIdentifier = records.reduce((highestValue, record) => (
    Math.max(highestValue, extractNumericIdentifier(record?.[fieldName]))
  ), 0);

  return String(maxIdentifier + 1);
};

const getNextGrnNoValue = async () => getNextNumericIdentifier(Purchase, "grnNo");

const getNextLrIdValue = async () => getNextNumericIdentifier(LrEntry, "lrId");

const findOrCreateCategory = async (categoryValue, hsnValue = "", unitValue = "") => {
  if (!categoryValue) {
    return null;
  }

  if (mongoose.Types.ObjectId.isValid(categoryValue)) {
    return Category.findById(categoryValue);
  }

  let category = await Category.findOne({ name: categoryValue });
  if (!category) {
    category = await Category.create({ name: categoryValue, hsn: normalizeText(hsnValue), unit: normalizeUnit(unitValue) });
  } else if (!normalizeText(category.hsn) && normalizeText(hsnValue)) {
    category.hsn = normalizeText(hsnValue);
    category.unit = normalizeUnit(unitValue || category.unit);
    await category.save();
  } else if (normalizeText(unitValue)) {
    category.unit = normalizeUnit(unitValue);
    await category.save();
  }
  return category;
};

const findOrCreateBrand = async (brandValue) => {
  if (!brandValue) {
    return null;
  }

  if (mongoose.Types.ObjectId.isValid(brandValue)) {
    return Brand.findById(brandValue);
  }

  let brand = await Brand.findOne({ name: brandValue });
  if (!brand) {
    brand = await Brand.create({ name: brandValue });
  }
  return brand;
};

const syncItemMaster = async (rawItem, categoryId, brandId) => {
  const itemName = normalizeText(rawItem.name);
  if (!itemName || !categoryId) {
    return null;
  }

  let itemDoc = null;
  if (rawItem.itemId && mongoose.Types.ObjectId.isValid(rawItem.itemId)) {
    itemDoc = await Item.findById(rawItem.itemId);
  }

  if (!itemDoc) {
    itemDoc = await Item.findOne({
      name: itemName,
      category: categoryId,
      ...(brandId ? { brand: brandId } : {})
    });
  }

  if (!itemDoc) {
    itemDoc = await Item.create({
      name: itemName,
      category: categoryId,
      brand: brandId || undefined,
      hsn: normalizeText(rawItem.hsn),
      size: normalizeText(rawItem.size),
      color: normalizeText(rawItem.color),
      material: normalizeText(rawItem.material),
      style: normalizeText(rawItem.style),
      subStyle: normalizeText(rawItem.subStyle),
      designNo: normalizeText(rawItem.designNo),
      unit: normalizeUnit(rawItem.unit),
      defaultPurchaseRate: round2(rawItem.purchaseRate),
      mrp: round2(rawItem.mrp),
      saleRate: round2(rawItem.saleRate)
    });
    return itemDoc;
  }

  itemDoc.name = itemName;
  itemDoc.category = categoryId;
  itemDoc.brand = brandId || itemDoc.brand;
  itemDoc.hsn = normalizeText(rawItem.hsn) || itemDoc.hsn;
  itemDoc.size = normalizeText(rawItem.size) || itemDoc.size;
  itemDoc.color = normalizeText(rawItem.color) || itemDoc.color;
  itemDoc.material = normalizeText(rawItem.material) || itemDoc.material;
  itemDoc.style = normalizeText(rawItem.style) || itemDoc.style;
  itemDoc.subStyle = normalizeText(rawItem.subStyle) || itemDoc.subStyle;
  itemDoc.designNo = normalizeText(rawItem.designNo) || itemDoc.designNo;
  itemDoc.unit = normalizeUnit(rawItem.unit || itemDoc.unit);
  itemDoc.defaultPurchaseRate = round2(rawItem.purchaseRate || itemDoc.defaultPurchaseRate);
  itemDoc.mrp = round2(rawItem.mrp || itemDoc.mrp);
  itemDoc.saleRate = round2(rawItem.saleRate || itemDoc.saleRate);
  await itemDoc.save();
  return itemDoc;
};

const buildItemIdentity = (item = {}) => {
  if (item?._id) {
    return `purchase-item:${String(item._id)}`;
  }

  const itemId = item.itemId?._id || item.itemId;
  if (itemId) {
    return `item:${String(itemId)}`;
  }

  return [
    normalizeText(item.name).toLowerCase(),
    normalizeText(item.category?.name || item.category).toLowerCase(),
    normalizeText(item.brand?.name || item.brand).toLowerCase(),
    normalizeText(item.hsn).toLowerCase(),
  ].join("|");
};

const buildInventoryIdentity = (item = {}) => {
  const itemId = item.itemId?._id || item.itemId;
  if (itemId) {
    return `item:${String(itemId)}`;
  }

  return [
    normalizeText(item.name).toLowerCase(),
    normalizeText(item.category?.name || item.category).toLowerCase(),
    normalizeText(item.brand?.name || item.brand).toLowerCase(),
  ].join("|");
};

const normalizePurchaseItems = async (items = []) => {
  const normalizedItems = [];

  for (const rawItem of items) {
    const itemName = normalizeText(rawItem?.name);
    if (!itemName) {
      continue;
    }

    const qty = Number(rawItem.qty || 0);
    const purchaseRate = Number(rawItem.purchaseRate || 0);
    const discount = Number(rawItem.discount || 0);
    const netRate = Number(rawItem.netRate || 0);
    const total = Number(rawItem.total || 0);

    const category = await findOrCreateCategory(rawItem.category, rawItem.hsn, rawItem.unit);
    const brand = await findOrCreateBrand(rawItem.brand);
    const itemDoc = await syncItemMaster(rawItem, category?._id, brand?._id);

    normalizedItems.push({
      ...rawItem,
      _id: rawItem?._id && mongoose.Types.ObjectId.isValid(rawItem._id)
        ? new mongoose.Types.ObjectId(rawItem._id)
        : undefined,
      itemId: itemDoc?._id || (rawItem.itemId && rawItem.itemId !== "" ? rawItem.itemId : undefined),
      name: itemName,
      category: category?._id,
      hsn: normalizeText(rawItem.hsn) || normalizeText(category?.hsn),
      brand: brand?._id || undefined,
      size: normalizeText(rawItem.size),
      color: normalizeText(rawItem.color),
      material: normalizeText(rawItem.material),
      style: normalizeText(rawItem.style),
      subStyle: normalizeText(rawItem.subStyle),
      designNo: normalizeText(rawItem.designNo),
      qty,
      unit: normalizeUnit(rawItem.unit || itemDoc?.unit || category?.unit),
      purchaseRate,
      mrp: Number(rawItem.mrp || 0),
      saleRate: Number(rawItem.saleRate || 0),
      discount,
      netRate,
      total,
      received: typeof rawItem.received === "boolean" ? rawItem.received : undefined,
      printedLabels: Number(rawItem.printedLabels || 0),
      labelsPrinted: Boolean(rawItem.labelsPrinted)
    });
  }

  return normalizedItems;
};

const synchronizePurchaseState = (purchaseLike = {}) => {
  const items = (purchaseLike.items || []).map((item) => {
    const qty = Number(item.qty || 0);
    const printedLabels = Number(item.printedLabels || 0);
    const labelsPrinted = printedLabels >= qty || Boolean(item.labelsPrinted);

    return {
      ...item,
      received: Boolean(purchaseLike.received || item.received),
      printedLabels,
      labelsPrinted,
    };
  });

  const labelsPrinted = items.length > 0 && items.every((item) => item.labelsPrinted);
  const received = Boolean(purchaseLike.received) || (items.length > 0 && items.every((item) => item.received));

  return {
    ...purchaseLike,
    items,
    received,
    labelsPrinted,
  };
};

const mergeExistingItemState = (incomingItems = [], existingItems = [], forceReceived = false) => {
  const existingByIdentity = new Map(existingItems.map((item) => [buildItemIdentity(item), item]));

  return incomingItems.map((item) => {
    const existing = existingByIdentity.get(buildItemIdentity(item));
    const printedLabels = item.printedLabels !== undefined
      ? Number(item.printedLabels || 0)
      : Number(existing?.printedLabels || 0);
    const labelsPrinted = item.labelsPrinted !== undefined
      ? Boolean(item.labelsPrinted)
      : Boolean(existing?.labelsPrinted);
    const received = forceReceived
      ? true
      : item.received !== undefined
        ? Boolean(item.received)
        : Boolean(existing?.received);

    return {
      ...item,
      _id: item._id || existing?._id,
      printedLabels,
      labelsPrinted: labelsPrinted || printedLabels >= Number(item.qty || 0),
      received,
    };
  });
};

const findInventoryRecordForPurchaseItem = async (item, session = null) => {
  const itemId = item?.itemId?._id || item?.itemId;
  const category = item?.category?._id || item?.category;
  const brand = item?.brand?._id || item?.brand;

  if (itemId && mongoose.Types.ObjectId.isValid(itemId)) {
    const byItemId = await Inventory.findOne({ itemId }).session(session);
    if (byItemId) {
      return byItemId;
    }
  }

  if (normalizeText(item?.name) && category && mongoose.Types.ObjectId.isValid(category)) {
    return Inventory.findOne({
      name: normalizeText(item.name),
      category,
      ...(brand && mongoose.Types.ObjectId.isValid(brand) ? { brand } : {})
    }).session(session);
  }

  return null;
};

const applyInventorySnapshotToRecord = (record, item) => {
  record.itemId = item?.itemId || record.itemId;
  record.name = normalizeText(item?.name) || record.name;
  record.category = item?.category || record.category;
  record.brand = item?.brand || record.brand;
  record.unit = normalizeText(item?.unit) || record.unit || "PC";
  record.barcode = normalizeText(item?.barcode) || record.barcode;
  record.mrp = Number(item?.mrp ?? record.mrp ?? item?.saleRate ?? 0);
  record.sellingRate = Number(item?.saleRate ?? record.sellingRate ?? item?.mrp ?? 0);
  record.purchaseRate = Number(item?.purchaseRate ?? record.purchaseRate ?? 0);
  record.avgPurchaseRate = Number(item?.purchaseRate ?? record.avgPurchaseRate ?? record.purchaseRate ?? 0);
  record.stockValue = round2(Number(record.stock || 0) * Number(record.avgPurchaseRate || 0));
  record.lastPurchaseDate = new Date();
};

const syncLabelSnapshotToItem = async (purchaseId, item, session = null) => {
  const itemId = item?.itemId?._id || item?.itemId;
  if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
    return;
  }

  await Label.updateMany(
    { billId: purchaseId, itemId },
    {
      $set: {
        productName: normalizeText(item?.name),
        purchaseRate: Number(item?.purchaseRate || 0),
        mrp: Number(item?.mrp || 0),
        saleRate: Number(item?.saleRate || 0),
        price: Number(item?.saleRate || 0),
        brand: normalizeText(item?.brand?.name || item?.brand),
        unit: normalizeText(item?.unit),
        color: normalizeText(item?.color),
        material: normalizeText(item?.material),
        style: normalizeText(item?.style),
        subStyle: normalizeText(item?.subStyle),
        designNo: normalizeText(item?.designNo),
      }
    },
    { session }
  );
};

const syncPurchaseArtifacts = async (purchaseId, previousItems = [], nextItems = [], { reconcileStock = false, session = null } = {}) => {
  const previousByIdentity = new Map(previousItems.map((item) => [buildItemIdentity(item), item]));
  const nextByIdentity = new Map(nextItems.map((item) => [buildItemIdentity(item), item]));
  const identityKeys = new Set([...previousByIdentity.keys(), ...nextByIdentity.keys()]);

  for (const identityKey of identityKeys) {
    const previousItem = previousByIdentity.get(identityKey);
    const nextItem = nextByIdentity.get(identityKey);

    if (nextItem) {
      const inventoryRecord = await findInventoryRecordForPurchaseItem(nextItem, session);
      if (inventoryRecord) {
        applyInventorySnapshotToRecord(inventoryRecord, nextItem);
        await inventoryRecord.save({ session });
      }

      await syncLabelSnapshotToItem(purchaseId, nextItem, session);
    }

    if (!reconcileStock) {
      continue;
    }

    const previousInventoryKey = previousItem ? buildInventoryIdentity(previousItem) : "";
    const nextInventoryKey = nextItem ? buildInventoryIdentity(nextItem) : "";

    if (previousItem && nextItem && previousInventoryKey && previousInventoryKey === nextInventoryKey) {
      const record = await findInventoryRecordForPurchaseItem(nextItem, session);
      if (!record) {
        continue;
      }

      const nextQty = Number(nextItem.qty || 0);
      const previousQty = Number(previousItem.qty || 0);
      const stockDelta = nextQty - previousQty;
      const nextPurchaseRate = Number(nextItem.purchaseRate ?? record.purchaseRate ?? 0);

      record.stock = Math.max(0, Number(record.stock || 0) + stockDelta);
      applyInventorySnapshotToRecord(record, nextItem);
      record.purchaseRate = nextPurchaseRate;
      record.avgPurchaseRate = nextPurchaseRate;
      record.stockValue = round2(Number(record.stock || 0) * Number(record.avgPurchaseRate || 0));
      await record.save({ session });
      continue;
    }

    if (previousItem) {
      const previousRecord = await findInventoryRecordForPurchaseItem(previousItem, session);
      if (previousRecord) {
        previousRecord.stock = Math.max(0, Number(previousRecord.stock || 0) - Number(previousItem.qty || 0));
        previousRecord.stockValue = round2(Number(previousRecord.stock || 0) * Number(previousRecord.avgPurchaseRate || previousRecord.purchaseRate || 0));
        await previousRecord.save({ session });
      }
    }

    if (nextItem) {
      const nextRecord = await findInventoryRecordForPurchaseItem(nextItem, session);
      if (nextRecord) {
        nextRecord.stock = Math.max(0, Number(nextRecord.stock || 0) + Number(nextItem.qty || 0));
        applyInventorySnapshotToRecord(nextRecord, nextItem);
        await nextRecord.save({ session });
      } else {
        await Inventory.create([{
          itemId: nextItem.itemId,
          name: nextItem.name,
          category: nextItem.category,
          brand: nextItem.brand,
          barcode: nextItem.barcode,
          stock: Number(nextItem.qty || 0),
          mrp: Number(nextItem.mrp || 0),
          sellingRate: Number(nextItem.saleRate || 0),
          purchaseRate: Number(nextItem.purchaseRate || 0),
          avgPurchaseRate: Number(nextItem.purchaseRate || 0),
          stockValue: round2(Number(nextItem.qty || 0) * Number(nextItem.purchaseRate || 0)),
          unit: nextItem.unit || "PC",
          lastPurchaseDate: new Date(),
        }], { session });
      }
    }
  }
};

const moveReceivedPurchaseIntoInventory = async (purchase) => {
  for (const purchaseItem of purchase.items || []) {
    await adjustStock({
      itemId: purchaseItem.itemId,
      name: purchaseItem.name,
      category: purchaseItem.category,
      brand: purchaseItem.brand,
      qty: Number(purchaseItem.qty || 0),
      mrp: Number(purchaseItem.mrp || 0),
      sellingRate: Number(purchaseItem.saleRate || 0),
      purchaseRate: Number(purchaseItem.purchaseRate || 0),
      unit: purchaseItem.unit || "PC",
    });
  }
};

const validatePurchasePayload = (purchaseData, { allowVariance = false } = {}) => {
  const errors = [];

  if (!normalizeText(purchaseData.party)) {
    errors.push("Party is required");
  }

  if (!normalizeText(purchaseData.billNo)) {
    errors.push("Bill No is required");
  }

  if (!Array.isArray(purchaseData.items) || purchaseData.items.length === 0) {
    errors.push("At least one valid item is required");
  }

  purchaseData.items.forEach((item, index) => {
    if (!item.category) {
      errors.push(`Row ${index + 1}: category is required`);
    }
    if (!normalizeText(item.name)) {
      errors.push(`Row ${index + 1}: item name is required`);
    }
    if (Number(item.qty || 0) <= 0) {
      errors.push(`Row ${index + 1}: qty must be greater than 0`);
    }
    if (Number(item.purchaseRate || 0) <= 0) {
      errors.push(`Row ${index + 1}: purchase rate must be greater than 0`);
    }
    if (Number(item.netRate || 0) < 0) {
      errors.push(`Row ${index + 1}: net rate must be 0 or more`);
    }
    if (Number(item.total || 0) < 0) {
      errors.push(`Row ${index + 1}: total must be 0 or more`);
    }
  });

  const varianceAmount = round2(Number(purchaseData.billAmount || 0) - Number(purchaseData.finalTotal || 0));
  if (Math.abs(varianceAmount) > 0.01 && !allowVariance) {
    errors.push(`Bill Amount and System Total differ by Rs. ${Math.abs(varianceAmount).toFixed(2)}`);
  }

  return {
    errors,
    varianceAmount
  };
};

const escapeRegex = (value = "") => normalizeText(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findDuplicatePurchaseBill = async ({ party, billNo, billDate, excludeId }, session = null) => {
  const normalizedParty = normalizeText(party);
  const normalizedBillNo = normalizeText(billNo);
  if (!normalizedParty || !normalizedBillNo) {
    return null;
  }

  const filter = {
    party: { $regex: `^${escapeRegex(normalizedParty)}$`, $options: "i" },
    billNo: { $regex: `^${escapeRegex(normalizedBillNo)}$`, $options: "i" },
  };

  if (billDate) {
    const date = new Date(billDate);
    if (!Number.isNaN(date.getTime())) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      filter.billDate = { $gte: start, $lte: end };
    }
  }

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  return Purchase.findOne(filter)
    .select("_id grnNo party billNo billDate billAmount finalTotal received labelsPrinted createdAt")
    .sort({ billDate: -1, createdAt: -1 })
    .session(session)
    .lean();
};

const ensureNoDuplicateBill = async ({ party, billNo, billDate, excludeId }, session = null) => {
  const normalizedParty = normalizeText(party);
  const normalizedBillNo = normalizeText(billNo);
  const duplicate = await findDuplicatePurchaseBill({ party, billNo, billDate, excludeId }, session);
  if (duplicate) {
    const error = new Error(`Duplicate bill found for ${normalizedParty} / ${normalizedBillNo} on ${new Date(duplicate.billDate).toLocaleDateString()}`);
    error.statusCode = 409;
    error.duplicate = duplicate;
    throw error;
  }
};

const sanitizeHeaderIds = (purchaseData) => ({
  transporterId: purchaseData.transporterId || undefined,
  firmId: purchaseData.firmId || undefined,
  partyId: purchaseData.partyId || undefined,
  supplierAgentId: purchaseData.supplierAgentId || undefined
});

const sanitizeAttachments = (attachments = []) => (Array.isArray(attachments) ? attachments : [])
  .map((attachment) => ({
    name: normalizeText(attachment.name),
    url: normalizeText(attachment.url),
    mimeType: normalizeText(attachment.mimeType),
    size: Number(attachment.size || 0),
    dataUrl: normalizeText(attachment.dataUrl),
    uploadedAt: attachment.uploadedAt || new Date()
  }))
  .filter((attachment) => attachment.name || attachment.dataUrl || attachment.url);

const buildLrPayload = (source = {}) => ({
  lrId: normalizeText(source.lrId),
  lrNo: normalizeText(source.lrNo),
  bale: Number(source.bale || 0),
  godown: normalizeText(source.godown),
  transporter: normalizeText(source.transporter),
  partyName: normalizeText(source.partyName || source.party),
  inwardDate: source.inwardDate || undefined,
  hundekari: normalizeText(source.hundekari),
  transportCharges: Number(source.transportCharges || 0),
  hamaliCharges: Number(source.hamaliCharges || 0),
  narration: normalizeText(source.narration),
  firmName: normalizeText(source.firmName || source.firm),
  billNo: normalizeText(source.billNo)
});

const syncPurchaseFromLrEntry = async (purchase, lrEntry) => {
  if (!purchase || !lrEntry) {
    return purchase;
  }

  purchase.lrId = lrEntry.lrId;
  purchase.lrNo = lrEntry.lrNo;
  purchase.bale = Number(lrEntry.bale || 0);
  purchase.godown = lrEntry.godown;
  purchase.transporter = lrEntry.transporter || purchase.transporter;
  purchase.party = lrEntry.partyName || purchase.party;
  purchase.inwardDate = lrEntry.inwardDate || purchase.inwardDate;
  purchase.hundekari = lrEntry.hundekari;
  purchase.transportCharges = Number(lrEntry.transportCharges || 0);
  purchase.hamaliCharges = Number(lrEntry.hamaliCharges || 0);
  purchase.narration = lrEntry.narration;
  purchase.firm = lrEntry.firmName || purchase.firm;
  purchase.billNo = lrEntry.billNo || purchase.billNo;
  await purchase.save();
  return purchase;
};

const upsertLrEntryFromPurchase = async (purchase, userId, session = null) => {
  if (!purchase?.lrId) {
    return null;
  }

  return LrEntry.findOneAndUpdate(
    { lrId: purchase.lrId },
    {
      ...buildLrPayload(purchase),
      createdBy: userId,
      updatedBy: userId
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
      runValidators: true,
      session
    }
  );
};

const normalizePurchasePayload = async (incomingData) => {
  const purchaseData = { ...incomingData };
  purchaseData.items = await normalizePurchaseItems(purchaseData.items);
  purchaseData.received = Boolean(purchaseData.received);
  purchaseData.billVarianceAllowed = Boolean(purchaseData.billVarianceAllowed);
  purchaseData.varianceAmount = round2(purchaseData.varianceAmount);
  purchaseData.bale = Number(purchaseData.bale || 0);
  purchaseData.billAmount = Number(purchaseData.billAmount || 0);
  purchaseData.transportCharges = Number(purchaseData.transportCharges || 0);
  purchaseData.hamaliCharges = Number(purchaseData.hamaliCharges || 0);
  purchaseData.discountTotal = Number(purchaseData.discountTotal || 0);
  purchaseData.addCharges = Number(purchaseData.addCharges || 0);
  purchaseData.gstRate = Number(purchaseData.gstRate || 0);
  purchaseData.commission = Number(purchaseData.commission || 0);
  purchaseData.packingRoundoff = Number(purchaseData.packingRoundoff || 0);
  purchaseData.subtotal = Number(purchaseData.subtotal || 0);
  purchaseData.taxableAmount = Number(purchaseData.taxableAmount || 0);
  purchaseData.cgst = Number(purchaseData.cgst || 0);
  purchaseData.sgst = Number(purchaseData.sgst || 0);
  purchaseData.igst = Number(purchaseData.igst || 0);
  purchaseData.totalGst = Number(purchaseData.totalGst || 0);
  purchaseData.finalTotal = Number(purchaseData.finalTotal || 0);
  purchaseData.netQty = Number(purchaseData.netQty || 0);
  purchaseData.party = normalizeText(purchaseData.party);
  purchaseData.transporter = normalizeText(purchaseData.transporter);
  purchaseData.firm = normalizeText(purchaseData.firm);
  purchaseData.supplier = normalizeText(purchaseData.supplier);
  purchaseData.agent = normalizeText(purchaseData.agent);
  purchaseData.supplierAgent = normalizeText(purchaseData.supplierAgent);
  purchaseData.billNo = normalizeText(purchaseData.billNo);
  purchaseData.deliveryChallan = normalizeText(purchaseData.deliveryChallan);
  purchaseData.lrId = normalizeText(purchaseData.lrId);
  purchaseData.lrNo = normalizeText(purchaseData.lrNo);
  purchaseData.godown = normalizeText(purchaseData.godown);
  purchaseData.hundekari = normalizeText(purchaseData.hundekari);
  purchaseData.narration = normalizeText(purchaseData.narration);
  purchaseData.attachments = sanitizeAttachments(purchaseData.attachments);
  Object.assign(purchaseData, sanitizeHeaderIds(purchaseData));
  return purchaseData;
};

const getPartyInsightsData = async (partyName = "") => {
  const normalizedParty = normalizeText(partyName);
  if (!normalizedParty) {
    return {
      lastBillNo: "",
      lastBillDate: null,
      lastBillAmount: 0,
      outstandingApprox: 0
    };
  }

  const lastPurchase = await Purchase.findOne({ party: normalizedParty }).sort({ billDate: -1, createdAt: -1 }).lean();
  return {
    lastBillNo: lastPurchase?.billNo || "",
    lastBillDate: lastPurchase?.billDate || null,
    lastBillAmount: Number(lastPurchase?.finalTotal || lastPurchase?.billAmount || 0),
    outstandingApprox: 0
  };
};

export const previewPurchaseBillScan = async (req, res) => {
  try {
    const attachment = req.body?.attachment || {};
    const ocrResult = req.body?.text ? { text: "", warning: "" } : await runLocalPurchaseBillOcr(attachment);
    const sourceText = [
      attachment.name,
      ocrResult.text,
      req.body?.text,
      req.body?.notes
    ].filter(Boolean).join("\n");
    const parsedScan = parsePurchaseBillScanSource(sourceText);

    const parties = await Party.find({ partyType: { $in: ["party", "supplierAgent"] } }).select("name gstNo stateCode").lean();
    const matchedParty = parties.find((entry) => (
      entry.name && sourceText.toLowerCase().includes(String(entry.name).toLowerCase())
    ));

    const extracted = {
      party: matchedParty?.name || parsedScan.party,
      partyId: matchedParty?._id || "",
      partyGstNo: matchedParty?.gstNo || "",
      partyStateCode: matchedParty?.stateCode || "",
      billNo: parsedScan.billNo,
      billDate: parsedScan.billDate,
      billAmount: parsedScan.billAmount,
      items: parsedScan.items
    };

    const filledFields = [
      extracted.party,
      extracted.billNo,
      extracted.billDate,
      extracted.billAmount,
      extracted.items.length
    ].filter(Boolean).length;
    const confidenceScore = Math.min(0.86, 0.22 + (filledFields * 0.11) + (ocrResult.text ? 0.12 : 0));
    const warnings = [
      "Review all extracted values before saving the purchase.",
      ocrResult.warning,
      ocrResult.text
        ? "Parsed with local OCR from the attached bill image."
        : req.body?.text
        ? "Parsed from supplied OCR text and attachment metadata."
        : "AI/OCR provider is not configured yet, so only attachment metadata was inspected."
    ].filter(Boolean);

    return res.status(200).json({
      success: true,
      message: "Purchase bill scan preview created",
      data: {
        status: "review_required",
        confidenceScore,
        extracted,
        attachment: {
          name: normalizeScanText(attachment.name),
          mimeType: normalizeScanText(attachment.mimeType),
          size: Number(attachment.size || 0)
        },
        warnings
      }
    });
  } catch (err) {
    console.error("Purchase Bill Scan Preview Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to preview purchase bill scan",
      error: err.message
    });
  }
};

export const checkDuplicatePurchaseBill = async (req, res) => {
  try {
    const duplicate = await findDuplicatePurchaseBill({
      party: req.query.party,
      billNo: req.query.billNo,
      billDate: req.query.billDate,
      excludeId: req.query.excludeId,
    });

    return res.status(200).json({
      success: true,
      data: {
        duplicate: Boolean(duplicate),
        record: duplicate || null,
        message: duplicate
          ? `Duplicate bill found for ${duplicate.party} / ${duplicate.billNo}.`
          : "No duplicate bill found."
      }
    });
  } catch (err) {
    console.error("Duplicate Purchase Bill Check Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to check duplicate bill",
      error: err.message
    });
  }
};

export const getNextGrnNo = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: { grnNo: await getNextGrnNoValue() }
    });
  } catch (err) {
    console.error("Get Next GRN Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to generate GRN",
      error: err.message
    });
  }
};

export const getNextLrId = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: { lrId: await getNextLrIdValue() }
    });
  } catch (err) {
    console.error("Get Next LR ID Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to generate LR ID",
      error: err.message
    });
  }
};

export const createPurchase = async (req, res) => {
  try {
    const purchaseData = await normalizePurchasePayload(req.body);
    purchaseData.items = mergeExistingItemState(purchaseData.items, [], purchaseData.received);
    Object.assign(purchaseData, synchronizePurchaseState(purchaseData));
    purchaseData.grnNo = normalizeText(purchaseData.grnNo) || await getNextGrnNoValue(new Date(purchaseData.receiveDate || Date.now()));
    purchaseData.createdBy = req.user?._id;

    const { errors, varianceAmount } = validatePurchasePayload(purchaseData, {
      allowVariance: purchaseData.billVarianceAllowed
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors
      });
    }

    purchaseData.varianceAmount = varianceAmount;
    await ensureNoDuplicateBill(purchaseData);

    const purchase = await createPurchaseRecord({
      purchaseData,
      afterCreate: async ({ purchase }) => {
        await upsertLrEntryFromPurchase(purchase, req.user?._id);
      }
    });
    await createAuditLog({
      module: "purchase",
      action: "CREATE",
      entityType: "Purchase",
      entityId: purchase._id,
      summary: `Created purchase ${purchase.billNo}`,
      after: purchase.toObject(),
      user: req.user
    });

    return res.status(201).json({
      success: true,
      message: "Purchase created. Inventory will update after label printing.",
      data: purchase,
    });
  } catch (err) {
    console.error("Create Purchase Error:", err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: "Failed to create purchase",
      error: err.message,
      duplicate: err.duplicate || null,
    });
  }
};

export const updatePurchase = async (req, res) => {
  try {
    const { billId } = req.params;
    const existingPurchase = await Purchase.findById(billId);

    if (!existingPurchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    const purchaseData = await normalizePurchasePayload(req.body);
    purchaseData.grnNo = normalizeText(purchaseData.grnNo) || existingPurchase.grnNo;
    purchaseData.received = typeof purchaseData.received === "boolean"
      ? purchaseData.received
      : existingPurchase.received;
    purchaseData.items = mergeExistingItemState(
      purchaseData.items,
      existingPurchase.items || [],
      purchaseData.received
    );
    Object.assign(
      purchaseData,
      synchronizePurchaseState({
        ...purchaseData,
        labelsPrinted: typeof purchaseData.labelsPrinted === "boolean"
          ? purchaseData.labelsPrinted
          : existingPurchase.labelsPrinted,
      })
    );

    const { errors, varianceAmount } = validatePurchasePayload(purchaseData, {
      allowVariance: purchaseData.billVarianceAllowed
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors
      });
    }

    purchaseData.varianceAmount = varianceAmount;
    const updatedPurchase = await runInTransaction(async (session) => {
      await ensureNoDuplicateBill({ ...purchaseData, excludeId: billId }, session);

      const purchaseRecord = await Purchase.findByIdAndUpdate(
        billId,
        purchaseData,
        { returnDocument: "after", runValidators: true, session }
      )
        .populate({
          path: "items.itemId",
          populate: [
            { path: "category", select: "name" },
            { path: "brand", select: "name" }
          ]
        })
        .populate("items.category", "name")
        .populate("items.brand", "name");

      await syncPurchaseArtifacts(
        purchaseRecord._id,
        existingPurchase.items || [],
        purchaseRecord.items || [],
        {
          reconcileStock: Boolean(existingPurchase.received),
          session
        }
      );

      await upsertLrEntryFromPurchase(purchaseRecord, req.user?._id, session);
      return purchaseRecord;
    });

    await createAuditLog({
      module: "purchase",
      action: "UPDATE",
      entityType: "Purchase",
      entityId: updatedPurchase._id,
      summary: `Updated purchase ${updatedPurchase.billNo}`,
      before: existingPurchase.toObject(),
      after: updatedPurchase.toObject(),
      user: req.user
    });

    return res.status(200).json({
      success: true,
      message: "Purchase updated successfully",
      data: updatedPurchase,
    });
  } catch (err) {
    console.error("Update Purchase Error:", err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: "Failed to update purchase",
      error: err.message,
      duplicate: err.duplicate || null,
    });
  }
};

export const updatePurchaseLrDetails = async (req, res) => {
  try {
    const { billId } = req.params;
    const purchase = await Purchase.findById(billId);

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found"
      });
    }

    const patch = {
      lrNo: normalizeText(req.body.lrNo),
      bale: Number(req.body.bale || purchase.bale || 0),
      godown: normalizeText(req.body.godown),
      transporter: normalizeText(req.body.transporter),
      transporterId: req.body.transporterId || purchase.transporterId,
      party: normalizeText(req.body.partyName) || purchase.party,
      partyId: req.body.partyId || purchase.partyId,
      inwardDate: req.body.inwardDate || undefined,
      hundekari: normalizeText(req.body.hundekari),
      transportCharges: Number(req.body.transportCharges || 0),
      hamaliCharges: Number(req.body.hamaliCharges || 0),
      narration: normalizeText(req.body.narration),
      firm: normalizeText(req.body.firmName) || purchase.firm,
      firmId: req.body.firmId || purchase.firmId,
      billNo: normalizeText(req.body.billNo) || purchase.billNo
    };

    const before = purchase.toObject();
    Object.assign(purchase, patch);
    await purchase.save();

    if (purchase.lrId) {
      await LrEntry.findOneAndUpdate(
        { lrId: purchase.lrId },
        {
          ...buildLrPayload({
            ...patch,
            lrId: purchase.lrId
          }),
          updatedBy: req.user?._id
        },
        {
          upsert: true,
          returnDocument: "after",
          setDefaultsOnInsert: true
        }
      );
    }

    await createAuditLog({
      module: "purchase",
      action: "LR_UPDATE",
      entityType: "Purchase",
      entityId: purchase._id,
      summary: `Updated LR details for ${purchase.billNo}`,
      before,
      after: purchase.toObject(),
      user: req.user
    });

    return res.status(200).json({
      success: true,
      message: "LR details updated successfully",
      data: purchase
    });
  } catch (err) {
    console.error("Update Purchase LR Details Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update LR details",
      error: err.message
    });
  }
};

export const createOrUpdateLrEntry = async (req, res) => {
  try {
    const payload = buildLrPayload(req.body);
    payload.lrId = payload.lrId || await getNextLrIdValue();
    const existingEntry = await LrEntry.findOne({ lrId: payload.lrId }).lean();

    const lrEntry = await LrEntry.findOneAndUpdate(
      { lrId: payload.lrId },
      {
        ...payload,
        createdBy: req.user?._id,
        updatedBy: req.user?._id
      },
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
        runValidators: true
      }
    );

    const linkedPurchases = await Purchase.find({ lrId: payload.lrId });
    for (const purchase of linkedPurchases) {
      await syncPurchaseFromLrEntry(purchase, lrEntry);
    }

    await createAuditLog({
      module: "purchase",
      action: existingEntry ? "LR_ENTRY_UPDATE" : "LR_ENTRY_CREATE",
      entityType: "LrEntry",
      entityId: lrEntry._id,
      summary: `${existingEntry ? "Updated" : "Created"} LR ${lrEntry.lrId}`,
      before: existingEntry,
      after: lrEntry.toObject ? lrEntry.toObject() : lrEntry,
      user: req.user
    });

    return res.status(200).json({
      success: true,
      message: "LR details saved successfully",
      data: lrEntry
    });
  } catch (err) {
    console.error("Create Or Update LR Entry Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to save LR details",
      error: err.message
    });
  }
};

export const getLrEntryById = async (req, res) => {
  try {
    const lrId = normalizeText(req.params.lrId);
    const lrEntry = await LrEntry.findOne({ lrId }).lean();
    if (!lrEntry) {
      return res.status(404).json({
        success: false,
        message: "No LR entry found"
      });
    }

    return res.status(200).json({
      success: true,
      data: lrEntry
    });
  } catch (err) {
    console.error("Get LR Entry By ID Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch LR entry",
      error: err.message
    });
  }
};

export const deletePurchase = async (req, res) => {
  try {
    const { billId } = req.params;
    const deletedPurchase = await Purchase.findByIdAndDelete(billId);

    if (!deletedPurchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    await createAuditLog({
      module: "purchase",
      action: "DELETE",
      entityType: "Purchase",
      entityId: deletedPurchase._id,
      summary: `Deleted purchase ${deletedPurchase.billNo}`,
      before: deletedPurchase.toObject(),
      user: req.user
    });

    return res.status(200).json({
      success: true,
      message: "Purchase deleted successfully",
    });
  } catch (err) {
    console.error("Delete Purchase Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete purchase",
      error: err.message,
    });
  }
};

export const getPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find()
      .populate({
        path: "items.itemId",
        populate: [
          { path: "category", select: "name hsn" },
          { path: "brand", select: "name hsn unit defaultPurchaseRate" }
        ]
      })
      .populate("items.category", "name hsn")
      .populate("items.brand", "name")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: purchases
    });
  } catch (err) {
    console.error("Get Purchases Error FULL:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

export const getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.billId)
      .populate("items.itemId")
      .populate("items.category", "name hsn")
      .populate("items.brand", "name")
      .lean();

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: purchase
    });
  } catch (err) {
    console.error("Get Purchase By ID Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch purchase",
      error: err.message
    });
  }
};

export const getPurchaseByLrId = async (req, res) => {
  try {
    const lrId = normalizeText(req.params.lrId);
    const lrEntry = await LrEntry.findOne({ lrId }).lean();
    const purchase = await Purchase.findOne({ lrId })
      .populate("items.category", "name hsn")
      .populate("items.brand", "name")
      .sort({ createdAt: -1 })
      .lean();

    if (!purchase && !lrEntry) {
      return res.status(404).json({
        success: false,
        message: "No LR details found for this LR ID"
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        lrEntry,
        purchase
      }
    });
  } catch (err) {
    console.error("Get Purchase By LR ID Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch purchase by LR ID",
      error: err.message,
    });
  }
};

export const getPurchasePartyInsights = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: await getPartyInsightsData(req.query.party || "")
    });
  } catch (err) {
    console.error("Get Purchase Party Insights Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch party insights",
      error: err.message
    });
  }
};

export const receivePurchase = async (req, res) => {
  try {
    const { billId } = req.params;
    const purchase = await Purchase.findById(billId);

    if (!purchase) {
      return res.status(404).json({ success: false, message: "Purchase not found" });
    }

    if (purchase.received) {
      return res.status(400).json({ success: false, message: "Already received" });
    }

    const before = purchase.toObject();
    const updatedPurchase = await runInTransaction(async (session) => {
      const purchaseRecord = await Purchase.findById(billId).session(session);

      if (!purchaseRecord) {
        throw new Error("Purchase not found");
      }
      if (purchaseRecord.received) {
        throw new Error("Already received");
      }

      purchaseRecord.received = true;
      purchaseRecord.items = (purchaseRecord.items || []).map((item) => ({
        ...item.toObject(),
        received: true,
        printedLabels: Number(item.printedLabels || 0),
        labelsPrinted: Number(item.printedLabels || 0) >= Number(item.qty || 0) || Boolean(item.labelsPrinted),
      }));

      await receivePurchaseIntoInventory(purchaseRecord.items || [], { session });
      await purchaseRecord.save({ session });
      return purchaseRecord;
    });

    await createAuditLog({
      module: "purchase",
      action: "RECEIVE",
      entityType: "Purchase",
      entityId: updatedPurchase._id,
      summary: `Marked purchase ${updatedPurchase.billNo} as received`,
      before,
      after: updatedPurchase.toObject(),
      user: req.user
    });

    return res.status(200).json({
      success: true,
      message: "Purchase received and inventory updated successfully",
      data: updatedPurchase,
    });
  } catch (err) {
    console.error("Receive Purchase Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to receive purchase",
      error: err.message,
    });
  }
};
