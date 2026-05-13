import api from "../app/axios";

const cleanParams = (params = {}) => Object.fromEntries(Object.entries(params).filter(([, value]) => (
    value !== undefined && value !== null && value !== ""
)));

export const fetchTallySyncSnapshot = async (params = {}) => {
    const { data } = await api.get("/tally/snapshot", { params: cleanParams(params) });
    return data;
};

export const fetchTallyLogs = async () => {
    const { data } = await api.get("/tally/logs");
    return data;
};

export const fetchTallySettings = async () => {
    const { data } = await api.get("/tally/settings");
    return data;
};

export const saveTallySettings = async (payload) => {
    const { data } = await api.put("/tally/settings", payload);
    return data;
};

export const syncTally = async (payload = {}) => {
    const { data } = await api.post("/tally/prepare", payload);
    return data;
};

export const exportTallyPayload = async (params = {}) => {
    const { data: response } = await api.get("/tally/export/json", { params: cleanParams(params) });
    const payload = response.data;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tally-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return payload;
};

export const exportTallyXml = async (params = {}) => {
    const { data: response } = await api.get("/tally/export/xml", { params: cleanParams(params) });
    const xml = response.data?.xml || "";
    const fileName = response.data?.fileName || `tally-export-${new Date().toISOString().slice(0, 10)}.xml`;
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    return response.data;
};
