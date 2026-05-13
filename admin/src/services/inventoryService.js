import api from "../app/axios";

export const fetchInventoryList = async () => {
    const { data } = await api.get("/inventory");
    return data;
};
