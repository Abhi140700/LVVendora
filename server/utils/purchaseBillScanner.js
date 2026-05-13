import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const OCR_TIMEOUT_MS = 20000;
const OCR_MAX_BUFFER = 4 * 1024 * 1024;
const MAX_SCAN_ITEMS = 40;

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
export const normalizeScanText = (value = "") => String(value).trim();

export const parseScanDate = (value = "") => {
  const text = normalizeScanText(value);
  const isoMatch = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${String(isoMatch[2]).padStart(2, "0")}-${String(isoMatch[3]).padStart(2, "0")}`;
  }

  const indianMatch = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
  if (indianMatch) {
    return `${indianMatch[3]}-${String(indianMatch[2]).padStart(2, "0")}-${String(indianMatch[1]).padStart(2, "0")}`;
  }

  return "";
};

export const parseScanAmount = (value = "") => {
  const text = normalizeScanText(value).replace(/,/g, "");
  const netAmount = text.match(/net\s*(?:bill\s*)?amount(?:\s*payable)?\s*[:#-]?\s*(\d+(?:\.\d{1,2})?)/i);
  if (netAmount) {
    return Number(netAmount[1] || 0);
  }

  const totalInvoiceAmount = text.match(/total\s*invoice\s*amount[\s\S]{0,160}?(\d+(?:\.\d{1,2})?)/i);
  if (totalInvoiceAmount) {
    return Number(totalInvoiceAmount[1] || 0);
  }

  const labelledAmount = text.match(/(?:total|amount|net|rs\.?|inr)\s*[:#-]?\s*(\d+(?:\.\d{1,2})?)/i);
  if (labelledAmount) {
    return Number(labelledAmount[1] || 0);
  }

  const amounts = [...text.matchAll(/\b\d{3,}(?:\.\d{1,2})?\b/g)].map((match) => Number(match[0]));
  return amounts.length ? Math.max(...amounts) : 0;
};

export const parseScanBillNo = (value = "") => {
  const text = normalizeScanText(value);
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    if (/\b(?:invoice|inv)\s*(?:no\.?|number|#)\b/i.test(lines[index]) || /\b(?:invoice|inv)\s*[,.:=#-]+/i.test(lines[index])) {
      const sameLine = lines[index].match(/\b(?:invoice|inv)\s*(?:no\.?|number|#)\s*[,.:=#-]*\s*([A-Z0-9/-]{2,})/i)
        || lines[index].match(/\b(?:invoice|inv)\s*[,.:=#-]+\s*([A-Z0-9/-]{2,})/i);
      if (sameLine) {
        return sameLine[1];
      }

      const nextLine = lines[index + 1]?.match(/\b([A-Z0-9/-]{2,})\b/i);
      if (nextLine) {
        return nextLine[1];
      }
    }
  }

  const labelledBill = text.match(/\b(?:bill|invoice|inv|voucher)\s*(?:no\.?|number|#)\s*[:#-]?\s*([A-Z0-9/-]{2,})/i)
    || text.match(/\b(?:bill|invoice|inv|voucher)\s*[:#-]+\s*([A-Z0-9/-]{2,})/i);
  if (labelledBill) {
    return labelledBill[1];
  }

  const filenameToken = text.match(/\b(?:BILL|INV|PUR)[-_ ]?([A-Z0-9/-]{2,})\b/i);
  return filenameToken ? filenameToken[1] : "";
};

export const parseScanPartyName = (value = "") => {
  const lines = normalizeScanText(value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const ignored = /^(tax invoice|invoice|mobile|gstin|state name|details of|sr\.?no|bank|total|terms|for,?|authorised|net amount|office copy|page)/i;
  const topParty = lines.find((line) => (
    /^[A-Z][A-Z0-9&.,' -]{4,}$/.test(line)
    && !ignored.test(line)
    && !/\d{3,}/.test(line)
  ));

  if (topParty) {
    return topParty.replace(/\s{2,}/g, " ").trim();
  }

  const billedName = normalizeScanText(value).match(/(?:billed\s*to|receiver)[\s\S]{0,120}?name\s*[:#-]?\s*([A-Z0-9&.,' -]{3,})/i);
  return billedName ? billedName[1].split(/\r?\n/)[0].trim() : "";
};

const normalizeOcrHsn = (value = "") => normalizeScanText(value).replace(/^S/i, "5").replace(/O/g, "0");
const parseOcrNumber = (value = "") => {
  const parsed = Number(String(value).replace(/,/g, "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getRateFromAmount = (qty, scannedRate, amount) => {
  if (!qty || !amount) {
    return scannedRate || 0;
  }

  const computedRate = round2(amount / qty);
  return Math.abs(round2((scannedRate || 0) * qty) - amount) > 1 ? computedRate : scannedRate;
};

const createScanItem = ({ hsn, name, qty, unit, purchaseRate, amount, confidence }) => ({
  category: "",
  hsn: normalizeOcrHsn(hsn),
  brand: "",
  name: normalizeScanText(name).replace(/[^A-Z0-9&.,' -]/gi, ""),
  qty,
  unit,
  purchaseRate,
  discount: 0,
  amount,
  confidence,
  status: "needs_review"
});

const parseTaxInvoiceGridLine = (line = "") => {
  const normalizedLine = line.replace(/\s+/g, " ").trim();
  const rowMatch = normalizedLine.match(/^\s*(\d+)\s+(.+?)\s+([5S]\d{5,7})[}\]\s|]*(?:[A-Z0-9/-]+\s+)?(\d+(?:\.\d+)?)\s+(?:(\d+(?:\.\d+)?)\s+)?(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s*$/i);
  if (!rowMatch) {
    return null;
  }

  const [, , rawName, rawHsn, rawPcs, rawMtr, rawRate, rawGst, rawAmount] = rowMatch;
  const pcs = parseOcrNumber(rawPcs);
  const mtr = parseOcrNumber(rawMtr);
  const amount = parseOcrNumber(rawAmount);
  const scannedRate = parseOcrNumber(rawRate);
  const qty = mtr || pcs;
  const unit = mtr ? "MTRS" : "PCS";

  if (!rawName || !qty || !amount || parseOcrNumber(rawGst) > 28) {
    return null;
  }

  return createScanItem({
    hsn: rawHsn,
    name: rawName,
    qty,
    unit,
    purchaseRate: getRateFromAmount(qty, scannedRate, amount),
    amount,
    confidence: 0.74
  });
};

const parseDelimitedTextileLine = (line = "") => {
  const cleanedLine = line
    .replace(/[|[\]{}()]/g, " ")
    .replace(/[“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleanedLine.split(" ").filter(Boolean);
  const serialIndex = tokens.findIndex((token) => /^\d+\.?$|^[IT][._]?$/i.test(token));
  const hsnIndex = tokens.findIndex((token, index) => index > serialIndex && /^[5S]\d{3,7}$/i.test(token));

  if (serialIndex < 0 || hsnIndex <= serialIndex + 1) {
    return null;
  }

  const rawNumbers = tokens.slice(hsnIndex + 1).map(parseOcrNumber).filter((number) => number > 0);
  if (rawNumbers.length < 3) {
    return null;
  }

  const amount = rawNumbers.at(-1);
  const possibleGst = rawNumbers.at(-2);
  const hasGstColumn = possibleGst > 0 && possibleGst <= 28 && rawNumbers.length >= 4;
  const scannedRate = hasGstColumn ? rawNumbers.at(-3) : rawNumbers.at(-2);
  const qtyCandidates = rawNumbers.slice(0, hasGstColumn ? -3 : -2);
  const qty = qtyCandidates.length > 1 ? qtyCandidates.at(-1) : qtyCandidates[0];
  const name = tokens.slice(serialIndex + 1, hsnIndex).join(" ");

  if (!name || !qty || !scannedRate || amount < 1) {
    return null;
  }

  return createScanItem({
    hsn: tokens[hsnIndex],
    name,
    qty,
    unit: "MTRS",
    purchaseRate: getRateFromAmount(qty, scannedRate, amount),
    amount,
    confidence: 0.68
  });
};

const parseGenericDelimitedLine = (line = "") => {
  const cells = line.split(/\t|,/).map((cell) => cell.trim()).filter(Boolean);
  if (cells.length < 4) {
    return null;
  }

  const numericCells = cells.map(parseOcrNumber);
  const qtyIndex = numericCells.findIndex((number) => number > 0 && number < 10000);
  const rateIndex = numericCells.findIndex((number, index) => index !== qtyIndex && number > 0);

  return {
    category: cells[0] || "",
    hsn: /^\d{4,8}$/.test(cells[1] || "") ? cells[1] : "",
    brand: cells[2] || "",
    name: cells[3] || cells[0] || "",
    qty: qtyIndex >= 0 ? numericCells[qtyIndex] : 1,
    unit: "PCS",
    purchaseRate: rateIndex >= 0 ? numericCells[rateIndex] : 0,
    discount: 0,
    confidence: 0.52,
    status: "needs_review"
  };
};

export const parseScanItems = (value = "") => {
  const lines = normalizeScanText(value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const invoiceItems = lines
    .map((line) => parseTaxInvoiceGridLine(line) || parseDelimitedTextileLine(line))
    .filter(Boolean)
    .slice(0, MAX_SCAN_ITEMS);

  if (invoiceItems.length > 0) {
    return invoiceItems;
  }

  return lines.map(parseGenericDelimitedLine).filter(Boolean).slice(0, 25);
};

export const parsePurchaseBillScanSource = (sourceText = "") => ({
  party: parseScanPartyName(sourceText),
  billNo: parseScanBillNo(sourceText),
  billDate: parseScanDate(sourceText),
  billAmount: parseScanAmount(sourceText),
  items: parseScanItems(sourceText)
});

const getDataUrlPayload = (dataUrl = "") => {
  const match = normalizeScanText(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
};

const getAttachmentExtension = (mimeType = "") => {
  if (/png/i.test(mimeType)) return ".png";
  if (/jpe?g/i.test(mimeType)) return ".jpg";
  if (/webp/i.test(mimeType)) return ".webp";
  if (/gif/i.test(mimeType)) return ".gif";
  if (/tiff?/i.test(mimeType)) return ".tif";
  return ".img";
};

export const runLocalPurchaseBillOcr = async (attachment = {}) => {
  const payload = getDataUrlPayload(attachment.dataUrl);
  if (!payload || !payload.mimeType.startsWith("image/")) {
    return { text: "", warning: "Only image attachments can be OCR scanned locally right now." };
  }

  const tempFile = path.join(os.tmpdir(), `purchase-bill-${randomUUID()}${getAttachmentExtension(payload.mimeType)}`);
  try {
    await fs.writeFile(tempFile, payload.buffer);
    const outputs = await Promise.allSettled([
      execFileAsync("tesseract", [tempFile, "stdout", "--psm", "11"], { timeout: OCR_TIMEOUT_MS, maxBuffer: OCR_MAX_BUFFER }),
      execFileAsync("tesseract", [tempFile, "stdout", "--psm", "4"], { timeout: OCR_TIMEOUT_MS, maxBuffer: OCR_MAX_BUFFER })
    ]);
    const text = outputs
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value.stdout)
      .filter(Boolean)
      .join("\n");

    return text
      ? { text, warning: "" }
      : { text: "", warning: "Local OCR could not read text from this attachment." };
  } catch (error) {
    return { text: "", warning: `Local OCR failed: ${error.message}` };
  } finally {
    await fs.unlink(tempFile).catch(() => {});
  }
};
