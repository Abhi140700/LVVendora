export const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  MANAGER: "manager",
  SALES: "sales",
  STOCK: "stock",
  ACCOUNTANT: "accountant",
};

export const ROLE_GROUPS = {
  adminOnly: [ROLES.ADMIN],
  stockOps: [ROLES.ADMIN, ROLES.STOCK],
  salesOps: [ROLES.ADMIN, ROLES.SALES, ROLES.MANAGER],
  salesRead: [ROLES.ADMIN, ROLES.SALES, ROLES.MANAGER, ROLES.ACCOUNTANT],
  financeRead: [ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.MANAGER, ROLES.SALES],
  financeOps: [ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.MANAGER, ROLES.SALES],
  tallyOps: [ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.MANAGER],
  settingsOps: [ROLES.ADMIN, ROLES.MANAGER],
};

export const hasRole = (role, allowedRoles = []) => {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return role === ROLES.SUPERADMIN || allowedRoles.includes(role);
};

export const canAccessItem = (item, role) => hasRole(role, item?.allowedRoles);

export const filterSidebarSections = (sections, role) => (
  sections
    .map((section) => {
      const items = section.items
        .map((item) => {
          if (item.children) {
            const children = item.children.filter((child) => canAccessItem(child, role));
            if (!children.length || !canAccessItem(item, role)) return null;
            return { ...item, children };
          }

          return canAccessItem(item, role) ? item : null;
        })
        .filter(Boolean);

      return items.length ? { ...section, items } : null;
    })
    .filter(Boolean)
);

export const getCurrentRole = () => localStorage.getItem("role") || "";
