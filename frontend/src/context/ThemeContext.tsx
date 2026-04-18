"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark" | "system";
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
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const DEFAULT_THEME: ThemeSettings = {
  mode: "system",
  color: "orange",
  layout: "sidebar",
};

const THEME_RGB: Record<
  ThemeColor,
  { primary50: string; primary500: string; primary600: string }
> = {
  purple: {
    primary50: "250 245 255",
    primary500: "168 85 247",
    primary600: "147 51 234",
  },
  blue: {
    primary50: "239 246 255",
    primary500: "59 130 246",
    primary600: "37 99 235",
  },
  green: {
    primary50: "247 254 231",
    primary500: "132 204 22",
    primary600: "101 163 13",
  },
  orange: {
    primary50: "255 243 238",
    primary500: "250 93 25",
    primary600: "212 76 20",
  },
  red: {
    primary50: "254 242 242",
    primary500: "239 68 68",
    primary600: "220 38 38",
  },
};

function getSystemMode(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveMode(
  mode: ThemeMode,
  systemMode: "light" | "dark",
): "light" | "dark" {
  return mode === "system" ? systemMode : mode;
}

function applyTheme(settings: ThemeSettings, systemMode: "light" | "dark") {
  const root = document.documentElement;
  const actual = resolveMode(settings.mode, systemMode);
  const rgb = THEME_RGB[settings.color];

  if (actual === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
  }

  root.setAttribute("data-theme-color", settings.color);
  root.style.setProperty("--primary-50", rgb.primary50);
  root.style.setProperty("--primary-500", rgb.primary500);
  root.style.setProperty("--primary-600", rgb.primary600);
  root.setAttribute("data-layout", settings.layout);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);
  const [systemMode, setSystemMode] = useState<"light" | "dark">("light");

  // Hydrate from localStorage + listen to OS theme changes
  useEffect(() => {
    const current = getSystemMode();
    setSystemMode(current);

    const stored = localStorage.getItem("construprice-theme");
    let initial = DEFAULT_THEME;
    if (stored) {
      try {
        initial = JSON.parse(stored) as ThemeSettings;
      } catch {
        /* ignore */
      }
    }
    setTheme(initial);
    applyTheme(initial, current);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const next = e.matches ? "dark" : "light";
      setSystemMode(next);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Re-apply whenever theme or systemMode changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("construprice-theme", JSON.stringify(theme));
    applyTheme(theme, systemMode);
  }, [theme, systemMode]);

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
    setTheme((prev) => {
      if (prev.mode === "light") return { ...prev, mode: "dark" };
      if (prev.mode === "dark") return { ...prev, mode: "system" };
      return { ...prev, mode: "light" };
    });
  }

  const isDark = resolveMode(theme.mode, systemMode) === "dark";

  return (
    <ThemeContext.Provider
      value={{ ...theme, setMode, setColor, setLayout, toggleMode, isDark }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
