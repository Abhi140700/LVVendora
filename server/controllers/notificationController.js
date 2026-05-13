import { buildSystemNotifications } from "../services/notificationService.js";

export const getSystemNotifications = async (req, res) => {
  try {
    const data = await buildSystemNotifications({ role: req.user?.role });
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load notifications",
      error: error.message
    });
  }
};
