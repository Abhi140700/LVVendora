import React from "react";
import { handleEnterAdvance } from "../../utils/enterNavigation";

const Input = ({ className = "", style, onKeyDown, "data-enter-nav": dataEnterNav = "true", ...props }) => (
    <input
        {...props}
        data-enter-nav={dataEnterNav}
        onKeyDown={(event) => {
            onKeyDown?.(event);
            if (!event.defaultPrevented) {
                handleEnterAdvance(event);
            }
        }}
        className={`app-input${className ? ` ${className}` : ""}`}
        style={style}
    />
);

export default Input;
