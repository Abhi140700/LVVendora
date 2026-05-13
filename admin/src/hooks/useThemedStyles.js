/**
 * useThemedStyles Hook
 * Provides a standardized way to get themed style objects
 * Use this to replace inline style objects in pages
 */

import { useMemo } from "react";
import { useThemeContext } from "../context/themeContext";

export const useThemedStyles = () => {
    const { effectiveTheme } = useThemeContext();

    return useMemo(() => ({
        // Page & Container
        page: {
            display: "flex",
            flexDirection: "column",
            gap: 16,
            padding: 16,
        },

        // Hero Sections
        hero: {
            background: "var(--hero-gradient-soft)",
            border: "1px solid var(--panel-border-soft)",
            borderRadius: 24,
            padding: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 20,
        },

        // Text Styles
        eyebrow: {
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-soft)",
            fontWeight: 800,
        },

        title: {
            fontSize: 24,
            fontWeight: 700,
            color: "var(--text-main)",
            margin: 0,
            marginBottom: 8,
        },

        subtitle: {
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-main)",
            margin: 0,
            marginBottom: 8,
        },

        subtle: {
            color: "var(--text-soft)",
            fontSize: 14,
            margin: 0,
        },

        // Cards
        card: {
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 24,
            padding: 20,
        },

        cardPanel: {
            background: "var(--panel-gradient)",
            border: "1px solid var(--panel-border)",
            borderRadius: 24,
            padding: 20,
        },

        cardSoft: {
            background: "var(--soft-card-bg)",
            border: "1px solid var(--soft-card-border)",
            borderRadius: 24,
            padding: 20,
        },

        // Buttons
        primaryButton: {
            background: "var(--button-primary)",
            color: "var(--button-primary-text)",
            border: "none",
            borderRadius: 16,
            padding: "12px 16px",
            fontWeight: 800,
            cursor: "pointer",
            transition: "opacity 0.2s",
        },

        secondaryButton: {
            background: "var(--button-secondary-bg)",
            color: "var(--button-secondary-text)",
            border: "1px solid var(--button-secondary-border)",
            borderRadius: 16,
            padding: "12px 16px",
            fontWeight: 800,
            cursor: "pointer",
            transition: "opacity 0.2s",
        },

        dangerButton: {
            background: "var(--danger-soft-bg)",
            color: "var(--danger-soft-text)",
            border: "1px solid var(--danger-soft-border)",
            borderRadius: 16,
            padding: "12px 16px",
            fontWeight: 800,
            cursor: "pointer",
        },

        // Form Fields
        field: {
            display: "grid",
            gap: 6,
        },

        label: {
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-soft)",
            fontWeight: 800,
        },

        input: {
            width: "100%",
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px solid var(--field-border)",
            background: "var(--field-bg)",
            color: "var(--field-text)",
            fontSize: 14,
        },

        // Status & Tone
        successTone: {
            background: "var(--success-soft-bg)",
            border: "1px solid var(--success-soft-border)",
            color: "var(--success-soft-text)",
            borderRadius: 12,
            padding: "10px 12px",
        },

        warningTone: {
            background: "var(--warning-soft-bg)",
            border: "1px solid var(--warning-soft-border)",
            color: "var(--warning-soft-text)",
            borderRadius: 12,
            padding: "10px 12px",
        },

        dangerTone: {
            background: "var(--danger-soft-bg)",
            border: "1px solid var(--danger-soft-border)",
            color: "var(--danger-soft-text)",
            borderRadius: 12,
            padding: "10px 12px",
        },

        infoTone: {
            background: "var(--info-soft-bg)",
            border: "1px solid var(--info-soft-border)",
            color: "var(--info-soft-text)",
            borderRadius: 12,
            padding: "10px 12px",
        },

        // Accent
        accentBg: {
            background: "color-mix(in srgb, var(--accent) 18%, var(--surface-soft))",
            border: "1px solid color-mix(in srgb, var(--accent) 28%, var(--line))",
            borderRadius: 12,
            padding: "10px 12px",
        },

        // Grid & Layout
        grid: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
        },

        stack: {
            display: "flex",
            flexDirection: "column",
            gap: 16,
        },

        row: {
            display: "flex",
            gap: 12,
            alignItems: "center",
        },

        // Shadows
        shadowSoft: {
            boxShadow: "var(--shadow)",
        },

        // Glass Effect
        glass: {
            background: "var(--glass)",
            border: "1px solid var(--glass-border)",
            backdropFilter: "blur(10px)",
        },

        glassStrong: {
            background: "var(--glass-strong)",
            border: "1px solid var(--glass-border)",
            backdropFilter: "blur(10px)",
        },

        // Loading & Empty States
        loadingText: {
            color: "var(--text-soft)",
            fontSize: 14,
            padding: 24,
            textAlign: "center",
        },

        errorText: {
            color: "var(--danger-soft-text)",
        },

        emptyState: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 32,
            color: "var(--text-soft)",
            textAlign: "center",
        },
    }), [effectiveTheme]);
};

export default useThemedStyles;
