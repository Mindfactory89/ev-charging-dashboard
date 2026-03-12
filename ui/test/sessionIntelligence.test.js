import test from "node:test";
import assert from "node:assert/strict";

import { buildShiftScenario } from "../src/ui/sessionIntelligence.js";

const sessions = [
  {
    id: "dc-1",
    date: "2026-01-10T10:00:00.000Z",
    connector: "CCS - DC",
    provider: "Ionity",
    location: "Brohltal Ost",
    energy_kwh: 50,
    total_cost: 30,
    price_per_kwh: 0.6,
    duration_seconds: 1800,
    soc_start: 10,
    soc_end: 80,
  },
  {
    id: "ac-1",
    date: "2026-01-12T10:00:00.000Z",
    connector: "CCS AC",
    provider: "EnBW",
    location: "Bochum",
    energy_kwh: 20,
    total_cost: 9.6,
    price_per_kwh: 0.48,
    duration_seconds: 5400,
    soc_start: 48,
    soc_end: 81,
  },
  {
    id: "home-1",
    date: "2026-01-14T10:00:00.000Z",
    connector: "Wallbox AC",
    provider: "Wallbox",
    location: "Zuhause",
    energy_kwh: 24,
    total_cost: 7.2,
    price_per_kwh: 0.3,
    duration_seconds: 15600,
    soc_start: 32,
    soc_end: 76,
  },
];

test("buildShiftScenario supports configurable source and target channels", () => {
  const scenario = buildShiftScenario(sessions, { sourceKey: "public_ac", targetKey: "home", shiftPct: 25 });

  assert.equal(scenario.ok, true);
  assert.equal(scenario.sourceKey, "public_ac");
  assert.equal(scenario.targetKey, "home");
  assert.equal(scenario.source?.label, "Public AC");
  assert.equal(scenario.target?.label, "Wallbox Zuhause");
  assert.equal(scenario.shiftEnergyKwh, 5);
  assert.equal(scenario.deltaPricePerKwh, 0.18);
});

test("buildShiftScenario rejects same source and target channels", () => {
  const scenario = buildShiftScenario(sessions, { sourceKey: "public_dc", targetKey: "public_dc", shiftPct: 20 });

  assert.equal(scenario.ok, false);
});
