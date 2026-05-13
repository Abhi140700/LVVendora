import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  inventory: [],
  loading: false,
};

const inventorySlice = createSlice({
  name: "inventory",
  initialState,
  reducers: {
    setInventory: (state, action) => {
      state.inventory = action.payload;
    },

    updateStock: (state, action) => {
      const { itemId, quantity } = action.payload;

      const item = state.inventory.find((i) => i._id === itemId);

      if (item) {
        item.quantity = quantity;
      }
    },
  },
});

export const { setInventory, updateStock } = inventorySlice.actions;

export default inventorySlice.reducer;