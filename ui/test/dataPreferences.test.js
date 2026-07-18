import test from "node:test";
import assert from "node:assert/strict";

import {
  ACTIVE_VEHICLE_PROFILE_STORAGE_KEY,
  CUSTOM_VEHICLE_PROFILES_STORAGE_KEY,
  VEHICLE_PROFILE_IMAGES_STORAGE_KEY,
} from "../src/config/vehicleProfilePreferences.js";
import { CHARGING_GOALS_STORAGE_KEY } from "../src/config/chargingGoals.js";
import { CHARGING_PROFILES_STORAGE_KEY } from "../src/config/chargingProfiles.js";
import { THEME_STORAGE_KEY } from "../src/design-system/theme.js";
import { LOCALE_STORAGE_KEY } from "../src/i18n/runtime.js";
import { PERSONAL_ACTION_CENTER_STORAGE_KEY } from "../src/ui/personalActionCenter.js";
import {
  DATA_PREFERENCES_FORMAT,
  DATA_PREFERENCES_VERSION,
  analyzeLocalPreferencesBackup,
  createLocalPreferencesBackup,
  getLocalPreferenceInventory,
  restoreLocalPreferencesBackup,
  serializeLocalPreferencesBackup,
} from "../src/config/dataPreferences.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

test("preference backup exports only known local personalization", () => {
  const storage = memoryStorage({
    [THEME_STORAGE_KEY]: "light",
    [LOCALE_STORAGE_KEY]: "de",
    [CUSTOM_VEHICLE_PROFILES_STORAGE_KEY]: JSON.stringify([{ id: "family", name: "Family EV" }]),
    unrelated: "secret",
  });
  const backup = createLocalPreferencesBackup(storage, "2026-07-16T08:00:00.000Z");

  assert.equal(backup.format, DATA_PREFERENCES_FORMAT);
  assert.equal(backup.version, DATA_PREFERENCES_VERSION);
  assert.equal(backup.preferences.theme, "light");
  assert.equal(backup.preferences.unrelated, undefined);
  assert.match(serializeLocalPreferencesBackup(storage), /mobility-dashboard-preferences/);
});

test("backup analysis rejects unknown, invalid, and incompatible content", () => {
  assert.equal(analyzeLocalPreferencesBackup("not json").error, "syntax");
  assert.equal(analyzeLocalPreferencesBackup({ format: "other", version: 1 }).error, "format");
  assert.equal(analyzeLocalPreferencesBackup({ format: DATA_PREFERENCES_FORMAT, version: 2 }).error, "version");
  assert.equal(analyzeLocalPreferencesBackup({
    format: DATA_PREFERENCES_FORMAT,
    version: DATA_PREFERENCES_VERSION,
    preferences: { theme: "neon" },
  }).error, "empty");
  assert.equal(analyzeLocalPreferencesBackup({
    format: DATA_PREFERENCES_FORMAT,
    version: DATA_PREFERENCES_VERSION,
    preferences: { theme: "dark", unknown: "value" },
  }).error, "content");
});

test("valid backup restores preferences into their original storage keys", () => {
  const target = memoryStorage();
  const result = restoreLocalPreferencesBackup({
    format: DATA_PREFERENCES_FORMAT,
    version: DATA_PREFERENCES_VERSION,
    exportedAt: "2026-07-16T08:00:00.000Z",
    preferences: {
      theme: "system",
      locale: "en",
      activeVehicle: "family",
      chargingGoals: { annualBudgetEur: 900 },
      customVehicles: [{ id: "family", name: "Family EV" }],
    },
  }, target);

  assert.equal(result.valid, true);
  assert.equal(target.getItem(THEME_STORAGE_KEY), "system");
  assert.equal(target.getItem(LOCALE_STORAGE_KEY), "en");
  assert.equal(target.getItem(ACTIVE_VEHICLE_PROFILE_STORAGE_KEY), "family");
  assert.deepEqual(JSON.parse(target.getItem(CHARGING_GOALS_STORAGE_KEY)), { annualBudgetEur: 900 });
  assert.equal(JSON.parse(target.getItem(CUSTOM_VEHICLE_PROFILES_STORAGE_KEY))[0].id, "family");
});

test("local inventory separates appearance, vehicles, goals, imports, actions, and views", () => {
  const storage = memoryStorage({
    [THEME_STORAGE_KEY]: "dark",
    [LOCALE_STORAGE_KEY]: "de",
    [CHARGING_GOALS_STORAGE_KEY]: JSON.stringify({ annualBudgetEur: 1200 }),
    [CHARGING_PROFILES_STORAGE_KEY]: JSON.stringify({ profiles: [{ id: "home" }], activeProfileId: "home" }),
    [CUSTOM_VEHICLE_PROFILES_STORAGE_KEY]: JSON.stringify([{ id: "one" }, { id: "two" }]),
    [VEHICLE_PROFILE_IMAGES_STORAGE_KEY]: JSON.stringify({ one: "data:image/webp;base64,UklGRg==" }),
    [PERSONAL_ACTION_CENTER_STORAGE_KEY]: JSON.stringify({ years: { 2026: { hidden: ["outliers"] } } }),
  });
  const inventory = getLocalPreferenceInventory(storage);

  assert.deepEqual(inventory.map((item) => item.id), ["appearance", "vehicles", "goals", "chargingProfiles", "imports", "actions", "savedViews"]);
  assert.equal(inventory.find((item) => item.id === "appearance").itemCount, 2);
  assert.equal(inventory.find((item) => item.id === "vehicles").itemCount, 3);
  assert.equal(inventory.find((item) => item.id === "goals").present, true);
  assert.equal(inventory.find((item) => item.id === "chargingProfiles").present, true);
  assert.equal(inventory.find((item) => item.id === "imports").present, false);
  assert.equal(inventory.find((item) => item.id === "actions").present, true);
});
