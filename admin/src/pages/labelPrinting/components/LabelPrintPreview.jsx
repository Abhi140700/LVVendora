import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { getDisplayName } from "../labelPrintUtils.jsx";

const LabelPrintPreview = ({
    companyAcronym,
    previewLabelDraft,
    selectedItem,
    previewBarcodeRef,
    normalizedPreviewBarcode,
    previewIdentity,
    selectedItemHistory,
    selectedItemHistories = [],
    barcodeChoice,
    setBarcodeChoice,
    selectedHistoryEntry,
    nextBarcode,
}) => {
    const showSinglePrice =
        Number(previewLabelDraft?.mrp || selectedItem?.mrp || 0) ===
        Number(previewLabelDraft?.saleRate || selectedItem?.saleRate || 0);

    const productName = previewLabelDraft?.productName || selectedItem?.name || "Product Name";
    const barcodeValue = normalizedPreviewBarcode?.value || "";
    const mrpValue = previewLabelDraft?.mrp || selectedItem?.mrp || "0.00";
    const saleRateValue = previewLabelDraft?.saleRate || selectedItem?.saleRate || "0.00";
    const qtyText = previewLabelDraft?.qtyText || selectedItem?.qty || "";
    const partyName = getDisplayName(
        previewLabelDraft?.partyName,
        getDisplayName(selectedItem?.partyName, getDisplayName(selectedItem?.party, "")),
    );

    const billNumber =
        previewLabelDraft?.billNo ||
        previewLabelDraft?.billNumber ||
        selectedItem?.billNo ||
        selectedItem?.billNumber ||
        "BILL-0001";
    const referenceCode = previewLabelDraft?.referenceCode || selectedItem?.referenceCode || barcodeValue;


    return (
        <div className="workbench-preview-wrap label-print-modal__preview-grid">
            <div className="card workbench-panel app-card soft-card label-print-modal__preview-card">
                <div className="card-body p-1">
                    <div className="shipping-label-stage">
                        <div className="shipping-label label-print-modal__preview-sheet" aria-label="Shipping barcode label preview">
                            <div className="shipping-label-logo label-print-modal__sheet-brand">
                                <div className="label-print-modal__sheet-bill-party">
                                    {partyName || "Party"} / {billNumber}
                                </div>
                            </div>

                            <div className="shipping-label-product label-print-modal__sheet-name">
                                {productName}
                            </div>

                            <div className={`shipping-address from label-print-modal__sheet-pricing${showSinglePrice ? " shipping-address--single-price" : ""}`}>
                                <div className="label-print-modal__price-line">
                                    <strong>MRP</strong>
                                    <span>Rs. {mrpValue}</span>
                                </div>
                            </div>

                            {!showSinglePrice ? (
                                <div className="shipping-address to label-print-modal__sheet-qty">
                                    <div className="label-print-modal__price-line">
                                        <strong>Sale Rate</strong>
                                        <span>Rs. {saleRateValue}</span>
                                    </div>
                                </div>
                            ) : null}

                            <div className="shipping-qr-box label-print-modal__sheet-qr">
                                {barcodeValue ? (
                                    <QRCodeSVG
                                        value={barcodeValue}
                                        size={150}
                                        level="M"
                                        includeMargin={false}
                                        bgColor="#FFFFFF"
                                        fgColor="#000000"
                                        className="shipping-qr-img label-print-modal__sheet-qr-svg"
                                    />
                                ) : null}
                            </div>

                            <div className="shipping-barcode-box label-print-modal__sheet-barcode-box">
                                <div className="shipping-barcode-code label-print-modal__sheet-barcode-text">
                                    {barcodeValue}
                                </div>
                                <svg
                                    ref={previewBarcodeRef}
                                    className="shipping-barcode-bars label-print-modal__sheet-barcode-svg"
                                    aria-hidden="true"
                                />
                            </div>

                            <div className="shipping-icons-box" aria-label="Fabric care labels">
                                <span className="shipping-icon" aria-label="Wash care">
                                    <svg viewBox="0 0 32 32" role="img" aria-hidden="true">
                                        <path d="M5 10h22l-2.5 14h-17z" />
                                        <path d="M9 15c2.5-2 4.5 2 7 0s4.5 2 7 0" />
                                    </svg>
                                </span>
                                <span className="shipping-icon" aria-label="Bleach care">
                                    <svg viewBox="0 0 32 32" role="img" aria-hidden="true">
                                        <path d="M16 6l12 20H4z" />
                                    </svg>
                                </span>
                                <span className="shipping-icon" aria-label="Iron care">
                                    <svg viewBox="0 0 32 32" role="img" aria-hidden="true">
                                        <path d="M7 21h20l-3-9H11c-2.5 0-4 1.8-4 4z" />
                                        <path d="M9 21v4h16v-4" />
                                        <path d="M18 9h4" />
                                    </svg>
                                </span>
                            </div>

                            <div className="shipping-bottom-item label-print-modal__sheet-identity">
                                <div>
                                    <strong>{qtyText || "1"}</strong>
                                </div>
                            </div>

                            <div className="shipping-bottom-note">
                                <div className="shipping-bottom-item label-print-modal__sheet-identity border-0">
                                    <span>{referenceCode || "Reference"}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card workbench-panel barcode-choice-panel app-card label-print-modal__preview-card">
                <div className="card-body">
                    <h3>Barcode selection</h3>
                    <select className="form-select" value={barcodeChoice} onChange={(event) => setBarcodeChoice?.(event.target.value)}>
                        <option value="new">{barcodeValue || nextBarcode || "Next barcode"}</option>
                        {selectedItemHistories.map((entry) => (
                            <option key={entry._id || entry.barcode} value={String(entry.barcode || "")}>
                                {entry.barcode}
                            </option>
                        ))}
                    </select>
                    <p className="barcode-choice-note label-print-modal__reuse-hint">
                        {barcodeChoice === "new"
                            ? "This print will use the next available barcode."
                            : selectedHistoryEntry?._id
                                ? `This print will reuse barcode ${selectedHistoryEntry.barcode}.`
                                : selectedItemHistory?._id
                                    ? `Latest existing barcode is ${selectedItemHistory.barcode}.`
                                    : "No previous barcode exists for this item yet."}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LabelPrintPreview;
