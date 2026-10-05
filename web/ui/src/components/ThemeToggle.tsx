import { useCallback, useEffect, useState } from "react";
import { currentTheme, subscribeTheme, toggleTheme, type Theme } from "../lib/theme";

// ThemeToggle switches between the light and dark palette.
//
// It is a single button showing the theme it would switch to, not a pair of
// radio buttons: a two-state control does not need two targets, and one button
// stays legible in the footer where a segmented control would crowd the links.
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(() => currentTheme());

  // A second instance elsewhere on the page has to see this one's change, and a
  // change made in another tab has to land here too.
  useEffect(() => {
    const unsubscribe = subscribeTheme(setTheme);
    const onStorage = (event: StorageEvent) => {
      if (event.key === "moogo-theme") {
        setTheme(currentTheme());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const next = theme === "dark" ? "light" : "dark";

  const onClick = useCallback(() => {
    toggleTheme();
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      // The accessible name is the action, not the state: "Switch to dark theme"
      // tells a screen-reader user what the button does, where "Dark theme" is
      // ambiguous about whether it is on, off, or already selected.
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-edge px-3 py-1.5 text-[0.85rem] text-muted transition-colors hover:border-edge-strong hover:bg-panel hover:text-foreground ${className}`}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      <span>{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
    </svg>
  );
}
