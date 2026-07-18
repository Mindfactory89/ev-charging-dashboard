import { getWindow } from "../platform/runtime.js";

export const IMPORT_MAPPING_PROFILE_STORAGE_KEY = "mobility.importMappingProfiles.v1";

function storageTarget(target) {
  return target || getWindow()?.localStorage || null;
}

function cleanMapping(mapping) {
  if (!mapping || typeof mapping !== "object") return {};
  return Object.fromEntries(
    Object.entries(mapping)
      .map(([field, header]) => [String(field || "").trim(), String(header || "").trim()])
      .filter(([field]) => field)
  );
}

function cleanFallbacks(fallbacks) {
  return {
    soc_start: Number.isFinite(Number(fallbacks?.soc_start)) ? Number(fallbacks.soc_start) : 10,
    soc_end: Number.isFinite(Number(fallbacks?.soc_end)) ? Number(fallbacks.soc_end) : 80,
    vehicle: String(fallbacks?.vehicle || "").trim(),
  };
}

function cleanProfile(profile) {
  const id = String(profile?.id || "").trim();
  const name = String(profile?.name || "").trim().slice(0, 60);
  if (!id || !name) return null;
  return {
    id,
    name,
    baseProfileId: String(profile?.baseProfileId || "generic"),
    mapping: cleanMapping(profile?.mapping),
    fallbacks: cleanFallbacks(profile?.fallbacks),
    updatedAt: String(profile?.updatedAt || new Date().toISOString()),
  };
}

export function readImportMappingProfiles(target) {
  try {
    const raw = storageTarget(target)?.getItem?.(IMPORT_MAPPING_PROFILE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(cleanProfile).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function writeImportMappingProfiles(profiles, target) {
  const cleaned = (Array.isArray(profiles) ? profiles : []).map(cleanProfile).filter(Boolean);
  try {
    storageTarget(target)?.setItem?.(IMPORT_MAPPING_PROFILE_STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
  return cleaned;
}

export function saveImportMappingProfile(profile, profiles = [], target) {
  const now = new Date().toISOString();
  const id = String(profile?.id || "").trim() || `mapping-${Date.now()}`;
  const cleaned = cleanProfile({ ...profile, id, updatedAt: now });
  if (!cleaned) return { profile: null, profiles: readImportMappingProfiles(target) };

  const current = Array.isArray(profiles) ? profiles : readImportMappingProfiles(target);
  const next = [...current.filter((item) => item.id !== cleaned.id), cleaned].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
  return { profile: cleaned, profiles: writeImportMappingProfiles(next, target) };
}

export function deleteImportMappingProfile(profileId, profiles = [], target) {
  const next = (Array.isArray(profiles) ? profiles : readImportMappingProfiles(target)).filter(
    (profile) => profile.id !== profileId
  );
  return writeImportMappingProfiles(next, target);
}
