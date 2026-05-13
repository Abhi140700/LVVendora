import React from "react";

const PlaceholderPage = ({
    title,
    eyebrow = "Scaffolded",
    description = "This page has been scaffolded and is ready for the next implementation pass.",
    meta = null,
}) => (
    <div className="app-page">
        <section className="app-card soft-card app-page__hero">
            <div>
                <div className="app-page__eyebrow">{eyebrow}</div>
                <h2 className="app-page__title">{title}</h2>
                <p className="app-page__subtitle">{description}</p>
            </div>
            {meta ? <div className="app-toolbar__meta">{meta}</div> : null}
        </section>
        <section className="app-card app-panel print-safe-card placeholder-page">
            <div className="placeholder-page__badge">Ready for extension</div>
            <p className="placeholder-page__description">
                This screen now uses the shared dashboard shell so the full implementation can drop in without another layout pass.
            </p>
        </section>
    </div>
);

export default PlaceholderPage;
