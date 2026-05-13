import React, { useEffect } from "react";
import { canAdvanceOnEnter, focusNextEnterField } from "../../utils/enterNavigation";

const KeyboardFirstProvider = ({ children }) => {
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.defaultPrevented || event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
                return;
            }

            const target = event.target;
            if (!canAdvanceOnEnter(target)) {
                return;
            }

            const tagName = String(target.tagName || "").toLowerCase();
            if (tagName === "button") {
                return;
            }

            if (focusNextEnterField(target)) {
                event.preventDefault();
            }
        };

        document.addEventListener("keydown", handleKeyDown, true);
        return () => document.removeEventListener("keydown", handleKeyDown, true);
    }, []);

    return children;
};

export default KeyboardFirstProvider;
