import React, { useState } from "react";
import {
    ActionButton,
    SettingsCard,
    SettingsMeta,
    SettingsPage,
    SettingsToggleCard,
} from "../../components/ui/SettingsSection.jsx";
import { readAppSettings, saveAppSettings } from "../../utils/appSettings";

const GSTSettings = () => {
    const [settings, setSettings] = useState(readAppSettings);
    const [savedAt, setSavedAt] = useState("");

    const updateSales = (field) => setSettings((current) => ({
        ...current,
        sales: { ...current.sales, [field]: !current.sales[field] },
    }));
    const updatePurchase = (field) => setSettings((current) => ({
        ...current,
        purchase: { ...current.purchase, [field]: !current.purchase[field] },
    }));

    return (
        <SettingsPage
            eyebrow="Settings"
            title="GST Settings"
            description="Keep GST visibility, default purchase GST, and print behavior aligned across sales and purchase."
            action={(
                <div className="settings-meta-grid">
                    <SettingsMeta label="Print GST" value={settings.sales.hideGstInPrint ? "Hidden" : "Visible"} />
                    <ActionButton onClick={() => setSavedAt(saveAppSettings(settings))}>Save Changes</ActionButton>
                </div>
            )}
        >
            <div className="settings-two-column">
                <SettingsCard title="Sales GST" description="Customer bill behavior and payment-related GST presentation.">
                    <div className="settings-toggle-grid settings-toggle-grid--compact">
                        <SettingsToggleCard title="Hide GST In Print" body="Control whether customer bills show GST breakup lines." checked={settings.sales.hideGstInPrint} onToggle={() => updateSales("hideGstInPrint")} />
                        <SettingsToggleCard title="Prompt Received Amount" body="Ask cashier for received amount before final bill confirmation." checked={settings.sales.promptReceivedAmount} onToggle={() => updateSales("promptReceivedAmount")} />
                        <SettingsToggleCard title="No Discount Credit Sales" body="Prevent discounts when the bill is posted to credit." checked={settings.sales.noDiscountCreditSales} onToggle={() => updateSales("noDiscountCreditSales")} />
                    </div>
                </SettingsCard>
                <SettingsCard title="Purchase GST" description="Default GST/HSN rules and label-side tax visibility.">
                    <div className="settings-toggle-grid settings-toggle-grid--compact">
                        <SettingsToggleCard title="Default GST %" body="Start purchase rows with the configured GST default." checked={settings.purchase.defaultGst} onToggle={() => updatePurchase("defaultGst")} />
                        <SettingsToggleCard title="HSN Mandatory" body="Require HSN before the purchase or item is finalized." checked={settings.purchase.hsnMandatory} onToggle={() => updatePurchase("hsnMandatory")} />
                        <SettingsToggleCard title="Tax Additional On Label" body="Expose extra tax details in label print configuration." checked={settings.purchase.taxAdditionalOnLabel} onToggle={() => updatePurchase("taxAdditionalOnLabel")} />
                    </div>
                </SettingsCard>
            </div>
            {savedAt ? <div className="app-message">Saved at {savedAt}</div> : null}
        </SettingsPage>
    );
};

export default GSTSettings;
