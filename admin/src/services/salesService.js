import api from "../app/axios";

export const fetchSales = async () => {
    const { data } = await api.get("/sales");
    return data;
};
