import React from "react";
import LabelPrintPreview from "./LabelPrintPreview";

const sanitizeDecimalInput = (value) => {
    const cleaned = String(value || "").replace(/[^\d.]/g, "");
    const [whole = "", ...decimalParts] = cleaned.split(".");
    return decimalParts.length ? `${whole}.${decimalParts.join("")}` : whole;
};

const LabelPrintEditorPane = ({
    selectedItem,
    selectedItemHistory,
    selectedItemHistories,
    barcodeChoice,
    setBarcodeChoice,
    selectedHistoryEntry,
    companyAcronym,
    previewLabelDraft,
    previewBarcodeRef,
    normalizedPreviewBarcode,
    previewIdentity,
    printer,
    setPrinter,
    printerOptions,
    labelSize,
    setLabelSize,
    nextBarcode,
    Field,
    updateSelectedItem,
    calculateMRP,
    handlePrintAll,
    handleReprint,
    handlePrint,
    purchaseSettings,
    printing,
    onEnterNext,
    printButtonRef,
}) => {
    if (!selectedItem) {
        return (
            <section className="label-print-modal__editor-panel">
                <div className="label-print-modal__empty-state">All items in this bill have been printed.</div>
            </section>
        );
    }

    return (
        <>
            <div className="row g-3 mb-3">
                <div className="col-12 col-lg-4">
                    <div className="card app-card h-100 label-print-modal__info-card">
                        <div className="card-body">
                            <small className="text-muted">Selected item</small>
                            <h6 className="mt-1 mb-1">{selectedItem.name}</h6>
                            <p className="text-muted mb-0">
                        {selectedItem.categoryObj?.name || "No category"} • Qty{" "}
                        {selectedItem.qty} • Printed {selectedItem.printedLabels || 0}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-lg-4">
                    <label className="form-label">Printer</label>
                    <select
                        value={printer}
                        onChange={(e) => setPrinter(e.target.value)}
                        className="form-select"
                    >
                        {printerOptions.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="col-12 col-lg-4">
                    <label className="form-label">Label Size</label>
                    <select
                        value={labelSize}
                        onChange={(e) => setLabelSize(e.target.value)}
                        className="form-select"
                    >
                        <option value="50x25">50 x 25 mm</option>
                        <option value="40x20">40 x 20 mm</option>
                    </select>
                </div>
            </div>

            <LabelPrintPreview
                companyAcronym={companyAcronym}
                previewLabelDraft={previewLabelDraft}
                selectedItem={selectedItem}
                previewBarcodeRef={previewBarcodeRef}
                normalizedPreviewBarcode={normalizedPreviewBarcode}
                previewIdentity={previewIdentity}
                selectedItemHistory={selectedItemHistory}
                selectedItemHistories={selectedItemHistories}
                barcodeChoice={barcodeChoice}
                setBarcodeChoice={setBarcodeChoice}
                selectedHistoryEntry={selectedHistoryEntry}
                nextBarcode={nextBarcode}
            />

            {!selectedItem.category ? (
                <div className="label-print-modal__warning-banner">
                    Category is missing for this item. Select or fix the purchase item
                    before printing.
                </div>
            ) : null}

            <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                <Field label="Category" value={selectedItem.categoryObj?.name || "-"} readOnly />
                <Field label="Fabric" value={selectedItem.fabric || ""} readOnly />
                <Field label="Style" value={selectedItem.style || ""} readOnly />
                <Field label="Sub Style" value={selectedItem.subStyle || ""} readOnly />
                <Field label="Colour" value={selectedItem.colour || ""} readOnly />
                <Field label="Design No" value={selectedItem.designNo || ""} readOnly />
                <Field
                    key={`def-qty-${selectedItem.itemId || selectedItem._id || selectedItem.name}`}
                    label="Def. Qty"
                    value={selectedItem.defQty || 1}
                    onChange={(value) =>
                        updateSelectedItem((item) => {
                            item.defQty = String(value || "").replace(/[^\d.]/g, "");
                        })
                    }
                    type="text"
                    onEnterNext={onEnterNext}
                    autoFocus
                />
                <Field label="Received Qty" value={selectedItem.qty || 1} readOnly onEnterNext={onEnterNext} />
                <Field
                    label="Purchase Rate"
                    value={selectedItem.purchaseRate || 0}
                    readOnly
                    type="text"
                    onEnterNext={onEnterNext}
                />
                <Field
                    label="Disc %"
                    value={selectedItem.disc}
                    onChange={(value) => {
                        updateSelectedItem((item) => {
                            item.disc = Number(value);
                            const newMrp = calculateMRP(
                                item.purchaseRate,
                                item.disc,
                                item.per,
                            );
                            item.mrp = parseFloat(newMrp);
                            item.saleRate = parseFloat(newMrp);
                            item.commAmount = (
                                (item.saleRate * item.qty * item.commPercent) /
                                100
                            ).toFixed(2);
                        });
                    }}
                    type="text"
                    onEnterNext={onEnterNext}
                />
                <Field
                    label="Markup %"
                    value={selectedItem.per}
                    onChange={(value) => {
                        updateSelectedItem((item) => {
                            item.per = Number(value);
                            const newMrp = calculateMRP(
                                item.purchaseRate,
                                item.disc,
                                item.per,
                            );
                            item.mrp = parseFloat(newMrp);
                            item.saleRate = parseFloat(newMrp);
                            item.commAmount = (
                                (item.saleRate * item.qty * item.commPercent) /
                                100
                            ).toFixed(2);
                        });
                    }}
                    type="text"
                    onEnterNext={onEnterNext}
                />
                <Field
                    label="MRP"
                    value={selectedItem.mrp}
                    onChange={(value) =>
                        updateSelectedItem((item) => {
                            item.mrp = Number(value);
                        })
                    }
                    type="text"
                    onEnterNext={onEnterNext}
                />
                <Field
                    label="Sale Rate"
                    value={selectedItem.saleRate}
                    onChange={(value) => {
                        updateSelectedItem((item) => {
                            item.saleRate = Number(value);
                            item.commAmount = (
                                (item.saleRate * item.qty * item.commPercent) /
                                100
                            ).toFixed(2);
                        });
                    }}
                    type="text"
                    onEnterNext={onEnterNext}
                />
                <Field
                    label="Comm %"
                    value={selectedItem.commPercent}
                    onChange={(value) => {
                        updateSelectedItem((item) => {
                            item.commPercent = sanitizeDecimalInput(value);
                            const commPercent = Number(item.commPercent || 0);
                            item.commAmount = (
                                (item.saleRate * item.qty * commPercent) /
                                100
                            ).toFixed(2);
                        });
                    }}
                    type="text"
                    onEnterNext={onEnterNext}
                />
                <Field label="Comm Amount" value={selectedItem.commAmount || 0} readOnly onEnterNext={onEnterNext} />
                <Field label="Labels To Print" value={selectedItem.remainingLabels || selectedItem.labels || 0} readOnly onEnterNext={onEnterNext} />
                <Field
                    label="Barcode Mode"
                    value={barcodeChoice}
                    onChange={setBarcodeChoice}
                    type="select"
                    options={[
                        {
                            label: `New barcode (${nextBarcode || "Pending"})`,
                            value: "new",
                        },
                        ...selectedItemHistories.map((entry) => ({
                            label: `Previous ${entry.barcode}`,
                            value: String(entry.barcode || ""),
                        })),
                    ]}
                    onEnterNext={onEnterNext}
                />
                <Field label="Barcode" value={normalizedPreviewBarcode.value} readOnly onEnterNext={onEnterNext} />
                <Field label="Qty On Label" value={previewLabelDraft?.qtyText || "-"} readOnly onEnterNext={onEnterNext} />
                <Field
                    label="Reference Code"
                    value={previewLabelDraft?.referenceCode || "-"}
                    readOnly
                    onEnterNext={onEnterNext}
                />
            </form>
        </>
    );
};

export default LabelPrintEditorPane;
