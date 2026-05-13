import { ROLE_GROUPS, ROLES, getCurrentRole, hasRole } from "../utils/permissions";

const usePermissions = () => {
    const role = getCurrentRole();
    const isSuperAdmin = role === ROLES.SUPERADMIN;
    return {
        role,
        isSuperAdmin,
        canManageUsers: hasRole(role, ROLE_GROUPS.adminOnly),
        canUseSales: hasRole(role, ROLE_GROUPS.salesOps),
        canReadSales: hasRole(role, ROLE_GROUPS.salesRead),
        canUseStock: hasRole(role, ROLE_GROUPS.stockOps),
        canUseFinance: hasRole(role, ROLE_GROUPS.financeOps),
        canUseTally: hasRole(role, ROLE_GROUPS.tallyOps),
        canUseSettings: hasRole(role, ROLE_GROUPS.settingsOps),
        hasRole: (allowedRoles) => hasRole(role, allowedRoles),
    };
};

export default usePermissions;
