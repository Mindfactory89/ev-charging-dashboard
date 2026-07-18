import { getWindow } from "../platform/runtime.js";

export const DASHBOARD_NOTIFICATIONS_STORAGE_KEY = "mobility.notifications.v1";

export const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({
  goals: true,
  quality: true,
  monthly: true,
  savings: true,
});

const MAX_IDS = 300;

function storageTarget(target) {
  if (target?.localStorage) return target.localStorage;
  return target || getWindow()?.localStorage || null;
}

function cleanIds(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").slice(0, 140)).filter(Boolean))).slice(-MAX_IDS);
}

function cleanPreferences(value) {
  return Object.fromEntries(Object.keys(DEFAULT_NOTIFICATION_PREFERENCES).map((key) => [key, value?.[key] !== false]));
}

function cleanState(value) {
  const snoozedUntil = String(value?.snoozedUntil || "");
  return {
    read: cleanIds(value?.read),
    dismissed: cleanIds(value?.dismissed),
    snoozedUntil: Number.isFinite(new Date(snoozedUntil).getTime()) ? snoozedUntil : "",
    preferences: cleanPreferences(value?.preferences),
  };
}

export function readDashboardNotificationState(target) {
  try {
    const raw = storageTarget(target)?.getItem?.(DASHBOARD_NOTIFICATIONS_STORAGE_KEY);
    return cleanState(raw ? JSON.parse(raw) : {});
  } catch {
    return cleanState({});
  }
}

export function writeDashboardNotificationState(value, target) {
  const state = cleanState(value);
  try {
    storageTarget(target)?.setItem?.(DASHBOARD_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The in-app centre remains usable when storage is unavailable.
  }
  return state;
}

export function markDashboardNotificationsRead(state, ids, target) {
  return writeDashboardNotificationState({ ...state, read: [...(state?.read || []), ...(Array.isArray(ids) ? ids : [ids])] }, target);
}

export function dismissDashboardNotification(state, id, target) {
  return writeDashboardNotificationState({ ...state, dismissed: [...(state?.dismissed || []), id] }, target);
}

export function snoozeDashboardNotifications(state, days = 7, target, now = new Date()) {
  const until = new Date(now);
  until.setDate(until.getDate() + Math.max(1, Number(days) || 7));
  return writeDashboardNotificationState({ ...state, snoozedUntil: until.toISOString() }, target);
}

export function resumeDashboardNotifications(state, target) {
  return writeDashboardNotificationState({ ...state, snoozedUntil: "" }, target);
}

export function updateDashboardNotificationPreferences(state, preferences, target) {
  return writeDashboardNotificationState({ ...state, preferences: { ...state?.preferences, ...preferences } }, target);
}

export function buildDashboardNotifications({
  dataQuality = null,
  goalProgress = [],
  monthly = [],
  personalActions = [],
  year,
} = {}) {
  const notifications = [];
  const normalizedYear = Number(year);

  (Array.isArray(goalProgress) ? goalProgress : []).forEach((goal) => {
    if (!goal?.available || goal.met !== false) return;
    notifications.push({
      id: `${normalizedYear}-goal-${goal.key}`,
      category: "goals",
      kind: `goal${goal.key[0].toUpperCase()}${goal.key.slice(1)}`,
      tone: "danger",
      priority: goal.key === "budget" ? 100 : goal.key === "price" ? 95 : 90,
      metric: { actual: goal.actual, target: goal.target, delta: Math.abs(Number(goal.delta) || 0) },
      destination: goal.key === "budget"
        ? { type: "history", filters: { sort: "cost_desc" } }
        : { type: "analysis", mode: goal.key === "efficiency" ? "efficiency" : "mobility" },
    });
  });

  if (Number(dataQuality?.actionableIssues?.length) > 0) {
    notifications.push({
      id: `${normalizedYear}-data-quality-${dataQuality.actionableIssues.length}`,
      category: "quality",
      kind: "dataQuality",
      tone: dataQuality.score < 70 ? "warning" : "neutral",
      priority: 80,
      metric: { count: dataQuality.actionableIssues.length, score: dataQuality.score },
      destination: { type: "quality" },
    });
  }

  const providerAction = (Array.isArray(personalActions) ? personalActions : []).find((action) => action.kind === "providerOpportunity");
  if (providerAction) {
    notifications.push({
      id: `${normalizedYear}-provider-${providerAction.context?.provider || "saving"}`,
      category: "savings",
      kind: "providerSaving",
      tone: "positive",
      priority: 65,
      context: providerAction.context,
      metric: providerAction.metric,
      destination: providerAction.destination,
    });
  }

  const availableMonths = (Array.isArray(monthly) ? monthly : []).filter((item) => Number(item?.count || 0) > 0);
  const latestMonth = availableMonths[availableMonths.length - 1];
  if (latestMonth) {
    notifications.push({
      id: `${normalizedYear}-month-${latestMonth.month}`,
      category: "monthly",
      kind: "monthlyDigest",
      tone: "neutral",
      priority: 40,
      metric: {
        month: latestMonth.month,
        cost: latestMonth.cost,
        energy: latestMonth.energy_kwh,
        price: latestMonth.price_per_kwh,
        count: latestMonth.count,
      },
      destination: { type: "history", filters: { month: latestMonth.month } },
    });
  }

  return notifications.sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
}

export function getVisibleDashboardNotifications(notifications, state, now = new Date()) {
  const clean = cleanState(state);
  const snoozed = clean.snoozedUntil && new Date(clean.snoozedUntil).getTime() > now.getTime();
  if (snoozed) return [];
  return (Array.isArray(notifications) ? notifications : []).filter((notification) => (
    clean.preferences[notification.category] !== false && !clean.dismissed.includes(notification.id)
  ));
}

export function countUnreadDashboardNotifications(notifications, state, now) {
  const clean = cleanState(state);
  return getVisibleDashboardNotifications(notifications, clean, now).filter((notification) => !clean.read.includes(notification.id)).length;
}
