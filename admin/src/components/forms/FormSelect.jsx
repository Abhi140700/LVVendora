import React from "react";
import Select from "../ui/Select";

const FormSelect = ({ label, options = [], ...props }) => (
    <label style={{ display: "grid", gap: 6 }}>
        {label ? <span style={{ fontSize: 12, color: "var(--text-soft)", fontWeight: 700 }}>{label}</span> : null}
        <Select {...props}>
            {options.map((option) => (
                <option key={option.value || option.label || option} value={option.value || option}>
                    {option.label || option}
                </option>
            ))}
        </Select>
    </label>
);

export default FormSelect;
