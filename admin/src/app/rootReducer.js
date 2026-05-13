import { combineReducers } from "@reduxjs/toolkit";

import authReducer from "../redux/authSlice";
import partyReducer from "../redux/partySlice";
import itemReducer from "../redux/itemSlice";
import purchaseReducer from "../redux/purchaseSlice";
import salesReducer from "../redux/salesSlice";
import inventoryReducer from "../redux/inventorySlice";

const rootReducer = combineReducers({
  auth: authReducer,
  party: partyReducer,
  item: itemReducer,
  purchase: purchaseReducer,
  sales: salesReducer,
  inventory: inventoryReducer,
});

export default rootReducer;