import AuditLog from "../models/AuditLog.js";

const safeClone = (value) => {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return undefined;
  }
};

export const createAuditLog = async ({
  module,
  action,
  entityType,
  entityId,
  summary,
  before,
  after,
  metadata,
  user
}) => {
  try {
    await AuditLog.create({
      module,
      action,
      entityType,
      entityId: entityId ? String(entityId) : "",
      summary,
      before: safeClone(before),
      after: safeClone(after),
      metadata: safeClone(metadata),
      userId: user?._id,
      username: user?.username || "",
      role: user?.role || ""
    });
  } catch (error) {
    console.error("Create Audit Log Error:", error);
  }
};
