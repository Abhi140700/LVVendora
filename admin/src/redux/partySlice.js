import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  parties: [],
  loading: false,
};

const partySlice = createSlice({
  name: "party",
  initialState,
  reducers: {
    setParties: (state, action) => {
      state.parties = action.payload;
    },

    addParty: (state, action) => {
      state.parties.push(action.payload);
    },
  },
});

export const { setParties, addParty } = partySlice.actions;

export default partySlice.reducer;