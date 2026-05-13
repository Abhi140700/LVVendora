import React from "react";

const Pagination = ({ page = 1, totalPages = 1, onChange = () => {} }) => (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" onClick={() => onChange(Math.max(1, page - 1))}>Prev</button>
        <span>{page} / {totalPages}</span>
        <button type="button" onClick={() => onChange(Math.min(totalPages, page + 1))}>Next</button>
    </div>
);

export default Pagination;
