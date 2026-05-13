import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  items: [],
  loading: false,
};

const itemSlice = createSlice({
  name: "item",
  initialState,
  reducers: {
    setItems: (state, action) => {
      state.items = action.payload;
    },

    addItem: (state, action) => {
      state.items.push(action.payload);
    },
  },
});

export const { setItems, addItem } = itemSlice.actions;

export default itemSlice.reducer;