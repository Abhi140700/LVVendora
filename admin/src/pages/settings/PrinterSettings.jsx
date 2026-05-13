import React, { useState } from "react";
import {
    ActionButton,
    SettingsCard,
    SettingsField,
    SettingsMeta,
    SettingsPage,
    SettingsSelectField,
} from "../../components/ui/SettingsSection.jsx";
import {
    getPrinterOptions,
    readAppSettings,
    saveAppSettings,
} from "../../utils/appSettings";

const PrinterSettings = () => {
    const [settings, setSettings] = useState(readAppSettings);
    const [savedAt, setSavedAt] = useState("");
    const [printerListText, setPrinterListText] = useState(() =>
        getPrinterOptions(readAppSettings()).join("\n"),
    );

    const update = (field, value) => setSettings((current) => ({ ...current, [field]: value }));
    const save = () => {
        const availablePrinters = printerListText
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean)
            .filter((value, index, list) => list.indexOf(value) === index);

        setSavedAt(saveAppSettings({ ...settings, availablePrinters }));
    };

    return (
        <SettingsPage
            eyebrow="Settings"
            title="Printer Settings"
            description="Control thermal billing, label printers, sizes, and barcode output defaults."
            action={(
                <div className="settings-meta-grid">
                    <SettingsMeta label="Active thermal printer" value={settings.thermalPrinter} />
                    <ActionButton onClick={save}>Save Changes</ActionButton>
                </div>
            )}
        >
            <SettingsCard title="Printer Mapping" description="Define print devices and label/barcode formats used by the billing and stock flow.">
                <div className="row g-3">
                    <SettingsField label="Thermal Printer" value={settings.thermalPrinter} onChange={(value) => update("thermalPrinter", value)} />
                    <SettingsField label="Label Printer" value={settings.labelPrinter} onChange={(value) => update("labelPrinter", value)} />
                    <SettingsSelectField label="Label Size" value={settings.labelSize} onChange={(value) => update("labelSize", value)} options={["50x25", "40x20", "60x30"]} />
                    <SettingsSelectField label="Barcode Format" value={settings.barcodeFormat} onChange={(value) => update("barcodeFormat", value)} options={["CODE128", "EAN13"]} />
                </div>
                <label className="form-label mt-3" htmlFor="settings-available-printers">Available Printers</label>
                    <textarea
                        id="settings-available-printers"
                        value={printerListText}
                        onChange={(event) => setPrinterListText(event.target.value)}
                        className="form-control settings-textarea"
                        rows="5"
                        placeholder="One printer name per line"
                    />
                {savedAt ? <div className="app-message">Saved at {savedAt}</div> : null}
            </SettingsCard>
        </SettingsPage>
    );
};

export default PrinterSettings;
