import { useEffect, useState } from "react";
import {
    APP_SETTINGS_UPDATED_EVENT,
    DEFAULT_APP_SETTINGS,
    readAppSettings,
    syncAppSettingsFromServer,
} from "../utils/appSettings";

const useAppSettings = () => {
    const [settings, setSettings] = useState(readAppSettings);

    useEffect(() => {
        syncAppSettingsFromServer()
            .then((nextSettings) => setSettings(nextSettings))
            .catch(() => {});

        const syncSettings = (event) => {
            const nextSettings = event?.detail?.settings || readAppSettings();
            setSettings({
                ...DEFAULT_APP_SETTINGS,
                ...nextSettings,
                ui: { ...DEFAULT_APP_SETTINGS.ui, ...(nextSettings.ui || {}) },
                loyalty: { ...DEFAULT_APP_SETTINGS.loyalty, ...(nextSettings.loyalty || {}) },
                sales: { ...DEFAULT_APP_SETTINGS.sales, ...(nextSettings.sales || {}) },
                purchase: { ...DEFAULT_APP_SETTINGS.purchase, ...(nextSettings.purchase || {}) },
            });
        };

        window.addEventListener(APP_SETTINGS_UPDATED_EVENT, syncSettings);
        window.addEventListener("storage", syncSettings);
        return () => {
            window.removeEventListener(APP_SETTINGS_UPDATED_EVENT, syncSettings);
            window.removeEventListener("storage", syncSettings);
        };
    }, []);

    return settings;
};

export default useAppSettings;
