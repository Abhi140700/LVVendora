import React from "react";
import Input from "../ui/Input";

const FormInput = ({ label, ...props }) => (
    <label style={{ display: "grid", gap: 6 }}>
        {label ? <span style={{ fontSize: 12, color: "var(--text-soft)", fontWeight: 700 }}>{label}</span> : null}
        <Input {...props} />
    </label>
);

export default FormInput;
