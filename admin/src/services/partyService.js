import api from "../app/axios";

export const fetchParties = async (type) => {
    const params = type ? { type } : undefined;
    const { data } = await api.get("/parties", { params });
    return data;
};

export const fetchNextPartyCode = async (type) => {
    const { data } = await api.get("/parties/next-code", { params: type ? { type } : undefined });
    return data;
};

export const fetchPartyByGst = async (gstNo) => {
    const { data } = await api.get(`/parties/gst/${encodeURIComponent(gstNo)}`);
    return data;
};

export const createParty = async (payload) => {
    const { data } = await api.post("/parties", payload);
    return data;
};

export const updateParty = async (id, payload) => {
    const { data } = await api.put(`/parties/${id}`, payload);
    return data;
};

export const deleteParty = async (id) => {
    const { data } = await api.delete(`/parties/${id}`);
    return data;
};
