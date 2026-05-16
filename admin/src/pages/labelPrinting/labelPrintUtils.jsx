import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { getCompanyAcronym } from "../../utils/appSettings";
import { normalizeUnit } from "../../utils/unit";

export function getLabelMetrics(labelSize = "50x25") {
    const [widthMm = 50, heightMm = 25] = String(labelSize || "50x25")
        .split("x")
        .map((value) => Number(value) || 0);

    return {
        widthMm,
        heightMm,
        jsBarcodeWidth: widthMm >= 50 ? 1.35 : 1.1,
        barcodeHeight: heightMm >= 25 ? 22 : 18,
    };
}

export function calculateMRP(purchaseRate, disc, per, gst = 5) {
    const base = purchaseRate - (purchaseRate * disc) / 100;
    const markup = base + (base * per) / 100;
    const mrp = markup + (markup * gst) / 100;
    return mrp.toFixed(2);
}

export function formatCurrency(value) {
    return `Rs. ${Number(value || 0).toFixed(2)}`;
}

export function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function getDisplayName(value, fallback = "") {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        const text = String(value).trim();
        return text && text.toLowerCase() !== "partyname" && text.toLowerCase() !== "party name"
            ? text
            : fallback;
    }
    if (typeof value === "object") {
        return getDisplayName(
            value.name || value.partyName || value.displayName || value.label || value.title || value.companyName || value._id,
            fallback,
        );
    }
    return fallback;
}

export function getDiscountPercent(mrp, saleRate) {
    const mrpValue = Number(mrp || 0);
    const saleValue = Number(saleRate || 0);

    if (!mrpValue || saleValue <= 0 || saleValue >= mrpValue) {
        return 0;
    }
    if (mrpValue < 0 || saleValue < 0) return 0;

    return Math.round(((mrpValue - saleValue) / mrpValue) * 100);
}

export function normalizeBarcodeFormat(format = "CODE128", value = "") {
    const requestedFormat = String(format || "CODE128").toUpperCase();
    const trimmedValue = String(value || "").trim();

    if (requestedFormat === "EAN13") {
        const digits = trimmedValue.replace(/\D/g, "");
        if (digits.length === 12 || digits.length === 13) {
            return { format: "EAN13", value: digits.slice(0, 13) };
        }
    }

    return {
        format: "CODE128",
        value: trimmedValue.replace(/[^\x20-\x7E]/g, ""),
    };
}

function createSeededDigits(source, salt) {
    const input = `${salt}:${source}`;
    let seed = 0;

    for (let index = 0; index < input.length; index += 1) {
        seed = (seed * 31 + input.charCodeAt(index)) % 100;
    }

    return String(seed).padStart(2, "0");
}

export function buildReferenceCode({ row, billNo }) {
    const seedSource = [
        row?.itemId || row?._id || row?.name || "",
        row?.designNo || "",
        billNo || "",
        row?.qty || 0,
    ].join("|");
    const prefix = createSeededDigits(seedSource, "prefix");
    const suffix = createSeededDigits(seedSource, "suffix");
    const purchaseRateCore = String(Math.max(0, Math.round(Number(row?.purchaseRate || 0) * 2)));
    return `${prefix}${purchaseRateCore}${suffix}`;
}

export function buildRows(items) {
    return items.map((item) => {
        const unit = normalizeUnit(item.unit || null);
        const itemQty = Number(item.qty || 1);
        const printedLabels = Number(item.printedLabels || 0);
        const isMeterItem = ["MTR", "MTRS", "METER", "METERS"].includes(unit);
        const defaultSalesQty = item.defQty || item.defaultSalesQty || (isMeterItem ? itemQty : 1);
        const labelsToPrint = Math.max(isMeterItem ? 1 : Math.ceil(itemQty - printedLabels), 0);
        const calculatedMrp = calculateMRP(
            item.purchaseRate || 0,
            item.discount || 0,
            item.percentage || 0,
        );
        const resolvedMrp = Number(item.mrp || calculatedMrp || 0);
        const resolvedSaleRate = Number(item.saleRate || resolvedMrp || 0);

        return {
            ...item,
            category:
                item.category?._id ||
                item.categoryId ||
                (typeof item.category === "string" ? item.category : null),
            categoryObj:
                typeof item.category === "object"
                    ? item.category
                    : item.categoryObj ||
                    (item.categoryName
                        ? { name: item.categoryName }
                        : typeof item.category === "string"
                            ? { name: item.category }
                            : null),
            fabric: item.material || item.fabric || "",
            style: item.style || "",
            subStyle: item.subStyle || "",
            colour: item.color || item.colour || "",
            designNo: item.designNo || "",
            disc: item.discount || 0,
            per: item.percentage || 0,
            mrp: resolvedMrp,
            saleRate: resolvedSaleRate,
            commPercent: 0,
            commAmount: 0,
            defQty: defaultSalesQty,
            labels: labelsToPrint ? String(labelsToPrint) : "",
            printedLabels,
            remainingLabels: item.labelsPrinted ? 0 : labelsToPrint,
            barcode: String(item.barcode || "").replace(/[^\x20-\x7E]/g, ""),
            itemId: item.itemId?._id || item.itemId || item._id || null,
            brand:
                item.brand?._id ||
                item.brandId ||
                (typeof item.brand === "string" && /^[a-f\d]{24}$/i.test(item.brand)
                    ? item.brand
                    : null),
            brandName:
                item.brand?.name ||
                (typeof item.brand === "string" && !/^[a-f\d]{24}$/i.test(item.brand)
                    ? item.brand
                    : "") ||
                "",
            unit,
            copies: 1,
        };
    });
}

export function buildLabelDraft({ row, barcode, companyName, billNo, partyName }) {
    const normalizedBillNo = billNo || "-";
    const normalizedUnit = normalizeUnit(row?.unit || "PCS");
    const effectiveQty = Number(row?.qty || 1);
    const resolvedPartyName = getDisplayName(partyName, getDisplayName(row?.partyName, getDisplayName(row?.party, "")));

    return {
        productName: row?.name || row?.productName || "",
        barcode: String(barcode || row?.barcode || ""),
        mrp: Number(row?.mrp || 0),
        saleRate: Number(row?.saleRate || 0),
        designNo: row?.designNo || "",
        qtyText: `${effectiveQty} ${normalizedUnit}`,
        referenceCode: buildReferenceCode({ row, billNo: normalizedBillNo }),
        companyName: companyName || "Company",
        billNo: normalizedBillNo,
        billNumber: normalizedBillNo,
        partyName: resolvedPartyName,
    };
}

function buildQrSvgMarkup(value) {
    if (!value) {
        return "";
    }

    return renderToStaticMarkup(
        <QRCodeSVG
            value={String(value)}
            size={80}
            level="M"
            includeMargin={false}
            bgColor="#FFFFFF"
            fgColor="#000000"
        />,
    );
}

export function buildLabelPrintHtml({
    labels,
    labelSize,
    companyName,
    billNo,
    barcodeFormat,
}) {
    const metrics = getLabelMetrics(labelSize);
    const widthMm = metrics.widthMm || 50;
    const heightMm = metrics.heightMm || 25;
    const printerPageWidthMm = Math.min(widthMm, heightMm);
    const printerPageHeightMm = Math.max(widthMm, heightMm);
    const rotateForPrint = widthMm > heightMm;

    const labelMarkup = labels
        .map((label, index) => {
            const normalizedBarcode = normalizeBarcodeFormat(
                barcodeFormat,
                label.barcode,
            );
            const showSinglePrice =
                Number(label.mrp || 0) === Number(label.saleRate || 0);
            const priceMarkup = showSinglePrice
                ? `
                <div class="label-price-line">
                    <strong>MRP</strong>
                    <span>${escapeHtml(formatCurrency(label.mrp))}</span>
                </div>
                `
                : `
                <div class="label-price-line">
                    <strong>MRP</strong>
                    <span>${escapeHtml(formatCurrency(label.mrp))}</span>
                </div>
                `;
            const saleRateMarkup = showSinglePrice
                ? ""
                : `
                <div class="shipping-address to">
                    <div class="label-price-line">
                        <strong>Sale Rate</strong>
                        <span>${escapeHtml(formatCurrency(label.saleRate))}</span>
                    </div>
                </div>
                `;
            const partyName = getDisplayName(label.partyName, getDisplayName(label.party, getDisplayName(companyName, "")));
            const displayBillNo = label.billNo || billNo || "BILL-0001";
            return `
<div class="label ${index < labels.length - 1 ? "page-break" : ""}">
    <div class="label-sheet">
        <div class="shipping-label">
            <div class="shipping-label-logo">
                <div class="label-bill-party">
                    ${escapeHtml(partyName)} / ${escapeHtml(displayBillNo)}
                </div>
            </div>

            <div class="shipping-label-product">
                ${escapeHtml(label.productName || "-")}
            </div>

            <div class="shipping-address from ${showSinglePrice ? "shipping-address--single-price" : ""}">
                ${priceMarkup}
            </div>

            ${saleRateMarkup}

            <div class="shipping-qr-box">
                ${buildQrSvgMarkup(normalizedBarcode.value)}
            </div>

            <div class="shipping-barcode-box">
                <div class="shipping-barcode-code">${escapeHtml(normalizedBarcode.value)}</div>
                <svg class="barcode-svg shipping-barcode-bars" jsbarcode-format="${escapeHtml(normalizedBarcode.format)}" jsbarcode-value="${escapeHtml(normalizedBarcode.value)}" jsbarcode-displayvalue="false" jsbarcode-width="${metrics.jsBarcodeWidth}" jsbarcode-height="${metrics.barcodeHeight}"></svg>
            </div>

            <div class="shipping-icons-box" aria-label="Fabric care labels">
                <span class="shipping-icon" aria-label="Wash care">
                    <svg viewBox="0 0 32 32" role="img" aria-hidden="true">
                        <path d="M5 10h22l-2.5 14h-17z"></path>
                        <path d="M9 15c2.5-2 4.5 2 7 0s4.5 2 7 0"></path>
                    </svg>
                </span>
                <span class="shipping-icon" aria-label="Bleach care">
                    <svg viewBox="0 0 32 32" role="img" aria-hidden="true">
                        <path d="M16 6l12 20H4z"></path>
                    </svg>
                </span>
                <span class="shipping-icon" aria-label="Iron care">
                    <svg viewBox="0 0 32 32" role="img" aria-hidden="true">
                        <path d="M7 21h20l-3-9H11c-2.5 0-4 1.8-4 4z"></path>
                        <path d="M9 21v4h16v-4"></path>
                        <path d="M18 9h4"></path>
                    </svg>
                </span>
            </div>

            <div class="shipping-bottom-item">
                <div><strong>${escapeHtml(label.qtyText || "1")}</strong></div>
            </div>

            <div class="shipping-bottom-note">
                <div class="shipping-bottom-item border-0">
                    <span>${escapeHtml(label.referenceCode || normalizedBarcode.value || "Reference")}</span>
                </div>
            </div>
        </div>
    </div>
</div>
`;
        })
        .join("");

    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Label Print</title>
    <style>
@page {
    size: ${printerPageWidthMm}mm ${printerPageHeightMm}mm;
    margin: 0;
}

@media print {
    html, body {
        width: ${printerPageWidthMm}mm;
        height: ${printerPageHeightMm}mm;
    }

    body {
        margin: 0;
    }
}

html, body {
    margin: 0;
    padding: 0;
    width: ${printerPageWidthMm}mm;
    min-width: ${printerPageWidthMm}mm;
    max-width: ${printerPageWidthMm}mm;
    font-family: Arial, sans-serif;
    font-size: ${heightMm >= 25 ? "7px" : "6px"};
}

body {
    width: ${printerPageWidthMm}mm;
    min-height: ${printerPageHeightMm}mm;
    font-family: Arial, sans-serif;
}

.label {
    width: ${printerPageWidthMm}mm;
    height: ${printerPageHeightMm}mm;
    box-sizing: border-box;
    overflow: hidden;
    page-break-inside: avoid;
    position: relative;
}

.label.page-break {
    page-break-after: always;
}

.label-sheet {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
}

.shipping-label {
    width: ${widthMm}mm;
    height: ${heightMm}mm;
    display: grid;
    grid-template-columns: 1.04fr 0.92fr 0.74fr;
    grid-template-rows: 20.8% 29.4% 32.2% 17.6%;
    box-sizing: border-box;
    overflow: hidden;
    border: 0.16mm solid #111;
    border-radius: ${heightMm >= 25 ? "1.1mm" : "0.8mm"};
    background: #fff;
    color: #000;
    transform: ${rotateForPrint ? "rotate(-90deg) translateX(-100%)" : "none"};
    transform-origin: top left;
    position: absolute;
    top: 0;
    left: 0;
}

.shipping-label-logo,
.shipping-label-product {
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 0.14mm solid #111;
    font-size: ${heightMm >= 25 ? "1.05em" : "0.95em"};
    font-weight: 900;
    letter-spacing: 0.02em;
    line-height: 1;
    text-align: center;
}

.shipping-label-logo {
    grid-column: 1 / 2;
    border-right: 0.14mm solid #111;
}

.shipping-label-product {
    grid-column: 2 / 4;
}

.shipping-address {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    gap: 0;
    padding: 0.42mm 0.55mm;
    border-bottom: 0.14mm solid #111;
    font-size: 0.78em;
    line-height: 1.08;
    box-sizing: border-box;
}

.shipping-address.from {
    grid-column: 1 / 2;
    border-right: 0.14mm solid #111;
}

.shipping-address.from.shipping-address--single-price {
    grid-column: 1 / 3;
}

.shipping-address.to {
    grid-column: 2 / 3;
    border-right: 0.14mm solid #111;
}

.shipping-address strong {
    font-size: 0.72em;
    font-weight: 900;
    white-space: nowrap;
}

.shipping-address span {
    display: block;
    font-weight: 800;
}

.label-price-line {
    display: grid;
    grid-template-columns: minmax(8.8mm, auto) minmax(0, 1fr);
    align-items: center;
    gap: 0.5mm;
    width: 100%;
    min-width: 0;
}

.label-price-line strong {
    font-size: 0.75em;
    line-height: 1;
}

.label-price-line span {
    min-width: 0;
    font-size: 0.76em;
    font-weight: 900;
    line-height: 1;
    white-space: nowrap;
    text-align: right;
}

.shipping-qr-box {
    grid-column: 3 / 4;
    grid-row: 2 / 4;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.42mm;
    border-bottom: 0.14mm solid #111;
    box-sizing: border-box;
}

.shipping-qr-box svg {
    display: block;
    width: 100%;
    height: auto;
}

.shipping-barcode-box {
    grid-column: 1 / 2;
    grid-row: 3 / 5;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.42mm;
    padding: 0.45mm 0.65mm;
    border-right: 0.14mm solid #111;
    box-sizing: border-box;
}

.shipping-barcode-code {
    text-align: center;
    font-size: 0.72em;
    font-weight: 900;
    letter-spacing: 0.28em;
    white-space: nowrap;
}

.shipping-barcode-bars {
    display: block;
    width: 100%;
    height: 100%;
    min-height: ${heightMm >= 25 ? "3.8mm" : "3mm"};
}

.shipping-icons-box {
    grid-column: 2 / 3;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.38mm;
    align-items: center;
    padding: 0.45mm 0.55mm;
    border-bottom: 0.14mm solid #111;
    box-sizing: border-box;
}

.shipping-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 4.6mm;
    border: 0.14mm solid #111;
    border-radius: 0.12mm;
    color: #000;
    font-size: 1.35em;
    line-height: 1;
    font-weight: 700;
}

.shipping-icon svg {
    display: block;
    width: 72%;
    height: 72%;
    fill: none;
    stroke: #000;
    stroke-width: 2.15;
    stroke-linecap: round;
    stroke-linejoin: round;
}

.shipping-bottom-item,
.shipping-bottom-note {
    padding: 0.4mm 0.55mm;
    font-size: 0.52em;
    line-height: 1.1;
    box-sizing: border-box;
}

.shipping-bottom-item {
    grid-column: 2 / 3;
    border-right: 0.14mm solid #111;
}

.shipping-bottom-note {
    grid-column: 3 / 4;
}

.shipping-bottom-item strong,
.shipping-bottom-note strong {
    display: block;
    margin-bottom: 0.12mm;
    font-size: 0.66em;
    font-weight: 900;
}

.border-0 { border: 0 !important; }
</style>
</head>
<body>${labelMarkup}
</body>
</html>`;
}

export function getRowKey(item, index) {
    return item.itemId || item._id || `${item.name || "row"}-${index}`;
}

export function applyPrintedQtyToRows(rows, rowKey, printedQty) {
    const normalizedPrintedQty = Math.max(Number(printedQty || 0), 0);

    return rows.reduce((nextRows, row, index) => {
        if (getRowKey(row, index) !== rowKey) {
            nextRows.push(row);
            return nextRows;
        }

        const printedLabels = Math.max(Number(row.printedLabels || 0), 0) + normalizedPrintedQty;
        const remainingLabels = 0;
        if (remainingLabels !== 0) {
            nextRows.push({
                ...row,
                printedLabels,
                remainingLabels,
                labels: row.labels ?? "",
            });
        }
        return nextRows;
    }, []);
}
