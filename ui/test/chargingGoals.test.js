import test from "node:test";
import assert from "node:assert/strict";

import {
  CHARGING_GOALS_STORAGE_KEY,
  buildChargingGoalProgress,
  clearChargingGoals,
  countChargingGoals,
  readChargingGoals,
  saveChargingGoals,
  validateChargingGoalsDraft,
} from "../src/config/chargingGoals.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

test("charging goals persist normalized optional targets", () => {
  const storage = memoryStorage();
  const saved = saveChargingGoals({
    annualBudgetEur: "1200,50",
    maxAveragePricePerKwh: "0.4754",
    minEfficiencyScore: "",
  }, storage);

  assert.equal(saved.goals.annualBudgetEur, 1200.5);
  assert.equal(saved.goals.maxAveragePricePerKwh, 0.475);
  assert.equal(saved.goals.minEfficiencyScore, null);
  assert.equal(countChargingGoals(readChargingGoals(storage)), 2);
  assert.match(storage.getItem(CHARGING_GOALS_STORAGE_KEY), /annualBudgetEur/);
});

test("charging goal validation requires one realistic target", () => {
  const empty = validateChargingGoalsDraft({});
  assert.equal(empty.valid, false);
  assert.equal(empty.errors.form, "empty");

  const invalid = validateChargingGoalsDraft({
    annualBudgetEur: 20,
    maxAveragePricePerKwh: 8,
    minEfficiencyScore: 101,
  });
  assert.deepEqual(Object.keys(invalid.errors), [
    "annualBudgetEur",
    "maxAveragePricePerKwh",
    "minEfficiencyScore",
  ]);
});

test("goal progress respects lower-is-better and higher-is-better metrics", () => {
  const goals = {
    annualBudgetEur: 1000,
    maxAveragePricePerKwh: 0.5,
    minEfficiencyScore: 70,
  };
  const progress = buildChargingGoalProgress(goals, {
    stats: { total_cost: 750, avg_price_per_kwh: 0.55 },
    efficiency: { overall_score: 75 },
  });

  assert.deepEqual(progress.map((item) => [item.key, item.met]), [
    ["budget", true],
    ["price", false],
    ["efficiency", true],
  ]);
  assert.equal(progress[0].progress, 75);
  assert.equal(progress[1].progress < 100, true);
  assert.equal(progress[2].progress, 100);
});

test("clearing goals removes the local configuration", () => {
  const storage = memoryStorage();
  saveChargingGoals({ annualBudgetEur: 900 }, storage);
  clearChargingGoals(storage);
  assert.equal(readChargingGoals(storage), null);
});
