import React from "react";

const DataTable = ({ columns = [], rows = [] }) => (
    <div className="app-card table-surface" style={{ padding: 12 }}>
        <table>
            <thead>
                <tr>
                    {columns.map((column) => <th key={column.key || column}>{column.label || column}</th>)}
                </tr>
            </thead>
            <tbody>
                {rows.length === 0 ? (
                    <tr>
                        <td colSpan={columns.length || 1} style={{ textAlign: "center", padding: 18 }}>
                            No data
                        </td>
                    </tr>
                ) : rows.map((row, index) => (
                    <tr key={row.id || index}>
                        {columns.map((column) => <td key={column.key || column}>{row[column.key || column]}</td>)}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

export default DataTable;
