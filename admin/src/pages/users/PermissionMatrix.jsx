import React from "react";
import PlaceholderPage from "../../components/ui/PlaceholderPage";
import { CrudMeta } from "../../components/ui/CrudPage";

const PermissionMatrix = () => (
    <PlaceholderPage
        eyebrow="Users"
        title="Permission Matrix"
        description="Reserve this space for module-level permissions, role toggles, and audit-ready access visibility."
        meta={<CrudMeta>Scaffold aligned</CrudMeta>}
    />
);

export default PermissionMatrix;
