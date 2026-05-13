import mongoose from "mongoose";
import Inventory from "../models/Inventory.js";
import Label from "../models/Label.js";
import Party from "../models/Party.js";
import Purchase from "../models/Purchase.js";
import PurchaseReturn from "../models/PurchaseReturn.js";
import { createAuditLog } from "../services/auditService.js";

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const round2 = (value) => Math.round(asNumber(value) * 100) / 100;

const buildNumericSequence = async (fieldName) => {
  const latest = await PurchaseReturn.findOne()
    .sort({ createdAt: -1 })
    .select(fieldName)
    .lean();

  const lastNumber = Number(String(latest?.[fieldName] || "").replace(/\D/g, "")) || 0;
  return String(lastNumber + 1);
};

const findInventoryRecord = async (label) => Inventory.findOne({
  $or: [
    { itemId: label.itemId },
    { _id: label.itemId }
  ]
});

const syncInventoryForReturn = async ({ label, qtyDelta }) => {
  if (!qtyDelta) return;

  const inventoryItem = await findInventoryRecord(label);
  if (!inventoryItem) return;

  inventoryItem.stock = Math.max(0, asNumber(inventoryItem.stock) - qtyDelta);
  inventoryItem.stockValue = round2(
    asNumber(inventoryItem.stock) * asNumber(inventoryItem.avgPurchaseRate || inventoryItem.purchaseRate)
  );
  await inventoryItem.save();
};

const syncLabelReturnedQty = async ({ labelId, qtyDelta }) => {
  if (!qtyDelta) return;
  const label = await Label.findById(labelId);
  if (!label) return;

  label.returnedQty = Math.max(0, asNumber(label.returnedQty) + qtyDelta);
  await label.save();
};

const resolvePurchaseItem = (purchase, label) => {
  const labelItemId = String(label.itemId || "");
  return (purchase.items || []).find((purchaseItem) => {
    if (purchaseItem.itemId && String(purchaseItem.itemId) === labelItemId) {
      return true;
    }
    return String(purchaseItem.name || "").trim().toLowerCase() === String(label.productName || "").trim().toLowerCase();
  }) || null;
};

const buildHeaderValues = ({ body = {}, purchase = {}, partyRecord = null }) => ({
  firm: String(body.firm || purchase.firm || "").trim(),
  party: String(body.party || purchase.party || "").trim(),
  partyId: body.partyId || purchase.partyId || partyRecord?._id || null,
  partyPhone: String(body.partyPhone || partyRecord?.phone || "").trim(),
  partyState: String(body.partyState || purchase.partyState || partyRecord?.state || "").trim(),
  shipTo: String(body.shipTo || "").trim(),
  transporterName: String(body.transporterName || purchase.transporter || "").trim(),
  transporterId: String(body.transporterId || purchase.transporterId || "").trim(),
  distanceKm: asNumber(body.distanceKm),
  transportMode: String(body.transportMode || "Road").trim() || "Road",
  vehicleType: String(body.vehicleType || "Regular").trim() || "Regular",
  lrNo: String(body.lrNo || purchase.lrNo || "").trim(),
  lrDate: body.lrDate ? new Date(body.lrDate) : null,
  vehicleNo: String(body.vehicleNo || "").trim(),
  narration: String(body.narration || purchase.narration || "").trim(),
  eWayBillNo: String(body.eWayBillNo || "").trim(),
  eInvoiceNo: String(body.eInvoiceNo || "").trim(),
  eInvoiceAckNo: String(body.eInvoiceAckNo || "").trim(),
  addCharges: round2(body.addCharges),
  roundOff: round2(body.roundOff),
  printBarcodeLabels: Boolean(body.printBarcodeLabels),
  debitNoteNo: String(body.debitNoteNo || "").trim(),
});

const resolveRequestedItems = async ({ items = [], existingReturn = null }) => {
  const existingQtyByLabelId = new Map(
    (existingReturn?.items || []).map((item) => [String(item.labelId), asNumber(item.qty)])
  );

  const resolvedItems = [];

  for (const item of items) {
    const labelId = String(item.labelId || "").trim();
    if (!labelId || !mongoose.Types.ObjectId.isValid(labelId)) {
      throw new Error("Each return row must include a valid label id.");
    }

    const label = await Label.findById(labelId)
      .populate("itemId", "name")
      .populate("category", "name")
      .lean();

    if (!label) {
      throw new Error(`Label not found for ${item.barcode || labelId}`);
    }

    const purchase = await Purchase.findById(label.billId)
      .populate("items.brand", "name")
      .lean();

    if (!purchase) {
      throw new Error(`Source purchase not found for barcode ${label.barcode}`);
    }

    const partyRecord = purchase.partyId
      ? await Party.findById(purchase.partyId).lean()
      : null;

    const inventoryItem = await Inventory.findOne({
      $or: [
        { itemId: label.itemId },
        { _id: label.itemId }
      ]
    })
      .populate("brand", "name")
      .lean();

    const purchaseItem = resolvePurchaseItem(purchase, label);
    const requestedQty = Math.max(1, asNumber(item.qty, 1));
    const allowedQty = Math.max(
      0,
      asNumber(label.qty) - asNumber(label.returnedQty) + asNumber(existingQtyByLabelId.get(String(label._id)))
    );

    if (requestedQty > allowedQty) {
      throw new Error(`Invalid return quantity for barcode ${label.barcode}. Available qty is ${allowedQty}.`);
    }

    const rate = round2(
      item.rate ?? purchaseItem?.purchaseRate ?? label.purchaseRate ?? label.price ?? inventoryItem?.purchaseRate ?? 0
    );
    const gstPercent = round2(item.gstPercent ?? label.gstPercent ?? 0);
    const discount = round2(item.discount ?? purchaseItem?.discount ?? 0);
    const commission = round2(item.commission ?? purchase.commission ?? 0);
    const amount = round2(requestedQty * rate);

    resolvedItems.push({
      header: {
        firm: purchase.firm || "",
        party: purchase.party || "",
        partyId: purchase.partyId || partyRecord?._id || null,
        partyPhone: partyRecord?.phone || "",
        partyState: purchase.partyState || partyRecord?.state || "",
      },
      label,
      purchase,
      partyRecord,
      documentItem: {
        labelId: label._id,
        itemId: label.itemId?._id || label.itemId,
        sourceBillId: purchase._id,
        sourcePurchaseItemId: purchaseItem?._id || null,
        barcode: label.barcode,
        sourceBillNo: purchase.billNo,
        sourceGrnNo: purchase.grnNo,
        brandName: item.brandName || purchaseItem?.brand?.name || inventoryItem?.brand?.name || label.brand || "",
        name: label.productName,
        boxNo: String(item.boxNo || "").trim(),
        qty: requestedQty,
        rate,
        amount,
        gstPercent,
        stockAtReturn: asNumber(item.stockAtReturn, asNumber(inventoryItem?.stock)),
        commission,
        discount,
      }
    });
  }

  return resolvedItems;
};

const summarizeItems = (items = [], addCharges = 0, roundOff = 0) => {
  const totalQty = round2(items.reduce((sum, item) => sum + asNumber(item.qty), 0));
  const totalAmount = round2(items.reduce((sum, item) => sum + asNumber(item.amount), 0));
  const discountAmount = round2(items.reduce((sum, item) => (
    sum + ((asNumber(item.rate) * asNumber(item.qty) * asNumber(item.discount)) / 100)
  ), 0));
  const taxableAmount = round2(totalAmount - discountAmount);
  const gstAmount = round2(items.reduce((sum, item) => (
    sum + ((asNumber(item.amount) * asNumber(item.gstPercent)) / 100)
  ), 0));
  const netAmount = round2(taxableAmount + gstAmount + asNumber(addCharges) + asNumber(roundOff));

  return {
    totalItems: items.length,
    totalQty,
    totalAmount,
    discountAmount,
    taxableAmount,
    gstAmount,
    netAmount,
  };
};

const rollbackReturnEffects = async (purchaseReturn) => {
  for (const item of purchaseReturn.items || []) {
    await syncLabelReturnedQty({ labelId: item.labelId, qtyDelta: -asNumber(item.qty) });
    const label = await Label.findById(item.labelId).lean();
    if (label) {
      await syncInventoryForReturn({ label, qtyDelta: -asNumber(item.qty) });
    }
  }
};

const applyReturnEffects = async (purchaseReturn) => {
  for (const item of purchaseReturn.items || []) {
    const label = await Label.findById(item.labelId).lean();
    if (!label) continue;
    await syncLabelReturnedQty({ labelId: item.labelId, qtyDelta: asNumber(item.qty) });
    await syncInventoryForReturn({ label, qtyDelta: asNumber(item.qty) });
  }
};

export const lookupPurchaseReturnBarcode = async (req, res) => {
  try {
    const barcode = String(req.params.barcode || "").trim();
    if (!barcode) {
      return res.status(400).json({ success: false, message: "Barcode is required" });
    }

    const label = await Label.findOne({ barcode })
      .populate("itemId", "name")
      .populate("category", "name")
      .lean();

    if (!label) {
      return res.status(404).json({ success: false, message: "Barcode not found in printed labels" });
    }

    const purchase = await Purchase.findById(label.billId)
      .populate("items.brand", "name")
      .lean();

    if (!purchase) {
      return res.status(404).json({ success: false, message: "Source purchase not found for this barcode" });
    }

    const partyRecord = purchase.partyId ? await Party.findById(purchase.partyId).lean() : null;
    const inventoryItem = await Inventory.findOne({
      $or: [
        { itemId: label.itemId },
        { _id: label.itemId }
      ]
    })
      .populate("brand", "name")
      .lean();

    const purchaseItem = resolvePurchaseItem(purchase, label);
    const remainingQty = Math.max(0, asNumber(label.qty) - asNumber(label.returnedQty));

    if (remainingQty <= 0) {
      return res.status(400).json({ success: false, message: "This barcode has already been fully returned" });
    }

    return res.status(200).json({
      success: true,
      data: {
        labelId: label._id,
        barcode: label.barcode,
        productName: label.productName,
        itemId: label.itemId?._id || label.itemId,
        category: inventoryItem?.category || label.category,
        brandName: purchaseItem?.brand?.name || inventoryItem?.brand?.name || label.brand || "",
        unit: inventoryItem?.unit || label.unit || "PC",
        purchaseRate: round2(inventoryItem?.purchaseRate || label.purchaseRate || 0),
        inventoryStock: asNumber(inventoryItem?.stock),
        remainingQty,
        party: purchase.party,
        partyId: purchase.partyId || partyRecord?._id || null,
        partyPhone: partyRecord?.phone || "",
        partyState: purchase.partyState || partyRecord?.state || "",
        firm: purchase.firm || "",
        billId: purchase._id,
        billNo: purchase.billNo,
        grnNo: purchase.grnNo,
        billDate: purchase.billDate,
        gstPercent: round2(label.gstPercent || 0),
        discount: round2(purchaseItem?.discount || 0),
        commission: round2(purchase.commission || 0),
        boxNo: "",
      }
    });
  } catch (err) {
    console.error("Lookup Purchase Return Barcode Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to lookup barcode",
      error: err.message
    });
  }
};

export const createPurchaseReturn = async (req, res) => {
  try {
    const returnDate = req.body.returnDate ? new Date(req.body.returnDate) : new Date();
    const requestItems = Array.isArray(req.body.items) ? req.body.items : [];

    if (requestItems.length === 0) {
      return res.status(400).json({ success: false, message: "At least one return item is required" });
    }

    const resolvedItems = await resolveRequestedItems({ items: requestItems });
    const groupedByParty = resolvedItems.reduce((map, entry) => {
      const key = `${entry.header.firm || ""}::${entry.header.party || ""}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(entry);
      return map;
    }, new Map());

    const createdReturns = [];

    for (const entries of groupedByParty.values()) {
      const firstEntry = entries[0];
      const headerValues = buildHeaderValues({
        body: req.body,
        purchase: firstEntry.purchase,
        partyRecord: firstEntry.partyRecord
      });

      const returnNo = await buildNumericSequence("returnNo");
      const debitNoteNo = headerValues.debitNoteNo || await buildNumericSequence("debitNoteNo");
      const items = entries.map((entry) => entry.documentItem);
      const totals = summarizeItems(items, headerValues.addCharges, headerValues.roundOff);

      const purchaseReturn = await PurchaseReturn.create({
        returnNo,
        debitNoteNo,
        returnDate,
        ...headerValues,
        ...firstEntry.header,
        items,
        ...totals,
        createdBy: req.user?._id,
        updatedBy: req.user?._id
      });

      await applyReturnEffects(purchaseReturn);
      await createAuditLog({
        module: "purchase-return",
        action: "CREATE",
        entityType: "PurchaseReturn",
        entityId: purchaseReturn._id,
        summary: `Created purchase return ${purchaseReturn.returnNo}`,
        after: purchaseReturn.toObject(),
        metadata: {
          returnNo: purchaseReturn.returnNo,
          debitNoteNo: purchaseReturn.debitNoteNo,
          party: purchaseReturn.party,
          totalQty: purchaseReturn.totalQty,
          netAmount: purchaseReturn.netAmount,
        },
        user: req.user,
      });

      createdReturns.push(purchaseReturn);
    }

    return res.status(201).json({
      success: true,
      message: createdReturns.length > 1
        ? `${createdReturns.length} purchase return bills created by party`
        : "Purchase return bill created",
      data: createdReturns
    });
  } catch (err) {
    console.error("Create Purchase Return Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to create purchase return",
      error: err.message
    });
  }
};

export const getPurchaseReturns = async (req, res) => {
  try {
    const { from, to, firm, party, barcode, search } = req.query;
    const filter = {};

    if (from || to) {
      filter.returnDate = {};
      if (from) filter.returnDate.$gte = new Date(from);
      if (to) {
        const endDate = new Date(to);
        endDate.setHours(23, 59, 59, 999);
        filter.returnDate.$lte = endDate;
      }
    }

    if (firm) {
      filter.firm = new RegExp(String(firm).trim(), "i");
    }

    if (party) {
      filter.party = new RegExp(String(party).trim(), "i");
    }

    if (barcode) {
      filter["items.barcode"] = String(barcode).trim();
    }

    if (search) {
      const query = new RegExp(String(search).trim(), "i");
      filter.$or = [
        { returnNo: query },
        { debitNoteNo: query },
        { party: query },
        { firm: query },
        { "items.barcode": query },
        { "items.sourceBillNo": query },
        { "items.sourceGrnNo": query },
      ];
    }

    const purchaseReturns = await PurchaseReturn.find(filter)
      .sort({ returnDate: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: purchaseReturns.length,
      data: purchaseReturns
    });
  } catch (err) {
    console.error("Get Purchase Returns Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch purchase returns",
      error: err.message
    });
  }
};

export const getPurchaseReturnById = async (req, res) => {
  try {
    const purchaseReturn = await PurchaseReturn.findById(req.params.returnId).lean();
    if (!purchaseReturn) {
      return res.status(404).json({ success: false, message: "Purchase return not found" });
    }

    return res.status(200).json({ success: true, data: purchaseReturn });
  } catch (err) {
    console.error("Get Purchase Return Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch purchase return",
      error: err.message
    });
  }
};

export const updatePurchaseReturn = async (req, res) => {
  try {
    const purchaseReturn = await PurchaseReturn.findById(req.params.returnId);
    if (!purchaseReturn) {
      return res.status(404).json({ success: false, message: "Purchase return not found" });
    }

    const before = purchaseReturn.toObject();
    const requestItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (requestItems.length === 0) {
      return res.status(400).json({ success: false, message: "At least one return item is required" });
    }

    const resolvedItems = await resolveRequestedItems({ items: requestItems, existingReturn: purchaseReturn });
    const uniqueHeaders = new Set(resolvedItems.map((entry) => `${entry.header.firm || ""}::${entry.header.party || ""}`));
    if (uniqueHeaders.size > 1) {
      return res.status(400).json({
        success: false,
        message: "One purchase return document can only contain items from the same party."
      });
    }

    const firstEntry = resolvedItems[0];
    const headerValues = buildHeaderValues({
      body: req.body,
      purchase: firstEntry.purchase,
      partyRecord: firstEntry.partyRecord
    });
    const items = resolvedItems.map((entry) => entry.documentItem);
    const totals = summarizeItems(items, headerValues.addCharges, headerValues.roundOff);

    await rollbackReturnEffects(purchaseReturn);

    purchaseReturn.returnDate = req.body.returnDate ? new Date(req.body.returnDate) : purchaseReturn.returnDate;
    purchaseReturn.debitNoteNo = headerValues.debitNoteNo || purchaseReturn.debitNoteNo || await buildNumericSequence("debitNoteNo");
    purchaseReturn.firm = headerValues.firm || firstEntry.header.firm;
    purchaseReturn.party = headerValues.party || firstEntry.header.party;
    purchaseReturn.partyId = headerValues.partyId || firstEntry.header.partyId || null;
    purchaseReturn.partyPhone = headerValues.partyPhone || firstEntry.header.partyPhone || "";
    purchaseReturn.partyState = headerValues.partyState || firstEntry.header.partyState || "";
    purchaseReturn.shipTo = headerValues.shipTo;
    purchaseReturn.transporterName = headerValues.transporterName;
    purchaseReturn.transporterId = headerValues.transporterId;
    purchaseReturn.distanceKm = headerValues.distanceKm;
    purchaseReturn.transportMode = headerValues.transportMode;
    purchaseReturn.vehicleType = headerValues.vehicleType;
    purchaseReturn.lrNo = headerValues.lrNo;
    purchaseReturn.lrDate = headerValues.lrDate;
    purchaseReturn.vehicleNo = headerValues.vehicleNo;
    purchaseReturn.narration = headerValues.narration;
    purchaseReturn.eWayBillNo = headerValues.eWayBillNo;
    purchaseReturn.eInvoiceNo = headerValues.eInvoiceNo;
    purchaseReturn.eInvoiceAckNo = headerValues.eInvoiceAckNo;
    purchaseReturn.addCharges = headerValues.addCharges;
    purchaseReturn.roundOff = headerValues.roundOff;
    purchaseReturn.printBarcodeLabels = headerValues.printBarcodeLabels;
    purchaseReturn.items = items;
    purchaseReturn.totalItems = totals.totalItems;
    purchaseReturn.totalQty = totals.totalQty;
    purchaseReturn.totalAmount = totals.totalAmount;
    purchaseReturn.discountAmount = totals.discountAmount;
    purchaseReturn.taxableAmount = totals.taxableAmount;
    purchaseReturn.gstAmount = totals.gstAmount;
    purchaseReturn.netAmount = totals.netAmount;
    purchaseReturn.updatedBy = req.user?._id;

    await purchaseReturn.save();
    await applyReturnEffects(purchaseReturn);

    await createAuditLog({
      module: "purchase-return",
      action: "UPDATE",
      entityType: "PurchaseReturn",
      entityId: purchaseReturn._id,
      summary: `Updated purchase return ${purchaseReturn.returnNo}`,
      before,
      after: purchaseReturn.toObject(),
      metadata: {
        returnNo: purchaseReturn.returnNo,
        debitNoteNo: purchaseReturn.debitNoteNo,
      },
      user: req.user,
    });

    return res.status(200).json({
      success: true,
      message: "Purchase return updated",
      data: purchaseReturn
    });
  } catch (err) {
    console.error("Update Purchase Return Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to update purchase return",
      error: err.message
    });
  }
};

export const deletePurchaseReturn = async (req, res) => {
  try {
    const purchaseReturn = await PurchaseReturn.findById(req.params.returnId);
    if (!purchaseReturn) {
      return res.status(404).json({ success: false, message: "Purchase return not found" });
    }

    const before = purchaseReturn.toObject();
    await rollbackReturnEffects(purchaseReturn);
    await PurchaseReturn.deleteOne({ _id: purchaseReturn._id });

    await createAuditLog({
      module: "purchase-return",
      action: "DELETE",
      entityType: "PurchaseReturn",
      entityId: purchaseReturn._id,
      summary: `Deleted purchase return ${purchaseReturn.returnNo}`,
      before,
      metadata: {
        returnNo: purchaseReturn.returnNo,
        debitNoteNo: purchaseReturn.debitNoteNo,
      },
      user: req.user,
    });

    return res.status(200).json({
      success: true,
      message: "Purchase return deleted"
    });
  } catch (err) {
    console.error("Delete Purchase Return Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete purchase return",
      error: err.message
    });
  }
};
