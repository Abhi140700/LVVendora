import React from "react";
import PlaceholderPage from "../../components/ui/PlaceholderPage";
import { CrudMeta } from "../../components/ui/CrudPage";

const RoleManagement = () => (
    <PlaceholderPage
        eyebrow="Users"
        title="Role Management"
        description="Prepare a centralized role desk for access definitions, assignment rules, and permissions handoff."
        meta={<CrudMeta>Coming next</CrudMeta>}
    />
);

export default RoleManagement;
