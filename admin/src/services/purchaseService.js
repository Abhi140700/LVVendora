import api from "../app/axios";

export const fetchPurchases = async () => {
    const { data } = await api.get("/purchases");
    return data;
};
