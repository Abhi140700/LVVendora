import { getSystemSettings, updateSystemSettings } from "../services/systemSettingsService.js";

export const getSettings = async (req, res) => {
  try {
    const settings = await getSystemSettings();
    return res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error("Get Settings Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch system settings"
    });
  }
};

export const saveSettings = async (req, res) => {
  try {
    const settings = await updateSystemSettings(req.body || {});
    return res.status(200).json({
      success: true,
      message: "System settings saved successfully",
      data: settings
    });
  } catch (error) {
    console.error("Save Settings Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save system settings",
      error: error.message
    });
  }
};
