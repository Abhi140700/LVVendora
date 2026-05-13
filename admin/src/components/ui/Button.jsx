import React from "react";

const Button = ({ children, className = "", variant = "primary", style, ...props }) => (
    <button
        {...props}
        className={`app-btn app-btn--${variant}${className ? ` ${className}` : ""}`}
        style={style}
    >
        {children}
    </button>
);

export default Button;
