"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isLight = resolvedTheme === "light";
  const nextTheme = theme === "system" ? (isLight ? "dark" : "light") : "system";
  const label = theme === "system" ? "Auto" : isLight ? "Night" : "Day";
  const ariaLabel =
    theme === "system"
      ? `Using system ${resolvedTheme} theme. Switch to ${isLight ? "night" : "day"} theme`
      : `Using ${resolvedTheme} theme. Switch to system theme`;

  return (
    <button
      type="button"
      className="button button-secondary theme-toggle"
      onClick={() => setTheme(nextTheme)}
      aria-label={ariaLabel}
      title={ariaLabel}
      data-theme-choice={theme}
      suppressHydrationWarning
    >
      {isLight ? <MoonStar size={16} /> : <SunMedium size={16} />}
      <span suppressHydrationWarning>{label}</span>
    </button>
  );
}
