import React, { useEffect, useMemo, useState } from "react";
import { ThemeContext } from "./themeContext.js";
import { APP_SETTINGS_UPDATED_EVENT, readAppSettings } from "../utils/appSettings.js";

const THEME_STORAGE_KEY = "erp-theme-mode";
const DEFAULT_THEME_PALETTE = "lime";

const getSystemTheme = () => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return "light";
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const ThemeProvider = ({ children }) => {
    const [themeMode, setThemeMode] = useState(() => {
        if (typeof window === "undefined") {
            return "system";
        }

        return localStorage.getItem(THEME_STORAGE_KEY) || "system";
    });
    const [systemTheme, setSystemTheme] = useState(getSystemTheme);
    const [themePalette, setThemePalette] = useState(() => {
        try {
            return readAppSettings()?.ui?.palette || DEFAULT_THEME_PALETTE;
        } catch {
            return DEFAULT_THEME_PALETTE;
        }
    });

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
            return undefined;
        }

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleThemeChange = (event) => {
            setSystemTheme(event.matches ? "dark" : "light");
        };

        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", handleThemeChange);
            return () => mediaQuery.removeEventListener("change", handleThemeChange);
        }

        mediaQuery.addListener(handleThemeChange);
        return () => mediaQuery.removeListener(handleThemeChange);
    }, []);

    const effectiveTheme = themeMode === "system" ? systemTheme : themeMode;

    useEffect(() => {
        const syncPalette = (event) => {
            try {
                const nextSettings = event?.detail?.settings || readAppSettings();
                const nextPalette = nextSettings?.ui?.palette || DEFAULT_THEME_PALETTE;
                setThemePalette(nextPalette);
            } catch {
                setThemePalette(DEFAULT_THEME_PALETTE);
            }
        };

        if (typeof window !== "undefined") {
            window.addEventListener(APP_SETTINGS_UPDATED_EVENT, syncPalette);
            window.addEventListener("storage", syncPalette);
            return () => {
                window.removeEventListener(APP_SETTINGS_UPDATED_EVENT, syncPalette);
                window.removeEventListener("storage", syncPalette);
            };
        }
    }, []);

    useEffect(() => {
        if (typeof document === "undefined") {
            return;
        }

        document.documentElement.dataset.theme = effectiveTheme;
        document.documentElement.dataset.palette = themePalette;
        document.documentElement.style.colorScheme = effectiveTheme;
        localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    }, [effectiveTheme, themeMode, themePalette]);

    const value = useMemo(() => ({
        themeMode,
        setThemeMode,
        effectiveTheme,
        systemTheme,
        themePalette,
        toggleThemeMode: () => {
            setThemeMode((currentMode) => {
                if (currentMode === "system") {
                    return systemTheme === "dark" ? "light" : "dark";
                }
                return currentMode === "dark" ? "light" : "dark";
            });
        },
    }), [effectiveTheme, systemTheme, themeMode, themePalette]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};
