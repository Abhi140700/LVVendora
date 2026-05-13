import React from "react";

export const PosBillHeader = ({
    styles,
    customerName,
    setCustomerModalOpen,
    currentDateLabel,
    billNo,
    setBillNo,
    lastBillAmount,
    salesmanLookupInput,
    selectedSalesmanSummary,
    applySalesmanLookup,
    openSalesmanModalForCreate,
    setSalesmanModalOpen,
    setSalesmanFormOpen,
    lines,
    note,
    setNote,
    discountPercentInput,
    setDiscountPercentInput,
    applyItemDiscountPercent,
    barcodeInputRef,
    barcodeInput,
    setBarcodeInput,
    handleBarcodeSubmit,
    handleBarcodeInputEnter,
    setSearchModalOpen,
    setScannerStatus,
    setScannerSessionKey,
    setScannerModalOpen,
    BILL_MODES,
    activeMode,
    permissionRules,
    salesSettings,
    activeSession,
    mobileShortcutChoice,
    handleMobileShortcutSelect,
    POS_SHORTCUTS,
}) => (
    <>
        <section className="card app-card pos-counter-card">
            <div className="card-body">
                <div className="pos-counter-head">
                    <div>
                        <p className="section-label mb-1">Counter Session</p>
                        <h2>Cash Memo</h2>
                    </div>
                    <div className="pos-counter-meta">
                        <span className="metric-pill">{salesSettings.useDayEnd ? (activeSession ? `Session ${activeSession.sessionNo}` : "Session closed") : "Day end disabled"}</span>
                        <span className="metric-pill">Mode {BILL_MODES.find((mode) => mode.id === activeMode)?.label}</span>
                        <span className="metric-pill">Discount limit {permissionRules.maxBillDiscountPercent}%</span>
                    </div>
                </div>
                <form className="pos-counter-grid">
                    <div className="pos-field pos-field-customer">
                        <label className="form-label">Customer</label>
                        <div className="input-group">
                            <input
                                className="form-control"
                                value={customerName}
                                readOnly
                                data-enter-nav="true"
                                placeholder="Click or press Enter to search customer"
                                onClick={() => setCustomerModalOpen(true)}
                                onFocus={(event) => {
                                    event.target.blur();
                                    setCustomerModalOpen(true);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        setCustomerModalOpen(true);
                                    }
                                }}
                            />
                            <button className="btn btn_style" type="button" onClick={() => setCustomerModalOpen(true)}><i className="bx bx-search"></i><span>Find</span></button>
                        </div>
                    </div>
                    <div className="pos-field"><label className="form-label">Date</label><input className="form-control" value={currentDateLabel} readOnly data-enter-nav="true" /></div>
                    <div className="pos-field"><label className="form-label">Bill No</label><input className="form-control" value={billNo} onChange={(e) => setBillNo(e.target.value)} data-enter-nav="true" /></div>
                    <div className="pos-field"><label className="form-label">Last Bill</label><input className="form-control" value={lastBillAmount.toFixed(2)} readOnly data-enter-nav="true" /></div>
                    <div className="pos-field pos-field-salesman">
                        <label className="form-label">Salesman</label>
                        <div className="input-group">
                            <input
                                className="form-control"
                                value={salesmanLookupInput || selectedSalesmanSummary}
                                data-enter-nav="true"
                                placeholder="Enter salesman no or name"
                                onChange={(event) => applySalesmanLookup(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.altKey && event.key.toLowerCase() === "c") {
                                        event.preventDefault();
                                        openSalesmanModalForCreate().catch(() => { });
                                    }
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        applySalesmanLookup(event.currentTarget.value);
                                    }
                                }}
                                onBlur={(event) => applySalesmanLookup(event.target.value)}
                            />
                            <button type="button" className="btn btn_style inActive" onClick={() => { setSalesmanModalOpen(true); setSalesmanFormOpen(false); }}><i className="bx bx-list-ul"></i><span>List</span></button>
                        </div>
                    </div>
                    {/* <div className="pos-field"><label className="form-label">Items</label><input className="form-control" value={String(lines.length)} readOnly data-enter-nav="true" /></div> */}
                    <div className="pos-field pos-field-remark"><label className="form-label">Remark</label><input className="form-control" value={note} onChange={(e) => setNote(e.target.value)} data-enter-nav="true" placeholder="Bill note" /></div>
                    <div className="pos-field">
                        <label className="form-label">Discount %</label>
                        <input
                            className="form-control"
                            type="text"
                            inputMode="decimal"
                            value={discountPercentInput}
                            onChange={(e) => setDiscountPercentInput(e.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    applyItemDiscountPercent(event.currentTarget.value);
                                }
                            }}
                            onBlur={(event) => {
                                if (event.currentTarget.value) {
                                    applyItemDiscountPercent(event.currentTarget.value);
                                }
                            }}
                            data-enter-nav="false"
                        />
                    </div>
                </form>
                <form onSubmit={(event) => event.preventDefault()} className="pos-scan-row">
                    <span className="status-badge status-primary">Shift+F1</span>
                    <input ref={barcodeInputRef} className="form-control pos-scan-input" value={barcodeInput} data-enter-nav="false" onChange={(event) => setBarcodeInput(event.target.value)} onKeyDown={handleBarcodeInputEnter} placeholder="Search Product / scan barcode" />
                    <button type="button" className="btn btn_style" onClick={handleBarcodeSubmit}><i className="bx bx-plus"></i><span>Add</span></button>
                    <button type="button" className="btn btn_style inActive" onClick={() => setSearchModalOpen(true)}><i className="bx bx-search"></i><span>Search Product</span></button>
                    <button type="button" className="btn btn_style inActive" onClick={() => { setScannerStatus(""); setScannerSessionKey((current) => current + 1); setScannerModalOpen(true); }}><i className="bx bx-qr-scan"></i><span>Scan QR</span></button>
                </form>
            </div>
        </section>
        <div style={styles.mobileShortcutBar} className="sales-pos__mobile-shortcuts">
            <label style={styles.field}>
                <span style={styles.fieldLabel}>Billing Shortcuts</span>
                <select value={mobileShortcutChoice} onChange={(event) => handleMobileShortcutSelect(event.target.value)} style={styles.input}>
                    <option value="">Choose an action</option>
                    {POS_SHORTCUTS.map((shortcut) => <option key={`mobile-${shortcut.key}-${shortcut.label}`} value={`${shortcut.key}-${shortcut.label}`}>{shortcut.label} ({shortcut.key})</option>)}
                </select>
            </label>
        </div>
    </>
);

export const PosLineItemsTable = ({
    styles, lines, clampNumber, BILL_MODES, activeMode, updateLine, removeLine, isMeterUnit, qtyInputRefs, meterInputRefs, round2, stockWarnings, pendingQtyFocusLineId,
}) => (
    <div className="pos-workspace-grid pos-lines-full">
        <section className="card app-card app-datatable-card">
            <div className="card-header app-card-header">
                <div><p className="section-label mb-1">Cash memo</p><h2>Billing Lines</h2></div>
                <div className="d-flex flex-wrap gap-2">
                    {/* <span className="status-badge status-primary">Items {lines.length}</span> */}
                    <span className="status-badge status-primary">Qty {lines.reduce((sum, item) => sum + clampNumber(item.qty), 0)}</span>
                    <span className="status-badge status-success">Mode {BILL_MODES.find((mode) => mode.id === activeMode)?.label}</span>
                </div>
            </div>
            <div className="card-body">
                <div className="datatable-toolbar">
                    <div className="datatable-toolbar-start">
                        <label className="datatable-length"><span>Show</span><select className="form-select form-select-sm datatable-page-size" aria-label="Billing lines per page" defaultValue="10"><option>10</option><option>25</option><option>50</option></select></label>
                        <button className="btn btn_style datatable-create" type="button"><i className="bx bx-plus"></i><span>Add Line</span></button>
                    </div>
                    <div className="datatable-toolbar-end">
                        <div className="datatable-search"><input type="text" placeholder="Search Billing Lines" aria-label="Search Billing Lines" /></div>
                        <select className="form-select datatable-status-filter" aria-label="Filter billing lines" defaultValue="All Lines"><option>All Lines</option><option>Scanned</option><option>Manual</option><option>Stock Warning</option></select>
                    </div>
                </div>
                <div className="table-responsive app-table-wrap">
                    <table className="table app-table align-middle pos-line-table">
                        <thead><tr><th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" aria-label="Select all billing lines" /></th><th>Sr</th><th>Salesman</th><th>Barcode</th><th>Category</th><th>Item Name</th><th>Qty</th><th>MTR</th><th>Unit</th><th>Stock</th><th>MRP</th><th>Sale Rate</th><th>Total</th><th className="text-end">Actions</th></tr></thead>
                        <tbody>
                            {lines.length > 0 ? lines.map((line, index) => {
                                const meterItem = isMeterUnit(line.unit);
                                const hasWarning = clampNumber(meterItem ? line.mtrQty : line.qty) > clampNumber(line.stock);
                                return (
                                    <tr key={line.id}>
                                        <td className="datatable-check-cell"><input className="form-check-input datatable-row-check" type="checkbox" aria-label={`Select billing line ${index + 1}`} /></td>
                                        <td>{index + 1}</td>
                                        <td><input className="form-control form-control-sm" data-enter-nav="true" value={line.salesmanNumber} onChange={(event) => updateLine(line.id, "salesmanNumber", event.target.value)} /></td>
                                        <td>{line.barcode || "-"}</td>
                                        <td>{line.categoryName}</td>
                                        <td><strong>{line.itemName}</strong><small className="d-block text-muted">{line.brandName}</small></td>
                                        <td><input className="form-control form-control-sm" ref={(node) => { if (node) qtyInputRefs.current.set(line.id, node); else qtyInputRefs.current.delete(line.id); }} autoFocus={pendingQtyFocusLineId === line.id && !meterItem} data-enter-nav="true" data-qty-line-id={line.id} type="text" inputMode="decimal" value={line.qty} onFocus={(event) => { event.currentTarget.select?.(); }} onChange={(event) => updateLine(line.id, "qty", event.target.value)} /></td>
                                        <td><input className="form-control form-control-sm" ref={(node) => { if (node) meterInputRefs.current.set(line.id, node); else meterInputRefs.current.delete(line.id); }} autoFocus={pendingQtyFocusLineId === line.id && meterItem} data-enter-nav="true" data-mtr-line-id={line.id} type="text" inputMode="decimal" value={meterItem ? line.mtrQty : ""} onFocus={(event) => { if (meterItem) { event.currentTarget.select?.(); } }} onChange={(event) => updateLine(line.id, "mtr", event.target.value)} /></td>
                                        <td>{line.unit || "-"}</td>
                                        <td style={hasWarning ? styles.warningText : undefined}>{line.stock}</td>
                                        <td><input className="form-control form-control-sm" data-enter-nav="true" type="text" inputMode="decimal" value={line.mrp} onChange={(event) => updateLine(line.id, "mrp", event.target.value)} /></td>
                                        <td><input className="form-control form-control-sm" data-enter-nav="true" type="text" inputMode="decimal" value={line.saleRate} onChange={(event) => updateLine(line.id, "saleRate", event.target.value)} /></td>
                                        <td>{round2(line.lineTotal).toFixed(2)}</td>
                                        <td className="text-end">
                                            <div className="datatable-actions">
                                                <button className="action-btn" type="button" aria-label="Remove line" onClick={() => removeLine(line.id)}><i className="bx bx-trash"></i></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : <tr><td colSpan="14" className="text-center text-muted py-4">Scan a barcode or search an item to start billing.</td></tr>}
                        </tbody>
                    </table>
                </div>
                {stockWarnings.length > 0 ? <div className="status-badge status-warning mt-3">Stock warning: {stockWarnings[0].itemName} requested {stockWarnings[0].requestedQty}, available {stockWarnings[0].stock}</div> : null}
                <div className="pagination-row">
                    <span>Showing 1 to {Math.max(lines.length, 1)} of {lines.length} entries</span>
                    <nav aria-label="Billing lines pagination"><ul className="pagination mb-0"><li className="page-item disabled"><a className="page-link" href="#" aria-label="Previous"><i className="bx bx-chevron-left"></i></a></li><li className="page-item active"><a className="page-link" href="#">1</a></li><li className="page-item disabled"><a className="page-link" href="#" aria-label="Next"><i className="bx bx-chevron-right"></i></a></li></ul></nav>
                </div>
            </div>
        </section>
    </div>
);

export const PosPaymentPanel = ({
    styles, activeMode, manualAdvanceAmount, setManualAdvanceAmount, selectedExchangeItems, round2, subtotal, discountPercent, discountAmount,
    itemDiscountAmount, exchangeAmount, paidAmount, advanceAmount, payableAmount, creditDue, openConfirmationModal, billNo, saving, completeSale,
}) => (
    <aside className="card app-card pos-summary pos-payment-panel">
        <div className="card-header app-card-header"><div><p className="section-label mb-1">Bill summary</p><h2>Total Amount</h2></div></div>
        <div className="card-body">
            <div className="summary-line"><span>Subtotal</span><strong>Rs. {subtotal.toFixed(2)}</strong></div>
            <div className="summary-line"><span>Item Discount</span><strong>Rs. {itemDiscountAmount.toFixed(2)}</strong></div>
            {discountAmount > 0 ? <div className="summary-line"><span>Bill Discount ({discountPercent}%)</span><strong>Rs. {discountAmount.toFixed(2)}</strong></div> : null}
            <div className="summary-line"><span>Exchange</span><strong>Rs. {exchangeAmount.toFixed(2)}</strong></div>
            <div className="summary-line"><span>Paid</span><strong>Rs. {paidAmount.toFixed(2)}</strong></div>
            <div className="summary-line"><span>Advance</span><strong>Rs. {advanceAmount.toFixed(2)}</strong></div>
            <div className="summary-total"><span>Net Payable</span><strong>Rs. {payableAmount.toFixed(2)}</strong></div>
            <div className="summary-line"><span>Balance / Due</span><strong>Rs. {creditDue.toFixed(2)}</strong></div>
            {activeMode === "advance" ? (
                <>
                    <label className="form-label mt-3">Advance Amount</label>
                    <input className="form-control" type="text" inputMode="decimal" value={manualAdvanceAmount} onChange={(e) => setManualAdvanceAmount(e.target.value)} data-enter-nav="true" />
                </>
            ) : null}
            {selectedExchangeItems.length > 0 ? <div className="mt-3"><strong>Exchange Offset</strong>{selectedExchangeItems.map((item) => <div key={item.key} className="summary-line"><span>{item.itemName} x {item.qty}</span><strong>Rs. {round2(item.amount).toFixed(2)}</strong></div>)}</div> : null}
            <button className="btn btn_style w-100 mt-3" type="button" onClick={() => openConfirmationModal({ title: "Complete Bill", message: `Save bill ${billNo || ""} for Rs. ${payableAmount.toFixed(2)}?`, confirmLabel: saving ? "Saving..." : "Complete Bill", onConfirm: completeSale })} disabled={saving}><i className="bx bx-check"></i><span>{saving ? "Saving..." : "Complete Bill"}</span></button>
        </div>
    </aside>
);


export const PosShortcutRail = ({
    customerName,
    paidAmount,
    creditDue,
    POS_SHORTCUTS,
    handleShortcutAction,
}) => (
    <section className="card app-card pos-shortcut-rail">
        <div className="card-body">
            <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
                <div><p className="section-label mb-1">Shortcuts</p><h2 className="h6 mb-0">Billing Actions</h2></div>
                <div className="d-flex flex-wrap gap-2">
                    <span className="text-muted">Customer: {customerName || "Walk-in"}</span>
                    <span className="text-muted">Paid: Rs. {paidAmount.toFixed(2)}</span>
                    <span className="text-muted">Due: Rs. {creditDue.toFixed(2)}</span>
                </div>
            </div>
            <div className="pos-shortcut-grid">
                {POS_SHORTCUTS.map((shortcut) => (
                    <button
                        className="quick-action pos-shortcut"
                        type="button"
                        key={`${shortcut.key}-${shortcut.label}`}
                        onClick={() => handleShortcutAction(shortcut)}
                    >
                        <span className="status-badge status-primary">{shortcut.key}</span>
                        <strong>{shortcut.label}</strong>
                    </button>
                ))}
            </div>
        </div>
    </section>
);
