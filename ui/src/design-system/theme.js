export const THEME_STORAGE_KEY = "mobility-dashboard-theme";
export const DEFAULT_THEME_PREFERENCE = "dark";
export const THEME_PREFERENCES = ["dark", "light", "system"];

export function normalizeThemePreference(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return THEME_PREFERENCES.includes(normalized) ? normalized : DEFAULT_THEME_PREFERENCE;
}

export function resolveThemePreference(preference, systemPrefersDark = true) {
  const normalized = normalizeThemePreference(preference);
  if (normalized === "system") return systemPrefersDark ? "dark" : "light";
  return normalized;
}

function getSystemQuery(win) {
  return typeof win?.matchMedia === "function" ? win.matchMedia("(prefers-color-scheme: dark)") : null;
}

export function readThemePreference(win = globalThis.window) {
  try {
    return normalizeThemePreference(win?.localStorage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

export function applyThemePreference(preference, win = globalThis.window) {
  const normalized = normalizeThemePreference(preference);
  const query = getSystemQuery(win);
  const resolved = resolveThemePreference(normalized, query?.matches ?? true);
  const root = win?.document?.documentElement;

  if (root) {
    root.dataset.theme = resolved;
    root.dataset.themePreference = normalized;
    root.style.colorScheme = resolved;
  }

  const themeColor = resolved === "light" ? "#f4f6f8" : "#080a0f";
  win?.document?.querySelector?.('meta[name="theme-color"]')?.setAttribute("content", themeColor);

  return resolved;
}

export function setThemePreference(preference, win = globalThis.window) {
  const normalized = normalizeThemePreference(preference);
  try {
    win?.localStorage?.setItem(THEME_STORAGE_KEY, normalized);
  } catch {
    // Theme still applies when storage is unavailable.
  }
  return applyThemePreference(normalized, win);
}

export function bootstrapTheme(win = globalThis.window) {
  if (!win) return () => {};
  const query = getSystemQuery(win);
  const onSystemThemeChange = () => {
    const preference = readThemePreference(win);
    if (preference === "system") applyThemePreference(preference, win);
  };

  applyThemePreference(readThemePreference(win), win);
  query?.addEventListener?.("change", onSystemThemeChange);
  return () => query?.removeEventListener?.("change", onSystemThemeChange);
}
