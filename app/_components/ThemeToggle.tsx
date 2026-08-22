"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedTheme = window.localStorage.getItem("hatsmash-theme");
      const nextTheme: Theme = savedTheme === "light" ? "light" : "dark";
      setTheme(nextTheme);
      applyTheme(nextTheme);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem("hatsmash-theme", nextTheme);
  }

  return (
    <button
      className={compact ? "theme-toggle is-compact" : "theme-toggle"}
      type="button"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      aria-pressed={theme === "dark"}
      onClick={toggleTheme}
    >
      <span className="theme-toggle-icon" aria-hidden="true"><i /></span>
      <span>{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}
