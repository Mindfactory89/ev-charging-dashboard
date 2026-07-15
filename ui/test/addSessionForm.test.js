import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialAddSessionValues,
  durationToSeconds,
  parseLocalizedNumber,
  validateAddSessionValues,
} from "../src/ui/addSessionForm.js";

test("durationToSeconds accepts common charging duration values", () => {
  assert.equal(durationToSeconds("0:30"), 1800);
  assert.equal(durationToSeconds("01:43"), 6180);
  assert.equal(durationToSeconds("01:60"), null);
  assert.equal(durationToSeconds("90"), null);
});

test("parseLocalizedNumber accepts German and English decimals", () => {
  assert.equal(parseLocalizedNumber("68,5"), 68.5);
  assert.equal(parseLocalizedNumber("0.59"), 0.59);
  assert.equal(parseLocalizedNumber(""), null);
  assert.equal(parseLocalizedNumber("invalid"), null);
});

test("validateAddSessionValues returns field-level issues and odometer bounds", () => {
  const values = {
    ...createInitialAddSessionValues(new Date(2026, 6, 15)),
    connector: "CCS - DC",
    energyKwh: "42,4",
    pricePerKwh: "0.59",
    durationHHMM: "00:42",
    socStart: 82,
    socEnd: 40,
    odometerKm: "11999",
  };

  const errors = validateAddSessionValues(values, { previousOdometerKm: 12000 });

  assert.equal(errors.socEnd.key, "socOrder");
  assert.equal(errors.odometerKm.key, "odometerMin");
  assert.equal(errors.odometerKm.values.value, 12000);
  assert.equal(errors.energyKwh, undefined);
});

test("validateAddSessionValues accepts a complete valid session", () => {
  const values = {
    ...createInitialAddSessionValues(new Date(2026, 6, 15)),
    connector: "CCS - DC",
    energyKwh: "42.4",
    pricePerKwh: "0,59",
    durationHHMM: "00:42",
    odometerKm: "12500",
  };

  assert.deepEqual(validateAddSessionValues(values, { previousOdometerKm: 12000 }), {});
});
