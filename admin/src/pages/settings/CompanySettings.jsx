import React, { useEffect, useMemo, useState } from "react";
import {
    APP_SETTINGS_UPDATED_EVENT,
    DEFAULT_APP_SETTINGS,
    readAppSettings,
    saveAppSettingsAsync,
    syncAppSettingsFromServer,
} from "../../utils/appSettings";
import {
    ActionButton,
    SettingsCard,
    SettingsField,
    SettingsMeta,
    SettingsPage,
} from "../../components/ui/SettingsSection.jsx";

const CompanySettings = () => {
    const [settings, setSettings] = useState(readAppSettings);
    const [savedAt, setSavedAt] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        syncAppSettingsFromServer()
            .then((nextSettings) => {
                if (active) setSettings(nextSettings);
            })
            .catch(() => {});

        const syncFromEvent = (event) => {
            setSettings(event?.detail?.settings || readAppSettings());
        };
        window.addEventListener(APP_SETTINGS_UPDATED_EVENT, syncFromEvent);
        window.addEventListener("storage", syncFromEvent);
        return () => {
            active = false;
            window.removeEventListener(APP_SETTINGS_UPDATED_EVENT, syncFromEvent);
            window.removeEventListener("storage", syncFromEvent);
        };
    }, []);

    const companyAcronym = useMemo(() => String(settings.companyName || "")
        .split(/\s+/)
        .map((part) => part.replace(/[^a-z0-9]/gi, "").charAt(0).toUpperCase())
        .filter(Boolean)
        .join("") || "ERP", [settings.companyName]);

    const update = (field, value) => {
        setSettings((current) => ({ ...current, [field]: value }));
    };

    const save = async () => {
        setSaving(true);
        setError("");
        try {
            setSavedAt(await saveAppSettingsAsync(settings));
            setSettings(readAppSettings());
        } catch (err) {
            setError(err.message || "Failed to save company settings");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SettingsPage
            eyebrow="Settings"
            title="Company Settings"
            description="Manage the company identity used across bills, GRN, labels, and POS numbering."
            action={(
                <div className="settings-meta-grid">
                    <SettingsMeta label="Current counter" value={settings.billingCounter || DEFAULT_APP_SETTINGS.billingCounter} />
                    <ActionButton onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</ActionButton>
                </div>
            )}
        >
            <SettingsCard title="Identity" description="These values feed branding, print headers, and barcode defaults throughout the workspace.">
                <div className="row g-3">
                    <SettingsField label="Company Name" value={settings.companyName} onChange={(value) => update("companyName", value)} />
                    <SettingsField label="Billing Counter" value={settings.billingCounter} onChange={(value) => update("billingCounter", value)} />
                    <SettingsField label="Company Acronym" value={companyAcronym} readOnly />
                    <SettingsField label="Default Barcode Format" value={settings.barcodeFormat} readOnly />
                </div>
                {savedAt ? <div className="app-message">Saved at {savedAt}</div> : null}
                {error ? <div className="app-message text-danger">{error}</div> : null}
            </SettingsCard>
        </SettingsPage>
    );
};

export default CompanySettings;
