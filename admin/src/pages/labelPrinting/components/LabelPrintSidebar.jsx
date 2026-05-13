import React from "react";

const LabelPrintSidebar = ({
    bill,
    printer,
    labelSize,
    pendingLabelCount,
    rows,
    selectedItemIndex,
    setSelectedItemIndex,
    history,
    SummaryRow,
    activeItemIndex,
    setActiveItemIndex,
    sidebarButtonRefs,
    onSidebarKeyDown,
}) => (
    <aside className="label-print-modal__sidebar">
        <section className="card app-card mb-3">
            <div className="card-body">
                <h6 className="mb-3">Job Summary</h6>
                <SummaryRow label="GRN" value={bill?.grnNo || "Auto generated"} />
                <SummaryRow label="Printer" value={printer} />
                <SummaryRow label="Label size" value={labelSize} />
                <SummaryRow label="Pending labels" value={pendingLabelCount} />
            </div>
        </section>

        <section className="card app-card">
            <div className="card-body">
                <h6 className="mb-3">Pending Items</h6>
                <div className="label-print-modal__item-list">
                    {rows.map((item, index) => (
                        <button
                            type="button"
                            key={item.itemId || item._id || `${item.name}-${index}`}
                            ref={(node) => {
                                if (node) sidebarButtonRefs.current.set(index, node);
                                else sidebarButtonRefs.current.delete(index);
                            }}
                            onClick={() => setSelectedItemIndex(index)}
                            onMouseEnter={() => setActiveItemIndex(index)}
                            onKeyDown={onSidebarKeyDown}
                            className={`quick-action mb-2 label-print-modal__item-button${
                                index === selectedItemIndex ? " label-print-modal__item-button--selected" : ""
                            }${index === activeItemIndex ? " label-print-modal__item-button--active" : ""}`}
                        >
                            <span className="d-grid">
                                <strong>{item.name}</strong>
                                <small className="text-muted">Qty {item.qty} • {item.categoryObj?.name || "No category"}</small>
                                <small>MRP Rs. {item.mrp} • {item.unit || "Unit pending"}</small>
                            </span>
                            <span className="status-badge status-warning">{item.remainingLabels}</span>
                        </button>
                    ))}
                </div>
            </div>
        </section>

        {history.length > 0 ? (
            <section className="card app-card mt-3 label-print-modal__history-card">
                <div className="card-body">
                    <h6 className="mb-3">Previous History</h6>
                    <div className="label-print-modal__history-list">
                        {history.map((entry, index) => (
                            <div key={`${entry.barcode}-${index}`} className="label-print-modal__history-row">
                                <div>
                                    <div className="label-print-modal__item-name">{entry.productName}</div>
                                    <div className="label-print-modal__small-muted">
                                        {entry.barcode} • Qty {entry.qty} •{" "}
                                        {entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : ""}
                                    </div>
                                </div>
                                <div className="label-print-modal__history-meta">
                                    <strong>Rs. {entry.saleRate || entry.price}</strong>
                                    <div className="label-print-modal__small-muted">
                                        {entry.printHistory?.[entry.printHistory.length - 1]?.action || "PRINT"}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        ) : null}
    </aside>
);

export default LabelPrintSidebar;
