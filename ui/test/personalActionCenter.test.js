import test from "node:test";
import assert from "node:assert/strict";

import {
  PERSONAL_ACTION_CENTER_STORAGE_KEY,
  buildPersonalActions,
  clearHiddenPersonalActions,
  hidePersonalAction,
  readPersonalActionPreferences,
  restorePersonalAction,
} from "../src/ui/personalActionCenter.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

test("personal actions prioritize missed goals before diagnostic recommendations", () => {
  const actions = buildPersonalActions({
    goalProgress: [
      { key: "budget", available: true, met: false, actual: 1250, target: 1000, delta: 250 },
      { key: "price", available: true, met: false, actual: 0.62, target: 0.5, delta: 0.12 },
      { key: "efficiency", available: true, met: true, actual: 72, target: 65, delta: 7 },
    ],
    outliers: { outlier_count: 4 },
  });

  assert.deepEqual(actions.map((action) => action.id), ["goal-budget", "goal-price", "outliers"]);
  assert.deepEqual(actions[0].destination, { type: "history", filters: { sort: "cost_desc" } });
  assert.equal(actions[1].destination.mode, "mobility");
});

test("provider opportunity requires a meaningful price gap and repeated usage", () => {
  const actions = buildPersonalActions({
    stats: { avg_price_per_kwh: 0.58 },
    intelligence: { highlights: { cheapest_provider: { label: "Home", count: 5, avg_price_per_kwh: 0.39 } } },
  });
  assert.equal(actions[0].id, "provider-opportunity");
  assert.equal(actions[0].metric.delta, 0.19);
  assert.equal(actions[0].destination.filters.provider, "Home");

  const insufficient = buildPersonalActions({
    stats: { avg_price_per_kwh: 0.42 },
    intelligence: { highlights: { cheapest_provider: { label: "Home", count: 1, avg_price_per_kwh: 0.4 } } },
  });
  assert.equal(insufficient.length, 0);
});

test("high end-of-charge share becomes an efficiency action only with enough data", () => {
  const sessions = [90, 87, 86, 82, 70].map((soc_end) => ({ soc_end }));
  const actions = buildPersonalActions({ sessions });
  assert.equal(actions[0].id, "high-soc-share");
  assert.equal(actions[0].metric.actual, 60);

  assert.equal(buildPersonalActions({ sessions: sessions.slice(0, 4) }).length, 0);
});

test("hidden actions persist per year and can be restored or cleared", () => {
  const storage = memoryStorage();
  hidePersonalAction(2026, "goal-budget", storage);
  hidePersonalAction(2026, "outliers", storage);
  hidePersonalAction(2027, "goal-price", storage);

  assert.deepEqual(readPersonalActionPreferences(2026, storage).hidden, ["goal-budget", "outliers"]);
  assert.deepEqual(readPersonalActionPreferences(2027, storage).hidden, ["goal-price"]);
  assert.match(storage.getItem(PERSONAL_ACTION_CENTER_STORAGE_KEY), /goal-budget/);

  restorePersonalAction(2026, "goal-budget", storage);
  assert.deepEqual(readPersonalActionPreferences(2026, storage).hidden, ["outliers"]);
  clearHiddenPersonalActions(2026, storage);
  assert.deepEqual(readPersonalActionPreferences(2026, storage).hidden, []);
});
