import Label from "../models/Label.js";
import Purchase from "../models/Purchase.js";
import Category from "../models/Category.js";
import { adjustStock } from "../controllers/inventoryController.js";
import { createAuditLog } from "../services/auditService.js";
import mongoose from "mongoose";
import { normalizeUnit } from "../utils/unit.js";

const BARCODE_START = 1000;

const getNextBarcodeNumber = async () => {
  const lastLabel = await Label.findOne({
    barcode: { $regex: "^[0-9]+$" }
  })
    .sort({ createdAt: -1, barcode: -1 })
    .select("barcode")
    .lean();

  const lastNumeric = Number(lastLabel?.barcode || 0);
  return lastNumeric >= BARCODE_START ? lastNumeric + 1 : BARCODE_START;
};

const resolveCategoryId = async (categoryValue) => {
  if (!categoryValue) {
    return null;
  }

  if (typeof categoryValue === "object" && categoryValue._id) {
    return categoryValue._id;
  }

  if (mongoose.Types.ObjectId.isValid(categoryValue)) {
    return categoryValue;
  }

  const categoryName = String(categoryValue).trim();
  if (!categoryName) {
    return null;
  }

  let category = await Category.findOne({ name: categoryName }).select("_id");
  if (!category) {
    category = await Category.create({ name: categoryName });
  }

  return category._id;
};

export const getNextBarcode = async (req, res) => {
  try {
    const nextBarcode = await getNextBarcodeNumber();
    return res.status(200).json({
      success: true,
      data: { nextBarcode: String(nextBarcode) }
    });
  } catch (err) {
    console.error("Get Next Barcode Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

export const createLabel = async (req, res) => {
  try {
    const {
      productName,
      barcode,
      price,
      mrp,
      saleRate,
      purchaseRate,
      qty,
      printQty,
      copies,
      markupPercent,
      gstPercent,
      category,
      itemId,
      billId,
      brand,
      unit,
      color,
      material,
      style,
      subStyle,
      designNo,
      printer,
      labelSize,
      skipInventorySync,
    } = req.body;

    if (!itemId || !productName || !qty || !billId) {
      return res.status(400).json({
        success: false,
        message: "itemId, productName, qty, and billId are required",
      });
    }

    const categoryId = await resolveCategoryId(category);
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    const numericQty = Number(qty);
    const numericPrintQty = Number(printQty !== undefined ? printQty : qty);
    const numericCopies = Math.max(Number(copies || 1), 1);
    if (!Number.isFinite(numericQty) || numericQty <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid quantity is required",
      });
    }
    if (!Number.isFinite(numericPrintQty) || numericPrintQty <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid print quantity is required",
      });
    }

    const numericPrice = Number(price || 0);
    const numericSaleRate = Number(saleRate !== undefined ? saleRate : price || 0);
    const numericMrp = Number(mrp !== undefined ? mrp : price || 0);
    const numericPurchaseRate = Number(
      purchaseRate !== undefined ? purchaseRate : price || 0
    );

    const purchase = await Purchase.findById(billId);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    let createdLabel;
    let resolvedBarcode = "";
    const requestedBarcode = String(barcode || "").trim();
    const existingLabelForBarcode = requestedBarcode
      ? await Label.findOne({ billId, itemId, barcode: requestedBarcode })
      : null;

    if (existingLabelForBarcode) {
      resolvedBarcode = existingLabelForBarcode.barcode;
      existingLabelForBarcode.productName = productName;
      existingLabelForBarcode.price = numericPrice;
      existingLabelForBarcode.saleRate = numericSaleRate;
      existingLabelForBarcode.purchaseRate = numericPurchaseRate;
      existingLabelForBarcode.mrp = numericMrp;
      existingLabelForBarcode.qty = numericQty;
      existingLabelForBarcode.category = categoryId;
      existingLabelForBarcode.brand = brand;
      existingLabelForBarcode.unit = normalizeUnit(unit);
      existingLabelForBarcode.color = color || existingLabelForBarcode.color || "";
      existingLabelForBarcode.material = material || existingLabelForBarcode.material || "";
      existingLabelForBarcode.style = style || existingLabelForBarcode.style || "";
      existingLabelForBarcode.subStyle = subStyle || existingLabelForBarcode.subStyle || "";
      existingLabelForBarcode.designNo = designNo || existingLabelForBarcode.designNo || "";
      existingLabelForBarcode.markupPercent = Number(markupPercent || 0);
      existingLabelForBarcode.gstPercent = Number(gstPercent || 0);
      existingLabelForBarcode.copiesPerPrint = numericCopies;
      existingLabelForBarcode.printer = printer || existingLabelForBarcode.printer || "default";
      existingLabelForBarcode.labelSize = labelSize || existingLabelForBarcode.labelSize || "50x25";
      existingLabelForBarcode.printedBy = req.user?._id;
      existingLabelForBarcode.printHistory.push({
        action: "PRINT",
        qty: numericPrintQty,
        copies: numericCopies,
        printer: printer || existingLabelForBarcode.printer || "default",
        labelSize: labelSize || existingLabelForBarcode.labelSize || "50x25",
        printedBy: req.user?._id,
      });
      await existingLabelForBarcode.save();
      createdLabel = existingLabelForBarcode;
    } else {
      let nextBarcode = requestedBarcode ? Number(requestedBarcode) : await getNextBarcodeNumber();
      if (!Number.isFinite(nextBarcode) || nextBarcode < BARCODE_START) {
        nextBarcode = await getNextBarcodeNumber();
      }

      resolvedBarcode = String(nextBarcode);

      const existingLabel = await Label.findOne({ barcode: resolvedBarcode }).select("barcode");
      if (existingLabel) {
        return res.status(400).json({
          success: false,
          message: `Barcode already exists: ${existingLabel.barcode}`,
        });
      }

      createdLabel = await Label.create({
        productName,
        barcode: resolvedBarcode,
        price: numericPrice,
        saleRate: numericSaleRate,
        purchaseRate: numericPurchaseRate,
        mrp: numericMrp,
        qty: numericQty,
        category: categoryId,
        itemId,
        billId,
        brand,
        unit: normalizeUnit(unit),
        color,
        material,
        style,
        subStyle,
        designNo,
        markupPercent: Number(markupPercent || 0),
        gstPercent: Number(gstPercent || 0),
        copiesPerPrint: numericCopies,
        printer: printer || "default",
        labelSize: labelSize || "50x25",
        printedBy: req.user?._id,
        printHistory: [{
          action: "PRINT",
          qty: numericPrintQty,
          copies: numericCopies,
          printer: printer || "default",
          labelSize: labelSize || "50x25",
          printedBy: req.user?._id,
        }],
      });
    }

    const itemIdString = String(itemId);
    const matchingItem = purchase.items.find((purchaseItem) => {
      if (purchaseItem.itemId && String(purchaseItem.itemId) === itemIdString) {
        return true;
      }
      return purchaseItem.name?.trim() === productName?.trim();
    });

    const itemStockQty = Number(matchingItem?.qty || 0);
    const shouldSyncFullItemStock = !skipInventorySync
      && !purchase.received
      && !Boolean(matchingItem?.received);
    const inventoryAdjustmentQty = shouldSyncFullItemStock ? itemStockQty : 0;

    const inventoryItem = await adjustStock({
      itemId,
      name: productName,
      category: categoryId,
      brand,
      barcode: resolvedBarcode,
      qty: inventoryAdjustmentQty,
      mrp: numericMrp,
      sellingRate: numericSaleRate,
      purchaseRate: numericPurchaseRate,
      unit,
    });

    if (matchingItem) {
      const normalizedMatchingUnit = normalizeUnit(matchingItem.unit || unit);
      const printedLabelTarget = ["MTR", "MTRS", "METER", "METERS"].includes(normalizedMatchingUnit)
        ? 1
        : Number(matchingItem.qty || 0);
      matchingItem.printedLabels = Number(matchingItem.printedLabels || 0) + numericPrintQty;
      matchingItem.labelsPrinted = Number(matchingItem.printedLabels || 0) >= printedLabelTarget;
      if (shouldSyncFullItemStock) {
        matchingItem.received = true;
      }
    }

    purchase.labelsPrinted = purchase.items.length > 0
      && purchase.items.every((purchaseItem) => purchaseItem.labelsPrinted);
    purchase.received = purchase.items.length > 0
      && purchase.items.every((purchaseItem) => purchaseItem.received);

    await purchase.save();
    await createAuditLog({
      module: "label",
      action: existingLabelForBarcode ? "PRINT_APPEND" : "PRINT_CREATE",
      entityType: "Label",
      entityId: createdLabel._id,
      summary: `${existingLabelForBarcode ? "Printed more labels for" : "Created label for"} ${createdLabel.productName}`,
      after: createdLabel.toObject(),
      metadata: {
        barcode: createdLabel.barcode,
        qty: numericPrintQty,
        defaultSalesQty: numericQty
      },
      user: req.user
    });

    const refreshedNextBarcode = await getNextBarcodeNumber();

    return res.status(201).json({
      success: true,
      message: purchase.labelsPrinted
        ? (purchase.received
          ? "Labels created, inventory synced, and bill completed"
          : "Labels created, inventory updated, and bill completed")
        : (purchase.received
          ? "Labels created and inventory synced"
          : "Labels created and inventory updated"),
      data: {
        labels: [createdLabel],
        inventory: inventoryItem,
        purchase: {
          _id: purchase._id,
          labelsPrinted: purchase.labelsPrinted,
          items: purchase.items,
        },
        barcodeRange: {
          start: createdLabel.barcode,
          end: createdLabel.barcode,
        },
        nextBarcode: String(refreshedNextBarcode),
      },
    });
  } catch (err) {
    console.error("Create Label Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const reprintLabel = async (req, res) => {
  try {
    const { labelId } = req.params;
    const { qty, copies, printer, labelSize, notes, mrp, saleRate, markupPercent, gstPercent } = req.body;

    const label = await Label.findById(labelId);
    if (!label) {
      return res.status(404).json({
        success: false,
        message: "Label not found",
      });
    }

    const numericQty = Number(qty || 1);
    const numericCopies = Math.max(Number(copies || 1), 1);
    if (!Number.isFinite(numericQty) || numericQty <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid reprint quantity is required",
      });
    }

    if (mrp !== undefined) {
      label.mrp = Number(mrp || 0);
    }
    if (saleRate !== undefined) {
      label.saleRate = Number(saleRate || 0);
      label.price = Number(saleRate || 0);
    }
    if (markupPercent !== undefined) {
      label.markupPercent = Number(markupPercent || 0);
    }
    if (gstPercent !== undefined) {
      label.gstPercent = Number(gstPercent || 0);
    }
    if (printer) {
      label.printer = printer;
    }
    if (labelSize) {
      label.labelSize = labelSize;
    }
    if (notes) {
      label.notes = notes;
    }
    if (label.category && !mongoose.Types.ObjectId.isValid(label.category)) {
      const resolvedCategoryId = await resolveCategoryId(label.category);
      if (resolvedCategoryId) {
        label.category = resolvedCategoryId;
      }
    }
    label.copiesPerPrint = numericCopies;
    label.printedBy = req.user?._id;
    label.printHistory.push({
      action: "REPRINT",
      qty: numericQty,
      copies: numericCopies,
      printer: printer || label.printer || "default",
      labelSize: labelSize || label.labelSize || "50x25",
      printedBy: req.user?._id,
    });

    await label.save();
    await createAuditLog({
      module: "label",
      action: "REPRINT",
      entityType: "Label",
      entityId: label._id,
      summary: `Reprinted label ${label.barcode}`,
      after: label.toObject(),
      metadata: {
        qty: numericQty,
        copies: numericCopies
      },
      user: req.user
    });

    return res.status(200).json({
      success: true,
      message: "Label reprint recorded",
      data: label,
    });
  } catch (err) {
    console.error("Reprint Label Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const getHistory = async (req, res) => {
  try {
    const { billId } = req.params;

    const labels = await Label.find({ billId })
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: labels,
    });
  } catch (err) {
    console.error("Label History Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const getLabelsByItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    const labels = await Label.find({ itemId })
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: labels,
    });
  } catch (err) {
    console.error("Get Labels Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
