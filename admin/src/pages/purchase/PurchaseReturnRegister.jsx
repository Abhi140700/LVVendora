import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../app/axios";
import useAppSettings from "../../hooks/useAppSettings";
import { confirmAction } from "../../utils/notify";
import { getCompanyName } from "../../utils/appSettings";
import {
    deletePurchaseReturn,
    fetchPurchaseReturnById,
    fetchPurchaseReturns,
} from "../../services/purchaseReturnService";
import {
    exportRowsAsSpreadsheet,
    formatDateDisplay,
    formatDateInput,
    openPurchaseReturnBarcodePrint,
    openPurchaseReturnPrint,
} from "./purchaseReturnHelpers";

function PurchaseReturnRegister() {
    const navigate = useNavigate();
    const appSettings = useAppSettings();
    const companyName = appSettings.companyName || getCompanyName();
    const [filters, setFilters] = useState({
        firm: "",
        party: "",
        barcode: "",
        from: formatDateInput(new Date()),
        to: formatDateInput(new Date()),
    });
    const [firms, setFirms] = useState([]);
    const [parties, setParties] = useState([]);
    const [returns, setReturns] = useState([]);
    const [selectedId, setSelectedId] = useState("");
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        Promise.all([
            api.get("/parties", { params: { type: "firm" } }).then(({ data }) => data).catch(() => ({ data: [] })),
            api.get("/parties", { params: { type: "party" } }).then(({ data }) => data).catch(() => ({ data: [] })),
        ]).then(([firmData, partyData]) => {
            setFirms(Array.isArray(firmData.data) ? firmData.data : []);
            setParties(Array.isArray(partyData.data) ? partyData.data : []);
        });
    }, []);

    const filtersRef = useRef(filters);
    useEffect(() => {
        filtersRef.current = filters;
    }, [filters]);

    const loadRegister = useCallback(async (nextFilters) => {
        const activeFilters = nextFilters ?? filtersRef.current;
        try {
            setLoading(true);
            const data = await fetchPurchaseReturns(activeFilters);
            setReturns(data.data || []);
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to load purchase return register");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRegister(filtersRef.current);
    }, [loadRegister]);

    const summary = useMemo(() => ({
        qty: returns.reduce((sum, entry) => sum + Number(entry.totalQty || 0), 0),
        taxable: returns.reduce((sum, entry) => sum + Number(entry.taxableAmount || 0), 0),
        gst: returns.reduce((sum, entry) => sum + Number(entry.gstAmount || 0), 0),
        net: returns.reduce((sum, entry) => sum + Number(entry.netAmount || 0), 0),
    }), [returns]);

    const openDetail = async (recordId) => {
        try {
            const data = await fetchPurchaseReturnById(recordId);
            setSelectedRecord(data.data || null);
            setSelectedId(recordId);
            setDetailOpen(true);
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to open purchase return");
        }
    };

    const exportRegister = () => {
        exportRowsAsSpreadsheet(
            "purchase-return-register.xls",
            ["Ret.No", "Sr.No.", "Ret.Date", "Firm", "Party Name", "State", "Ret.Qty", "Total Amt", "Disc Amt", "Taxable", "GST Amt", "Charges", "Net Amt", "Debit Note"],
            returns.map((entry, index) => [
                entry.returnNo,
                index + 1,
                formatDateDisplay(entry.returnDate),
                entry.firm,
                entry.party,
                entry.partyState,
                entry.totalQty,
                entry.totalAmount,
                entry.discountAmount,
                entry.taxableAmount,
                entry.gstAmount,
                entry.addCharges,
                entry.netAmount,
                entry.debitNoteNo,
            ])
        );
    };

    const handleDelete = async () => {
        if (!selectedId) {
            toast.error("Select a return bill first.");
            return;
        }

        if (!(await confirmAction("Delete this purchase return bill?"))) {
            return;
        }

        try {
            await deletePurchaseReturn(selectedId);
            toast.success("Purchase return deleted");
            setSelectedId("");
            setSelectedRecord(null);
            setDetailOpen(false);
            await loadRegister();
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Failed to delete purchase return");
        }
    };

    return (
        <>
            <div className="page-header card">
                <div className="card-body">
                    <div>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-2">
                                <li className="breadcrumb-item"><a href="/dashboard">Home</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Purchase Operations</li>
                            </ol>
                        </nav>
                        <p className="section-label">Purchase Operations</p>
                        <h1>Return Register</h1>
                        <p className="mb-0 text-muted">Review all purchase returns with debit note, inventory, and supplier settlement status.</p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-check-circle"></i> Ready</span>
                        <button className="btn btn_style" type="button" onClick={() => navigate("/purchase/return")}>
                            <i className="bx bx-plus"></i><span>New</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="row g-3 mb-3">
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card stat-card"><div className="card-body"><span className="stat-icon text-primary"><i className="bx bx-package"></i></span><p>Total Qty</p><h3>{summary.qty.toFixed(2)}</h3></div></div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card stat-card"><div className="card-body"><span className="stat-icon text-success"><i className="bx bx-receipt"></i></span><p>Taxable</p><h3>Rs. {summary.taxable.toFixed(2)}</h3></div></div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card stat-card"><div className="card-body"><span className="stat-icon text-warning"><i className="bx bx-rupee"></i></span><p>GST</p><h3>Rs. {summary.gst.toFixed(2)}</h3></div></div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card stat-card"><div className="card-body"><span className="stat-icon text-info"><i className="bx bx-wallet"></i></span><p>Net Amount</p><h3>Rs. {summary.net.toFixed(2)}</h3></div></div>
                </div>
            </div>

            <section className="card app-card">
                <div className="card-header app-card-header">
                    <div>
                        <h2>Filters</h2>
                        <p>Use consistent master data so downstream billing and reporting stay clean.</p>
                    </div>
                </div>
                <div className="card-body">
                    <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                        <FilterField label="Return No">
                            <input type="text" className="form-control" placeholder="Enter Return No" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} />
                        </FilterField>
                        <FilterField label="Party">
                            <select className="form-select" value={filters.party} onChange={(event) => setFilters((current) => ({ ...current, party: event.target.value }))}>
                                <option value="">All Parties</option>
                                {parties.map((party) => <option key={party._id} value={party.name}>{party.name}</option>)}
                            </select>
                        </FilterField>
                        <FilterField label="Bill No">
                            <input type="text" className="form-control" placeholder="Enter Bill No" readOnly />
                        </FilterField>
                        <FilterField label="GRN">
                            <input type="text" className="form-control" placeholder="Enter GRN" readOnly />
                        </FilterField>
                        <FilterField label="From Date">
                            <input type="date" className="form-control" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} />
                        </FilterField>
                        <FilterField label="To Date">
                            <input type="date" className="form-control" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} />
                        </FilterField>
                        <FilterField label="Status">
                            <select className="form-select" defaultValue="Select Status">
                                <option>Select Status</option>
                                <option>Active</option>
                                <option>Default</option>
                                <option>Pending</option>
                            </select>
                        </FilterField>
                        <FilterField label="Firm">
                            <select className="form-select" value={filters.firm} onChange={(event) => setFilters((current) => ({ ...current, firm: event.target.value }))}>
                                <option value="">All Firms</option>
                                {firms.map((firm) => <option key={firm._id} value={firm.name}>{firm.name}</option>)}
                            </select>
                        </FilterField>
                        <FilterField label="Barcode">
                            <input type="text" className="form-control" value={filters.barcode} onChange={(event) => setFilters((current) => ({ ...current, barcode: event.target.value }))} placeholder="Enter Barcode" />
                        </FilterField>
                        <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                            <button className="btn btn_style" type="button" onClick={() => loadRegister()}><i className="bx bx-save"></i><span>Show</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={() => setFilters({ firm: "", party: "", barcode: "", from: formatDateInput(new Date()), to: formatDateInput(new Date()) })}><i className="bx bx-reset"></i><span>Clear</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={() => selectedRecord ? openPurchaseReturnPrint(selectedRecord, companyName) : window.print()}><i className="bx bx-printer"></i><span>Print</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={exportRegister}><i className="bx bx-export"></i><span>Export</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={() => selectedId ? openDetail(selectedId) : navigate("/purchase/return")}><i className="bx bx-search"></i><span>Add/Find</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={() => toast("E-Waybill flow is ready for the next backend pass.")}><i className="bx bx-file"></i><span>E-Waybill</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={() => toast("eInvoice hook will be added after API mapping.")}><i className="bx bx-receipt"></i><span>eInvoice</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={() => navigate("/purchase")}><i className="bx bx-log-out"></i><span>Exit</span></button>
                        </div>
                    </form>
                </div>
            </section>

            <section className="card app-card app-datatable-card">
                <div className="card-body p-0">
                    <div className="datatable-toolbar">
                        <div className="datatable-toolbar-start">
                            <label className="datatable-length">
                                <span>Show</span>
                                <select className="form-select form-select-sm datatable-page-size" aria-label="Rows per page" defaultValue="10">
                                    <option>10</option>
                                    <option>25</option>
                                    <option>50</option>
                                </select>
                            </label>
                            <button className="btn btn_style datatable-create" type="button" onClick={() => navigate("/purchase/return")}>
                                <i className="bx bx-plus"></i><span>Create Return</span>
                            </button>
                        </div>
                        <div className="datatable-toolbar-end">
                            <button className="btn btn_style inActive datatable-tool-btn" type="button" data-bs-toggle="offcanvas" data-bs-target="#advancedFilterOffcanvas" aria-controls="advancedFilterOffcanvas">
                                <i className="bx bx-filter-alt"></i><span>Filters</span>
                            </button>
                            <div className="dropdown">
                                <button className="btn btn_style inActive datatable-tool-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <i className="bx bx-columns"></i><span>Columns</span>
                                </button>
                                <div className="dropdown-menu dropdown-menu-end datatable-column-menu">
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" defaultChecked /><span>Reference</span></label>
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" defaultChecked /><span>Date</span></label>
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" defaultChecked /><span>Party</span></label>
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" defaultChecked /><span>Amount</span></label>
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" /><span>Status</span></label>
                                </div>
                            </div>
                            <div className="dropdown">
                                <button className="btn btn_style inActive datatable-tool-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <i className="bx bx-export"></i><span>Export</span>
                                </button>
                                <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                    <button className="dropdown-item" type="button" onClick={exportRegister}><i className="bx bx-file me-2"></i>CSV</button>
                                    <button className="dropdown-item" type="button" onClick={exportRegister}><i className="bx bx-spreadsheet me-2"></i>Excel</button>
                                    <button className="dropdown-item" type="button" onClick={() => selectedRecord ? openPurchaseReturnPrint(selectedRecord, companyName) : window.print()}><i className="bx bx-printer me-2"></i>Print</button>
                                </div>
                            </div>
                            <div className="datatable-search">
                                <input type="text" placeholder="Search Return Register" aria-label="Search Return Register" value={filters.barcode} onChange={(event) => setFilters((current) => ({ ...current, barcode: event.target.value }))} />
                            </div>
                            <select className="form-select datatable-status-filter" aria-label="Filter status" defaultValue="Invoice Status">
                                <option>Invoice Status</option>
                                <option>Active</option>
                                <option>Paid</option>
                                <option>Pending</option>
                                <option>Received</option>
                            </select>
                        </div>
                    </div>

                    <div className="datatable-bulk-bar">
                        <div className="datatable-bulk-copy">
                            <strong>{selectedId ? 1 : 0} selected</strong>
                            <span>{selectedId ? "Selected return actions are available" : "Choose rows to unlock bulk actions"}</span>
                        </div>
                        <div className="datatable-bulk-actions">
                            <button className="btn btn_style inActive" type="button"><i className="bx bx-archive"></i><span>Archive</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={exportRegister}><i className="bx bx-export"></i><span>Export</span></button>
                            <button className="btn btn_style inActive" type="button" onClick={handleDelete}><i className="bx bx-trash"></i><span>Delete</span></button>
                        </div>
                    </div>

                    <div className="table-responsive app-table-wrap datatable-wrap">
                        <table className="table app-table align-middle">
                            <thead>
                                <tr>
                                    <th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" aria-label="Select all rows" /></th>
                                    <th><span className="sortable-heading">Return No<i className="bx bx-sort-up"></i></span></th>
                                    <th><span className="sortable-heading">Return Date<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Party<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Bill No<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Items<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Debit Note<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Amount<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Status<i className="bx bx-sort"></i></span></th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr className="table-state-row table-state-row-loading">
                                        <td colSpan="10">
                                            <div className="table-skeleton-list" aria-label="Loading rows"><span></span><span></span><span></span></div>
                                        </td>
                                    </tr>
                                ) : returns.length > 0 ? returns.map((entry) => (
                                    <tr key={entry._id} onClick={() => setSelectedId(entry._id)} onDoubleClick={() => openDetail(entry._id)} className={entry._id === selectedId ? "table-active" : ""}>
                                        <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" checked={entry._id === selectedId} readOnly /></td>
                                        <td>{entry.returnNo}</td>
                                        <td>{formatDateDisplay(entry.returnDate)}</td>
                                        <td>{entry.party || "-"}</td>
                                        <td>{entry.items?.[0]?.sourceBillNo || entry.billNo || "-"}</td>
                                        <td>{entry.items?.length || 0}</td>
                                        <td>{entry.debitNoteNo || "Pending"}</td>
                                        <td>{Number(entry.netAmount || 0).toFixed(2)}</td>
                                        <td><span className={`status-badge ${entry.debitNoteNo ? "status-success" : "status-warning"}`}>{entry.debitNoteNo ? "Settled" : "Draft"}</span></td>
                                        <td className="text-end"><ReturnRegisterActions onView={() => openDetail(entry._id)} onDelete={handleDelete} /></td>
                                    </tr>
                                )) : (
                                    <tr className="table-state-row table-state-row-empty">
                                        <td colSpan="10">
                                            <div className="empty-state compact">
                                                <span className="empty-state-icon"><i className="bx bx-search-alt"></i></span>
                                                <h6>No matching records</h6>
                                                <p>Try changing filters or clearing the search field.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="pagination-row">
                        <span>Showing {returns.length === 0 ? 0 : 1} to {returns.length} of {returns.length} entries</span>
                        <nav aria-label="Table pagination">
                            <ul className="pagination pagination-sm mb-0">
                                <li className="page-item disabled"><a className="page-link" href="#" aria-label="Previous"><i className="bx bx-chevron-left"></i></a></li>
                                <li className="page-item active"><a className="page-link" href="#">1</a></li>
                                <li className="page-item disabled"><a className="page-link" href="#" aria-label="Next"><i className="bx bx-chevron-right"></i></a></li>
                            </ul>
                        </nav>
                    </div>
                </div>
            </section>

            {detailOpen && selectedRecord ? (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" aria-hidden="false" onClick={() => setDetailOpen(false)}>
                        <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(event) => event.stopPropagation()}>
                            <div className="modal-content">
                                <div className="modal-header">
                                    <div>
                                        <h5 className="modal-title">Purchase Return {selectedRecord.returnNo}</h5>
                                        <p className="text-muted mb-0">{selectedRecord.party || "-"} | {formatDateDisplay(selectedRecord.returnDate)} | Debit Note {selectedRecord.debitNoteNo || "-"}</p>
                                    </div>
                                    <button type="button" className="btn-close" onClick={() => setDetailOpen(false)} aria-label="Close"></button>
                                </div>
                                <div className="modal-body">
                                    <div className="row g-3 mb-3">
                                        <DetailField label="Firm" value={selectedRecord.firm} />
                                        <DetailField label="Party" value={selectedRecord.party} />
                                        <DetailField label="Phone" value={selectedRecord.partyPhone} />
                                        <DetailField label="State" value={selectedRecord.partyState} />
                                        <DetailField label="Transporter" value={selectedRecord.transporterName} />
                                        <DetailField label="LR No" value={selectedRecord.lrNo} />
                                        <DetailField label="Vehicle No" value={selectedRecord.vehicleNo} />
                                        <DetailField label="Narration" value={selectedRecord.narration} />
                                    </div>

                                    <div className="table-responsive app-table-wrap datatable-wrap">
                                        <table className="table app-table align-middle">
                                            <thead>
                                                <tr>
                                                    <th>Sr.</th>
                                                    <th>Barcode ID</th>
                                                    <th>Bill No</th>
                                                    <th>GRN</th>
                                                    <th>Item Name</th>
                                                    <th>BoxNo</th>
                                                    <th>Qty</th>
                                                    <th>Rate</th>
                                                    <th>Amount</th>
                                                    <th>Cmsn</th>
                                                    <th>Disc</th>
                                                    <th>GST</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(selectedRecord.items || []).map((item, index) => (
                                                    <tr key={`${item.labelId}-${index}`}>
                                                        <td>{index + 1}</td>
                                                        <td>{item.barcode}</td>
                                                        <td>{item.sourceBillNo}</td>
                                                        <td>{item.sourceGrnNo}</td>
                                                        <td>{item.name}</td>
                                                        <td>{item.boxNo || "-"}</td>
                                                        <td>{item.qty}</td>
                                                        <td>{Number(item.rate || 0).toFixed(2)}</td>
                                                        <td>{Number(item.amount || 0).toFixed(2)}</td>
                                                        <td>{Number(item.commission || 0).toFixed(2)}</td>
                                                        <td>{Number(item.discount || 0).toFixed(2)}</td>
                                                        <td>{Number(item.gstPercent || 0).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn_style inActive" onClick={() => navigate(`/purchase/return?returnId=${selectedRecord._id}`)}>Edit</button>
                                    <button type="button" className="btn btn_style inActive" onClick={handleDelete}>Delete</button>
                                    <button type="button" className="btn btn_style inActive" onClick={() => openPurchaseReturnPrint(selectedRecord, companyName)}>Print</button>
                                    <button type="button" className="btn btn_style inActive" onClick={() => openPurchaseReturnBarcodePrint(selectedRecord, companyName)}>Print Barcode</button>
                                    <button type="button" className="btn btn_style" onClick={() => setDetailOpen(false)}>Close</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}

            <div className="modal fade" id="pageActionModal" tabIndex="-1" aria-hidden="true">
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">New Return Register</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            <p className="text-muted mb-3">Use the page form or table action menu to continue this workflow.</p>
                            <div className="quick-action-list">
                                <button className="quick-action" type="button" onClick={() => navigate("/purchase/return")}><i className="bx bx-plus"></i><span>Create record</span></button>
                                <button className="quick-action" type="button" onClick={exportRegister}><i className="bx bx-import"></i><span>Export data</span></button>
                                <button className="quick-action" type="button" onClick={() => selectedRecord ? openPurchaseReturnPrint(selectedRecord, companyName) : window.print()}><i className="bx bx-printer"></i><span>Print view</span></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

const FilterField = ({ label, children }) => (
    <div className="col-12 col-sm-6 col-xl-3">
        <label className="form-label">{label}</label>
        {children}
    </div>
);

const DetailField = ({ label, value }) => (
    <div className="col-12 col-sm-6 col-xl-3">
        <div className="summary-line">
            <span>{label}</span>
            <strong>{value || "-"}</strong>
        </div>
    </div>
);

const ReturnRegisterActions = ({ onView, onDelete }) => (
    <div className="datatable-actions">
        <button type="button" className="btn action-btn" aria-label="Delete" onClick={(event) => { event.stopPropagation(); onDelete(); }}><i className="bx bx-trash"></i></button>
        <button type="button" className="btn action-btn" aria-label="View" onClick={(event) => { event.stopPropagation(); onView(); }}><i className="bx bx-show"></i></button>
        <div className="dropdown">
            <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions" onClick={(event) => event.stopPropagation()}>
                <i className="bx bx-dots-vertical-rounded"></i>
            </button>
            <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                <button className="dropdown-item" type="button" onClick={(event) => { event.stopPropagation(); onView(); }}>Download</button>
                <button className="dropdown-item" type="button" onClick={(event) => { event.stopPropagation(); onView(); }}>Edit</button>
                <button className="dropdown-item" type="button">Duplicate</button>
            </div>
        </div>
    </div>
);

export default PurchaseReturnRegister;
