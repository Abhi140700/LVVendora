import React, { useRef, useState } from "react";
import {
    ActionButton,
    SettingsCard,
    SettingsPage,
} from "../../components/ui/SettingsSection.jsx";
import { readAppSettings, saveAppSettings } from "../../utils/appSettings";

const BackupSettings = () => {
    const fileRef = useRef(null);
    const [message, setMessage] = useState("");

    const exportSettings = () => {
        const blob = new Blob([JSON.stringify(readAppSettings(), null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "erp-settings-backup.json";
        link.click();
        URL.revokeObjectURL(link.href);
        setMessage("Settings backup exported.");
    };

    const importSettings = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const parsed = JSON.parse(text);
        saveAppSettings(parsed);
        setMessage("Settings backup imported successfully.");
        event.target.value = "";
    };

    return (
        <SettingsPage
            eyebrow="Settings"
            title="Backup Settings"
            description="Export and import your application settings so deployment and machine replacement stay simple."
        >
            <SettingsCard title="Backup & Restore" description="Keep a portable snapshot of the local app configuration.">
                <div className="app-actions">
                    <ActionButton type="button" onClick={exportSettings}>Export Settings Backup</ActionButton>
                    <ActionButton type="button" variant="secondary" onClick={() => fileRef.current?.click()}>Import Settings Backup</ActionButton>
                    <input ref={fileRef} type="file" accept="application/json" hidden onChange={importSettings} />
                </div>
                {message ? <div className="app-message">{message}</div> : null}
            </SettingsCard>
        </SettingsPage>
    );
};

export default BackupSettings;
