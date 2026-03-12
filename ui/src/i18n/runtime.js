import { getNavigator, getWindow, readQueryParam } from "../platform/runtime.js";
import de from "./locales/de.js";
import en from "./locales/en.js";

export const DEFAULT_LOCALE = "de";
export const LOCALE_STORAGE_KEY = "mobility.locale";
export const SUPPORTED_LOCALES = ["de", "en"];

const LOCALE_META = {
  de: { intl: "de-DE" },
  en: { intl: "en-GB" },
};

const MESSAGES = { de, en };
const NO_DATA_PLACEHOLDER = "–";

let activeLocale = DEFAULT_LOCALE;

export function normalizeLocale(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (SUPPORTED_LOCALES.includes(raw)) return raw;
  const short = raw.split("-")[0];
  return SUPPORTED_LOCALES.includes(short) ? short : null;
}

export function getActiveLocale() {
  return activeLocale;
}

export function setActiveLocale(locale) {
  activeLocale = normalizeLocale(locale) || DEFAULT_LOCALE;
  return activeLocale;
}

export function getIntlLocale(locale = activeLocale) {
  const normalized = normalizeLocale(locale) || DEFAULT_LOCALE;
  return LOCALE_META[normalized]?.intl || LOCALE_META[DEFAULT_LOCALE].intl;
}

export function detectInitialLocale() {
  const queryLocale = normalizeLocale(readQueryParam("lang"));
  if (queryLocale) return queryLocale;

  try {
    const stored = normalizeLocale(getWindow()?.localStorage?.getItem(LOCALE_STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // Ignore storage access errors and fall back to navigator detection.
  }

  return normalizeLocale(getNavigator()?.language) || DEFAULT_LOCALE;
}

export function persistLocale(locale) {
  const normalized = normalizeLocale(locale) || DEFAULT_LOCALE;

  try {
    getWindow()?.localStorage?.setItem(LOCALE_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage access errors in restricted contexts.
  }

  return normalized;
}

function resolveMessages(locale = activeLocale) {
  const normalized = normalizeLocale(locale) || DEFAULT_LOCALE;
  return MESSAGES[normalized] || MESSAGES[DEFAULT_LOCALE];
}

function interpolate(template, values = {}) {
  return String(template).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => String(values?.[key] ?? ""));
}

function lookupMessage(source, key) {
  return String(key || "")
    .split(".")
    .reduce((value, part) => (value && typeof value === "object" ? value[part] : undefined), source);
}

export function translate(locale, key, values = {}) {
  const direct = lookupMessage(resolveMessages(locale), key);
  if (typeof direct === "string") return interpolate(direct, values);

  const fallback = lookupMessage(MESSAGES[DEFAULT_LOCALE], key);
  if (typeof fallback === "string") return interpolate(fallback, values);

  return String(key || "");
}

export function formatNumber(value, options = {}, locale = activeLocale) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return NO_DATA_PLACEHOLDER;
  return new Intl.NumberFormat(getIntlLocale(locale), options).format(numeric);
}

export function formatCurrency(value, options = {}, locale = activeLocale) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return NO_DATA_PLACEHOLDER;
  return new Intl.NumberFormat(getIntlLocale(locale), {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
    ...options,
  }).format(numeric);
}

export function formatDate(value, options = {}, locale = activeLocale) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return NO_DATA_PLACEHOLDER;
    return new Intl.DateTimeFormat(getIntlLocale(locale), options).format(date);
  } catch {
    return NO_DATA_PLACEHOLDER;
  }
}

export function formatMonthLabel(monthNumber, locale = activeLocale) {
  const month = Number(monthNumber);
  if (!Number.isInteger(month) || month < 1 || month > 12) return String(monthNumber ?? "");
  return new Intl.DateTimeFormat(getIntlLocale(locale), { month: "long" }).format(new Date(Date.UTC(2026, month - 1, 1)));
}

export function formatWeekdayLabel(weekdayNumber, locale = activeLocale) {
  const weekday = Number(weekdayNumber);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return String(weekdayNumber ?? "");
  return new Intl.DateTimeFormat(getIntlLocale(locale), { weekday: "long" }).format(
    new Date(Date.UTC(2026, 0, 4 + weekday))
  );
}
