import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getCurrentRole, hasRole } from "../utils/permissions";

const RoleRoute = ({ allowedRoles = [] }) => {
    const role = getCurrentRole();

    return hasRole(role, allowedRoles) ? <Outlet /> : <Navigate to="/login" replace />;
};

export default RoleRoute;
