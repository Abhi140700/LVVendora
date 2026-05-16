import React, { useState } from "react";
import { useThemeContext } from "../../context/themeContext.js";
import {
    DEFAULT_APP_SETTINGS,
    SETTINGS_SAVED_AT_KEY,
    readAppSettings,
    saveAppSettings,
} from "../../utils/appSettings";
import {
    ActionButton,
    SettingsCard,
    SettingsField,
    SettingsMeta,
    SettingsPage,
    SettingsSelectField,
    SettingsToggleCard,
} from "../../components/ui/SettingsSection.jsx";

const SALES_SETTING_GROUPS = [
    {
        title: "Sales & POS Controls",
        description: "Capture-11 style switches for billing flow, focus handling, counters, and mandatory checks.",
        ids: [
            "useDayEnd",
            "useSystemDate",
            "multipleCashCounter",
            "counterWiseSale",
            "dailySaleNo",
            "showMeters",
            "decimalQty",
            "tokenMode",
            "lastBillAtBottom",
            "showDiscPercent",
            "showDiscAmount",
            "showCommission",
            "addStockQty",
            "stayFocusOnProduct",
            "promptReceivedAmount",
            "selectPrinterInSales",
            "packingEnabled",
            "salesmanCompulsory",
            "barcodeOffers",
            "hideGstInPrint",
            "negativeBillBlocked",
            "mopMandatory",
            "noDiscountCreditSales",
        ],
    },
];

const PURCHASE_SETTING_GROUPS = [
    {
        title: "Purchase & Label Controls",
        description: "Capture-12 style controls for LR intake, material/style rules, barcode handling, and printing behavior.",
        ids: [
            "refillBarcode",
            "refillAutoPurchase",
            "hideSupplierLedger",
            "commissionOnTaxable",
            "materialMandatory",
            "linkCategoryMaterial",
            "defaultQtyMandatory",
            "styleMandatory",
            "linkCategoryStyle",
            "useSingleBrand",
            "lrMandatory",
            "defaultGst",
            "hsnMandatory",
            "labelPrintingEnabled",
            "taxAdditionalOnLabel",
            "allowOldBarcode",
            "showSaleRateBeforeMrp",
            "focusToMrp",
            "thermalPrinterMode",
        ],
    },
];

const SETTING_LABELS = {
    useDayEnd: "Use Day End",
    useSystemDate: "Use System Date",
    multipleCashCounter: "Multiple Cash Counter",
    counterWiseSale: "Counter Wise Sale",
    dailySaleNo: "Daily Sale No",
    showMeters: "Show Meters",
    decimalQty: "Decimal Qty",
    tokenMode: "Token Mode",
    lastBillAtBottom: "Last Bill At Bottom",
    showDiscPercent: "Show Discount %",
    showDiscAmount: "Show Discount Amount",
    showCommission: "Show Commission",
    addStockQty: "Add Stock Qty",
    stayFocusOnProduct: "Stay Focus On Product",
    promptReceivedAmount: "Prompt Received Amount",
    selectPrinterInSales: "Select Printer In Sales",
    packingEnabled: "Packing Enabled",
    salesmanCompulsory: "Salesman Compulsory",
    barcodeOffers: "Barcode Offers",
    hideGstInPrint: "Hide GST In Print",
    negativeBillBlocked: "Negative Bill Blocked",
    mopMandatory: "MOP Mandatory",
    noDiscountCreditSales: "No Discount For Credit Sale",
    refillBarcode: "Item Refill Barcode",
    refillAutoPurchase: "Refill Auto Purchase",
    hideSupplierLedger: "Hide Supplier Ledger",
    commissionOnTaxable: "Commission On Taxable Amount",
    materialMandatory: "Material Mandatory",
    linkCategoryMaterial: "Link Category & Material",
    defaultQtyMandatory: "Default Qty Mandatory",
    styleMandatory: "Style Mandatory",
    linkCategoryStyle: "Link Category & Style",
    useSingleBrand: "Use Single Brand",
    lrMandatory: "LR Mandatory",
    defaultGst: "Default GST %",
    hsnMandatory: "HSN Mandatory",
    labelPrintingEnabled: "Label Printing Enabled",
    taxAdditionalOnLabel: "Tax Additional In Label Print",
    allowOldBarcode: "Allow Old Barcode",
    showSaleRateBeforeMrp: "Show Sale Rate Before MRP",
    focusToMrp: "Focus To MRP",
    thermalPrinterMode: "Thermal Printer Mode",
};

const SETTINGS_COPY = {
    useDayEnd: "Keep day-close flow active for counter balancing and handover.",
    useSystemDate: "Always start transactions with today’s system date.",
    multipleCashCounter: "Support separate POS counters inside the same store.",
    counterWiseSale: "Track bills and summaries by billing counter.",
    dailySaleNo: "Restart bill sequence rules by business day.",
    showMeters: "Allow clothing-style meter-based selling in POS.",
    decimalQty: "Permit decimal quantity entry where needed.",
    tokenMode: "Enable token-first billing workflow.",
    lastBillAtBottom: "Show the previous bill summary near totals.",
    showDiscPercent: "Keep discount percent visible during billing.",
    showDiscAmount: "Keep discount amount visible during billing.",
    showCommission: "Expose salesman commission information in POS.",
    addStockQty: "Show available stock quantity in bill entry rows.",
    stayFocusOnProduct: "Return keyboard focus to product search after add.",
    promptReceivedAmount: "Ask for received amount before payment finalize.",
    selectPrinterInSales: "Let cashier choose printer at bill time.",
    packingEnabled: "Allow packing or extra footer charge handling.",
    salesmanCompulsory: "Require salesman selection before save.",
    barcodeOffers: "Evaluate barcode-linked offer rules during billing.",
    hideGstInPrint: "Hide GST breakup on printed customer bills.",
    negativeBillBlocked: "Prevent bills that go below zero after exchange.",
    mopMandatory: "Require mode of payment before saving bill.",
    noDiscountCreditSales: "Block discounts on credit sales.",
    refillBarcode: "Reuse and continue barcode series for refill items.",
    refillAutoPurchase: "Auto carry forward barcode behavior into purchase intake.",
    hideSupplierLedger: "Simplify purchase screens by hiding supplier ledger.",
    commissionOnTaxable: "Calculate commission on taxable amount instead of gross.",
    materialMandatory: "Material must be selected before item save.",
    linkCategoryMaterial: "Tie material choices to selected category.",
    defaultQtyMandatory: "Require default quantity before item creation.",
    styleMandatory: "Style must be selected before save.",
    linkCategoryStyle: "Limit styles by category selection.",
    useSingleBrand: "Restrict entries to one active brand pattern.",
    lrMandatory: "LR details must exist before final purchase save.",
    defaultGst: "Start purchase rows with the default GST value.",
    hsnMandatory: "Require HSN in intake and label-ready rows.",
    labelPrintingEnabled: "Keep printing gate between purchase and stock release.",
    taxAdditionalOnLabel: "Show extra tax details on the printed label setup.",
    allowOldBarcode: "Allow old barcode reuse when explicitly needed.",
    showSaleRateBeforeMrp: "Prioritize sale rate in label and item setup.",
    focusToMrp: "Move keyboard focus to MRP during label preparation.",
    thermalPrinterMode: "Optimize printing defaults for thermal label printers.",
};

const THEME_PALETTE_OPTIONS = [
    { id: "lime", label: "Lime", swatch: "linear-gradient(135deg, #d9f6b8 0%, #f4f8ed 100%)" },
    { id: "sky", label: "Sky", swatch: "linear-gradient(135deg, #cbe8ff 0%, #eef7ff 100%)" },
    { id: "coral", label: "Coral", swatch: "linear-gradient(135deg, #ffd7c0 0%, #fff1e7 100%)" },
    { id: "violet", label: "Violet", swatch: "linear-gradient(135deg, #ddd3ff 0%, #f2eeff 100%)" },
];

const SettingsHome = () => {
    const { themeMode, setThemeMode, effectiveTheme, systemTheme, themePalette } = useThemeContext();
    const [settings, setSettings] = useState(readAppSettings);
    const [savedAt, setSavedAt] = useState(() => localStorage.getItem(SETTINGS_SAVED_AT_KEY) || "");
    const [savedSettingsJson, setSavedSettingsJson] = useState(() => JSON.stringify(readAppSettings()));
    const [activeSettingsTab, setActiveSettingsTab] = useState("sales");
    const hasUnsavedChanges = JSON.stringify(settings) !== savedSettingsJson;

    const updateTopField = (field, value) => {
        setSettings((current) => ({ ...current, [field]: value }));
    };

    const updateUiField = (field, value) => {
        setSettings((current) => {
            const nextSettings = {
                ...current,
                ui: {
                    ...(current.ui || DEFAULT_APP_SETTINGS.ui),
                    [field]: value,
                },
            };

            const nextSavedAt = saveAppSettings(nextSettings);
            setSavedAt(nextSavedAt);
            setSavedSettingsJson(JSON.stringify(nextSettings));
            return nextSettings;
        });
    };

    const updateLoyaltyField = (field, value) => {
        setSettings((current) => ({
            ...current,
            loyalty: {
                ...(current.loyalty || DEFAULT_APP_SETTINGS.loyalty),
                [field]: value,
            },
        }));
    };

    const updateToggle = (scope, key) => {
        setSettings((current) => ({
            ...current,
            [scope]: {
                ...current[scope],
                [key]: !current[scope][key],
            },
        }));
    };

    const activeGroups = activeSettingsTab === "sales" ? SALES_SETTING_GROUPS : PURCHASE_SETTING_GROUPS;
    const activeScope = activeSettingsTab === "sales" ? "sales" : "purchase";
    const handleSaveChanges = () => {
        const nextSavedAt = saveAppSettings(settings);
        setSavedAt(nextSavedAt);
        setSavedSettingsJson(JSON.stringify(settings));
    };

    return (
        <SettingsPage
            eyebrow="Settings"
            title="Settings Desk"
            description="Billing, purchase, label, and workspace behavior in one control room."
            action={(
                <div className="settings-meta-grid">
                    <SettingsMeta label="Effective theme" value={effectiveTheme} />
                    <SettingsMeta label="Last saved" value={savedAt || "Not saved yet"} />
                    <ActionButton onClick={hasUnsavedChanges ? handleSaveChanges : undefined} disabled={!hasUnsavedChanges}>
                        {hasUnsavedChanges ? "Save Changes" : "Saved"}
                    </ActionButton>
                </div>
            )}
        >
            <SettingsCard title="Workspace Theme" description="Recognizes system light or dark mode automatically, with manual override whenever you need it.">
                <div className="settings-theme-layout">
                    <div className="settings-choice-row mb-3">
                        {[
                            { id: "system", label: "System" },
                            { id: "light", label: "Light" },
                            { id: "dark", label: "Dark" },
                        ].map((themeOption) => (
                            <button
                                key={themeOption.id}
                                type="button"
                                className={`settings-choice${themeMode === themeOption.id ? " active" : ""}`}
                                onClick={() => setThemeMode(themeOption.id)}
                            >
                                {themeOption.label}
                            </button>
                        ))}
                    </div>
                    <div className="settings-inline-note">
                        <strong>
                            {themeMode === "system"
                                ? `System mode is active. Current device theme: ${systemTheme}.`
                                : `${themeMode === "dark" ? "Dark" : "Light"} mode is active.`}
                        </strong>
                        <span>Effective app appearance: {effectiveTheme}.</span>
                    </div>
                </div>
                <div className="settings-palette-grid">
                    {THEME_PALETTE_OPTIONS.map((palette) => {
                        const active = (settings.ui?.palette || themePalette) === palette.id;
                        return (
                            <button
                                key={palette.id}
                                type="button"
                                className={`settings-palette${active ? " active" : ""}`}
                                onClick={() => updateUiField("palette", palette.id)}
                            >
                                <span className="settings-palette__swatch" style={{ background: palette.swatch }} />
                                <span className="settings-palette__label">{palette.label}</span>
                            </button>
                        );
                    })}
                </div>
            </SettingsCard>

            <SettingsCard title="Company & Print Setup" description="Fast access to the constants that appear across POS, purchase, and label workflows.">
                <div className="row g-3">
                    <SettingsField label="Company Name" value={settings.companyName} onChange={(value) => updateTopField("companyName", value)} />
                    <SettingsField label="Tagline" value={settings.companyTagline} onChange={(value) => updateTopField("companyTagline", value)} />
                    <SettingsField label="Address" value={settings.companyAddress} onChange={(value) => updateTopField("companyAddress", value)} />
                    <SettingsField label="Phone" value={settings.companyPhone} onChange={(value) => updateTopField("companyPhone", value)} />
                    <SettingsField label="GSTIN" value={settings.gstin} onChange={(value) => updateTopField("gstin", value)} />
                    <SettingsField label="Billing Counter" value={settings.billingCounter} onChange={(value) => updateTopField("billingCounter", value)} />
                    <SettingsField label="Thermal Printer" value={settings.thermalPrinter} onChange={(value) => updateTopField("thermalPrinter", value)} />
                    <SettingsField label="Label Printer" value={settings.labelPrinter} onChange={(value) => updateTopField("labelPrinter", value)} />
                    <SettingsSelectField
                        label="Label Size"
                        value={settings.labelSize}
                        onChange={(value) => updateTopField("labelSize", value)}
                        options={[
                            { value: "50x25", label: "50 x 25 mm" },
                            { value: "40x20", label: "40 x 20 mm" },
                            { value: "60x30", label: "60 x 30 mm" },
                        ]}
                    />
                    <SettingsSelectField
                        label="Barcode Format"
                        value={settings.barcodeFormat}
                        onChange={(value) => updateTopField("barcodeFormat", value)}
                        options={[
                            { value: "CODE128", label: "CODE128" },
                            { value: "EAN13", label: "EAN13" },
                        ]}
                    />
                </div>
            </SettingsCard>

            <SettingsCard title="Loyalty Program" description="Control how customers earn and redeem loyalty points from POS billing.">
                <div className="row g-3">
                    <div className="col-12 col-lg-4">
                        <SettingsToggleCard
                            title="Enable Loyalty"
                            body="Earn points automatically on completed customer bills."
                            checked={settings.loyalty?.enabled !== false}
                            onToggle={() => updateLoyaltyField("enabled", settings.loyalty?.enabled === false)}
                        />
                    </div>
                    <SettingsField label="Earn Amount Step" type="number" value={settings.loyalty?.earnPerAmount ?? 100} onChange={(value) => updateLoyaltyField("earnPerAmount", Number(value || 0))} />
                    <SettingsField label="Points Per Step" type="number" value={settings.loyalty?.pointsPerStep ?? 1} onChange={(value) => updateLoyaltyField("pointsPerStep", Number(value || 0))} />
                    <SettingsField label="Redeem Value / Point" type="number" value={settings.loyalty?.redeemValuePerPoint ?? 1} onChange={(value) => updateLoyaltyField("redeemValuePerPoint", Number(value || 0))} />
                    <SettingsField label="Minimum Redeem Points" type="number" value={settings.loyalty?.minRedeemPoints ?? 0} onChange={(value) => updateLoyaltyField("minRedeemPoints", Number(value || 0))} />
                    <SettingsField label="Max Redeem %" type="number" value={settings.loyalty?.maxRedeemPercent ?? 20} onChange={(value) => updateLoyaltyField("maxRedeemPercent", Number(value || 0))} />
                    <SettingsField label="Enrollment Fee" type="number" value={settings.loyalty?.enrollmentFee ?? 0} onChange={(value) => updateLoyaltyField("enrollmentFee", Number(value || 0))} />
                    <SettingsField label="Enrollment Bonus Points" type="number" value={settings.loyalty?.enrollmentBonusPoints ?? 0} onChange={(value) => updateLoyaltyField("enrollmentBonusPoints", Number(value || 0))} />
                    <SettingsField label="Card Sequence Padding" type="number" value={settings.loyalty?.cardSequencePadding ?? 4} onChange={(value) => updateLoyaltyField("cardSequencePadding", Number(value || 0))} />
                </div>
            </SettingsCard>

            <SettingsCard title="Operational Controls" description="Switch between sales-facing controls and purchase-label rules without leaving the settings desk.">
                <div className="settings-choice-row mb-3">
                    <button
                        type="button"
                        className={`settings-choice${activeSettingsTab === "sales" ? " active" : ""}`}
                        onClick={() => setActiveSettingsTab("sales")}
                    >
                        Sales & POS Controls
                    </button>
                    <button
                        type="button"
                        className={`settings-choice${activeSettingsTab === "purchase" ? " active" : ""}`}
                        onClick={() => setActiveSettingsTab("purchase")}
                    >
                        Purchase & Label Controls
                    </button>
                </div>

                {activeGroups.map((group) => (
                    <div key={group.title} className="settings-group">
                        <div>
                            <h3>{group.title}</h3>
                            <p>{group.description}</p>
                        </div>
                        <div className="settings-toggle-grid">
                            {group.ids.map((id) => (
                                <SettingsToggleCard
                                    key={id}
                                    title={SETTING_LABELS[id]}
                                    body={SETTINGS_COPY[id]}
                                    checked={Boolean(settings[activeScope][id])}
                                    onToggle={() => updateToggle(activeScope, id)}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </SettingsCard>

            <SettingsCard
                title="Reset"
                description="Go back to the default local configuration for this machine."
                actions={<ActionButton variant="secondary" onClick={() => setSettings(DEFAULT_APP_SETTINGS)}>Reset Defaults</ActionButton>}
            />
        </SettingsPage>
    );
};

export default SettingsHome;
