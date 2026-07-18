import { getWindow } from "../platform/runtime.js";
import { normalizeHistoryFilters } from "./sessionHistoryView.js";

export const SAVED_HISTORY_FILTERS_STORAGE_KEY = "mobility.savedHistoryFilters.v1";

function storageTarget(target) {
  return target || getWindow()?.localStorage || null;
}

function cleanProfile(profile) {
  const id = String(profile?.id || "").trim();
  const name = String(profile?.name || "").trim().slice(0, 60);
  if (!id || !name) return null;
  return {
    id,
    name,
    filters: normalizeHistoryFilters(profile?.filters),
    updatedAt: String(profile?.updatedAt || new Date().toISOString()),
  };
}

export function readSavedHistoryFilters(target) {
  try {
    const raw = storageTarget(target)?.getItem?.(SAVED_HISTORY_FILTERS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(cleanProfile).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function writeSavedHistoryFilters(profiles, target) {
  const cleaned = (Array.isArray(profiles) ? profiles : []).map(cleanProfile).filter(Boolean);
  try {
    storageTarget(target)?.setItem?.(SAVED_HISTORY_FILTERS_STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
  return cleaned;
}

export function saveHistoryFilterProfile(profile, profiles = [], target) {
  const id = String(profile?.id || "").trim() || `history-${Date.now()}`;
  const cleaned = cleanProfile({ ...profile, id, updatedAt: new Date().toISOString() });
  if (!cleaned) return { profile: null, profiles: readSavedHistoryFilters(target) };

  const current = Array.isArray(profiles) ? profiles : readSavedHistoryFilters(target);
  const next = [...current.filter((entry) => entry.id !== id), cleaned].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
  return { profile: cleaned, profiles: writeSavedHistoryFilters(next, target) };
}

export function deleteHistoryFilterProfile(profileId, profiles = [], target) {
  return writeSavedHistoryFilters(
    (Array.isArray(profiles) ? profiles : readSavedHistoryFilters(target)).filter((profile) => profile.id !== profileId),
    target
  );
}
