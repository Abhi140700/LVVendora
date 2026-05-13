export const PURCHASE_RETURN_HOLD_KEY = "purchaseReturnHoldDraftsV1";

export const asNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const round2 = (value) => Math.round(asNumber(value) * 100) / 100;

export const formatDateInput = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return new Date().toISOString().slice(0, 10);
    }
    return date.toISOString().slice(0, 10);
};

export const formatDateDisplay = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-GB");
};

export const getStoredReturnDrafts = () => {
    try {
        const parsed = JSON.parse(localStorage.getItem(PURCHASE_RETURN_HOLD_KEY) || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error("Failed to read purchase return drafts", error);
        return [];
    }
};

export const saveStoredReturnDrafts = (drafts) => {
    localStorage.setItem(PURCHASE_RETURN_HOLD_KEY, JSON.stringify(drafts));
};

export const exportRowsAsSpreadsheet = (filename, columns, rows) => {
    const header = columns.join("\t");
    const body = rows.map((row) => row.map((value) => String(value ?? "")).join("\t")).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const printInWindow = (title, html) => {
    const printWindow = window.open("", "_blank", "width=1100,height=900");
    if (!printWindow) return false;
    printWindow.document.open();
    printWindow.document.write(`
        <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 18px; color: #111827; }
                    .header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 18px; }
                    .title { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
                    .meta { font-size: 12px; line-height: 1.5; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
                    th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
                    th { background: #f3f4f6; }
                    .totals { width: 320px; margin-left: auto; margin-top: 16px; }
                    .totals td:last-child { text-align: right; font-weight: 700; }
                    .footer { margin-top: 26px; font-size: 12px; display: flex; justify-content: space-between; }
                </style>
            </head>
            <body>${html}<script>window.print();</script></body>
        </html>
    `);
    printWindow.document.close();
    return true;
};

export const openPurchaseReturnPrint = (purchaseReturn, companyName) => {
    const itemsHtml = (purchaseReturn.items || []).map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${item.barcode || ""}</td>
            <td>${item.sourceBillNo || ""}</td>
            <td>${item.sourceGrnNo || ""}</td>
            <td>${item.name || ""}</td>
            <td>${item.boxNo || ""}</td>
            <td>${item.qty || 0}</td>
            <td>${asNumber(item.rate).toFixed(2)}</td>
            <td>${asNumber(item.amount).toFixed(2)}</td>
            <td>${asNumber(item.gstPercent).toFixed(2)}</td>
        </tr>
    `).join("");

    return printInWindow(
        `Purchase Return ${purchaseReturn.returnNo || ""}`,
        `
            <div class="header">
                <div>
                    <div class="title">${companyName}</div>
                    <div class="meta">
                        <div>Purchase Return / Debit Note</div>
                        <div>Party: ${purchaseReturn.party || "-"}</div>
                        <div>Firm: ${purchaseReturn.firm || "-"}</div>
                    </div>
                </div>
                <div class="meta">
                    <div><strong>Return No:</strong> ${purchaseReturn.returnNo || "-"}</div>
                    <div><strong>Debit Note No:</strong> ${purchaseReturn.debitNoteNo || "-"}</div>
                    <div><strong>Date:</strong> ${formatDateDisplay(purchaseReturn.returnDate)}</div>
                    <div><strong>LR No:</strong> ${purchaseReturn.lrNo || "-"}</div>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Sr.</th>
                        <th>Barcode</th>
                        <th>Bill No</th>
                        <th>GRN</th>
                        <th>Item Name</th>
                        <th>Box No</th>
                        <th>Qty</th>
                        <th>Rate</th>
                        <th>Amount</th>
                        <th>GST%</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            <table class="totals">
                <tbody>
                    <tr><td>Total Qty</td><td>${asNumber(purchaseReturn.totalQty).toFixed(2)}</td></tr>
                    <tr><td>Total Amount</td><td>${asNumber(purchaseReturn.totalAmount).toFixed(2)}</td></tr>
                    <tr><td>Discount</td><td>${asNumber(purchaseReturn.discountAmount).toFixed(2)}</td></tr>
                    <tr><td>GST</td><td>${asNumber(purchaseReturn.gstAmount).toFixed(2)}</td></tr>
                    <tr><td>Charges</td><td>${asNumber(purchaseReturn.addCharges).toFixed(2)}</td></tr>
                    <tr><td>Round Off</td><td>${asNumber(purchaseReturn.roundOff).toFixed(2)}</td></tr>
                    <tr><td>Net Amount</td><td>${asNumber(purchaseReturn.netAmount).toFixed(2)}</td></tr>
                </tbody>
            </table>
            <div class="footer">
                <div>Narration: ${purchaseReturn.narration || "-"}</div>
                <div>Authorized Signatory</div>
            </div>
        `
    );
};

export const openPurchaseReturnBarcodePrint = (purchaseReturn, companyName) => printInWindow(
    `Purchase Return Barcodes ${purchaseReturn.returnNo || ""}`,
    `
        <div class="title">${companyName}</div>
        <div class="meta">Purchase Return Barcode Sheet: ${purchaseReturn.returnNo || "-"}</div>
        <table>
            <thead>
                <tr>
                    <th>Sr.</th>
                    <th>Barcode</th>
                    <th>Item Name</th>
                    <th>Qty</th>
                    <th>Bill No</th>
                    <th>GRN</th>
                </tr>
            </thead>
            <tbody>
                ${(purchaseReturn.items || []).map((item, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${item.barcode || ""}</td>
                        <td>${item.name || ""}</td>
                        <td>${item.qty || 0}</td>
                        <td>${item.sourceBillNo || ""}</td>
                        <td>${item.sourceGrnNo || ""}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `
);
