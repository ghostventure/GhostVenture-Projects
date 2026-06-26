"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const storageKey = "bls-theme";
const validThemes = new Set(["light", "dark", "system"]);
const lightQuery = "(prefers-color-scheme: light)";
const themeColors = {
  light: "#f5f5ef",
  dark: "#0d1510"
};

const ThemeContext = createContext({
  theme: "system",
  resolvedTheme: "dark",
  setTheme: () => {}
});

function sanitizeTheme(nextTheme) {
  return validThemes.has(nextTheme) ? nextTheme : "system";
}

function resolveTheme(nextTheme) {
  if (typeof window === "undefined") {
    return "dark";
  }

  if (nextTheme === "system") {
    return window.matchMedia(lightQuery).matches ? "light" : "dark";
  }

  return nextTheme;
}

function applyTheme(nextTheme) {
  if (typeof document === "undefined") {
    return "dark";
  }

  const themeChoice = sanitizeTheme(nextTheme);
  const resolvedTheme = resolveTheme(themeChoice);
  const root = document.documentElement;
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');

  root.dataset.theme = resolvedTheme;
  root.dataset.themeChoice = themeChoice;
  root.style.colorScheme = resolvedTheme;

  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", themeColors[resolvedTheme]);
  }

  return resolvedTheme;
}

function readSavedTheme() {
  if (typeof window === "undefined") {
    return "system";
  }

  return sanitizeTheme(window.localStorage.getItem(storageKey) || "system");
}

function readInitialTheme() {
  if (typeof document === "undefined") {
    return { theme: "system", resolvedTheme: "dark" };
  }

  const root = document.documentElement;
  const theme = sanitizeTheme(root.dataset.themeChoice || readSavedTheme());
  const resolvedTheme =
    root.dataset.theme === "light" || root.dataset.theme === "dark"
      ? root.dataset.theme
      : resolveTheme(theme);

  return { theme, resolvedTheme };
}

export function ThemeProvider({ children }) {
  const [{ theme, resolvedTheme }, setThemeSnapshot] = useState(readInitialTheme);

  useEffect(() => {
    function syncTheme(nextTheme = readSavedTheme()) {
      const themeChoice = sanitizeTheme(nextTheme);
      const nextResolvedTheme = applyTheme(themeChoice);
      setThemeSnapshot({ theme: themeChoice, resolvedTheme: nextResolvedTheme });
    }

    function handleSystemChange() {
      if (readSavedTheme() === "system") {
        syncTheme("system");
      }
    }

    function handleStorage(event) {
      if (event.key === storageKey) {
        syncTheme(event.newValue || "system");
      }
    }

    syncTheme();

    const mediaQuery = window.matchMedia(lightQuery);
    mediaQuery.addEventListener("change", handleSystemChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  function setTheme(nextTheme) {
    const themeChoice = sanitizeTheme(nextTheme);
    window.localStorage.setItem(storageKey, themeChoice);
    setThemeSnapshot({ theme: themeChoice, resolvedTheme: applyTheme(themeChoice) });
  }

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
