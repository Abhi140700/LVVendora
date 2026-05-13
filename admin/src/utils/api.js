export const API_BASE = (globalThis.__ERP_API_BASE__ || "/api").replace(/\/$/, "");

export const apiUrl = (path = "") => {
    if (!path) return API_BASE;
    return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
};

export const getApiErrorMessage = (error, fallback = "Request failed") => (
    error?.response?.data?.message
    || error?.response?.data?.error
    || error?.message
    || fallback
);
