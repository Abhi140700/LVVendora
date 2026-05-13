import React from "react";
import { handleEnterAdvance } from "../../utils/enterNavigation";

const Select = ({ children, className = "", style, onKeyDown, "data-enter-nav": dataEnterNav = "true", ...props }) => (
    <select
        {...props}
        data-enter-nav={dataEnterNav}
        onKeyDown={(event) => {
            onKeyDown?.(event);
            if (!event.defaultPrevented) {
                handleEnterAdvance(event);
            }
        }}
        className={`app-select${className ? ` ${className}` : ""}`}
        style={style}
    >
        {children}
    </select>
);

export default Select;
