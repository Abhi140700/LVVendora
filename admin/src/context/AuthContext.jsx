import React, { useMemo } from "react";
import { AuthContext } from "./authContext.js";

export const AuthProvider = ({ children }) => {
    const value = useMemo(() => ({
        token: localStorage.getItem("token"),
        role: localStorage.getItem("role"),
        username: localStorage.getItem("username"),
    }), []);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
