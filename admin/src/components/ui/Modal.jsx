import React, { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
    'button:not([disabled])',
    'input:not([type="hidden"]):not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
].join(", ");

const getFocusable = (scope) => Array.from(scope?.querySelectorAll?.(FOCUSABLE_SELECTOR) || []).filter((element) => {
    if (element.getAttribute("aria-hidden") === "true") {
        return false;
    }
    return element.offsetParent !== null;
});

const Modal = ({ open, title, children, onClose, initialFocusSelector, returnFocusRef }) => {
    const dialogRef = useRef(null);
    const previousFocusRef = useRef(null);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        previousFocusRef.current = document.activeElement;
        const frameId = requestAnimationFrame(() => {
            const initialTarget = initialFocusSelector
                ? dialogRef.current?.querySelector(initialFocusSelector)
                : null;
            const fallbackTarget = getFocusable(dialogRef.current)[0] || dialogRef.current;
            const focusTarget = initialTarget || fallbackTarget;
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
    }, [initialFocusSelector, open, returnFocusRef]);

    if (!open) return null;

    const handleKeyDown = (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            onClose?.();
            return;
        }

        if (event.key !== "Tab") {
            return;
        }

        const focusable = getFocusable(dialogRef.current);
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
    };

    return (
        <div className="app-modal__backdrop" onClick={onClose}>
            <div
                ref={dialogRef}
                className="app-card app-modal__dialog"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={handleKeyDown}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={title}
            >
                <div className="app-modal__header">
                    <h3 className="app-modal__title">{title}</h3>
                    <button type="button" className="app-btn app-btn--secondary" onClick={onClose}>Close</button>
                </div>
                {children}
            </div>
        </div>
    );
};

export default Modal;
