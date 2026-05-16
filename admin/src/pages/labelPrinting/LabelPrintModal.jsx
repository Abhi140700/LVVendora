import React, { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import api from "../../app/axios";
import useAppSettings from "../../hooks/useAppSettings.js";
import { getCompanyAcronym, getPrinterOptions } from "../../utils/appSettings.js";
import { notifyError, notifySuccess } from "../../utils/notify.js";
import LabelPrintSidebar from "./components/LabelPrintSidebar.jsx";
import LabelPrintEditorPane from "./components/LabelPrintEditorPane.jsx";
import {
    applyPrintedQtyToRows,
    buildLabelDraft,
    buildLabelPrintHtml,
    buildRows,
    calculateMRP,
    getDisplayName,
    getLabelMetrics,
    getRowKey,
    normalizeBarcodeFormat,
} from "./labelPrintUtils.jsx";

const getEntityId = (value) => String(value?._id || value || "").trim();

const LabelPrintModal = ({ bill, items = [], onClose, onSuccess, onPrintSuccess }) => {
    const billItems = useMemo(
        () => (Array.isArray(items) && items.length > 0 ? items : bill?.items || []),
        [bill?.items, items],
    );
    const handleSuccess = onSuccess || onPrintSuccess;
    const appSettings = useAppSettings();
    const purchaseSettings = appSettings.purchase || {};
    const printerOptions = useMemo(
        () => getPrinterOptions(appSettings),
        [appSettings],
    );
    const [printer, setPrinter] = useState(
        appSettings.labelPrinter || "Zebra ZD230",
    );
    const [labelSize, setLabelSize] = useState(appSettings.labelSize || "50x25");
    const [rows, setRows] = useState(() => buildRows(billItems));
    const [selectedItemIndex, setSelectedItemIndex] = useState(
        billItems.length > 0 ? 0 : null,
    );
    const [history, setHistory] = useState([]);
    const [printing, setPrinting] = useState(false);
    const [nextBarcode, setNextBarcode] = useState("1000");
    const [barcodeChoice, setBarcodeChoice] = useState("new");
    const previewBarcodeRef = useRef(null);
    const printButtonRef = useRef(null);
    const sidebarButtonRefs = useRef(new Map());
    const [activeItemIndex, setActiveItemIndex] = useState(billItems.length > 0 ? 0 : -1);
    const selectedItem =
        selectedItemIndex !== null ? rows[selectedItemIndex] : null;
    const completedCount = Math.max((billItems || []).length - rows.length, 0);
    const pendingLabelCount = rows.reduce(
        (sum, item) => sum + Number(item.remainingLabels || 0),
        0,
    );
    const selectedItemHistories = useMemo(
        () =>
            selectedItem
                ? history.filter(
                    (entry) =>
                        getEntityId(entry.itemId) === getEntityId(selectedItem.itemId),
                )
                : [],
        [history, selectedItem],
    );
    const selectedItemHistory = selectedItemHistories[0] || null;
    const selectedHistoryEntry =
        barcodeChoice === "new"
            ? null
            : selectedItemHistories.find(
                (entry) => String(entry.barcode || "") === String(barcodeChoice || ""),
            ) || null;
    const previewBarcode = selectedItem
        ? String(barcodeChoice === "new"
            ? (selectedItem.barcode || nextBarcode)
            : (selectedHistoryEntry?.barcode || selectedItem.barcode || nextBarcode))
        : "";
    const normalizedPreviewBarcode = useMemo(
        () => normalizeBarcodeFormat(appSettings.barcodeFormat, previewBarcode),
        [appSettings.barcodeFormat, previewBarcode],
    );
    const companyAcronym = getCompanyAcronym(appSettings.companyName);
    const previewIdentity = `${companyAcronym}/${bill?.billNo || "-"}`;
    const billPartyName = getDisplayName(bill?.partyName, getDisplayName(bill?.party, getDisplayName(bill?.supplier || bill?.supplierAgent, "")));
    const labelMetrics = getLabelMetrics(labelSize);
    const previewLabelDraft = selectedItem
        ? buildLabelDraft({
            row: selectedItem,
            barcode: normalizedPreviewBarcode.value,
            companyName: appSettings.companyName,
            billNo: bill?.billNo,
            partyName: billPartyName,
        })
        : null;

    const getPrintQuantityForRow = (row) =>
        Math.max(parseInt(row?.remainingLabels || row?.labels || row?.qty || 1, 10), 1);

    const getDefaultSalesQuantityForRow = (row) => {
        const defaultSalesQty = Number(row?.defQty || 1);
        return Number.isFinite(defaultSalesQty) && defaultSalesQty > 0 ? defaultSalesQty : 1;
    };

    useEffect(() => {
        setPrinter(appSettings.labelPrinter || "Zebra ZD230");
        setLabelSize(appSettings.labelSize || "50x25");
    }, [appSettings.labelPrinter, appSettings.labelSize]);

    useEffect(() => {
        const nativePrintersPromise =
            typeof window !== "undefined" &&
            (window.electronAPI?.getPrinters?.() ||
                window.erpBridge?.getPrinters?.() ||
                window.__ERP_GET_PRINTERS__?.());

        if (!nativePrintersPromise || typeof nativePrintersPromise.then !== "function") {
            return;
        }

        nativePrintersPromise
            .then((printers) => {
                if (!Array.isArray(printers) || printers.length === 0) {
                    return;
                }

                const availablePrinters = printers
                    .map((entry) =>
                        typeof entry === "string" ? entry : entry?.displayName || entry?.name,
                    )
                    .map((value) => String(value || "").trim())
                    .filter(Boolean)
                    .filter((value, index, list) => list.indexOf(value) === index);

                if (availablePrinters.length === 0) {
                    return;
                }

                const currentPrinters = getPrinterOptions(appSettings);
                if (JSON.stringify(currentPrinters) === JSON.stringify(availablePrinters)) {
                    return;
                }

                localStorage.setItem(
                    "erp-application-settings-v1",
                    JSON.stringify({
                        ...appSettings,
                        availablePrinters,
                    }),
                );
                window.dispatchEvent(
                    new CustomEvent("erp-app-settings-updated", {
                        detail: {
                            settings: { ...appSettings, availablePrinters },
                            savedAt: new Date().toLocaleTimeString(),
                        },
                    }),
                );
            })
            .catch((error) => {
                console.error("Unable to load system printers:", error);
            });
    }, [appSettings]);

    useEffect(() => {
        setRows(buildRows(billItems));
        setSelectedItemIndex(billItems.length > 0 ? 0 : null);
        setActiveItemIndex(billItems.length > 0 ? 0 : -1);
    }, [billItems, bill?._id]);

    useEffect(() => {
        if (activeItemIndex < 0) {
            return;
        }
        sidebarButtonRefs.current.get(activeItemIndex)?.scrollIntoView?.({ block: "nearest" });
    }, [activeItemIndex]);

    useEffect(() => {
        if (selectedItemIndex === null || selectedItemIndex < 0) {
            return;
        }
        setActiveItemIndex(selectedItemIndex);
    }, [selectedItemIndex]);

    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose?.();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [onClose]);

    useEffect(() => {
        const itemIds = Array.from(
            new Set(
                (billItems || [])
                    .map((item) => String(item.itemId?._id || item.itemId || item._id || "").trim())
                    .filter(Boolean),
            ),
        );

        if (itemIds.length === 0) {
            setHistory([]);
            return;
        }

        Promise.all(
            itemIds.map(async (itemId) => {
                const { data } = await api.get(`/label/item/${itemId}`);
                return Array.isArray(data.data) ? data.data : [];
            }),
        )
            .then((histories) => {
                const merged = histories.flat();
                const unique = merged.filter((entry, index, list) =>
                    list.findIndex((candidate) => String(candidate._id || "") === String(entry._id || "")) === index,
                );
                setHistory(unique);
            })
            .catch((error) => {
                console.error("Failed to fetch label history:", error);
                setHistory([]);
            });
    }, [bill?._id, billItems]);

    useEffect(() => {
        api.get("/label/next-barcode")
            .then(({ data }) => data)
            .then((data) => setNextBarcode(data.data?.nextBarcode || "1000"))
            .catch(() => setNextBarcode("1000"));
    }, []);

    useEffect(() => {
        if (!selectedItem) {
            setBarcodeChoice("new");
            return;
        }

        if (selectedItemHistories.length === 0) {
            setBarcodeChoice("new");
            return;
        }

        setBarcodeChoice((currentChoice) => {
            if (
                currentChoice !== "new" &&
                selectedItemHistories.some(
                    (entry) => String(entry.barcode || "") === String(currentChoice),
                )
            ) {
                return currentChoice;
            }
            return String(selectedItemHistories[0]?.barcode || "new");
        });
    }, [selectedItem, selectedItemHistories]);

    useEffect(() => {
        if (!selectedItem || !normalizedPreviewBarcode.value || !previewBarcodeRef.current) {
            return;
        }

        try {
            JsBarcode(previewBarcodeRef.current, normalizedPreviewBarcode.value, {
                format: normalizedPreviewBarcode.format,
                displayValue: false,
                width: labelMetrics.jsBarcodeWidth,
                height: labelMetrics.barcodeHeight,
                margin: 0,
                background: "#ffffff",
            });
        } catch (error) {
            console.error("Barcode preview error:", error);
        }
    }, [
        labelMetrics.barcodeHeight,
        labelMetrics.jsBarcodeWidth,
        normalizedPreviewBarcode,
        selectedItem,
    ]);

    const updateSelectedItem = (mutator) => {
        setRows((prevRows) => {
            if (selectedItemIndex === null || !prevRows[selectedItemIndex]) {
                return prevRows;
            }
            const nextRows = [...prevRows];
            const nextItem = { ...nextRows[selectedItemIndex] };
            mutator(nextItem);
            nextRows[selectedItemIndex] = nextItem;
            return nextRows;
        });
    };

    const focusNextField = (currentElement) => {
        if (!currentElement || typeof document === "undefined") {
            return;
        }

        const fields = Array.from(document.querySelectorAll('[data-label-enter="true"]'))
            .filter((node) => !node.disabled && node.offsetParent !== null);
        const currentIndex = fields.indexOf(currentElement);
        if (currentIndex >= 0) {
            fields[currentIndex + 1]?.focus();
        }
    };

    const focusPrintButton = () => {
        printButtonRef.current?.focus();
    };

    const handleSidebarKeyDown = (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveItemIndex((current) => (rows.length ? (current + 1 + rows.length) % rows.length : -1));
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveItemIndex((current) => (rows.length ? (current - 1 + rows.length) % rows.length : -1));
            return;
        }

        if (event.key === "Enter" && activeItemIndex >= 0 && rows[activeItemIndex]) {
            event.preventDefault();
            setSelectedItemIndex(activeItemIndex);
        }
    };

    const openPrintSheet = (printJobs) =>
        new Promise((resolve) => {
            if (
                typeof document === "undefined" ||
                !Array.isArray(printJobs) ||
                printJobs.length === 0
            ) {
                resolve(false);
                return;
            }

            if (!printJobs.every(j => j.barcode && String(j.barcode).trim())) {
                notifyError("Invalid barcode detected in print jobs");
                resolve(false);
                return;
            }

            const labels = printJobs.flatMap((job) => {
                const qty = Math.max(parseInt(job.qty || 1, 10), 1);
                const copies = Math.max(parseInt(job.copies || 1, 10), 1);
                const total = qty * copies;

                return Array.from({ length: total }, () => ({
                    productName: job.productName,
                    barcode: String(job.barcode || "").replace(/[^\x20-\x7E]/g, ""),
                    mrp: Number(job.mrp || 0),
                    saleRate: Number(job.saleRate || 0),
                    designNo: job.designNo || "",
                    qtyText: job.qtyText || `${Number(job.qty || 1)} ${job.unit || "PCS"}`,
                    referenceCode: job.referenceCode || "",
                    partyName: getDisplayName(job.partyName, billPartyName),
                    billNo: bill?.billNo || job.billNo || "",
                }));
            });

            const iframe = document.createElement("iframe");
            iframe.style.position = "fixed";
            iframe.style.width = "0";
            iframe.style.height = "0";
            iframe.style.right = "0";
            iframe.style.bottom = "0";
            iframe.style.border = "0";
            iframe.setAttribute("aria-hidden", "true");
            document.body.appendChild(iframe);

            const printWindow = iframe.contentWindow;
            const printDocument = printWindow?.document;
            if (!printWindow || !printDocument) {
                document.body.removeChild(iframe);
                notifyError("Unable to prepare the label print sheet.");
                resolve(false);
                return;
            }

            printDocument.open();
            printDocument.write(
                buildLabelPrintHtml({
                    labels,
                    labelSize,
                    companyName: appSettings.companyName,
                    billNo: bill?.billNo,
                    barcodeFormat: appSettings.barcodeFormat,
                }),
            );
            printDocument.close();

            let settled = false;
            const finalize = (printed) => {
                if (settled) return;
                settled = true;
                setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                    }
                    resolve(printed);
                }, 250);
            };

            iframe.onload = () => {
                if (!printWindow || !printWindow.document) {
                    finalize(false);
                    return;
                }
                const doc = printWindow.document;

                if (doc.fonts && doc.fonts.ready) {
                    doc.fonts.ready.then(() => {
                        triggerPrint();
                    });
                } else {
                    setTimeout(triggerPrint, 300);
                }

                function triggerPrint() {
                    try {
                        const barcodeNodes = Array.from(doc.querySelectorAll(".barcode-svg"));
                        barcodeNodes.forEach((barcodeNode) => {
                            JsBarcode(barcodeNode, barcodeNode.getAttribute("jsbarcode-value") || "", {
                                format: barcodeNode.getAttribute("jsbarcode-format") || "CODE128",
                                displayValue: false,
                                width: Number(barcodeNode.getAttribute("jsbarcode-width") || labelMetrics.jsBarcodeWidth),
                                height: Number(barcodeNode.getAttribute("jsbarcode-height") || labelMetrics.barcodeHeight),
                                margin: 0,
                                background: "#ffffff",
                            });
                        });
                    } catch (error) {
                        console.error("Print barcode render failed:", error);
                        notifyError("Unable to render barcode for printing.");
                        finalize(false);
                        return;
                    }

                    const handleAfterPrint = () => {
                        finalize(true);
                    };

                    printWindow.addEventListener("afterprint", handleAfterPrint, {
                        once: true,
                    });

                    printWindow.focus();
                    printWindow.print();
                    setTimeout(() => finalize(true), 10000);
                }
            };
        });

    const printRow = async (row) => {
        if (!row) {
            throw new Error("Please select an item to print");
        }
        const requestedLabels = getPrintQuantityForRow(row);
        if (!Number.isInteger(requestedLabels) || requestedLabels <= 0) {
            throw new Error("Invalid label quantity");
        }
        const defaultSalesQty = getDefaultSalesQuantityForRow(row);
        if (!Number.isFinite(defaultSalesQty) || defaultSalesQty <= 0) {
            throw new Error("Invalid default sales quantity");
        }
        const normalizedBarcode = normalizeBarcodeFormat(
            appSettings.barcodeFormat,
            row.barcode,
        );

        if (!normalizedBarcode.value) {
            throw new Error("Invalid barcode before printing");
        }

        const categoryId = row.category || row.categoryObj?._id || null;
        if (!categoryId) {
            throw new Error(`Category missing for ${row.name}`);
        }

        const { data } = await api.post("/label/create", {
            productName: row.name,
            barcode: normalizedBarcode.value || undefined,
            price: Number(row.saleRate),
            purchaseRate: Number(row.purchaseRate || 0),
            qty: defaultSalesQty,
            printQty: requestedLabels,
            copies: 1,
            category: categoryId,
            itemId: row.itemId || row._id,
            brand: row.brand || null,
            unit: row.unit || null,
            mrp: Number(row.mrp || 0),
            saleRate: Number(row.saleRate || 0),
            markupPercent: Number(row.per || 0),
            gstPercent: 0,
            color: row.colour || "",
            material: row.fabric || "",
            style: row.style || "",
            subStyle: row.subStyle || "",
            designNo: row.designNo || "",
            printer,
            labelSize,
            billId: bill?._id,
        });

        if (!data.success) {
            throw new Error(data.message || "Failed to create label");
        }

        setHistory((prev) => [...(data.data?.labels || []), ...prev]);
        setNextBarcode(String(data.data?.nextBarcode || nextBarcode || "1000"));

        return data;
    };

    const buildSinglePrintJob = (row, barcode, historyEntry = null) => {
        const resolvedBarcode = normalizeBarcodeFormat(
            appSettings.barcodeFormat,
            barcode || historyEntry?.barcode || row?.barcode || "",
        ).value;
        const resolvedPartyName = getDisplayName(
            row?.partyName,
            getDisplayName(row?.party, billPartyName),
        );

        return {
            ...buildLabelDraft({
            row,
            barcode: resolvedBarcode,
            companyName: appSettings.companyName,
            billNo: bill?.billNo,
            partyName: resolvedPartyName,
            }),
            barcode: resolvedBarcode,
            qty: getPrintQuantityForRow(row),
            copies: 1,
            partyName: resolvedPartyName,
        };
    };

    const handlePrint = async () => {
        if (!purchaseSettings.labelPrintingEnabled) {
            notifyError("Label printing is disabled in settings.");
            return;
        }
        if (!selectedItem) {
            notifyError("Please select an item to print");
            return;
        }
        try {
            setPrinting(true);
            const targetBarcode = normalizedPreviewBarcode.value || String(nextBarcode);
            const confirmed = await openPrintSheet([
                buildSinglePrintJob(selectedItem, targetBarcode),
            ]);
            if (!confirmed) {
                return;
            }

            const data = await printRow({ ...selectedItem, barcode: targetBarcode });
            const rowKey = getRowKey(selectedItem, selectedItemIndex);
            const newRows = applyPrintedQtyToRows(
                rows,
                rowKey,
                getPrintQuantityForRow(selectedItem),
            );
            const completed =
                Boolean(data.data?.purchase?.labelsPrinted) || newRows.length === 0;

            setRows(newRows);
            setSelectedItemIndex(() => {
                const nextIndex = newRows.findIndex(
                    (row, index) => getRowKey(row, index) === rowKey,
                );

                if (nextIndex >= 0) return nextIndex;
                if (newRows.length === 0) return null;
                return Math.min(selectedItemIndex, newRows.length - 1);
            });

            if (handleSuccess) {
                handleSuccess({
                    billId: bill?._id,
                    remainingItems: newRows,
                    completed,
                });
            }

            if (completed) {
                onClose();
            }
        } catch (err) {
            console.error(err);
            notifyError(err.message || "Error while printing labels");
        } finally {
            setPrinting(false);
        }
    };

    const handleReprint = async () => {
        if (!purchaseSettings.labelPrintingEnabled) {
            notifyError("Label printing is disabled in settings.");
            return;
        }
        if (!selectedItemHistory?._id) {
            notifyError("No printed label found for this item yet");
            return;
        }

        try {
            setPrinting(true);
            const targetBarcode = selectedHistoryEntry?.barcode || selectedItemHistory?.barcode;
            const normalizedTargetBarcode = normalizeBarcodeFormat(appSettings.barcodeFormat, targetBarcode).value;
            if (!normalizedTargetBarcode) {
                notifyError("Saved barcode is missing for this reprint.");
                return;
            }
            const confirmed = await openPrintSheet([
                buildSinglePrintJob(selectedItem, normalizedTargetBarcode, selectedHistoryEntry || selectedItemHistory),
            ]);
            if (!confirmed) {
                return;
            }

            const { data } = await api.post(
                `/label/reprint/${selectedItemHistory._id}`,
                {
                    qty: getPrintQuantityForRow(selectedItem),
                    copies: 1,
                    printer,
                    labelSize,
                    mrp: Number(selectedItem.mrp || 0),
                    saleRate: Number(selectedItem.saleRate || 0),
                    markupPercent: Number(selectedItem.per || 0),
                    gstPercent: 0,
                },
            );

            if (!data.success) {
                notifyError(data.message || "Failed to reprint label");
                return;
            }

            setHistory((prev) => [
                data.data,
                ...prev.filter((entry) => entry._id !== data.data._id),
            ]);
            notifySuccess("Reprint saved successfully");
        } catch (error) {
            console.error(error);
            notifyError("Error while reprinting label");
        } finally {
            setPrinting(false);
        }
    };

    const handlePrintAll = async () => {
        if (!purchaseSettings.labelPrintingEnabled) {
            notifyError("Label printing is disabled in settings.");
            return;
        }
        if (rows.length === 0) {
            return;
        }

        try {
            setPrinting(true);
            const printJobs = [];
            const saveQueue = [];
            const rowsNeedingFreshBarcode = rows.filter((row) => {
                const existingHistory = history.find(
                    (entry) => getEntityId(entry.itemId) === getEntityId(row.itemId),
                );
                return !(existingHistory?.barcode || row.barcode);
            });
            let newBarcodeCursor = Number(nextBarcode || 1000) || 1000;

            if (rowsNeedingFreshBarcode.length > 0 && !nextBarcode) {
                throw new Error("Next barcode is not available yet");
            }

            rows.forEach((row) => {
                const existingHistory = history.find(
                    (entry) => getEntityId(entry.itemId) === getEntityId(row.itemId),
                );
                const barcode = existingHistory?.barcode || row.barcode || String(newBarcodeCursor++);
                printJobs.push(buildSinglePrintJob(row, barcode));
                saveQueue.push({ ...row, barcode });
            });

            const confirmed = await openPrintSheet(printJobs);
            if (!confirmed) {
                return;
            }

            let latestCompletion = false;
            for (const row of saveQueue) {
                const data = await printRow(row);
                latestCompletion = Boolean(data.data?.purchase?.labelsPrinted);
            }

            if (handleSuccess) {
                handleSuccess({
                    billId: bill?._id,
                    remainingItems: [],
                    completed: latestCompletion || rows.length > 0,
                });
            }

            onClose();
        } catch (error) {
            console.error(error);
            notifyError(error.message || "Failed to print all pending items");
        } finally {
            setPrinting(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop fade show"></div>
            <div className="modal fade show d-block label-print-workbench-modal" tabIndex="-1" aria-modal="true" role="dialog" onMouseDown={onClose}>
                <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" onMouseDown={(event) => event.stopPropagation()}>
                    <div className="modal-content">
                        <div className="modal-header">
                            <div>
                                <h5 className="modal-title">Label Workbench</h5>
                                <p className="text-muted mb-0">
                                    Bill {bill?.billNo || "-"} • {bill?.party?.name || bill?.party || "N/A"} •{" "}
                                    {bill?.billDate ? new Date(bill.billDate).toLocaleDateString() : "Date unavailable"}
                                </p>
                            </div>
                            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
                        </div>

                        <div className="modal-body">
                            <div className="row g-3">
                                <div className="col-12 col-xl-3">
                                    <LabelPrintSidebar
                                        bill={bill}
                                        printer={printer}
                                        labelSize={labelSize}
                                        pendingLabelCount={pendingLabelCount}
                                        rows={rows}
                                        selectedItemIndex={selectedItemIndex}
                                        setSelectedItemIndex={setSelectedItemIndex}
                                        history={history}
                                        styles={styles}
                                        itemButton={itemButton}
                                        SummaryRow={SummaryRow}
                                        activeItemIndex={activeItemIndex}
                                        setActiveItemIndex={setActiveItemIndex}
                                        sidebarButtonRefs={sidebarButtonRefs}
                                        onSidebarKeyDown={handleSidebarKeyDown}
                                    />
                                </div>

                                <div className="col-12 col-xl-9">
                                    <LabelPrintEditorPane
                                        selectedItem={selectedItem}
                                        selectedItemHistory={selectedItemHistory}
                                        selectedItemHistories={selectedItemHistories}
                                        barcodeChoice={barcodeChoice}
                                        setBarcodeChoice={setBarcodeChoice}
                                        selectedHistoryEntry={selectedHistoryEntry}
                                        companyAcronym={companyAcronym}
                                        previewLabelDraft={previewLabelDraft}
                                        previewBarcodeRef={previewBarcodeRef}
                                        normalizedPreviewBarcode={normalizedPreviewBarcode}
                                        previewIdentity={previewIdentity}
                                        printer={printer}
                                        setPrinter={setPrinter}
                                        printerOptions={printerOptions}
                                        labelSize={labelSize}
                                        setLabelSize={setLabelSize}
                                        nextBarcode={nextBarcode}
                                        styles={styles}
                                        Field={Field}
                                        onEnterNext={focusNextField}
                                        updateSelectedItem={updateSelectedItem}
                                        calculateMRP={calculateMRP}
                                        handlePrintAll={handlePrintAll}
                                        handleReprint={handleReprint}
                                        handlePrint={handlePrint}
                                        purchaseSettings={purchaseSettings}
                                        printing={printing}
                                        printButtonRef={printButtonRef}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button type="button" className="btn btn_style inActive" onClick={onClose}>
                                <i className="bx bx-x"></i><span>Close</span>
                            </button>
                            <button type="button" className="btn btn_style inActive" onClick={handlePrintAll} disabled={!purchaseSettings.labelPrintingEnabled || printing}>
                                <i className="bx bx-printer"></i><span>Print All Pending</span>
                            </button>
                            <button type="button" className="btn btn_style inActive" onClick={handleReprint} disabled={printing || !selectedHistoryEntry?._id}>
                                <i className="bx bx-refresh"></i><span>Reprint</span>
                            </button>
                            <button type="button" className="btn btn_style" onClick={handlePrint} ref={printButtonRef} data-label-enter="true" disabled={printing || !purchaseSettings.labelPrintingEnabled}>
                                <i className="bx bx-printer"></i><span>{printing ? "Printing..." : "Print Labels"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

const Field = ({
    label,
    value,
    onChange,
    readOnly = false,
    type = "text",
    options = [],
    onEnterNext,
    autoFocus = false,
}) => (
    <div className="col-12 col-sm-6 col-xl-3">
        <label className="form-label">{label}</label>
        {type === "select" ? (
            <select
                value={value}
                onChange={onChange ? (e) => onChange(e.target.value) : undefined}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        onEnterNext?.(event.currentTarget);
                    }
                }}
                data-label-enter="true"
                disabled={readOnly}
                autoFocus={autoFocus}
                className="form-select"
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        ) : (
            <input
                value={value}
                onChange={onChange ? (e) => onChange(e.target.value) : undefined}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        onEnterNext?.(event.currentTarget);
                    }
                }}
                readOnly={readOnly}
                type={type === "number" ? "text" : type}
                inputMode={type === "number" ? "decimal" : undefined}
                data-label-enter="true"
                autoFocus={autoFocus}
                className="form-control"
            />
        )}
    </div>
);

const MetricCard = ({ label, value, tone }) => (
    <div
        className={`app-card ${tone === "muted" ? "muted-card" : "soft-card"}`}
        style={styles.metricCard}
    >
        <div style={styles.metricLabel}>{label}</div>
        <strong style={styles.metricValue}>{value}</strong>
    </div>
);

const SummaryRow = ({ label, value }) => (
    <div className="summary-line">
        <span>{label}</span>
        <strong>{value}</strong>
    </div>
);

const itemButton = (active) => ({
    width: "100%",
    textAlign: "left",
    border: active ? "1px solid rgba(0,0,0,0.03)" : "1px solid var(--line)",
    background: active ? "var(--accent)" : "rgba(255,255,255,0.72)",
    borderRadius: 18,
    padding: "14px 16px",
    cursor: "pointer",
    boxShadow: active
        ? "0 12px 24px rgba(24,34,28,0.08)"
        : "0 4px 12px rgba(24,34,28,0.04)",
});

const styles = {
    backdrop: {
        position: "fixed",
        inset: 0,
        background: "rgba(18, 27, 22, 0.48)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        zIndex: 2000,
    },
    modal: {
        width: "min(1280px, 100%)",
        maxHeight: "92vh",
        overflow: "auto",
        padding: 18,
        borderRadius: 28,
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
        padding: 10,
        marginBottom: 12,
        flexWrap: "wrap",
    },
    headerActions: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        justifyContent: "flex-end",
        alignItems: "center",
    },
    eyebrow: {
        color: "var(--text-soft)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: 12,
        fontWeight: 800,
    },
    subtle: {
        color: "var(--text-soft)",
    },
    closeButton: {
        border: "1px solid var(--line)",
        background: "var(--button-secondary-bg)",
        color: "var(--button-secondary-text)",
        borderRadius: 14,
        padding: "10px 14px",
        cursor: "pointer",
        fontWeight: 700,
    },
    content: {
        display: "grid",
        gridTemplateColumns: "320px minmax(0, 1fr)",
        gap: 18,
    },
    sidebarPanel: {
        display: "grid",
        gap: 14,
        alignContent: "start",
    },
    summaryCard: {
        padding: 16,
    },
    summaryList: {
        display: "grid",
        gap: 10,
    },
    summaryRow: {
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
    },
    panelTitle: {
        fontWeight: 800,
        marginBottom: 8,
    },
    itemList: {
        display: "grid",
        gap: 10,
    },
    itemButtonTop: {
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        alignItems: "center",
        marginBottom: 6,
    },
    itemButtonFooter: {
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        marginTop: 8,
        fontSize: 12,
        color: "var(--text-soft)",
    },
    queuePill: {
        display: "inline-flex",
        minWidth: 28,
        justifyContent: "center",
        padding: "6px 9px",
        borderRadius: 999,
        background: "var(--surface-elevated)",
        fontWeight: 800,
        fontSize: 12,
    },
    historyCard: {
        background: "var(--panel-gradient-soft)",
        border: "1px solid var(--panel-border-soft)",
        borderRadius: 22,
        padding: 16,
    },
    historyList: {
        display: "grid",
        gap: 10,
    },
    historyRow: {
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
        borderRadius: 16,
        padding: "12px 14px",
        background: "var(--button-secondary-bg)",
    },
    smallMuted: {
        color: "var(--text-soft)",
        fontSize: 12,
    },
    editorPanel: {
        display: "grid",
        gap: 16,
        background: "var(--panel-gradient)",
        border: "1px solid var(--panel-border-soft)",
        borderRadius: 24,
        padding: 18,
    },
    settingsGrid: {
        display: "grid",
        gridTemplateColumns: "1.2fr 0.8fr 0.8fr",
        gap: 14,
    },
    infoCard: {
        borderRadius: 20,
        padding: 16,
    },
    metaLabel: {
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginBottom: 4,
        fontWeight: 800,
    },
    itemTitle: {
        fontWeight: 800,
        fontSize: 24,
        marginBottom: 4,
    },
    inlineSettings: {
        borderRadius: 20,
        padding: 16,
        background: "var(--surface-elevated)",
        border: "1px solid var(--line)",
    },
    previewGrid: {
        display: "grid",
        gridTemplateColumns: "1.1fr 0.9fr",
        gap: 14,
    },
    previewCard: {
        padding: 16,
    },
    previewViewport: {
        marginTop: 10,
        display: "grid",
        justifyContent: "center",
        overflowX: "auto",
        paddingBottom: 4,
    },
    labelPreview: {
        borderRadius: 22,
        background: "#fff",
        color: "#000",
        border: "1px solid rgba(0,0,0,0.1)",
        padding: 14,
        display: "grid",
        gap: 8,
        alignContent: "start",
        overflow: "hidden",
        flexShrink: 0,
        position: "relative",
    },
    previewPrintSideText: {
        position: "absolute",
        left: 0,
        top: "50%",
        transform: "rotate(-90deg) translateX(-50%)",
        transformOrigin: "left top",
        fontWeight: 800,
        lineHeight: 1,
        whiteSpace: "nowrap",
    },
    previewPrintTopRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        minWidth: 0,
    },
    previewPrintTitle: {
        fontWeight: 700,
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    previewPrintBarcodeRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minWidth: 0,
    },
    previewPrintBarcode: {
        width: "100%",
        minWidth: 0,
        flex: "1 1 auto",
        overflow: "visible",
    },
    previewPrintDiscount: {
        textAlign: "right",
        flex: "0 0 auto",
    },
    previewPrintDiscountValue: {
        display: "block",
        fontWeight: 800,
        lineHeight: 1,
    },
    previewPrintDiscountLabel: {
        display: "block",
        lineHeight: 1.1,
    },
    previewPrintCode: {
        fontWeight: 700,
        lineHeight: 1,
        flex: "0 0 auto",
        whiteSpace: "nowrap",
    },
    previewPrintBottomRow: {
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        borderTop: "1px solid #000",
        paddingTop: 6,
    },
    previewPrintBottomRowSingle: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        borderTop: "1px solid #000",
        paddingTop: 6,
    },
    previewPrintPriceBlock: {
        minWidth: 0,
    },
    previewPrintSaleBlock: {
        textAlign: "right",
    },
    previewPrintPriceLabel: {
        display: "block",
        lineHeight: 1.1,
    },
    previewPrintPriceValue: {
        margin: 0,
        fontWeight: 800,
        lineHeight: 1.1,
        whiteSpace: "nowrap",
    },
    previewPrintExtra: {
        textAlign: "right",
        lineHeight: 1.15,
    },
    previewHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
    },
    previewQtyText: {
        whiteSpace: "nowrap",
        lineHeight: 1,
        fontWeight: 500,
        flex: "0 0 auto",
    },
    previewHeaderLeft: {
        display: "grid",
        gap: 2,
        minWidth: 0,
        flex: "1 1 auto",
        justifyItems: "end",
    },
    previewMainline: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "start",
    },
    previewBody: {
        display: "grid",
        gap: 6,
        minWidth: 0,
    },
    previewReferenceText: {
        lineHeight: 1,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    previewBrand: {
        fontSize: 14,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        opacity: 1,
        fontWeight: 800,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        textAlign: "right",
    },
    previewCode: {
        fontSize: 11,
        letterSpacing: "0.02em",
        fontWeight: 700,
        opacity: 0.9,
    },
    previewBarcodeNumberBox: {
        minWidth: 132,
        padding: "8px 10px",
        borderRadius: 12,
        border: "1px solid #000",
        background: "#fff",
        textAlign: "right",
        display: "grid",
        gap: 2,
        flex: "0 0 auto",
    },
    previewBarcodeNumberLabel: {
        fontSize: 10,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        opacity: 1,
        fontWeight: 700,
    },
    previewBarcodeNumberValue: {
        fontSize: 32,
        lineHeight: 1,
        fontWeight: 800,
        letterSpacing: "0.04em",
    },
    previewName: {
        fontSize: 28,
        fontWeight: 800,
        lineHeight: 1.02,
        minHeight: 58,
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
    },
    previewVariantText: {
        lineHeight: 1,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    previewPriceRow: {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 12,
    },
    previewPriceRowSingle: {
        gridColumn: "1 / -1",
    },
    previewPriceBox: {
        border: "1px solid #000",
        borderRadius: 14,
        padding: "10px 12px",
        background: "#fff",
        color: "#000",
    },
    previewPriceBoxPrimary: {
        background: "#000",
        color: "#fff",
    },
    previewPriceLabel: {
        fontSize: 14,
        lineHeight: 1,
        textTransform: "uppercase",
        fontWeight: 700,
        letterSpacing: "0.06em",
    },
    previewPriceValue: {
        marginTop: 4,
        fontSize: 24,
        lineHeight: 1.05,
        fontWeight: 800,
    },
    previewBarcodeShell: {
        marginTop: 2,
        background: "#000",
        borderRadius: 22,
        padding: "12px 14px",
    },
    previewBarcodePanel: {
        borderRadius: 18,
        background: "#fff",
        minHeight: 0,
        height: "100%",
        padding: "10px 12px",
        display: "grid",
        placeItems: "center",
    },
    previewBarcodeSvg: {
        minHeight: 112,
        borderRadius: 10,
        background: "#fff",
        color: "#000",
        padding: "0 4px",
        justifySelf: "center",
    },
    reuseHint: {
        marginTop: 12,
        color: "var(--text-soft)",
        fontSize: 12,
    },
    previewSequenceBox: {
        padding: "12px 14px",
        borderRadius: 14,
        border: "1px solid var(--line)",
        background: "var(--surface-soft)",
        fontWeight: 800,
    },
    formGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 14,
    },
    fieldWrap: {
        display: "grid",
        gap: 6,
    },
    fieldLabel: {
        fontSize: 11,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--text-soft)",
    },
    input: {
        width: "100%",
        padding: "12px 13px",
        borderRadius: 14,
        border: "1px solid var(--line)",
        background: "#fff",
    },
    readOnlyInput: {
        background: "var(--field-bg-soft)",
    },
    footer: {
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        marginTop: 8,
        alignItems: "center",
        flexWrap: "wrap",
    },
    footerHint: {
        color: "var(--text-soft)",
        fontSize: 12,
    },
    footerActions: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
    },
    secondaryButton: {
        border: "1px solid var(--line)",
        background: "var(--button-secondary-bg)",
        color: "var(--text-main)",
        borderRadius: 16,
        padding: "12px 18px",
        cursor: "pointer",
        fontWeight: 800,
    },
    printButton: {
        border: "none",
        background: "var(--button-primary)",
        color: "var(--button-primary-text)",
        borderRadius: 16,
        padding: "12px 18px",
        cursor: "pointer",
        fontWeight: 800,
    },
    metricCard: {
        minWidth: 92,
        padding: "10px 12px",
        textAlign: "center",
    },
    metricLabel: {
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--text-soft)",
        marginBottom: 4,
        fontWeight: 800,
    },
    metricValue: {
        fontSize: 20,
    },
    warningBanner: {
        borderRadius: 16,
        padding: "12px 14px",
        background: "var(--warning-soft-bg)",
        color: "var(--warning-soft-text)",
        border: "1px solid var(--warning-soft-border)",
        fontWeight: 700,
    },
    emptyState: {
        borderRadius: 22,
        padding: 32,
        textAlign: "center",
        background: "var(--button-secondary-bg)",
        color: "var(--text-soft)",
    },
};

export default LabelPrintModal;
