import React from "react";
import { SocketContext } from "./socketContext.js";

export const SocketProvider = ({ children }) => (
    <SocketContext.Provider value={null}>{children}</SocketContext.Provider>
);
