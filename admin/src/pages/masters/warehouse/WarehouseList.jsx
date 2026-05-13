import React from "react";
import PartyList from "../party/PartyList";

const WarehouseList = () => (
    <PartyList
        initialType="warehouse"
        lockedType
        title="Warehouse Master"
        description="Create and maintain godowns, racks, and warehouse locations used across receiving and stock transfer."
    />
);

export default WarehouseList;
