import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  sales: [],
  loading: false,
};

const salesSlice = createSlice({
  name: "sales",
  initialState,
  reducers: {
    setSales: (state, action) => {
      state.sales = action.payload;
    },

    addSale: (state, action) => {
      state.sales.push(action.payload);
    },
  },
});

export const { setSales, addSale } = salesSlice.actions;

export default salesSlice.reducer;