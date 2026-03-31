"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type ThemeMode = "light" | "dark";
export type ThemeColor = "purple" | "blue" | "green" | "orange" | "red";
export type LayoutStyle = "sidebar" | "topbar" | "compact" | "wide" | "minimal";

interface ThemeSettings {
  mode: ThemeMode;
  color: ThemeColor;
  layout: LayoutStyle;
}

interface ThemeContextValue extends ThemeSettings {
  setMode: (mode: ThemeMode) => void;
  setColor: (color: ThemeColor) => void;
  setLayout: (layout: LayoutStyle) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const DEFAULT_THEME: ThemeSettings = {
  mode: "light",
  color: "green",
  layout: "sidebar"
};

const THEME_RGB: Record<ThemeColor, { primary50: string; primary500: string; primary600: string }> = {
  purple: { primary50: "250 245 255", primary500: "168 85 247", primary600: "147 51 234" },
  blue: { primary50: "239 246 255", primary500: "59 130 246", primary600: "37 99 235" },
  green: { primary50: "236 253 245", primary500: "16 185 129", primary600: "5 150 105" },
  orange: { primary50: "255 247 237", primary500: "249 115 22", primary600: "234 88 12" },
  red: { primary50: "254 242 242", primary500: "239 68 68", primary600: "220 38 38" }
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const stored = localStorage.getItem("construprice-theme");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ThemeSettings;
        setTheme(parsed);
        applyTheme(parsed);
      } catch {
        applyTheme(DEFAULT_THEME);
      }
    } else {
      applyTheme(DEFAULT_THEME);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("construprice-theme", JSON.stringify(theme));
    applyTheme(theme);
  }, [theme]);

  function applyTheme(settings: ThemeSettings) {
    const root = document.documentElement;
    const themeRgb = THEME_RGB[settings.color];
    
    // Apply mode (Forced to light by user request)
    root.classList.add("light");
    root.classList.remove("dark");

    // Apply color theme
    root.setAttribute("data-theme-color", settings.color);
    root.style.setProperty("--primary-50", themeRgb.primary50);
    root.style.setProperty("--primary-500", themeRgb.primary500);
    root.style.setProperty("--primary-600", themeRgb.primary600);
    
    // Apply layout
    root.setAttribute("data-layout", settings.layout);
  }

  function setMode(mode: ThemeMode) {
    setTheme((prev) => ({ ...prev, mode }));
  }

  function setColor(color: ThemeColor) {
    setTheme((prev) => ({ ...prev, color }));
  }

  function setLayout(layout: LayoutStyle) {
    setTheme((prev) => ({ ...prev, layout }));
  }

  function toggleMode() {
    // Disabled temporarily
    setTheme((prev) => ({ ...prev, mode: "light" }));
  }

  return (
    <ThemeContext.Provider
      value={{
        ...theme,
        setMode,
        setColor,
        setLayout,
        toggleMode
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
