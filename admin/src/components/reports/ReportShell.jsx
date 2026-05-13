import React from "react";

const ReportShell = ({ eyebrow, title, description, actions, stats = [], children }) => (
    <div style={styles.page}>
        <section style={styles.hero}>
            <div>
                <div style={styles.eyebrow}>{eyebrow}</div>
                <h2 style={styles.title}>{title}</h2>
                <p style={styles.description}>{description}</p>
            </div>
            {actions ? <div style={styles.actions}>{actions}</div> : null}
        </section>

        {stats.length > 0 ? (
            <section style={styles.statsGrid}>
                {stats.map((stat) => (
                    <article
                        key={stat.label}
                        className={`app-card ${stat.tone === "accent" ? "accent-card" : stat.tone === "muted" ? "muted-card" : "soft-card"}`}
                        style={styles.statCard}
                    >
                        <div style={styles.statLabel}>{stat.label}</div>
                        <div style={styles.statValue}>{stat.value}</div>
                    </article>
                ))}
            </section>
        ) : null}

        {children}
    </div>
);

const styles = {
    page: {
        display: "grid",
        gap: 20,
    },
    hero: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        padding: 24,
        borderRadius: 28,
        background: "var(--hero-gradient-soft)",
        border: "1px solid var(--panel-border-soft)",
    },
    eyebrow: {
        color: "var(--text-soft)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: 12,
        fontWeight: 800,
    },
    title: {
        margin: "8px 0 10px",
        fontSize: "1.95rem",
        lineHeight: 1.08,
    },
    description: {
        margin: 0,
        color: "var(--text-soft)",
        maxWidth: 720,
    },
    actions: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
    },
    statsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 16,
    },
    statCard: {
        padding: 18,
    },
    statLabel: {
        fontSize: 12,
        fontWeight: 800,
        color: "var(--text-soft)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 8,
    },
    statValue: {
        fontSize: "1.45rem",
        fontWeight: 800,
    },
};

export default ReportShell;
