import importProfilesConfig from "../../../shared/domain/importProfiles.cjs";
import { getActiveLocale, translate } from "../i18n/runtime.js";

function uniqueValues(values = []) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

const BASE_FIELD_ALIASES = Object.fromEntries(
  Object.entries(importProfilesConfig?.fieldAliases || {}).map(([field, aliases]) => [field, uniqueValues(aliases)])
);

const IMPORT_PROFILES = Array.isArray(importProfilesConfig?.profiles) ? importProfilesConfig.profiles : [];

function localizeProfile(profile) {
  if (!profile?.id) return profile || null;

  const locale = getActiveLocale();
  const labelKey = `importProfiles.profiles.${profile.id}.label`;
  const descriptionKey = `importProfiles.profiles.${profile.id}.description`;
  const label = translate(locale, labelKey);
  const description = translate(locale, descriptionKey);

  return {
    ...profile,
    label: label !== labelKey ? label : profile.label,
    description: description !== descriptionKey ? description : profile.description,
  };
}

export function getImportProfiles() {
  return IMPORT_PROFILES.map((profile) => localizeProfile(profile));
}

export function getImportProfile(profileId) {
  return localizeProfile(IMPORT_PROFILES.find((profile) => profile.id === profileId) || IMPORT_PROFILES[0] || null);
}

export function buildFieldAliasesForProfile(profileId) {
  const profile = getImportProfile(profileId);
  const profileAliases = profile?.fieldAliases || {};

  return Object.fromEntries(
    Object.keys(BASE_FIELD_ALIASES).map((field) => [
      field,
      uniqueValues([...(profileAliases?.[field] || []), ...(BASE_FIELD_ALIASES?.[field] || [])]),
    ])
  );
}

export function detectImportProfile(headers = []) {
  const normalizedHeaders = headers.map((header) => String(header || "").trim().toLowerCase().replace(/\s+/g, "_"));

  let bestProfile = getImportProfile("generic");
  let bestScore = 0;

  for (const profile of IMPORT_PROFILES) {
    if (!profile || profile.id === "generic") continue;
    const score = (profile.detectHeaders || []).reduce(
      (sum, candidate) => sum + (normalizedHeaders.includes(String(candidate || "").trim().toLowerCase()) ? 1 : 0),
      0
    );

    if (score > bestScore) {
      bestScore = score;
      bestProfile = getImportProfile(profile.id);
    }
  }

  return bestProfile || null;
}
