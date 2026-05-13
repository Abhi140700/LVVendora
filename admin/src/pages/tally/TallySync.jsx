import React, { useEffect, useState } from "react";
import { exportTallyPayload, exportTallyXml, fetchTallySyncSnapshot, syncTally } from "../../services/tallyService";
import { notifyError, notifySuccess } from "../../utils/notify";

const TallySync = () => {
    const [snapshot, setSnapshot] = useState(null);
    const [filters, setFilters] = useState({ fromDate: "", toDate: "", onlyUnexported: true });
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState(null);

    const load = async (nextFilters = filters) => {
        setLoading(true);
        try {
            const data = await fetchTallySyncSnapshot(nextFilters);
            setSnapshot(data.data);
            setFilters((current) => ({
                ...current,
                fromDate: data.data?.filters?.fromDate ? String(data.data.filters.fromDate).slice(0, 10) : current.fromDate,
                toDate: data.data?.filters?.toDate ? String(data.data.filters.toDate).slice(0, 10) : current.toDate,
                onlyUnexported: Boolean(data.data?.filters?.onlyUnexported),
            }));
            setError(null);
        } catch (err) {
            setError(err.message);
            notifyError(err.message || "Failed to load Tally snapshot");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const result = await syncTally(filters);
            setMessage(result.message);
            notifySuccess(result.message || "Tally payload prepared successfully.");
            await load(filters);
        } catch (err) {
            setError(err.message);
            notifyError(err.message || "Failed to prepare Tally payload");
        } finally {
            setSyncing(false);
        }
    };

    if (loading) return <div className="card app-card"><div className="card-body">Loading Tally sync...</div></div>;
    if (error) return <div className="card app-card"><div className="card-body text-danger">Error: {error}</div></div>;

    return (
        <>
            <div className="page-header card">
                <div className="card-body">
                    <div>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-2">
                                <li className="breadcrumb-item"><a href="/dashboard">Home</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Tally</li>
                            </ol>
                        </nav>
                        <p className="section-label">Tally</p>
                        <h1>Tally Sync</h1>
                        <p className="mb-0 text-muted">Prepare masters, vouchers, invoices, payments, and stock data for Tally synchronization.</p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-check-circle"></i> Ready</span>
                        <button className="btn btn_style" type="button" onClick={handleSync} disabled={syncing}>
                            <i className="bx bx-sync"></i><span>{syncing ? "Preparing..." : "Prepare Export"}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="row g-3">
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card stat-card">
                        <div className="card-body">
                            <span className="stat-icon text-warning"><i className="bx bx-time"></i></span>
                            <p>Pending Vouchers</p>
                            <h3>{snapshot?.vouchers?.length || 0}</h3>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card stat-card">
                        <div className="card-body">
                            <span className="stat-icon text-success"><i className="bx bx-check-circle"></i></span>
                            <p>Sales Queue</p>
                            <h3>{snapshot?.salesCount || 0}</h3>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card stat-card">
                        <div className="card-body">
                            <span className="stat-icon text-danger"><i className="bx bx-error-circle"></i></span>
                            <p>Purchase Queue</p>
                            <h3>{snapshot?.purchaseCount || 0}</h3>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card stat-card">
                        <div className="card-body">
                            <span className="stat-icon text-primary"><i className="bx bx-sync"></i></span>
                            <p>Ledger Queue</p>
                            <h3>{snapshot?.ledgerCount || 0}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {message ? <div className="alert alert-success mt-3" role="alert">{message}</div> : null}

            <section className="card app-card mt-3">
                <div className="card-header app-card-header">
                    <div>
                        <h2>Filters</h2>
                        <p>Filter the export queue before preparing Tally payloads.</p>
                    </div>
                </div>
                <div className="card-body">
                    <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">From</label>
                            <input
                                type="date"
                                className="form-control"
                                value={filters.fromDate}
                                onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
                            />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">To</label>
                            <input
                                type="date"
                                className="form-control"
                                value={filters.toDate}
                                onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
                            />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3 d-flex align-items-end">
                            <label className="filter-check-row mb-0">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    checked={filters.onlyUnexported}
                                    onChange={(event) => setFilters((current) => ({ ...current, onlyUnexported: event.target.checked }))}
                                />
                                <span>Only unexported</span>
                            </label>
                        </div>
                        <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                            <button type="button" onClick={() => load(filters)} className="btn btn_style inActive">
                                <i className="bx bx-filter-alt"></i><span>Apply Filters</span>
                            </button>
                            <button type="button" onClick={handleSync} className="btn btn_style" disabled={syncing}>
                                <i className="bx bx-sync"></i><span>{syncing ? "Preparing..." : "Prepare Export"}</span>
                            </button>
                            <button type="button" className="btn btn_style inActive" onClick={async () => {
                                try {
                                    const payload = await exportTallyPayload(filters);
                                    setMessage(`Exported payload with ${payload.salesCount} sales and ${payload.purchaseCount} purchases.`);
                                    notifySuccess(`JSON exported with ${payload.vouchers?.length || 0} vouchers.`);
                                    await load(filters);
                                } catch (err) {
                                    setError(err.message);
                                    notifyError(err.message || "Failed to export Tally JSON");
                                }
                            }}>
                                <i className="bx bx-file"></i><span>Download JSON</span>
                            </button>
                            <button type="button" className="btn btn_style inActive" onClick={async () => {
                                try {
                                    const payload = await exportTallyXml(filters);
                                    setMessage(`Exported XML file ${payload.fileName}.`);
                                    notifySuccess(`XML exported as ${payload.fileName}.`);
                                    await load(filters);
                                } catch (err) {
                                    setError(err.message);
                                    notifyError(err.message || "Failed to export Tally XML");
                                }
                            }}>
                                <i className="bx bx-code-alt"></i><span>Download XML</span>
                            </button>
                        </div>
                    </form>
                </div>
            </section>

            <section className="card app-card app-datatable-card mt-3">
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
                            <button className="btn btn_style datatable-create" type="button" onClick={handleSync} disabled={syncing}>
                                <i className="bx bx-plus"></i><span>Create Sync</span>
                            </button>
                        </div>
                        <div className="datatable-toolbar-end">
                            <button className="btn btn_style inActive datatable-tool-btn" type="button">
                                <i className="bx bx-filter-alt"></i><span>Filters</span>
                            </button>
                            <div className="dropdown">
                                <button className="btn btn_style inActive datatable-tool-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <i className="bx bx-columns"></i><span>Columns</span>
                                </button>
                                <div className="dropdown-menu dropdown-menu-end datatable-column-menu">
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" defaultChecked /><span>Module</span></label>
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" defaultChecked /><span>Pending</span></label>
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" defaultChecked /><span>Status</span></label>
                                    <label className="dropdown-item column-toggle-row"><input className="form-check-input" type="checkbox" defaultChecked /><span>Tracking</span></label>
                                </div>
                            </div>
                            <div className="dropdown">
                                <button className="btn btn_style inActive datatable-tool-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <i className="bx bx-export"></i><span>Export</span>
                                </button>
                                <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                    <button className="dropdown-item" type="button" onClick={async () => {
                                        try {
                                            const payload = await exportTallyPayload(filters);
                                            setMessage(`Exported payload with ${payload.salesCount} sales and ${payload.purchaseCount} purchases.`);
                                            notifySuccess(`JSON exported with ${payload.vouchers?.length || 0} vouchers.`);
                                            await load(filters);
                                        } catch (err) {
                                            setError(err.message);
                                            notifyError(err.message || "Failed to export Tally JSON");
                                        }
                                    }}><i className="bx bx-file me-2"></i>JSON</button>
                                    <button className="dropdown-item" type="button" onClick={async () => {
                                        try {
                                            const payload = await exportTallyXml(filters);
                                            setMessage(`Exported XML file ${payload.fileName}.`);
                                            notifySuccess(`XML exported as ${payload.fileName}.`);
                                            await load(filters);
                                        } catch (err) {
                                            setError(err.message);
                                            notifyError(err.message || "Failed to export Tally XML");
                                        }
                                    }}><i className="bx bx-code-alt me-2"></i>XML</button>
                                </div>
                            </div>
                            <div className="datatable-search">
                                <input type="text" placeholder="Search Sync Queue" aria-label="Search Sync Queue" readOnly />
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
                            <strong>0 selected</strong>
                            <span>Choose rows to unlock bulk actions</span>
                        </div>
                        <div className="datatable-bulk-actions">
                            <button className="btn btn_style inActive" type="button"><i className="bx bx-archive"></i><span>Archive</span></button>
                            <button className="btn btn_style inActive" type="button"><i className="bx bx-export"></i><span>Export</span></button>
                            <button className="btn btn_style inActive" type="button"><i className="bx bx-trash"></i><span>Delete</span></button>
                        </div>
                    </div>

                    <div className="table-responsive app-table-wrap datatable-wrap">
                        <table className="table app-table align-middle">
                            <thead>
                                <tr>
                                    <th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" aria-label="Select all rows" /></th>
                                    <th><span className="sortable-heading">Module<i className="bx bx-sort-up"></i></span></th>
                                    <th><span className="sortable-heading">Pending<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Last Run<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Next Action<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Owner<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Status<i className="bx bx-sort"></i></span></th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(snapshot?.queue || []).length > 0 ? (snapshot?.queue || []).map((row) => (
                                    <tr key={row.module}>
                                        <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" /></td>
                                        <td>{row.module}</td>
                                        <td>{row.count}</td>
                                        <td>-</td>
                                        <td>{row.count ? "Auto Sync" : "-"}</td>
                                        <td>System</td>
                                        <td><span className="status-badge status-success">{row.status}</span></td>
                                        <td className="text-end">
                                            <div className="datatable-actions">
                                                <button type="button" className="btn action-btn" aria-label="Delete"><i className="bx bx-trash"></i></button>
                                                <button type="button" className="btn action-btn" aria-label="View"><i className="bx bx-show"></i></button>
                                                <div className="dropdown">
                                                    <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions">
                                                        <i className="bx bx-dots-vertical-rounded"></i>
                                                    </button>
                                                    <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                                        <button className="dropdown-item" type="button">Download</button>
                                                        <button className="dropdown-item" type="button">Edit</button>
                                                        <button className="dropdown-item" type="button">Duplicate</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr className="table-state-row table-state-row-empty">
                                        <td colSpan="8">
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
                        <span>Showing {(snapshot?.queue || []).length === 0 ? 0 : 1} to {(snapshot?.queue || []).length} of {(snapshot?.queue || []).length} entries</span>
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
        </>
    );
};

const styles = {
    message: {
        padding: 16,
    },
    filterCard: {
        padding: 16,
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "end",
    },
    filterField: {
        display: "grid",
        gap: 6,
        minWidth: 180,
    },
    input: {
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: "10px 12px",
        background: "var(--surface)",
        color: "var(--text-main)",
    },
    checkbox: {
        display: "flex",
        gap: 8,
        alignItems: "center",
        paddingBottom: 10,
    },
    tableCard: {
        padding: 14,
    },
};

const buttonStyle = {
    border: "none",
    borderRadius: 16,
    padding: "12px 16px",
    background: "linear-gradient(135deg, #17261f 0%, #314a3d 100%)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
};

const secondaryButtonStyle = {
    border: "1px solid var(--line)",
    borderRadius: 16,
    padding: "12px 16px",
    background: "var(--surface)",
    color: "var(--text-main)",
    fontWeight: 800,
    cursor: "pointer",
};

export default TallySync;
