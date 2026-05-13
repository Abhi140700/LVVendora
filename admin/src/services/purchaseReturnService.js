import api from "../app/axios";

export async function lookupPurchaseReturnBarcode(barcode) {
    const { data } = await api.get(`/purchase-returns/lookup/${encodeURIComponent(barcode)}`);
    return data;
}

export async function fetchPurchaseReturns(params = {}) {
    const cleanParams = Object.fromEntries(Object.entries(params).filter(([, value]) => (
        value !== undefined && value !== null && String(value).trim() !== ""
    )));
    const { data } = await api.get("/purchase-returns", { params: cleanParams });
    return data;
}

export async function fetchPurchaseReturnById(returnId) {
    const { data } = await api.get(`/purchase-returns/${returnId}`);
    return data;
}

export async function createPurchaseReturn(payload) {
    const { data } = await api.post("/purchase-returns", payload);
    return data;
}

export async function updatePurchaseReturn(returnId, payload) {
    const { data } = await api.put(`/purchase-returns/${returnId}`, payload);
    return data;
}

export async function deletePurchaseReturn(returnId) {
    const { data } = await api.delete(`/purchase-returns/${returnId}`);
    return data;
}
