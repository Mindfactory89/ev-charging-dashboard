import {
  ACTIVE_VEHICLE_PROFILE_STORAGE_KEY,
  CUSTOM_VEHICLE_PROFILES_STORAGE_KEY,
  VEHICLE_PROFILE_IMAGES_STORAGE_KEY,
} from "./vehicleProfilePreferences.js";
import { CHARGING_GOALS_STORAGE_KEY } from "./chargingGoals.js";
import { CHARGING_PROFILES_STORAGE_KEY } from "./chargingProfiles.js";
import { THEME_STORAGE_KEY, THEME_PREFERENCES } from "../design-system/theme.js";
import { IMPORT_MAPPING_PROFILE_STORAGE_KEY } from "../ui/importMappingProfiles.js";
import { SAVED_HISTORY_FILTERS_STORAGE_KEY } from "../ui/savedHistoryFilters.js";
import { PERSONAL_ACTION_CENTER_STORAGE_KEY } from "../ui/personalActionCenter.js";
import { DATA_QUALITY_STORAGE_KEY } from "../ui/dataQuality.js";
import { DASHBOARD_NOTIFICATIONS_STORAGE_KEY } from "../ui/dashboardNotifications.js";
import { LOCALE_STORAGE_KEY, SUPPORTED_LOCALES } from "../i18n/runtime.js";
import { getWindow } from "../platform/runtime.js";

export const DATA_PREFERENCES_FORMAT = "mobility-dashboard-preferences";
export const DATA_PREFERENCES_VERSION = 1;
export const DATA_PREFERENCES_MAX_BYTES = 512 * 1024;

const PREFERENCE_DEFINITIONS = Object.freeze([
  { id: "theme", storageKey: THEME_STORAGE_KEY, type: "string", allowed: THEME_PREFERENCES },
  { id: "locale", storageKey: LOCALE_STORAGE_KEY, type: "string", allowed: SUPPORTED_LOCALES },
  { id: "customVehicles", storageKey: CUSTOM_VEHICLE_PROFILES_STORAGE_KEY, type: "array" },
  { id: "activeVehicle", storageKey: ACTIVE_VEHICLE_PROFILE_STORAGE_KEY, type: "string", maxLength: 120 },
  { id: "chargingGoals", storageKey: CHARGING_GOALS_STORAGE_KEY, type: "object" },
  { id: "chargingProfiles", storageKey: CHARGING_PROFILES_STORAGE_KEY, type: "object" },
  { id: "importProfiles", storageKey: IMPORT_MAPPING_PROFILE_STORAGE_KEY, type: "array" },
  { id: "actionCenter", storageKey: PERSONAL_ACTION_CENTER_STORAGE_KEY, type: "object" },
  { id: "dataQuality", storageKey: DATA_QUALITY_STORAGE_KEY, type: "object" },
  { id: "notifications", storageKey: DASHBOARD_NOTIFICATIONS_STORAGE_KEY, type: "object" },
  { id: "savedViews", storageKey: SAVED_HISTORY_FILTERS_STORAGE_KEY, type: "array" },
]);

const PREFERENCE_GROUPS = Object.freeze([
  { id: "appearance", keys: ["theme", "locale"] },
  { id: "vehicles", keys: ["customVehicles", "activeVehicle", "vehicleImages"] },
  { id: "goals", keys: ["chargingGoals"] },
  { id: "chargingProfiles", keys: ["chargingProfiles"] },
  { id: "imports", keys: ["importProfiles"] },
  { id: "actions", keys: ["actionCenter", "dataQuality", "notifications"] },
  { id: "savedViews", keys: ["savedViews"] },
]);

function storageTarget(target) {
  if (target?.localStorage) return target.localStorage;
  return target || getWindow()?.localStorage || null;
}

function byteLength(value) {
  const text = String(value || "");
  if (typeof TextEncoder === "function") return new TextEncoder().encode(text).length;
  return text.length;
}

function readStoredValue(definition, target) {
  try {
    const raw = storageTarget(target)?.getItem?.(definition.storageKey);
    if (raw == null || raw === "") return undefined;
    if (definition.type === "string") return raw;
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function validatePreferenceValue(definition, value) {
  if (definition.type === "array" && !Array.isArray(value)) return false;
  if (definition.type === "object" && (!value || typeof value !== "object" || Array.isArray(value))) return false;
  if (definition.type === "string") {
    if (typeof value !== "string" || !value.trim()) return false;
    if (definition.maxLength && value.length > definition.maxLength) return false;
    if (definition.allowed && !definition.allowed.includes(value)) return false;
  }
  return byteLength(JSON.stringify(value)) <= 128 * 1024;
}

function cleanPreferencePayload(preferences) {
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) return {};
  return Object.fromEntries(
    PREFERENCE_DEFINITIONS
      .map((definition) => [definition.id, preferences[definition.id], definition])
      .filter(([, value, definition]) => value !== undefined && validatePreferenceValue(definition, value))
      .map(([id, value]) => [id, value])
  );
}

export function createLocalPreferencesBackup(target, exportedAt = new Date().toISOString()) {
  const preferences = Object.fromEntries(
    PREFERENCE_DEFINITIONS
      .map((definition) => [definition.id, readStoredValue(definition, target)])
      .filter(([, value]) => value !== undefined)
  );

  return {
    format: DATA_PREFERENCES_FORMAT,
    version: DATA_PREFERENCES_VERSION,
    exportedAt,
    preferences,
  };
}

export function serializeLocalPreferencesBackup(target, exportedAt) {
  return `${JSON.stringify(createLocalPreferencesBackup(target, exportedAt), null, 2)}\n`;
}

export function analyzeLocalPreferencesBackup(input) {
  const text = typeof input === "string" ? input : JSON.stringify(input || {});
  if (byteLength(text) > DATA_PREFERENCES_MAX_BYTES) return { valid: false, error: "size", items: [] };

  let parsed;
  try {
    parsed = typeof input === "string" ? JSON.parse(input) : input;
  } catch {
    return { valid: false, error: "syntax", items: [] };
  }

  if (parsed?.format !== DATA_PREFERENCES_FORMAT) return { valid: false, error: "format", items: [] };
  if (parsed?.version !== DATA_PREFERENCES_VERSION) return { valid: false, error: "version", items: [] };

  const preferences = cleanPreferencePayload(parsed.preferences);
  const suppliedKeys = parsed?.preferences && typeof parsed.preferences === "object"
    ? Object.keys(parsed.preferences)
    : [];
  const items = Object.keys(preferences);
  if (!items.length) return { valid: false, error: "empty", items: [] };
  if (items.length !== suppliedKeys.length) return { valid: false, error: "content", items: [] };

  return {
    valid: true,
    error: null,
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : null,
    items,
    preferences,
  };
}

export function restoreLocalPreferencesBackup(input, target) {
  const analysis = analyzeLocalPreferencesBackup(input);
  if (!analysis.valid) return analysis;
  const storage = storageTarget(target);
  if (!storage?.setItem) return { ...analysis, valid: false, error: "storage" };

  try {
    PREFERENCE_DEFINITIONS.forEach((definition) => {
      if (!(definition.id in analysis.preferences)) return;
      const value = analysis.preferences[definition.id];
      storage.setItem(definition.storageKey, definition.type === "string" ? value : JSON.stringify(value));
    });
  } catch {
    return { ...analysis, valid: false, error: "storage" };
  }

  return analysis;
}

export function getLocalPreferenceInventory(target) {
  const values = Object.fromEntries(
    PREFERENCE_DEFINITIONS.map((definition) => [definition.id, readStoredValue(definition, target)])
  );
  values.vehicleImages = readStoredValue({ storageKey: VEHICLE_PROFILE_IMAGES_STORAGE_KEY, type: "object" }, target);

  return PREFERENCE_GROUPS.map((group) => {
    const entries = group.keys.map((key) => values[key]).filter((value) => value !== undefined);
    const itemCount = entries.reduce((count, value) => count + (Array.isArray(value) ? value.length : 1), 0);
    return { id: group.id, present: entries.length > 0, itemCount };
  });
}
