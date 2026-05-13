import api from "../app/axios";

export const fetchAccountingCustomers = async (query = "") => {
    const { data } = await api.get("/accounting/customers", { params: query ? { q: query } : undefined });
    return data;
};
export const fetchReceipts = async (query = "") => {
    const { data } = await api.get("/accounting/receipts", { params: query ? { q: query } : undefined });
    return data;
};
export const fetchExpenseEntries = async (query = "") => {
    const { data } = await api.get("/accounting/expense-entries", { params: query ? { q: query } : undefined });
    return data;
};
export const createReceipt = async (payload) => {
    const { data } = await api.post("/accounting/receipts", payload);
    return data;
};
export const createExpenseEntry = async (payload) => {
    const { data } = await api.post("/accounting/expense-entries", payload);
    return data;
};
export const createLedgerAdjustment = async (payload) => {
    const { data } = await api.post("/accounting/ledger-adjustments", payload);
    return data;
};
export const fetchCustomerLedger = async (customerId) => {
    const { data } = await api.get(`/accounting/ledger/${customerId}`);
    return data;
};
export const fetchCashBookReport = async ({ from, to }) => {
    const { data } = await api.get("/reports/cash-book", { params: { from, to } });
    return data;
};
export const openPosSession = async (payload) => {
    const { data } = await api.post("/sales/session/open", payload);
    return data;
};
export const closePosSession = async (payload) => {
    const { data } = await api.post("/sales/session/close", payload);
    return data;
};
export const dayEndPosSession = async (payload = {}) => {
    const { data } = await api.post("/sales/session/day-end", payload);
    return data;
};
export const undoDayEndPosSession = async () => {
    const { data } = await api.post("/sales/session/day-end/undo");
    return data;
};
