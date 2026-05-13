import React from "react";

const Loader = ({ label = "Loading..." }) => (
    <div style={{ padding: 20, color: "var(--text-soft)" }}>{label}</div>
);

export default Loader;
