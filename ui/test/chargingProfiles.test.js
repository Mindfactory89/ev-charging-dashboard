import test from "node:test";
import assert from "node:assert/strict";
import {
  CHARGING_PROFILES_STORAGE_KEY,
  addSessionDefaultsForChargingProfile,
  deleteChargingProfile,
  isTimeInWindow,
  priceForChargingProfile,
  readChargingProfileState,
  saveChargingProfile,
} from "../src/config/chargingProfiles.js";

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
}

test("time windows work across midnight", () => {
  assert.equal(isTimeInWindow("23:15", "22:00", "06:00"), true);
  assert.equal(isTimeInWindow("05:30", "22:00", "06:00"), true);
  assert.equal(isTimeInWindow("14:00", "22:00", "06:00"), false);
});

test("time-dependent profile selects off-peak and peak price", () => {
  const profile = { tariffType: "timeOfUse", offPeakStart: "22:00", offPeakEnd: "06:00", offPeakPrice: 0.2, peakPrice: 0.5 };
  assert.equal(priceForChargingProfile(profile, new Date(2026, 6, 16, 23, 0)), 0.2);
  assert.equal(priceForChargingProfile(profile, new Date(2026, 6, 16, 12, 0)), 0.5);
});

test("profiles persist, become active, and seed the add-session form", () => {
  const storage = memoryStorage();
  const result = saveChargingProfile({ name: "Solar", context: "home", energySource: "pv", tariffType: "fixed", basePrice: 0.12, pvShare: 80 }, storage);
  assert.equal(result.state.activeProfile.name, "Solar");
  assert.ok(storage.getItem(CHARGING_PROFILES_STORAGE_KEY));
  assert.deepEqual(addSessionDefaultsForChargingProfile(result.profile).location, "Zuhause");
  assert.equal(addSessionDefaultsForChargingProfile(result.profile).connector, "Wallbox AC");
  assert.match(addSessionDefaultsForChargingProfile(result.profile).tags, /pv/);
  assert.equal(deleteChargingProfile(result.profile.id, storage).profiles.length, 1);
  assert.equal(readChargingProfileState(storage).activeProfile.name, "Zuhause");
});
