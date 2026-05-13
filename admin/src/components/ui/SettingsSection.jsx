import React from "react";

export function SettingsPage({ eyebrow, title, description, action, children }) {
    return (
        <div className="container-fluid p-0 flex-grow-1">
            <div className="page-header card">
                <div className="card-body">
                    <div>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-2">
                                <li className="breadcrumb-item"><a href="/">Home</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Settings</li>
                            </ol>
                        </nav>
                        <p className="section-label">{eyebrow}</p>
                        <h1>{title}</h1>
                        <p className="mb-0 text-muted">{description}</p>
                    </div>
                    {action ? <div className="page-header-actions">{action}</div> : null}
                </div>
            </div>
            <div className="app-settings-page">
                {children}
            </div>
        </div>
    );
}

export function SettingsCard({ title, description, actions, children, className = "" }) {
    return (
        <section className={`card app-card settings-card${className ? ` ${className}` : ""}`}>
            {(title || description || actions) ? (
                <div className="card-header app-card-header">
                    <div>
                        {title ? <h2>{title}</h2> : null}
                        {description ? <p>{description}</p> : null}
                    </div>
                    {actions ? <div className="app-actions">{actions}</div> : null}
                </div>
            ) : null}
            <div className="card-body">
                {children}
            </div>
        </section>
    );
}

export function SettingsField({ label, value, onChange, readOnly = false, type = "text", placeholder }) {
    const id = `settings-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    return (
        <div className="col-12 col-sm-6 col-xl-3">
            <label className="form-label" htmlFor={id}>{label}</label>
            <input
                className="form-control"
                id={id}
                type={type}
                value={value}
                readOnly={readOnly}
                onChange={onChange ? (event) => onChange(event.target.value) : undefined}
                placeholder={placeholder || `Enter ${label}`}
            />
        </div>
    );
}

export function SettingsSelectField({ label, value, onChange, options = [] }) {
    const id = `settings-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    return (
        <div className="col-12 col-sm-6 col-xl-3">
            <label className="form-label" htmlFor={id}>{label}</label>
            <select className="form-select" id={id} value={value} onChange={(event) => onChange(event.target.value)}>
                {options.map((option) => {
                    const normalizedOption = typeof option === "string"
                        ? { value: option, label: option }
                        : option;

                    return (
                        <option key={normalizedOption.value} value={normalizedOption.value}>
                            {normalizedOption.label}
                        </option>
                    );
                })}
            </select>
        </div>
    );
}

export function SettingsToggleCard({ title, body, checked, onToggle }) {
    return (
        <button type="button" className={`settings-toggle${checked ? " active" : ""}`} onClick={onToggle}>
            <span className="settings-toggle-top">
                <span>{title}</span>
                <span className="settings-switch"><span></span></span>
            </span>
            <small>{body}</small>
        </button>
    );
}

export function SettingsMeta({ label, value }) {
    return (
        <div className="settings-meta">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

export function ActionButton({ children, variant = "primary", className = "", ...props }) {
    return (
        <button className={`btn btn_style${variant === "secondary" ? " inActive" : ""}${className ? ` ${className}` : ""}`} type="button" {...props}>
            {children}
        </button>
    );
}
