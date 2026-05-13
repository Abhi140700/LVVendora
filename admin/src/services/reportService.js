import api from "../app/axios";

function buildRequestError(data, fallback, status) {
    const rawMessage = data?.message || data?.error || fallback;
    const lowerMessage = String(rawMessage || "").toLowerCase();
    const message = status === 404
        ? "Cash adjustment API is not available. Please restart the backend server and try again."
        : lowerMessage.includes("failed to fetch") || lowerMessage === "request failed"
            ? "Backend request failed. Please check that the server is running, then try again."
            : rawMessage;
    const error = new Error(message);
    error.status = status;
    error.data = data?.data;
    error.response = data;
    return error;
}

async function getJson(path) {
    try {
        const { data } = await api.get(path);
        return data;
    } catch (error) {
        throw buildRequestError(error.response?.data || {}, "Failed to fetch report data", error.response?.status);
    }
}

async function sendJson(path, body) {
    try {
        const { data } = await api.post(path, body || {});
        return data;
    } catch (error) {
        throw buildRequestError(error.response?.data || {}, "Request failed", error.response?.status);
    }
}

export const fetchReportSummary = async () => getJson("/reports");
export const fetchSalesReport = async () => getJson("/reports/sales");
export const fetchPurchaseReport = async () => getJson("/reports/purchase");
export const fetchStockReport = async () => getJson("/reports/stock");
export const fetchGstReport = async () => getJson("/reports/gst");
export const fetchGstComplianceReport = async () => getJson("/reports/gst-compliance");
export const fetchProfitLossReport = async () => getJson("/reports/profit-loss");
export const fetchAdvancedReport = async (type) => getJson(`/reports/advanced/${type}`);
export const previewCashSalesAdjustment = async (payload) => sendJson("/sales/cash-adjustment/preview", payload);
export const processCashSalesAdjustment = async (payload) => sendJson("/sales/cash-adjustment/process", payload);
export const fetchCashSalesAdjustmentHistory = async () => getJson("/sales/cash-adjustment/history");
export const reverseCashSalesAdjustment = async (payload) => sendJson("/sales/cash-adjustment/reverse", payload);
