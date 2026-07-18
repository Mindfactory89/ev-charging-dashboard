import test from "node:test";
import assert from "node:assert/strict";
import { buildActionExplanation, buildGoalExplanation, confidenceForSample } from "../src/ui/explainability.js";

test("confidence grows with the available session sample", () => {
  assert.equal(confidenceForSample(2), "low");
  assert.equal(confidenceForSample(5), "medium");
  assert.equal(confidenceForSample(15), "high");
});

test("provider opportunity exposes basis, confidence, and annualized potential", () => {
  const explanation = buildActionExplanation({ kind: "providerOpportunity", metric: { delta: 0.08 } }, {
    sessions: Array.from({ length: 20 }),
    stats: { total_energy_kwh: 1000 },
  });
  assert.equal(explanation.basis, "providerComparison");
  assert.equal(explanation.confidence, "high");
  assert.equal(explanation.savingsEur, 80);
});

test("goal explanation names the underlying score model", () => {
  const explanation = buildGoalExplanation({ key: "efficiency" }, { sessions: Array.from({ length: 7 }) });
  assert.equal(explanation.basis, "efficiencyScore");
  assert.equal(explanation.confidence, "medium");
});
