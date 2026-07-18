import { getWindow } from "../platform/runtime.js";

export const ADD_SESSION_DRAFT_STORAGE_KEY = "mobility.addSessionDraft.v1";

const ALLOWED_FIELDS = [
  "date", "provider", "location", "vehicle", "tags", "connector", "socStart", "socEnd",
  "energyKwh", "pricePerKwh", "durationHHMM", "odometerKm", "note",
];

function storageTarget(target) {
  if (target?.localStorage) return target.localStorage;
  return target || getWindow()?.localStorage || null;
}

function cleanValues(values) {
  return Object.fromEntries(ALLOWED_FIELDS.map((field) => [field, String(values?.[field] ?? "").slice(0, 500)]));
}

export function hasMeaningfulAddSessionDraft(values) {
  return ["provider", "location", "tags", "energyKwh", "pricePerKwh", "durationHHMM", "odometerKm", "note"]
    .some((field) => String(values?.[field] || "").trim());
}

export function readAddSessionDraft(target) {
  try {
    const raw = storageTarget(target)?.getItem?.(ADD_SESSION_DRAFT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed?.values || !hasMeaningfulAddSessionDraft(parsed.values)) return null;
    return { values: cleanValues(parsed.values), updatedAt: String(parsed.updatedAt || "") };
  } catch {
    return null;
  }
}

export function writeAddSessionDraft(values, target) {
  if (!hasMeaningfulAddSessionDraft(values)) {
    clearAddSessionDraft(target);
    return null;
  }
  const draft = { values: cleanValues(values), updatedAt: new Date().toISOString() };
  try {
    storageTarget(target)?.setItem?.(ADD_SESSION_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Draft autosave is a best-effort enhancement.
  }
  return draft;
}

export function clearAddSessionDraft(target) {
  try {
    storageTarget(target)?.removeItem?.(ADD_SESSION_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore restricted storage environments.
  }
}
