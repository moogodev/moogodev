// Theme selection.
//
// Light is the default. Dark is opt-in, chosen by the toggle in the footer and
// remembered in localStorage.
//
// The choice lives on <html> as a class rather than in React state because every
// page in this app is reached by a full load: the marketing page, the auth pages
// and the console are separate documents, not nested routes sharing a layout
// that could hold the value. A class on the root element is the only place that
// survives a navigation from one to the other.

export type Theme = "light" | "dark";

const STORAGE_KEY = "moogo-theme";
const DARK_CLASS = "theme-dark";

const listeners = new Set<(theme: Theme) => void>();

// readStored returns the saved theme, or null when there is nothing usable.
//
// A missing key means the visitor never chose, which is the same as light. A key
// holding anything else is treated as missing too: a stale value from an older
// version of the app should land on the default rather than on an unstyled page.
function readStored(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    // Private browsing and a blocked third-party context both make
    // localStorage throw on access rather than return null. The theme still
    // works for this page view; only the memory of it is lost.
    return null;
  }
}

// currentTheme reads the theme from the document, which is the source of truth
// once applied. Reading the class rather than localStorage means a user who edits
// the value by hand sees what the page actually renders.
export function currentTheme(): Theme {
  return document.documentElement.classList.contains(DARK_CLASS) ? "dark" : "light";
}

// applyTheme sets the document class and returns the theme now in effect.
//
// Only the class is set. color-scheme is handled in the stylesheet -- light on
// html, dark inside .theme-dark -- because that is what makes native widgets
// follow the theme (scrollbars, select dropdowns, date pickers), and doing it in
// CSS keeps this file free of inline style writes.
export function applyTheme(theme: Theme): Theme {
  document.documentElement.classList.toggle(DARK_CLASS, theme === "dark");

  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not being able to remember the choice is not a reason to fail the change.
  }

  for (const listener of listeners) {
    listener(theme);
  }
  return theme;
}

// initializeTheme applies the saved theme once, before anything renders.
//
// It is called at the top of main.tsx rather than from an effect because an
// effect runs after the first paint, and a returning dark-mode visitor would see
// a white flash of the page they asked to keep dark.
//
// The usual fix for that is a blocking inline script in index.html, which the
// Content-Security-Policy forbids: script-src is 'self' with no 'unsafe-inline'
// and no nonce. Reading localStorage from the bundle is the remaining option, and
// since #root is empty until React renders, the only thing that can show before
// the class lands is the page background.
export function initializeTheme(): Theme {
  return applyTheme(readStored() ?? "light");
}

// toggleTheme switches to the other theme and returns it.
export function toggleTheme(): Theme {
  return applyTheme(currentTheme() === "dark" ? "light" : "dark");
}

// subscribeTheme reports theme changes to a listener.
//
// The toggle uses it so that two instances mounted at once -- the footer and the
// console sidebar -- stay in agreement. Storage events are handled separately,
// which is why this exists rather than the toggle reading the document on click.
export function subscribeTheme(listener: (theme: Theme) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// storageKey is exported for tests.
export const __storageKey = STORAGE_KEY;
