import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
  applyThemePreference,
  normalizeThemePreference,
  readThemePreference,
  resolveThemePreference,
  setThemePreference,
} from "../src/design-system/theme.js";

function createWindow({ stored = null, systemDark = true } = {}) {
  const values = new Map(stored == null ? [] : [[THEME_STORAGE_KEY, stored]]);
  const attributes = new Map();
  const meta = {
    setAttribute(name, value) {
      attributes.set(name, value);
    },
  };

  return {
    localStorage: {
      getItem(key) {
        return values.get(key) ?? null;
      },
      setItem(key, value) {
        values.set(key, value);
      },
    },
    matchMedia() {
      return { matches: systemDark };
    },
    document: {
      documentElement: { dataset: {}, style: {} },
      querySelector(selector) {
        return selector === 'meta[name="theme-color"]' ? meta : null;
      },
    },
    values,
    attributes,
  };
}

test("theme preferences normalize and resolve predictably", () => {
  assert.equal(normalizeThemePreference("LIGHT"), "light");
  assert.equal(normalizeThemePreference("unknown"), DEFAULT_THEME_PREFERENCE);
  assert.equal(resolveThemePreference("system", true), "dark");
  assert.equal(resolveThemePreference("system", false), "light");
});

test("theme preference persists and updates document theme metadata", () => {
  const win = createWindow({ systemDark: false });

  const resolved = setThemePreference("system", win);

  assert.equal(resolved, "light");
  assert.equal(readThemePreference(win), "system");
  assert.equal(win.values.get(THEME_STORAGE_KEY), "system");
  assert.equal(win.document.documentElement.dataset.theme, "light");
  assert.equal(win.document.documentElement.dataset.themePreference, "system");
  assert.equal(win.document.documentElement.style.colorScheme, "light");
  assert.equal(win.attributes.get("content"), "#f4f6f8");
});

test("applying dark theme updates without touching persisted preference", () => {
  const win = createWindow({ stored: "light", systemDark: false });

  assert.equal(applyThemePreference("dark", win), "dark");
  assert.equal(win.values.get(THEME_STORAGE_KEY), "light");
  assert.equal(win.document.documentElement.dataset.theme, "dark");
  assert.equal(win.attributes.get("content"), "#080a0f");
});
