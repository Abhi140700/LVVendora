import React, { useCallback, useEffect, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import { handleEnterAdvance } from "../../../utils/enterNavigation";
import styles from "../salesPOSStyles";

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const clampNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const FOCUSABLE_SELECTOR = [
    'button:not([disabled])',
    'input:not([type="hidden"]):not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
].join(", ");

const getFocusableElements = (scope) => {
    if (!scope) {
        return [];
    }

    return Array.from(scope.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) => {
        if (element.getAttribute("aria-hidden") === "true") {
            return false;
        }

        return element.offsetParent !== null;
    });
};

export const moveActiveIndex = (currentIndex, length, delta) => {
    if (!length) {
        return -1;
    }

    if (currentIndex < 0) {
        return delta > 0 ? 0 : length - 1;
    }

    return (currentIndex + delta + length) % length;
};

export const Modal = ({
    title,
    children,
    onClose,
    width = 860,
    onKeyDown,
    initialFocusSelector,
    returnFocusRef,
}) => {
    const cardRef = useRef(null);
    const previousFocusRef = useRef(null);

    useEffect(() => {
        previousFocusRef.current = document.activeElement;

        const frameId = requestAnimationFrame(() => {
            const initialTarget = initialFocusSelector
                ? cardRef.current?.querySelector(initialFocusSelector)
                : null;
            const firstFocusable = getFocusableElements(cardRef.current)[0];
            const focusTarget = initialTarget || firstFocusable || cardRef.current;
            focusTarget?.focus?.();
            focusTarget?.select?.();
        });

        return () => {
            cancelAnimationFrame(frameId);
            const fallbackTarget = returnFocusRef?.current;
            const previousTarget = previousFocusRef.current;
            const restoreTarget = previousTarget?.isConnected ? previousTarget : fallbackTarget;
            requestAnimationFrame(() => {
                restoreTarget?.focus?.();
                restoreTarget?.select?.();
            });
        };
    }, [initialFocusSelector, returnFocusRef]);

    const handleModalKeyDown = (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            onClose?.();
            return;
        }

        if (event.key === "Tab") {
            const focusable = getFocusableElements(cardRef.current);
            if (!focusable.length) {
                event.preventDefault();
                return;
            }

            const currentIndex = focusable.indexOf(document.activeElement);
            const targetIndex = event.shiftKey
                ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
                : (currentIndex === -1 || currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1);

            event.preventDefault();
            focusable[targetIndex]?.focus?.();
            focusable[targetIndex]?.select?.();
            return;
        }

        onKeyDown?.(event);
    };

    return (
        <>
            <div className="modal-backdrop fade show"></div>
            <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" aria-hidden="false" onClick={onClose}>
                <div
                    ref={cardRef}
                    className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
                    style={{ maxWidth: width }}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={handleModalKeyDown}
                    tabIndex={-1}
                    aria-label={title}
                >
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">{title}</h5>
                            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export const CashBillingModal = ({ isOpen, onClose, payableAmount, lines, onConfirm }) => {
    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.code === "F1") {
                event.preventDefault();
                onConfirm();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose, onConfirm]);

    if (!isOpen || lines.length === 0) return null;

    return (
        <>
            <div className="modal-backdrop fade show"></div>
            <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true" onClick={onClose}>
                <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(event) => event.stopPropagation()}>
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Bill Pay</h5>
                            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            <div className="row g-3 mb-3">
                                <div className="col-6 col-md-3"><input className="form-control" readOnly value="" /></div>
                                <div className="col-6 col-md-3"><input className="form-control" readOnly value="" /></div>
                                <div className="col-6 col-md-3"><input className="form-control" readOnly value="" /></div>
                                <div className="col-6 col-md-3"><input className="form-control" readOnly value="" /></div>
                            </div>
                            <div className="app-table-wrap mb-3">
                                <table className="table app-table mb-0">
                                    <thead>
                                        <tr>
                                            <th>Mobile No</th>
                                            <th>Cash Customer Name</th>
                                            <th>GSTIN</th>
                                            <th>Area / City</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>-</td>
                                            <td>Cash Customer</td>
                                            <td>-</td>
                                            <td>-</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className="pos-receivable-panel">
                                <span>Net Receivable</span>
                                <strong>Rs. {payableAmount.toFixed(2)}</strong>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn_style" onClick={onConfirm}>
                                <i className="bx bx-printer"></i><span>F1-Save & Print</span>
                            </button>
                            <button type="button" className="btn btn_style inActive" onClick={onClose}>Esc - Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

const CARD_UPI_GROUPS = {
    cash: new Set(["CASH"]),
    cardUpi: new Set(["PAYTM", "HDFC", "CARD", "IDFC", "UPI"]),
};

export const getCardUpiTotals = (paymentRows = []) => paymentRows.reduce((totals, row) => {
    const mode = String(row.mode || "").trim().toUpperCase();
    const amount = clampNumber(row.amount);
    if (CARD_UPI_GROUPS.cash.has(mode)) {
        totals.cash += amount;
    } else if (CARD_UPI_GROUPS.cardUpi.has(mode)) {
        totals.cardUpi += amount;
    }
    return totals;
}, { cash: 0, cardUpi: 0 });

export const CardUpiBillingModal = ({ isOpen, onClose, payableAmount, paymentRows, onOpenPaymentOptions, onConfirm }) => {
    const paymentTotals = useMemo(() => getCardUpiTotals(paymentRows), [paymentRows]);

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.key === "Enter") {
                event.preventDefault();
                onOpenPaymentOptions();
                return;
            }

            if (event.code === "F3") {
                event.preventDefault();
                onConfirm();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose, onOpenPaymentOptions, onConfirm]);

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-backdrop fade show"></div>
            <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true" onClick={onClose}>
                <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(event) => event.stopPropagation()}>
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Bill Pay - Card / UPI</h5>
                            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            <div className="app-table-wrap mb-3">
                                <table className="table app-table mb-0">
                                    <thead>
                                        <tr>
                                            <th>Sr</th>
                                            <th>Firm Name</th>
                                            <th>Net Amt</th>
                                            <th>Debit Amt</th>
                                            <th>Credit Amt</th>
                                            <th>By Cash</th>
                                            <th>Card / UPI</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>0</td>
                                            <td><strong>LAXMI VISHNU CLOTH SHOP</strong></td>
                                            <td>{payableAmount.toFixed(2)}</td>
                                            <td>-</td>
                                            <td>-</td>
                                            <td>{paymentTotals.cash.toFixed(2)}</td>
                                            <td>
                                                <button className="btn btn_style inActive" type="button" onClick={onOpenPaymentOptions}>
                                                    {paymentTotals.cardUpi > 0 ? paymentTotals.cardUpi.toFixed(2) : "<ENTER>"}
                                                </button>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>New</td>
                                            <td>Total :</td>
                                            <td>{payableAmount.toFixed(2)}</td>
                                            <td></td>
                                            <td></td>
                                            <td>{paymentTotals.cash.toFixed(2)}</td>
                                            <td>{paymentTotals.cardUpi.toFixed(2)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className="pos-receivable-panel">
                                <span>Net Receivable</span>
                                <strong>Rs. {payableAmount.toFixed(2)}</strong>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn_style" onClick={onConfirm}>
                                <i className="bx bx-check"></i><span>F3 - Save</span>
                            </button>
                            <button type="button" className="btn btn_style inActive" onClick={onClose}>Esc - Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

const PAYMENT_OPTION_METHODS = ["Cash", "PAYTM", "HDFC", "Card", "IDFC", "UPI"];

const createFallbackPaymentRow = (mode = "Cash", amount = 0) => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, mode, amount, reference: "" });

const rebalancePaymentRows = (rows = [], payableAmount = 0, createRow = createFallbackPaymentRow) => {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    const cashRow = normalizedRows.find((row) => String(row.mode || "").trim().toUpperCase() === "CASH");
    const nonCashRows = normalizedRows
        .filter((row) => String(row.mode || "").trim().toUpperCase() !== "CASH")
        .map((row) => ({
            ...row,
            amount: Math.max(0, round2(clampNumber(row.amount))),
        }));

    const nonCashTotal = round2(nonCashRows.reduce((sum, row) => sum + clampNumber(row.amount), 0));
    const cashAmount = Math.max(0, round2(payableAmount - nonCashTotal));
    const nextCashRow = cashRow
        ? { ...cashRow, mode: "Cash", amount: cashAmount }
        : createRow("Cash", cashAmount);

    return [nextCashRow, ...nonCashRows];
};

export const PaymentModal = ({
    isOpen,
    onClose,
    payableAmount,
    lines,
    createPaymentRow,
    setActiveMode,
    paymentRows,
    setPaymentRows,
}) => {
    const netReceivable = payableAmount;
    const totalPaid = useMemo(() => paymentRows.reduce((sum, row) => sum + clampNumber(row.amount), 0), [paymentRows]);
    const dueAmount = Math.max(0, round2(netReceivable - totalPaid));

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setPaymentRows((current) => rebalancePaymentRows(
            current.length > 0 ? current : [createPaymentRow("Cash", netReceivable)],
            netReceivable,
            createPaymentRow,
        ));
    }, [createPaymentRow, isOpen, netReceivable, setPaymentRows]);

    useEffect(() => {
        setActiveMode("card-upi");
    }, [setActiveMode]);

    const paymentRowMap = useMemo(() => new Map(
        paymentRows.map((row) => [String(row.mode || "").trim().toUpperCase(), row]),
    ), [paymentRows]);

    const handleMethodAmountChange = useCallback((method, value) => {
        const normalizedMethod = String(method).trim();
        const upperMethod = normalizedMethod.toUpperCase();
        if (upperMethod === "CASH") {
            return;
        }

        setPaymentRows((current) => {
            const nextRows = current.filter((row) => String(row.mode || "").trim().toUpperCase() !== upperMethod);
            const nextAmount = Math.max(0, round2(clampNumber(value)));
            const existing = current.find((row) => String(row.mode || "").trim().toUpperCase() === upperMethod);
            if (nextAmount > 0 || String(existing?.reference || "").trim()) {
                nextRows.push({
                    ...(existing || createPaymentRow(normalizedMethod, 0)),
                    mode: normalizedMethod,
                    amount: nextAmount,
                });
            }
            return rebalancePaymentRows(nextRows, netReceivable, createPaymentRow);
        });
    }, [createPaymentRow, netReceivable, setPaymentRows]);

    const handleMethodReferenceChange = useCallback((method, value) => {
        const normalizedMethod = String(method).trim();
        const upperMethod = normalizedMethod.toUpperCase();

        setPaymentRows((current) => {
            const existing = current.find((row) => String(row.mode || "").trim().toUpperCase() === upperMethod);
            if (upperMethod === "CASH") {
                const nextRows = current.map((row) => (
                    String(row.mode || "").trim().toUpperCase() === "CASH" ? { ...row, reference: value } : row
                ));
                return rebalancePaymentRows(nextRows, netReceivable, createPaymentRow);
            }

            const nextRows = current.filter((row) => String(row.mode || "").trim().toUpperCase() !== upperMethod);
            if (String(value).trim() || clampNumber(existing?.amount) > 0) {
                nextRows.push({
                    ...(existing || createPaymentRow(normalizedMethod, 0)),
                    mode: normalizedMethod,
                    amount: clampNumber(existing?.amount),
                    reference: value,
                });
            }
            return rebalancePaymentRows(nextRows, netReceivable, createPaymentRow);
        });
    }, [createPaymentRow, netReceivable, setPaymentRows]);

    const handlePaymentSelection = useCallback(() => {
        if (paymentRows.length === 0) {
            toast.error("Add at least one payment row.");
            return;
        }
        if (round2(totalPaid) !== round2(netReceivable)) {
            toast.error("Total paid must match the net receivable.");
            return;
        }

        onClose();
    }, [netReceivable, onClose, paymentRows.length, totalPaid]);

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.key === "Enter" || event.code === "F1") {
                event.preventDefault();
                handlePaymentSelection();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handlePaymentSelection, isOpen, onClose]);

    if (!isOpen || lines.length === 0) return null;

    return (
        <>
            <div className="modal-backdrop fade show"></div>
            <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true" onClick={onClose}>
                <div className="modal-dialog modal-dialog-centered pos-payment-option-dialog" onClick={(event) => event.stopPropagation()}>
                    <div className="modal-content pos-payment-option-modal">
                        <div className="modal-header">
                            <h5 className="modal-title">Payment Option</h5>
                            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            <div className="pos-receivable-panel mb-3">
                                <span>Net Receivable :</span>
                                <strong>Rs. {netReceivable.toFixed(2)}</strong>
                            </div>
                            <div className="app-table-wrap">
                                <table className="table app-table mb-0">
                                    <thead>
                                        <tr>
                                            <th>Payment Option</th>
                                            <th>Amount</th>
                                            <th>Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {PAYMENT_OPTION_METHODS.map((method) => (
                                            <tr key={method}>
                                                <td><strong>{method}</strong></td>
                                                <td>
                                                    <input
                                                        className="form-control form-control-sm"
                                                        data-enter-nav="true"
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={paymentRowMap.get(method.toUpperCase())?.amount ?? (method === "Cash" ? netReceivable : 0)}
                                                        onChange={(event) => handleMethodAmountChange(method, event.target.value)}
                                                        readOnly={method === "Cash"}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        className="form-control form-control-sm"
                                                        data-enter-nav="true"
                                                        value={paymentRowMap.get(method.toUpperCase())?.reference ?? ""}
                                                        onChange={(event) => handleMethodReferenceChange(method, event.target.value)}
                                                        placeholder={method === "Cash" ? "" : "Details"}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="summary-line mt-3">
                                <span>Total Paid :</span>
                                <strong>Rs. {totalPaid.toFixed(2)}</strong>
                            </div>
                            <div className="summary-line">
                                <span>Due :</span>
                                <strong>{dueAmount.toFixed(2)}</strong>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn_style" onClick={handlePaymentSelection}>F1 - OK</button>
                            <button type="button" className="btn btn_style inActive" onClick={onClose}>Esc - Cancel</button>
                            <button type="button" className="btn btn_style inActive">Adjust Debit Note</button>
                            <button type="button" className="btn btn_style inActive">Adjust Credit Note</button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export const Field = ({ label, value, onChange, type = "text", readOnly = false, as = "input", ...rest }) => (
    <label style={styles.field}>
        <span style={styles.fieldLabel}>{label}</span>
        {as === "textarea" ? (
            <textarea
                value={value}
                onChange={(event) => onChange?.(event.target.value)}
                readOnly={readOnly}
                data-enter-nav="true"
                onKeyDown={(event) => {
                    if (!event.defaultPrevented) {
                        handleEnterAdvance(event);
                    }
                }}
                style={{ ...styles.input, minHeight: 84, resize: "vertical" }}
                {...rest}
            />
        ) : (
            <input
                type={type === "number" ? "text" : type}
                value={value}
                onChange={(event) => onChange?.(event.target.value)}
                readOnly={readOnly}
                inputMode={type === "number" ? "decimal" : undefined}
                data-enter-nav="true"
                onKeyDown={(event) => {
                    if (!event.defaultPrevented) {
                        handleEnterAdvance(event);
                    }
                }}
                style={styles.input}
                {...rest}
            />
        )}
    </label>
);


export const SummaryLine = ({ label, value }) => (
    <div style={styles.summaryLine}>
        <span style={styles.smallMuted}>{label}</span>
        <strong>{value}</strong>
    </div>
);
