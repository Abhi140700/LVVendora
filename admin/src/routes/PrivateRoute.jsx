import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getCurrentRole, hasRole } from "../utils/permissions";

const PrivateRoute = ({ allowedRoles }) => {
    const token = localStorage.getItem("token");
    const role = getCurrentRole();

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    if (!hasRole(role, allowedRoles)) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

export default PrivateRoute;
