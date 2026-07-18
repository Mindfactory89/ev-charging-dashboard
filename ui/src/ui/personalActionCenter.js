import { getWindow } from "../platform/runtime.js";

export const PERSONAL_ACTION_CENTER_STORAGE_KEY = "mobility.personalActionCenter.v1";

const MAX_STORED_YEARS = 8;
const MAX_HIDDEN_ACTIONS = 30;

function storageTarget(target) {
  if (target?.localStorage) return target.localStorage;
  return target || getWindow()?.localStorage || null;
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanActionId(value) {
  return String(value || "").trim().slice(0, 80);
}

function cleanHiddenActions(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(cleanActionId).filter(Boolean))).slice(0, MAX_HIDDEN_ACTIONS);
}

function cleanPreferences(value) {
  const years = value?.years && typeof value.years === "object" ? value.years : {};
  const cleanedEntries = Object.entries(years)
    .map(([year, state]) => {
      const normalizedYear = String(Number(year));
      if (!/^\d{4}$/.test(normalizedYear)) return null;
      return [normalizedYear, {
        hidden: cleanHiddenActions(state?.hidden),
        updatedAt: String(state?.updatedAt || "").slice(0, 40),
      }];
    })
    .filter(Boolean)
    .sort((left, right) => Number(right[0]) - Number(left[0]))
    .slice(0, MAX_STORED_YEARS);
  return { years: Object.fromEntries(cleanedEntries) };
}

export function readPersonalActionPreferences(year, target) {
  let preferences = { years: {} };
  try {
    const raw = storageTarget(target)?.getItem?.(PERSONAL_ACTION_CENTER_STORAGE_KEY);
    preferences = raw ? cleanPreferences(JSON.parse(raw)) : preferences;
  } catch {
    preferences = { years: {} };
  }
  const key = String(Number(year));
  return { hidden: preferences.years[key]?.hidden || [] };
}

function writeYearState(year, hidden, target) {
  const storage = storageTarget(target);
  let current = { years: {} };
  try {
    const raw = storage?.getItem?.(PERSONAL_ACTION_CENTER_STORAGE_KEY);
    current = raw ? cleanPreferences(JSON.parse(raw)) : current;
  } catch {
    current = { years: {} };
  }
  const key = String(Number(year));
  const next = cleanPreferences({
    years: {
      ...current.years,
      [key]: { hidden: cleanHiddenActions(hidden), updatedAt: new Date().toISOString() },
    },
  });
  try {
    storage?.setItem?.(PERSONAL_ACTION_CENTER_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Keep actions usable when browser storage is unavailable.
  }
  return next.years[key]?.hidden || [];
}

export function hidePersonalAction(year, actionId, target) {
  const current = readPersonalActionPreferences(year, target).hidden;
  return writeYearState(year, [...current, cleanActionId(actionId)], target);
}

export function restorePersonalAction(year, actionId, target) {
  const current = readPersonalActionPreferences(year, target).hidden;
  return writeYearState(year, current.filter((id) => id !== cleanActionId(actionId)), target);
}

export function clearHiddenPersonalActions(year, target) {
  return writeYearState(year, [], target);
}

function goalAction(definition, options) {
  if (!definition?.available || definition.met !== false) return null;
  return {
    id: `goal-${definition.key}`,
    kind: `goal${definition.key[0].toUpperCase()}${definition.key.slice(1)}`,
    priority: options.priority,
    tone: options.tone,
    metric: {
      actual: safeNumber(definition.actual),
      delta: Math.abs(safeNumber(definition.delta) || 0),
      target: safeNumber(definition.target),
      type: options.metricType,
    },
    destination: options.destination,
  };
}

export function buildPersonalActions({
  goalProgress = [],
  intelligence = null,
  outliers = null,
  sessions = [],
  stats = null,
} = {}) {
  const actions = [];
  const goals = Object.fromEntries((Array.isArray(goalProgress) ? goalProgress : []).map((item) => [item.key, item]));

  actions.push(goalAction(goals.budget, {
    priority: 100,
    tone: "danger",
    metricType: "currency",
    destination: { type: "history", filters: { sort: "cost_desc" } },
  }));
  actions.push(goalAction(goals.price, {
    priority: 95,
    tone: "danger",
    metricType: "price",
    destination: { type: "analysis", mode: "mobility" },
  }));
  actions.push(goalAction(goals.efficiency, {
    priority: 90,
    tone: "warning",
    metricType: "score",
    destination: { type: "analysis", mode: "efficiency" },
  }));

  const outlierCount = safeNumber(outliers?.outlier_count);
  if (outlierCount > 0) {
    actions.push({
      id: "outliers",
      kind: "outliers",
      priority: 80,
      tone: outlierCount >= 3 ? "warning" : "neutral",
      metric: { type: "count", actual: outlierCount },
      destination: { type: "analysis", mode: "signals" },
    });
  }

  const averagePrice = safeNumber(stats?.avg_price_per_kwh);
  const cheapestProvider = intelligence?.highlights?.cheapest_provider || null;
  const providerPrice = safeNumber(cheapestProvider?.avg_price_per_kwh);
  const providerCount = safeNumber(cheapestProvider?.count) || 0;
  const priceGap = averagePrice != null && providerPrice != null
    ? Number((averagePrice - providerPrice).toFixed(3))
    : null;
  if (cheapestProvider?.label && providerCount >= 2 && priceGap >= 0.03) {
    actions.push({
      id: "provider-opportunity",
      kind: "providerOpportunity",
      priority: 65,
      tone: "positive",
      context: { provider: String(cheapestProvider.label) },
      metric: { type: "price", actual: averagePrice, target: providerPrice, delta: priceGap },
      destination: { type: "history", filters: { provider: String(cheapestProvider.label), sort: "price_asc" } },
    });
  }

  const validSocSessions = (Array.isArray(sessions) ? sessions : []).filter((session) => {
    const socEnd = safeNumber(session?.soc_end);
    return socEnd != null && socEnd >= 0 && socEnd <= 100;
  });
  const highSocCount = validSocSessions.filter((session) => safeNumber(session?.soc_end) >= 85).length;
  const highSocShare = validSocSessions.length ? (highSocCount / validSocSessions.length) * 100 : 0;
  if (validSocSessions.length >= 5 && highSocShare >= 40) {
    actions.push({
      id: "high-soc-share",
      kind: "highSocShare",
      priority: 55,
      tone: "neutral",
      metric: { type: "percentage", actual: highSocShare, count: highSocCount, total: validSocSessions.length },
      destination: { type: "analysis", mode: "efficiency" },
    });
  }

  return actions
    .filter(Boolean)
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
}
