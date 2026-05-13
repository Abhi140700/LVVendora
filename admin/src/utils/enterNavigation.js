const isVisible = (element) => {
    if (!element) return false;
    if (element.disabled) return false;
    if (element.getAttribute("aria-hidden") === "true") return false;
    return element.offsetParent !== null;
};

export const getFocusableFields = (scope = document) => Array.from(
    scope.querySelectorAll(
        'input:not([type="hidden"]):not([data-enter-nav="false"]), select:not([data-enter-nav="false"]), button:not([data-enter-nav="false"]), [tabindex]:not([tabindex="-1"]):not([data-enter-nav="false"])',
    ),
).filter(isVisible);

export const canAdvanceOnEnter = (target, options = {}) => {
    if (!target) {
        return false;
    }

    if (target.getAttribute?.("data-enter-nav") === "false") {
        return false;
    }

    const tagName = String(target.tagName || "").toLowerCase();
    if (tagName === "textarea" && !options.allowTextareaAdvance) {
        return false;
    }

    if (!["input", "select", "button", "textarea"].includes(tagName) && !target.hasAttribute?.("tabindex")) {
        return false;
    }

    return true;
};

export const focusNextEnterField = (currentElement) => {
    if (!currentElement || typeof document === "undefined") {
        return false;
    }

    const explicitScope = currentElement.closest("[data-enter-scope]");
    const form = currentElement.closest("form");
    const scope = explicitScope || form || document;
    const fields = getFocusableFields(scope);
    const currentIndex = fields.indexOf(currentElement);

    if (currentIndex < 0) {
        return false;
    }

    const nextField = fields[currentIndex + 1];
    if (!nextField) {
        return false;
    }

    nextField.focus();
    nextField.select?.();
    return true;
};

export const handleEnterAdvance = (event, options = {}) => {
    if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
        return false;
    }

    const target = event.currentTarget;
    if (!canAdvanceOnEnter(target, options)) {
        return false;
    }

    event.preventDefault();
    return focusNextEnterField(target);
};
