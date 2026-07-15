import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSessionEditDraft,
  durationToHHMM,
  hhmmToSeconds,
  parseDecimalInput,
  sessionEditHasChanges,
  validateSessionEditDraft,
} from "../src/ui/sessionEditForm.js";

const session = {
  id: 7,
  date: "2026-04-18T10:30:00.000Z",
  connector: "Type 2",
  energy_kwh: 42.4,
  price_per_kwh: 0.39,
  total_cost: 16.536,
  duration_seconds: 9000,
  soc_start: 20,
  soc_end: 78,
  odo_end_km: 12500,
};

test("session edit helpers accept localized decimals and format durations", () => {
  assert.equal(parseDecimalInput("42,4"), 42.4);
  assert.equal(hhmmToSeconds("02:30"), 9000);
  assert.equal(durationToHHMM(9000), "02:30");
  assert.equal(hhmmToSeconds("02:75"), null);
});

test("an untouched edit draft is recognized as unchanged", () => {
  const draft = buildSessionEditDraft(session);
  assert.equal(sessionEditHasChanges(session, draft), false);
  assert.equal(sessionEditHasChanges(session, { ...draft, energy_kwh: "43,1" }), true);
});

test("validation returns field-level errors for invalid mandatory values", () => {
  const draft = {
    ...buildSessionEditDraft(session),
    energy_kwh: "0",
    duration_hhmm: "2h",
    soc_start: "85",
    soc_end: "20",
  };
  const result = validateSessionEditDraft(draft, [session], session);
  assert.equal(result.valid, false);
  assert.equal(result.errors.energy_kwh.key, "energy");
  assert.equal(result.errors.duration_hhmm.key, "duration");
  assert.equal(result.errors.soc_end.key, "socOrder");
});

test("valid localized changes produce a complete preview", () => {
  const draft = {
    ...buildSessionEditDraft(session),
    energy_kwh: "43,2",
    price_per_kwh: "0,41",
  };
  const result = validateSessionEditDraft(draft, [session], session);
  assert.equal(result.valid, true);
  assert.equal(result.preview.totalCost, 17.712);
  assert.equal(result.preview.socDelta, 58);
});
