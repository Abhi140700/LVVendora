import React from "react";

export const CrudPage = ({ eyebrow, title, description, meta = null, children }) => (
    <div className="app-page crud-page">
        <section className="app-card soft-card app-page__hero crud-page__hero">
            <div>
                <div className="app-page__eyebrow">{eyebrow}</div>
                <h2 className="app-page__title">{title}</h2>
                <p className="app-page__subtitle">{description}</p>
            </div>
            {meta ? <div className="app-toolbar__meta">{meta}</div> : null}
        </section>
        {children}
    </div>
);

export const CrudMeta = ({ children }) => (
    <span className="app-status-badge">{children}</span>
);

export const CrudPanel = ({ children, className = "" }) => (
    <section className={`app-card app-panel crud-page__panel${className ? ` ${className}` : ""}`}>
        {children}
    </section>
);
