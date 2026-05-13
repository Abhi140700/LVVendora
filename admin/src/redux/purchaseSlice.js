import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  purchases: [],
  loading: false,
};

const purchaseSlice = createSlice({
  name: "purchase",
  initialState,
  reducers: {
    setPurchases: (state, action) => {
      state.purchases = action.payload;
    },

    addPurchase: (state, action) => {
      state.purchases.push(action.payload);
    },
  },
});

export const { setPurchases, addPurchase } = purchaseSlice.actions;

export default purchaseSlice.reducer;