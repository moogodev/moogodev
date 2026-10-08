// Theme selection for the changelog, mirroring the main site's behaviour:
// light is the default, dark is remembered in localStorage, and until the
// visitor chooses, the operating system decides (the stylesheet falls back
// to prefers-color-scheme when no data-theme is set yet).
//
// The choice lives on <html data-theme> rather than in React state because
// it has to survive the full page load every route here performs, and it is
// read before anything renders so a returning dark-mode visitor does not see
// a white flash.

export type Theme = "light" | "dark";

const STORAGE_KEY = "news-theme";

function readStored(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    // Private browsing and blocked storage make localStorage throw rather
    // than return null. The theme still works for this page view; only the
    // memory of the choice is lost.
    return null;
  }
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

// initializeTheme applies the saved theme, or the system's, once before the
// first render. Called at the top of main.tsx rather than from an effect,
// because an effect runs after the first paint.
export function initializeTheme(): Theme {
  const theme =
    readStored() ??
    (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  return theme;
}

// toggleTheme switches to the other theme, remembers it, and returns it.
export function toggleTheme(): Theme {
  const theme = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not being able to remember the choice is not a reason to fail the
    // change itself.
  }
  return theme;
}
