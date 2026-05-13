import React from "react";

const Table = ({ children }) => (
    <div className="app-card table-surface app-table-card">
        <table>{children}</table>
    </div>
);

export default Table;
