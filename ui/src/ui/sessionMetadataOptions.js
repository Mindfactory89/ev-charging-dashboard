import { parseTags } from "./sessionMetadata.js";

function uniqueSorted(values = []) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right, "de-DE"));
}

export function buildSessionMetadataOptions({ sessions = [], intelligence = null } = {}) {
  const fallbackProviders = uniqueSorted(sessions.map((session) => session?.provider));
  const fallbackLocations = uniqueSorted(sessions.map((session) => session?.location));
  const fallbackVehicles = uniqueSorted(sessions.map((session) => session?.vehicle));
  const fallbackTags = uniqueSorted(sessions.flatMap((session) => parseTags(session?.tags)));

  return {
    providers: uniqueSorted(intelligence?.filters?.providers?.length ? intelligence.filters.providers : fallbackProviders),
    locations: uniqueSorted(intelligence?.filters?.locations?.length ? intelligence.filters.locations : fallbackLocations),
    vehicles: uniqueSorted(intelligence?.filters?.vehicles?.length ? intelligence.filters.vehicles : fallbackVehicles),
    tags: uniqueSorted(intelligence?.filters?.tags?.length ? intelligence.filters.tags : fallbackTags),
  };
}
