import { parseTags } from "./sessionMetadata.js";

export const DEFAULT_SESSION_SORT = "date_desc";

export const SESSION_SORT_OPTIONS = Object.freeze([
  "date_desc",
  "date_asc",
  "cost_desc",
  "energy_desc",
  "price_asc",
  "duration_desc",
]);

const SESSION_SORT_IDS = new Set(SESSION_SORT_OPTIONS);

function cleanText(value, maxLength = 120) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function searchableText(value) {
  return cleanText(value, 1000)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

function dateSearchValues(value) {
  const raw = cleanText(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${raw} ${match[3]}.${match[2]}.${match[1]}` : raw;
}

function monthNumber(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getMonth() + 1;
}

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function effectivePrice(session) {
  const direct = numericValue(session?.price_per_kwh);
  if (direct != null && direct > 0) return direct;
  const cost = numericValue(session?.total_cost);
  const energy = numericValue(session?.energy_kwh);
  return cost != null && energy != null && energy > 0 ? cost / energy : null;
}

function compareNullable(left, right, direction = "desc") {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return direction === "asc" ? left - right : right - left;
}

export function normalizeSessionSort(value) {
  const sort = cleanText(value);
  return SESSION_SORT_IDS.has(sort) ? sort : DEFAULT_SESSION_SORT;
}

export function normalizeHistoryFilters(value = {}) {
  const month = Number(value?.month);
  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : null,
    provider: cleanText(value?.provider),
    location: cleanText(value?.location),
    vehicle: cleanText(value?.vehicle),
    tag: cleanText(value?.tag),
    query: cleanText(value?.query),
    sort: normalizeSessionSort(value?.sort),
  };
}

export function sessionMatchesQuery(session, query) {
  const terms = searchableText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;

  const haystack = searchableText([
    dateSearchValues(session?.date),
    session?.provider,
    session?.location,
    session?.vehicle,
    session?.connector,
    session?.note,
    ...parseTags(session?.tags),
  ].filter(Boolean).join(" "));

  return terms.every((term) => haystack.includes(term));
}

export function sortSessions(sessions = [], sort = DEFAULT_SESSION_SORT) {
  const sortId = normalizeSessionSort(sort);
  return sessions
    .map((session, index) => ({ session, index }))
    .sort((left, right) => {
      let comparison = 0;
      if (sortId === "date_asc" || sortId === "date_desc") {
        comparison = compareNullable(
          numericValue(new Date(left.session?.date).getTime()),
          numericValue(new Date(right.session?.date).getTime()),
          sortId === "date_asc" ? "asc" : "desc"
        );
      } else if (sortId === "cost_desc") {
        comparison = compareNullable(numericValue(left.session?.total_cost), numericValue(right.session?.total_cost));
      } else if (sortId === "energy_desc") {
        comparison = compareNullable(numericValue(left.session?.energy_kwh), numericValue(right.session?.energy_kwh));
      } else if (sortId === "price_asc") {
        comparison = compareNullable(effectivePrice(left.session), effectivePrice(right.session), "asc");
      } else if (sortId === "duration_desc") {
        comparison = compareNullable(numericValue(left.session?.duration_seconds), numericValue(right.session?.duration_seconds));
      }
      return comparison || left.index - right.index;
    })
    .map(({ session }) => session);
}

export function buildSessionHistoryView(sessions = [], filters = {}) {
  const normalized = normalizeHistoryFilters(filters);
  const filtered = sessions.filter((session) => {
    if (normalized.month != null && monthNumber(session?.date) !== normalized.month) return false;
    if (normalized.provider && String(session?.provider || "") !== normalized.provider) return false;
    if (normalized.location && String(session?.location || "") !== normalized.location) return false;
    if (normalized.vehicle && String(session?.vehicle || "") !== normalized.vehicle) return false;
    if (normalized.tag && !parseTags(session?.tags).some((tag) => tag.toLocaleLowerCase() === normalized.tag.toLocaleLowerCase())) return false;
    return sessionMatchesQuery(session, normalized.query);
  });

  return sortSessions(filtered, normalized.sort);
}
