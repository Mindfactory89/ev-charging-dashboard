import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDashboardNotifications,
  countUnreadDashboardNotifications,
  dismissDashboardNotification,
  getVisibleDashboardNotifications,
  markDashboardNotificationsRead,
  readDashboardNotificationState,
  snoozeDashboardNotifications,
  updateDashboardNotificationPreferences,
} from "../src/ui/dashboardNotifications.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

test("dashboard notifications prioritize goals, quality, savings, and monthly digest", () => {
  const notifications = buildDashboardNotifications({
    year: 2026,
    goalProgress: [{ key: "budget", available: true, met: false, actual: 1200, target: 1000, delta: 200 }],
    dataQuality: { score: 65, actionableIssues: [{ id: "one" }] },
    personalActions: [{ kind: "providerOpportunity", context: { provider: "Home" }, metric: { delta: 0.2 }, destination: { type: "history" } }],
    monthly: [{ month: 3, count: 4, cost: 80, energy_kwh: 120, price_per_kwh: 0.66 }],
  });
  assert.deepEqual(notifications.map((item) => item.kind), ["goalBudget", "dataQuality", "providerSaving", "monthlyDigest"]);
});

test("notification state supports read, dismiss, preferences, and snooze", () => {
  const storage = memoryStorage();
  const notifications = [{ id: "one", category: "quality" }, { id: "two", category: "monthly" }];
  let state = readDashboardNotificationState(storage);
  assert.equal(countUnreadDashboardNotifications(notifications, state), 2);
  state = markDashboardNotificationsRead(state, "one", storage);
  assert.equal(countUnreadDashboardNotifications(notifications, state), 1);
  state = dismissDashboardNotification(state, "two", storage);
  assert.deepEqual(getVisibleDashboardNotifications(notifications, state).map((item) => item.id), ["one"]);
  state = updateDashboardNotificationPreferences(state, { quality: false }, storage);
  assert.equal(getVisibleDashboardNotifications(notifications, state).length, 0);
  state = updateDashboardNotificationPreferences(state, { quality: true }, storage);
  state = snoozeDashboardNotifications(state, 7, storage, new Date("2026-07-16T10:00:00Z"));
  assert.equal(getVisibleDashboardNotifications(notifications, state, new Date("2026-07-17T10:00:00Z")).length, 0);
});
