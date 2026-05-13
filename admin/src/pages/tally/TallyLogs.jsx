import React, { useEffect, useState } from "react";
import ReportShell from "../../components/reports/ReportShell";
import { fetchTallyLogs } from "../../services/tallyService";
import { notifyError } from "../../utils/notify";

const TallyLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchTallyLogs()
            .then((data) => setLogs(data.data || []))
            .catch((err) => {
                setError(err.message);
                notifyError(err.message || "Failed to load Tally logs");
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div style={{ padding: 24 }}>Loading Tally logs...</div>;
    if (error) return <div style={{ padding: 24, color: "#b42318" }}>Error: {error}</div>;

    return (
        <ReportShell
            eyebrow="Tally logs"
            title="Recent export-preparation activity for Tally."
            description="Review backend Tally prepare/export runs, their status, and the document counts included in each run."
            stats={[
                { label: "Log Entries", value: logs.length, tone: "soft" },
                { label: "Success", value: logs.filter((log) => log.status === "Success").length, tone: "accent" },
                { label: "Failed", value: logs.filter((log) => log.status === "Failed").length, tone: "muted" },
                { label: "Latest", value: logs[0] ? new Date(logs[0].when).toLocaleTimeString() : "-", tone: "soft" },
            ]}
        >
            <section className="card app-card">
                <div className="card-header app-card-header">
                    <div>
                        <h2>Filters</h2>
                        <p>Use consistent master data so downstream billing and reporting stay clean.</p>
                    </div>
                </div>
                <div className="card-body">
                    <form className="row g-3" onSubmit={(e) => e.preventDefault()}>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Module</label>
                            <input className="form-control" placeholder="Enter Module" readOnly />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Status</label>
                            <select className="form-select" defaultValue="">
                                <option value="">Select Status</option>
                                <option>Active</option>
                                <option>Default</option>
                                <option>Pending</option>
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">From Date</label>
                            <input type="date" className="form-control" />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">To Date</label>
                            <input type="date" className="form-control" />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Reference</label>
                            <input className="form-control" placeholder="Enter Reference" readOnly />
                        </div>
                        <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                            <button className="btn btn_style" type="button"><i className="bx bx-save"></i><span>Save</span></button>
                            <button className="btn btn_style inActive" type="button"><i className="bx bx-reset"></i><span>Clear</span></button>
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
                                <select className="form-select form-select-sm datatable-page-size" defaultValue="10">
                                    <option>10</option>
                                    <option>25</option>
                                    <option>50</option>
                                </select>
                            </label>
                            <button className="btn btn_style datatable-create" type="button">
                                <i className="bx bx-plus"></i><span>Create Tally Logs</span>
                            </button>
                        </div>
                        <div className="datatable-toolbar-end">
                            <div className="datatable-search">
                                <input type="text" placeholder="Search Tally Logs" readOnly />
                            </div>
                        </div>
                    </div>

                    <div className="table-responsive app-table-wrap datatable-wrap">
                        <table className="table app-table align-middle">
                            <thead>
                                <tr>
                                    <th>Run ID</th>
                                    <th>Module</th>
                                    <th>Started</th>
                                    <th>Records</th>
                                    <th>Errors</th>
                                    <th>Message</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.length > 0 ? logs.map((log) => (
                                    <tr key={log.id}>
                                        <td>{log.id || "-"}</td>
                                        <td>{log.module}</td>
                                        <td>{new Date(log.when).toLocaleString()}</td>
                                        <td>{log.records || 0}</td>
                                        <td>{log.errors || 0}</td>
                                        <td>{log.detail}</td>
                                        <td>
                                            <span className={`status-badge ${log.status === "Success" ? "status-success" : "status-warning"}`}>
                                                {log.status}
                                            </span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="7">
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
                        <span>Showing {logs.length === 0 ? 0 : 1} to {logs.length} of {logs.length} entries</span>
                    </div>

                </div>
            </section>
        </ReportShell>
    );
};

export default TallyLogs;
