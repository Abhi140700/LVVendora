import React from "react";

export const OperationalPage = ({ eyebrow, title, description, actions = null, stats = null, children }) => (
    <div className="app-page operational-page">
        <section className="app-page__hero app-card soft-card operational-page__hero">
            <div>
                <div className="app-page__eyebrow">{eyebrow}</div>
                <h2 className="app-page__title">{title}</h2>
                <p className="app-page__subtitle">{description}</p>
            </div>
            {actions ? <div className="app-actions">{actions}</div> : null}
        </section>
        {stats}
        {children}
    </div>
);

export const OperationalStats = ({ children }) => (
    <section className="operational-stats">
        {children}
    </section>
);

export const OperationalStatCard = ({ label, value, tone = "soft" }) => (
    <article className={`app-card app-panel operational-stat operational-stat--${tone}`}>
        <div className="operational-stat__label">{label}</div>
        <div className="operational-stat__value">{value}</div>
    </article>
);

export const OperationalPanel = ({ title, description, actions = null, children, className = "" }) => (
    <section className={`app-card app-panel operational-panel${className ? ` ${className}` : ""}`}>
        {(title || description || actions) ? (
            <div className="app-panel__header">
                <div>
                    {title ? <div className="operational-panel__title">{title}</div> : null}
                    {description ? <div className="app-page__subtitle">{description}</div> : null}
                </div>
                {actions ? <div className="app-actions">{actions}</div> : null}
            </div>
        ) : null}
        {children}
    </section>
);

export const OperationalPill = ({ children, tone = "neutral" }) => (
    <span className={`operational-pill operational-pill--${tone}`}>{children}</span>
);
