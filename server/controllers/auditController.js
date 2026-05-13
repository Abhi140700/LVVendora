import AuditLog from "../models/AuditLog.js";
import POSSession from "../models/POSSession.js";

export const getAuditLogs = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const filter = {};

    if (req.query.module) {
      filter.module = req.query.module;
    }
    if (req.query.entityType) {
      filter.entityType = req.query.entityType;
    }
    if (req.query.entityId) {
      filter.entityId = String(req.query.entityId);
    }

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: logs
    });
  } catch (err) {
    console.error("Get Audit Logs Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch audit logs",
      error: err.message
    });
  }
};

export const deleteAuditLog = async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({
        success: false,
        message: "Audit log not found"
      });
    }

    if (log.action === "SESSION_DAY_END" && log.entityType === "POSSession" && log.entityId) {
      const latestDayEndLog = await AuditLog.findOne({
        action: "SESSION_DAY_END",
        entityType: "POSSession",
        entityId: log.entityId
      }).sort({ createdAt: -1, _id: -1 });

      if (!latestDayEndLog || String(latestDayEndLog._id) !== String(log._id)) {
        return res.status(400).json({
          success: false,
          message: "Only the latest day-end audit entry can be deleted and undone"
        });
      }

      const session = await POSSession.findById(log.entityId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: "Linked POS session not found for undo"
        });
      }

      const previousSnapshot = log.before || {};
      session.businessDate = previousSnapshot.businessDate || log.metadata?.previousBusinessDate || session.businessDate;
      session.lastDayEndDate = previousSnapshot.lastDayEndDate ?? undefined;
      session.lastDayEndAt = previousSnapshot.lastDayEndAt ?? undefined;
      await session.save();
    }

    await AuditLog.findByIdAndDelete(log._id);

    return res.status(200).json({
      success: true,
      message: log.action === "SESSION_DAY_END"
        ? "Audit log deleted and day end rolled back"
        : "Audit log deleted"
    });
  } catch (err) {
    console.error("Delete Audit Log Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete audit log",
      error: err.message
    });
  }
};
