import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../app/axios";
import useAppSettings from "../../hooks/useAppSettings";
import { getCompanyName } from "../../utils/appSettings";

const API_BASE = globalThis.__ERP_API_BASE__ || "/api";

const toApiUrl = (url = "") => {
    const apiBase = API_BASE.replace(/\/$/, "");
    const value = String(url);

    if (value.startsWith(apiBase)) {
        return value.slice(apiBase.length) || "/";
    }

    return value;
};

async function fetchWithAuth(url, options = {}) {
    const method = options.method || "GET";
    let payload = options.body;

    if (typeof payload === "string") {
        try {
            payload = JSON.parse(payload);
        } catch {
            payload = undefined;
        }
    }

    try {
        const { data } = await api.request({
            url: toApiUrl(url),
            method,
            data: payload,
            headers: options.headers,
        });

        return data;
    } catch (error) {
        throw new Error(error.response?.data?.message || error.message || "Request failed");
    }
}

const buildEmptyForm = (firmName = getCompanyName()) => ({
    lrId: "",
    lrNo: "",
    bale: "",
    godown: "",
    transporter: "",
    partyName: "",
    inwardDate: new Date().toISOString().slice(0, 10),
    hundekari: "",
    transportCharges: "",
    hamaliCharges: "",
    narration: "",
    firmName,
    billNo: "",
});

const sortByName = (items = []) => [...items].sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));

const buildEmptyEntityForm = (name = "") => ({
    name,
    contactPerson: "",
    phone: "",
    email: "",
    gstNo: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    stateCode: "",
    pincode: "",
    notes: "",
});

const ENTITY_LABELS = {
    party: "Party",
    transporter: "Transporter",
};

const normalizeLookupData = (record = {}) => ({
    lrId: record?.lrId || "",
    lrNo: record?.lrNo || "",
    bale: record?.bale || "",
    godown: record?.godown || "",
    transporter: record?.transporter || "",
    partyName: record?.partyName || record?.party || "",
    inwardDate: record?.inwardDate ? String(record.inwardDate).slice(0, 10) : "",
    hundekari: record?.hundekari || "",
    transportCharges: record?.transportCharges || "",
    hamaliCharges: record?.hamaliCharges || "",
    narration: record?.narration || "",
    firmName: record?.firmName || record?.firm || "",
    billNo: record?.billNo || "",
});

const LrIdLookup = () => {
    const navigate = useNavigate();
    const appSettings = useAppSettings();
    const companyName = appSettings.companyName || getCompanyName();
    const [searchParams, setSearchParams] = useSearchParams();
    const [lrId, setLrId] = useState(searchParams.get("lrId") || "");
    const [purchase, setPurchase] = useState(null);
    const [lrEntry, setLrEntry] = useState(null);
    const [nextSuggestedLrId, setNextSuggestedLrId] = useState("");
    const [parties, setParties] = useState([]);
    const [transporters, setTransporters] = useState([]);
    const [firms, setFirms] = useState([]);
    const [form, setForm] = useState(buildEmptyForm);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [modalForm, setModalForm] = useState(buildEmptyForm);
    const [entityModal, setEntityModal] = useState({
        open: false,
        type: "party",
        target: "form",
        loadingGst: false,
        form: buildEmptyEntityForm(),
    });

    const firmOptions = useMemo(() => {
        const normalizedCompanyName = String(companyName || "").trim();
        const options = sortByName(firms);

        if (normalizedCompanyName && !options.some((firm) => String(firm.name || "").trim().toLowerCase() === normalizedCompanyName.toLowerCase())) {
            options.push({ _id: "settings-company", name: normalizedCompanyName });
        }

        return sortByName(options);
    }, [companyName, firms]);

    useEffect(() => {
        setForm((current) => (
            current.firmName && current.firmName !== getCompanyName()
                ? current
                : { ...current, firmName: companyName }
        ));
        setModalForm((current) => (
            current.firmName && current.firmName !== getCompanyName()
                ? current
                : { ...current, firmName: companyName }
        ));
    }, [companyName]);

    const fetchNextLrId = useCallback(async () => {
        const data = await fetchWithAuth(`${API_BASE}/purchases/next-lr-id`);
        const generatedId = data.data?.lrId || "";
        setNextSuggestedLrId(generatedId);
        return generatedId;
    }, []);

    const fetchMasters = useCallback(async () => {
        const [partyData, transporterData, firmData] = await Promise.all([
            fetchWithAuth(`${API_BASE}/parties?type=party`),
            fetchWithAuth(`${API_BASE}/parties?type=transporter`),
            fetchWithAuth(`${API_BASE}/parties?type=firm`),
        ]);

        setParties(sortByName(partyData.data || []));
        setTransporters(sortByName(transporterData.data || []));
        setFirms(sortByName(firmData.data || []));
    }, []);

    const hydrateForm = (entryRecord, purchaseRecord) => {
        const source = entryRecord || purchaseRecord || {};
        setForm({
            ...buildEmptyForm(companyName),
            ...normalizeLookupData(source),
        });
    };

    const openEntityModal = (type, target = "form", currentName = "") => {
        setEntityModal({
            open: true,
            type,
            target,
            loadingGst: false,
            form: buildEmptyEntityForm(currentName),
        });
    };

    const closeEntityModal = () => {
        setEntityModal((current) => ({ ...current, open: false }));
    };

    const updateEntityModalField = (field, value) => {
        setEntityModal((current) => ({
            ...current,
            form: {
                ...current.form,
                [field]: value,
            },
        }));
    };

    const applyCreatedEntity = (entity, type, target) => {
        const name = entity?.name || "";
        if (!name) return;

        if (type === "party") {
            setParties((current) => sortByName([...current.filter((item) => item._id !== entity._id), entity]));
            const updater = (current) => ({ ...current, partyName: name });
            if (target === "modal") {
                setModalForm(updater);
            } else {
                setForm(updater);
            }
            return;
        }

        setTransporters((current) => sortByName([...current.filter((item) => item._id !== entity._id), entity]));
        const updater = (current) => ({ ...current, transporter: name });
        if (target === "modal") {
            setModalForm(updater);
        } else {
            setForm(updater);
        }
    };

    const fetchGstDetails = async () => {
        const gstNo = String(entityModal.form.gstNo || "").trim().toUpperCase();
        if (!gstNo) {
            alert("Enter GST number first");
            return;
        }

        setEntityModal((current) => ({ ...current, loadingGst: true }));
        try {
            const response = await fetchWithAuth(`${API_BASE}/parties/gst/${encodeURIComponent(gstNo)}`, {
                headers: { "Content-Type": "application/json" },
            });
            const gstData = response.data || {};

            setEntityModal((current) => ({
                ...current,
                loadingGst: false,
                form: {
                    ...current.form,
                    name: current.form.name || gstData.partyName || gstData.tradeName || gstData.legalName || "",
                    contactPerson: gstData.contactPerson || current.form.contactPerson,
                    phone: gstData.phone || current.form.phone,
                    email: gstData.email || current.form.email,
                    addressLine1: gstData.addressLine1 || current.form.addressLine1,
                    addressLine2: gstData.addressLine2 || current.form.addressLine2,
                    city: gstData.city || current.form.city,
                    state: gstData.state || current.form.state,
                    stateCode: gstData.stateCode || current.form.stateCode,
                    pincode: gstData.pincode || current.form.pincode,
                    gstNo: gstData.gstNo || current.form.gstNo,
                },
            }));

            if (response.message) {
                alert(response.message);
            }
        } catch (err) {
            setEntityModal((current) => ({ ...current, loadingGst: false }));
            alert(err.message || "Failed to fetch GST details");
        }
    };

    const saveEntity = async () => {
        const entityName = String(entityModal.form.name || "").trim();
        if (!entityName) {
            alert(`${ENTITY_LABELS[entityModal.type]} name is required`);
            return;
        }

        try {
            const payload = {
                name: entityName,
                partyType: entityModal.type,
                phone: entityModal.form.phone,
            };

            if (entityModal.type === "party") {
                Object.assign(payload, {
                    contactPerson: entityModal.form.contactPerson,
                    email: entityModal.form.email,
                    gstNo: entityModal.form.gstNo,
                    addressLine1: entityModal.form.addressLine1,
                    addressLine2: entityModal.form.addressLine2,
                    city: entityModal.form.city,
                    state: entityModal.form.state,
                    stateCode: entityModal.form.stateCode,
                    pincode: entityModal.form.pincode,
                    notes: entityModal.form.notes,
                });
            }

            const response = await fetchWithAuth(`${API_BASE}/parties`, {
                method: "POST",
                body: JSON.stringify(payload),
            });
            const entity = response.data || response;
            applyCreatedEntity(entity, entityModal.type, entityModal.target);
            closeEntityModal();
            await fetchMasters();
        } catch (err) {
            alert(err.message || `Failed to save ${ENTITY_LABELS[entityModal.type]}`);
        }
    };

    const openPurchaseEntry = (targetLrId) => {
        const nextLrId = String(targetLrId || form.lrId || lrId || "").trim();
        if (!nextLrId) {
            alert("Save or search an LR ID first");
            return;
        }
        navigate(`/purchase/new?lrId=${encodeURIComponent(nextLrId)}`);
    };

    const openLinkedPurchase = () => {
        if (!purchase?._id) {
            openPurchaseEntry(form.lrId || lrId);
            return;
        }
        navigate(`/purchase/edit/${purchase._id}`);
    };

    const lookup = useCallback(async (value = lrId) => {
        if (!value.trim()) {
            setPurchase(null);
            setLrEntry(null);
            setError("Enter LR ID to search");
            return;
        }

        setLoading(true);
        setError("");
        try {
            const data = await fetchWithAuth(`${API_BASE}/purchases/lr/${encodeURIComponent(value.trim())}`);
            const lookupData = data.data || {};
            setPurchase(lookupData.purchase || null);
            setLrEntry(lookupData.lrEntry || null);
            hydrateForm(lookupData.lrEntry, lookupData.purchase);
            setSearchParams({ lrId: value.trim() });
        } catch (err) {
            setPurchase(null);
            setLrEntry(null);
            setForm({
                ...buildEmptyForm(companyName),
                lrId: value.trim(),
            });
            setError(err.message || "Failed to fetch LR details");
        } finally {
            setLoading(false);
        }
    }, [companyName, lrId, setSearchParams]);

    useEffect(() => {
        fetchMasters().catch((err) => {
            console.error(err);
        });
        fetchNextLrId().catch((err) => {
            console.error(err);
        });
    }, [fetchMasters, fetchNextLrId]);

    useEffect(() => {
        const initialLrId = searchParams.get("lrId");
        if (initialLrId) {
            lookup(initialLrId);
        }
    }, [lookup, searchParams]);

    const saveLrDetails = async (payload, options = {}) => {
        try {
            setSaving(true);
            const data = await fetchWithAuth(`${API_BASE}/purchases/lr-entry`, {
                method: "POST",
                body: JSON.stringify(payload),
            });
            const savedEntry = data.data || null;
            setLrEntry(savedEntry);
            setLrId(savedEntry?.lrId || payload.lrId || "");

            if (options.closeModal) {
                setModalOpen(false);
                setModalForm(buildEmptyForm(companyName));
            }

            await lookup(savedEntry?.lrId || payload.lrId || "");
            await fetchNextLrId();
            if (options.openPurchaseAfterSave) {
                openPurchaseEntry(savedEntry?.lrId || payload.lrId || "");
            } else {
                alert("LR details saved successfully");
            }
            return savedEntry;
        } catch (err) {
            alert(err.message || "Failed to save LR details");
            return null;
        } finally {
            setSaving(false);
        }
    };

    const openCreateModal = () => {
        const openModal = async () => {
            const generatedLrId = await fetchNextLrId();
            setModalForm({
                ...buildEmptyForm(companyName),
                lrId: generatedLrId || lrId || "",
            });
            setModalOpen(true);
        };

        openModal().catch((err) => {
            alert(err.message || "Failed to generate LR ID");
        });
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
                        <h1>LR ID Lookup</h1>
                        <p className="mb-0 text-muted">Search and reconcile logistics receipt IDs with transporters, bales, and purchase bills.</p>
                    </div>
                    <div className="page-header-actions">
                        <span className="metric-pill"><i className="bx bx-check-circle"></i> Ready</span>
                        <button className="btn btn_style" type="button" onClick={openCreateModal}>
                            <i className="bx bx-plus"></i><span>New</span>
                        </button>
                        <button className="btn btn_style inActive" type="button" onClick={() => openPurchaseEntry(lrId)}>
                            <i className="bx bx-cart-add"></i><span>New Purchase With LR</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="row g-3 mb-3">
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card stat-card"><div className="card-body"><span className="stat-icon text-primary"><i className="bx bx-barcode"></i></span><p>Suggested LR ID</p><h3>{nextSuggestedLrId || "--"}</h3></div></div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card stat-card"><div className="card-body"><span className="stat-icon text-success"><i className="bx bx-receipt"></i></span><p>Linked Purchase</p><h3>{purchase?._id ? "Available" : "Not linked"}</h3></div></div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card stat-card"><div className="card-body"><span className="stat-icon text-warning"><i className="bx bx-package"></i></span><p>LR Record</p><h3>{lrEntry ? "Found" : "Not found"}</h3></div></div>
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card stat-card"><div className="card-body"><span className="stat-icon text-info"><i className="bx bx-buildings"></i></span><p>Firm</p><h3>{form.firmName || companyName || "-"}</h3></div></div>
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
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label" htmlFor="lr-lookup-lr-id">LR ID</label>
                            <input
                                type="text"
                                className="form-control"
                                id="lr-lookup-lr-id"
                                value={lrId}
                                onChange={(event) => setLrId(event.target.value.replace(/[^\d]/g, ""))}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        lookup();
                                    }
                                }}
                                placeholder="Enter LR ID"
                            />
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor="lr-lookup-lr-no">LR No</label><input type="text" className="form-control" id="lr-lookup-lr-no" value={form.lrNo} onChange={(event) => setForm((current) => ({ ...current, lrNo: event.target.value }))} placeholder="Enter LR No" /></div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label" htmlFor="lr-lookup-transporter">Transporter</label>
                            <div className="input-group">
                                <input type="text" className="form-control" id="lr-lookup-transporter" list="lr-transporters-list" value={form.transporter} onChange={(event) => setForm((current) => ({ ...current, transporter: event.target.value }))} placeholder="Enter Transporter" />
                                <button className="btn btn_style" type="button" onClick={() => openEntityModal("transporter", "form", form.transporter)}>
                                    <i className="bx bx-plus"></i><span>Add</span>
                                </button>
                            </div>
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label" htmlFor="lr-lookup-party">Party</label>
                            <div className="input-group">
                                <input type="text" className="form-control" id="lr-lookup-party" list="lr-parties-list" value={form.partyName} onChange={(event) => setForm((current) => ({ ...current, partyName: event.target.value }))} placeholder="Enter Party" />
                                <button className="btn btn_style" type="button" onClick={() => openEntityModal("party", "form", form.partyName)}>
                                    <i className="bx bx-plus"></i><span>Add</span>
                                </button>
                            </div>
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor="lr-lookup-from-date">From Date</label><input type="date" className="form-control" id="lr-lookup-from-date" value={form.inwardDate || ""} onChange={(event) => setForm((current) => ({ ...current, inwardDate: event.target.value }))} /></div>
                        <div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor="lr-lookup-to-date">To Date</label><input type="date" className="form-control" id="lr-lookup-to-date" /></div>
                        <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                            <button className="btn btn_style" type="button" onClick={() => lookup()} disabled={loading}>
                                <i className="bx bx-search"></i><span>{loading ? "Searching..." : "Search"}</span>
                            </button>
                            <button className="btn btn_style inActive" type="button" onClick={fetchNextLrId}>
                                <i className="bx bx-refresh"></i><span>Refresh ID</span>
                            </button>
                            <button className="btn btn_style inActive" type="button" onClick={() => {
                                setLrId("");
                                setPurchase(null);
                                setLrEntry(null);
                                setForm(buildEmptyForm(companyName));
                                setError("");
                            }}>
                                <i className="bx bx-reset"></i><span>Clear</span>
                            </button>
                        </div>
                    </form>
                    {loading ? <div className="text-muted mt-3">Fetching LR details...</div> : null}
                    {error ? <div className="text-danger mt-3">{error}</div> : null}
                    {!error && !loading && !purchase && !lrEntry && lrId ? <div className="text-muted mt-3">No saved LR entry or purchase found for LR ID {lrId}.</div> : null}
                </div>
            </section>

            {/* <section className="card app-card">
                <div className="card-header app-card-header">
                    <div>
                        <h2>LR Details</h2>
                        <p>Save once and reuse across purchase intake.</p>
                    </div>
                    <span className={`status-badge ${lrEntry ? "status-success" : "status-warning"}`}>{lrEntry ? "Saved LR" : "Draft LR"}</span>
                </div>
                <div className="card-body">
                    <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                        <Field label="LR ID" value={form.lrId} onChange={(value) => setForm((current) => ({ ...current, lrId: value.replace(/[^\d]/g, "") }))} />
                        <Field label="LR No" value={form.lrNo} onChange={(value) => setForm((current) => ({ ...current, lrNo: value }))} />
                        <Field label="Bale" value={form.bale} onChange={(value) => setForm((current) => ({ ...current, bale: value }))} />
                        <Field label="Godown" value={form.godown} onChange={(value) => setForm((current) => ({ ...current, godown: value }))} />
                        <Field label="Inward Date" type="date" value={form.inwardDate} onChange={(value) => setForm((current) => ({ ...current, inwardDate: value }))} />
                        <Field label="Hundekari" value={form.hundekari} onChange={(value) => setForm((current) => ({ ...current, hundekari: value }))} />
                        <Field label="Transport Charges" value={form.transportCharges} onChange={(value) => setForm((current) => ({ ...current, transportCharges: value }))} />
                        <Field label="Hamali Charges" value={form.hamaliCharges} onChange={(value) => setForm((current) => ({ ...current, hamaliCharges: value }))} />
                        <Field label="Bill No" value={form.billNo} onChange={(value) => setForm((current) => ({ ...current, billNo: value }))} />
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Firm</label>
                            <select className="form-select" value={form.firmName} onChange={(event) => setForm((current) => ({ ...current, firmName: event.target.value }))}>
                                <option value="">Select firm</option>
                                {firms.map((firm) => <option key={firm._id} value={firm.name}>{firm.name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Party</label>
                            <select className="form-select" value={form.partyName} onChange={(event) => setForm((current) => ({ ...current, partyName: event.target.value }))}>
                                <option value="">Select party</option>
                                {parties.map((party) => <option key={party._id} value={party.name}>{party.name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-xl-3">
                            <label className="form-label">Transporter</label>
                            <select className="form-select" value={form.transporter} onChange={(event) => setForm((current) => ({ ...current, transporter: event.target.value }))}>
                                <option value="">Select transporter</option>
                                {transporters.map((party) => <option key={party._id} value={party.name}>{party.name}</option>)}
                            </select>
                        </div>
                        <div className="col-12">
                            <label className="form-label">Narration</label>
                            <textarea value={form.narration} onChange={(event) => setForm((current) => ({ ...current, narration: event.target.value }))} className="form-control" rows="3" />
                        </div>
                        <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                            <button className="btn btn_style" type="button" onClick={() => saveLrDetails(form)} disabled={saving}>
                                <i className="bx bx-save"></i><span>{saving ? "Saving..." : "Save LR Details"}</span>
                            </button>
                            <button className="btn btn_style inActive" type="button" onClick={() => saveLrDetails(form, { openPurchaseAfterSave: true })} disabled={saving}>
                                <i className="bx bx-cart-add"></i><span>Save & Open Purchase</span>
                            </button>
                            <button className="btn btn_style inActive" type="button" onClick={openLinkedPurchase}>
                                <i className="bx bx-link-external"></i><span>{purchase ? "Open Linked Purchase" : "Open Purchase Entry"}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </section> */}

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
                            <button className="btn btn_style datatable-create" type="button" onClick={openCreateModal}>
                                <i className="bx bx-plus"></i><span>Create LR ID Lookup</span>
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
                                    <button className="dropdown-item" type="button"><i className="bx bx-file me-2"></i>CSV</button>
                                    <button className="dropdown-item" type="button"><i className="bx bx-spreadsheet me-2"></i>Excel</button>
                                    <button className="dropdown-item" type="button" onClick={() => window.print()}><i className="bx bx-printer me-2"></i>Print</button>
                                </div>
                            </div>
                            <div className="datatable-search">
                                <input type="text" placeholder="Search LR ID Lookup" aria-label="Search LR ID Lookup" value={lrId} onChange={(event) => setLrId(event.target.value.replace(/[^\d]/g, ""))} />
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
                            <button className="btn btn_style inActive" type="button" data-bs-toggle="modal" data-bs-target="#confirmActionModal"><i className="bx bx-trash"></i><span>Delete</span></button>
                        </div>
                    </div>

                    <div className="table-responsive app-table-wrap datatable-wrap">
                        <table className="table app-table align-middle">
                            <thead>
                                <tr>
                                    <th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" aria-label="Select all rows" /></th>
                                    <th><span className="sortable-heading">LR ID<i className="bx bx-sort-up"></i></span></th>
                                    <th><span className="sortable-heading">LR No<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Transporter<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Bales<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Arrival<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Linked GRN<i className="bx bx-sort"></i></span></th>
                                    <th><span className="sortable-heading">Status<i className="bx bx-sort"></i></span></th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(lrEntry || purchase) ? (
                                    <tr>
                                        <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" /></td>
                                        <td>{form.lrId || lrId || "-"}</td>
                                        <td>{form.lrNo || "-"}</td>
                                        <td>{form.transporter || "-"}</td>
                                        <td>{form.bale || "-"}</td>
                                        <td>{form.inwardDate ? new Date(form.inwardDate).toLocaleDateString() : "-"}</td>
                                        <td>{purchase?.grnNo || "-"}</td>
                                        <td><span className={`status-badge ${purchase ? "status-primary" : "status-warning"}`}>{purchase ? "Matched" : "Open"}</span></td>
                                        <td className="text-end"><LrLookupActions onView={openLinkedPurchase} /></td>
                                    </tr>
                                ) : (
                                    <tr className="table-state-row table-state-row-empty">
                                        <td colSpan="9">
                                            <div className="empty-state compact">
                                                <span className="empty-state-icon"><i className="bx bx-search-alt"></i></span>
                                                <h6>No matching records</h6>
                                                <p>Try searching an LR ID or create a new LR entry.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="pagination-row">
                        <span>Showing {(lrEntry || purchase) ? 1 : 0} to {(lrEntry || purchase) ? 1 : 0} of {(lrEntry || purchase) ? 1 : 0} entries</span>
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

            <section className="card app-card">
                <div className="card-header app-card-header">
                    <div>
                        <h2>Linked Purchase</h2>
                        <p>See the current purchase linked to this LR ID.</p>
                    </div>
                    <span className={`status-badge ${purchase ? "status-primary" : "status-warning"}`}>{purchase ? "Purchase found" : "Not linked"}</span>
                </div>
                <div className="card-body">
                    {purchase ? (
                        <div className="row g-3">
                            <div className="col-12 col-sm-6 col-xl-2"><div className="summary-line"><span>GRN</span><strong>{purchase.grnNo || "-"}</strong></div></div>
                            <div className="col-12 col-sm-6 col-xl-3"><div className="summary-line"><span>Party</span><strong>{purchase.party?.name || purchase.party || "-"}</strong></div></div>
                            <div className="col-12 col-sm-6 col-xl-2"><div className="summary-line"><span>Bill No</span><strong>{purchase.billNo || "-"}</strong></div></div>
                            <div className="col-12 col-sm-6 col-xl-2"><div className="summary-line"><span>Bill Date</span><strong>{purchase.billDate ? new Date(purchase.billDate).toLocaleDateString() : "-"}</strong></div></div>
                            <div className="col-12 col-sm-6 col-xl-1"><div className="summary-line"><span>Items</span><strong>{purchase.items?.length || 0}</strong></div></div>
                            <div className="col-12 col-sm-6 col-xl-2"><div className="summary-line"><span>Status</span><strong>{purchase.received ? "Received" : "Pending"}</strong></div></div>
                        </div>
                    ) : (
                        <div className="empty-state compact">
                            <span className="empty-state-icon"><i className="bx bx-receipt"></i></span>
                            <h6>No purchase linked</h6>
                            <p>No purchase linked yet. Save LR details and open a new purchase entry to continue.</p>
                        </div>
                    )}
                </div>
            </section>

            <datalist id="lr-parties-list">
                {parties.map((party) => <option key={party._id || party.name} value={party.name} />)}
            </datalist>
            <datalist id="lr-transporters-list">
                {transporters.map((party) => <option key={party._id || party.name} value={party.name} />)}
            </datalist>

            {modalOpen ? (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" aria-hidden="false" onClick={() => setModalOpen(false)}>
                        <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(event) => event.stopPropagation()}>
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title">New LR ID Lookup</h5>
                                    <button type="button" className="btn-close" onClick={() => setModalOpen(false)} aria-label="Close"></button>
                                </div>
                                <div className="modal-body">
                                    <p className="text-muted mb-3">Suggested LR ID {modalForm.lrId || nextSuggestedLrId || "-"}</p>
                                    <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                                        <Field label="LR ID" value={modalForm.lrId} onChange={(value) => setModalForm((current) => ({ ...current, lrId: value.replace(/[^\d]/g, "") }))} />
                                        <Field label="LR No" value={modalForm.lrNo} onChange={(value) => setModalForm((current) => ({ ...current, lrNo: value }))} />
                                        <Field label="Bale" value={modalForm.bale} onChange={(value) => setModalForm((current) => ({ ...current, bale: value }))} />
                                        <Field label="Godown" value={modalForm.godown} onChange={(value) => setModalForm((current) => ({ ...current, godown: value }))} />
                                        <Field label="Inward Date" type="date" value={modalForm.inwardDate} onChange={(value) => setModalForm((current) => ({ ...current, inwardDate: value }))} />
                                        <Field label="Hundekari" value={modalForm.hundekari} onChange={(value) => setModalForm((current) => ({ ...current, hundekari: value }))} />
                                        <Field label="Transport Charges" value={modalForm.transportCharges} onChange={(value) => setModalForm((current) => ({ ...current, transportCharges: value }))} />
                                        <Field label="Hamali Charges" value={modalForm.hamaliCharges} onChange={(value) => setModalForm((current) => ({ ...current, hamaliCharges: value }))} />
                                        <Field label="Bill No" value={modalForm.billNo} onChange={(value) => setModalForm((current) => ({ ...current, billNo: value }))} />
                                        <div className="col-12 col-sm-6 col-xl-3">
                                            <label className="form-label">Firm</label>
                                            <select className="form-select" value={modalForm.firmName} onChange={(event) => setModalForm((current) => ({ ...current, firmName: event.target.value }))}>
                                                <option value="">Select firm</option>
                                                {firmOptions.map((firm) => <option key={firm._id || firm.name} value={firm.name}>{firm.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-12 col-sm-6 col-xl-3">
                                            <label className="form-label">Party</label>
                                            <div className="input-group">
                                                <input className="form-control" list="lr-parties-list" value={modalForm.partyName} onChange={(event) => setModalForm((current) => ({ ...current, partyName: event.target.value }))} placeholder="Enter Party" />
                                                <button className="btn btn_style" type="button" onClick={() => openEntityModal("party", "modal", modalForm.partyName)}>
                                                    <i className="bx bx-plus"></i><span>Add</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="col-12 col-sm-6 col-xl-3">
                                            <label className="form-label">Transporter</label>
                                            <div className="input-group">
                                                <input className="form-control" list="lr-transporters-list" value={modalForm.transporter} onChange={(event) => setModalForm((current) => ({ ...current, transporter: event.target.value }))} placeholder="Enter Transporter" />
                                                <button className="btn btn_style" type="button" onClick={() => openEntityModal("transporter", "modal", modalForm.transporter)}>
                                                    <i className="bx bx-plus"></i><span>Add</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="col-12">
                                            <label className="form-label">Narration</label>
                                            <textarea value={modalForm.narration} onChange={(event) => setModalForm((current) => ({ ...current, narration: event.target.value }))} className="form-control" rows="3" />
                                        </div>
                                    </form>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn_style inActive" onClick={() => setModalOpen(false)}>Close</button>
                                    <button type="button" className="btn btn_style" onClick={() => saveLrDetails(modalForm, { closeModal: true })} disabled={saving}>{saving ? "Saving..." : "Save LR Entry"}</button>
                                    <button type="button" className="btn btn_style inActive" onClick={() => saveLrDetails(modalForm, { closeModal: true, openPurchaseAfterSave: true })} disabled={saving}>Save & Open Purchase</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}

            {entityModal.open ? (
                <>
                    <div className="modal-backdrop fade show"></div>
                    <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" aria-hidden="false" onMouseDown={closeEntityModal}>
                        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable" onMouseDown={(event) => event.stopPropagation()}>
                            <div className="modal-content">
                                <div className="modal-header">
                                    <div>
                                        <h5 className="modal-title">Add {ENTITY_LABELS[entityModal.type]}</h5>
                                        <p className="mb-0 text-muted">The new {ENTITY_LABELS[entityModal.type].toLowerCase()} will be selected here and added to the dropdown list.</p>
                                    </div>
                                    <button type="button" className="btn-close" onClick={closeEntityModal} aria-label="Close"></button>
                                </div>
                                <div className="modal-body">
                                    <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                                        {entityModal.type === "party" ? (
                                            <div className="col-12">
                                                <label className="form-label">GSTIN</label>
                                                <div className="input-group">
                                                    <input className="form-control" value={entityModal.form.gstNo} onChange={(event) => updateEntityModalField("gstNo", event.target.value.toUpperCase())} placeholder="Enter GSTIN" />
                                                    <button type="button" className="btn btn_style" onClick={fetchGstDetails} disabled={entityModal.loadingGst}>
                                                        {entityModal.loadingGst ? "Fetching..." : "Fetch GST"}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : null}
                                        <div className="col-12 col-md-6">
                                            <label className="form-label">{ENTITY_LABELS[entityModal.type]} Name</label>
                                            <input className="form-control" value={entityModal.form.name} onChange={(event) => updateEntityModalField("name", event.target.value)} autoFocus />
                                        </div>
                                        <div className="col-12 col-md-6">
                                            <label className="form-label">Phone</label>
                                            <input className="form-control" value={entityModal.form.phone} onChange={(event) => updateEntityModalField("phone", event.target.value)} />
                                        </div>
                                        {entityModal.type === "party" ? (
                                            <>
                                                <div className="col-12 col-md-6">
                                                    <label className="form-label">Contact Person</label>
                                                    <input className="form-control" value={entityModal.form.contactPerson} onChange={(event) => updateEntityModalField("contactPerson", event.target.value)} />
                                                </div>
                                                <div className="col-12 col-md-6">
                                                    <label className="form-label">Email</label>
                                                    <input className="form-control" type="email" value={entityModal.form.email} onChange={(event) => updateEntityModalField("email", event.target.value)} />
                                                </div>
                                                <div className="col-12 col-md-6">
                                                    <label className="form-label">Address</label>
                                                    <input className="form-control" value={entityModal.form.addressLine1} onChange={(event) => updateEntityModalField("addressLine1", event.target.value)} />
                                                </div>
                                                <div className="col-12 col-md-6">
                                                    <label className="form-label">Address Line 2</label>
                                                    <input className="form-control" value={entityModal.form.addressLine2} onChange={(event) => updateEntityModalField("addressLine2", event.target.value)} />
                                                </div>
                                                <div className="col-12 col-md-3">
                                                    <label className="form-label">City</label>
                                                    <input className="form-control" value={entityModal.form.city} onChange={(event) => updateEntityModalField("city", event.target.value)} />
                                                </div>
                                                <div className="col-12 col-md-3">
                                                    <label className="form-label">State</label>
                                                    <input className="form-control" value={entityModal.form.state} onChange={(event) => updateEntityModalField("state", event.target.value)} />
                                                </div>
                                                <div className="col-12 col-md-3">
                                                    <label className="form-label">State Code</label>
                                                    <input className="form-control" value={entityModal.form.stateCode} onChange={(event) => updateEntityModalField("stateCode", event.target.value)} />
                                                </div>
                                                <div className="col-12 col-md-3">
                                                    <label className="form-label">Pincode</label>
                                                    <input className="form-control" value={entityModal.form.pincode} onChange={(event) => updateEntityModalField("pincode", event.target.value)} />
                                                </div>
                                                <div className="col-12">
                                                    <label className="form-label">Notes</label>
                                                    <textarea className="form-control" rows="3" value={entityModal.form.notes} onChange={(event) => updateEntityModalField("notes", event.target.value)} />
                                                </div>
                                            </>
                                        ) : null}
                                    </form>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn_style inActive" onClick={closeEntityModal}>Cancel</button>
                                    <button type="button" className="btn btn_style" onClick={saveEntity}>Save {ENTITY_LABELS[entityModal.type]}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}
        </>
    );
};

const Field = ({ label, value, onChange, type = "text" }) => (
    <div className="col-12 col-sm-6 col-xl-3">
        <label className="form-label">{label}</label>
        <input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} className="form-control" placeholder={`Enter ${label}`} />
    </div>
);

const LrLookupActions = ({ onView }) => (
    <div className="datatable-actions">
        <button type="button" className="btn action-btn" aria-label="Delete"><i className="bx bx-trash"></i></button>
        <button type="button" className="btn action-btn" aria-label="View" onClick={onView}><i className="bx bx-show"></i></button>
        <div className="dropdown">
            <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions">
                <i className="bx bx-dots-vertical-rounded"></i>
            </button>
            <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                <button className="dropdown-item" type="button">Download</button>
                <button className="dropdown-item" type="button" onClick={onView}>Edit</button>
                <button className="dropdown-item" type="button">Duplicate</button>
            </div>
        </div>
    </div>
);

export default LrIdLookup;
