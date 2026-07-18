import test from "node:test";
import assert from "node:assert/strict";

import {
  ACTIVE_VEHICLE_PROFILE_STORAGE_KEY,
  deleteCustomVehicleProfile,
  getVehicleReferenceConsumption,
  readVehicleProfileState,
  saveCustomVehicleProfile,
  setActiveVehicleProfile,
  validateVehicleProfileDraft,
  VEHICLE_PROFILE_IMAGES_STORAGE_KEY,
} from "../src/config/vehicleProfilePreferences.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

test("custom vehicle profiles persist battery and consumption data", () => {
  const storage = memoryStorage();
  const saved = saveCustomVehicleProfile({
    id: "family-ev",
    name: "Familienauto",
    batteryKwh: 82,
    consumptionKwhPer100Km: 18.4,
    chargingPowerKw: 205,
  }, [], storage);

  assert.equal(saved.profile.batteryKwh, 82);
  assert.equal(readVehicleProfileState(storage).profiles.at(-1).consumptionKwhPer100Km, 18.4);
  assert.equal(getVehicleReferenceConsumption("Familienauto", storage), 18.4);
});

test("active custom profile falls back safely after deletion", () => {
  const storage = memoryStorage();
  saveCustomVehicleProfile({ id: "city", name: "City EV", batteryKwh: 50, consumptionKwhPer100Km: 14 }, [], storage);
  const selected = setActiveVehicleProfile("city", storage);
  assert.equal(selected.activeProfileId, "city");
  assert.equal(storage.getItem(ACTIVE_VEHICLE_PROFILE_STORAGE_KEY), "city");

  const deleted = deleteCustomVehicleProfile("city", storage);
  assert.equal(deleted.state.activeProfileId, "generic-ev");
  assert.equal(storage.getItem(ACTIVE_VEHICLE_PROFILE_STORAGE_KEY), "generic-ev");
});

test("custom vehicle images are stored separately and removed with their profile", () => {
  const storage = memoryStorage();
  const imageDataUrl = "data:image/webp;base64,UklGRg==";
  const saved = saveCustomVehicleProfile({
    id: "photo-car",
    name: "Photo Car",
    batteryKwh: 77,
    consumptionKwhPer100Km: 16.8,
    imageDataUrl,
  }, [], storage);

  assert.equal(saved.imageSaved, true);
  assert.equal(saved.profile.imageSrc, imageDataUrl);
  assert.equal(readVehicleProfileState(storage).profiles.at(-1).imageSource, "user");
  assert.match(storage.getItem(VEHICLE_PROFILE_IMAGES_STORAGE_KEY), /photo-car/);

  deleteCustomVehicleProfile("photo-car", storage);
  assert.equal(storage.getItem(VEHICLE_PROFILE_IMAGES_STORAGE_KEY), "{}");
});

test("vehicle image persistence can be disabled for demo capabilities", () => {
  const storage = memoryStorage();
  const saved = saveCustomVehicleProfile({
    id: "demo-car",
    name: "Demo Car",
    batteryKwh: 60,
    consumptionKwhPer100Km: 17,
    imageDataUrl: "data:image/webp;base64,UklGRg==",
  }, [], storage, { allowImages: false });

  assert.equal(saved.profile.imageSrc, "");
  assert.equal(storage.getItem(VEHICLE_PROFILE_IMAGES_STORAGE_KEY), null);
});

test("vehicle profile validation rejects unrealistic values", () => {
  const result = validateVehicleProfileDraft({ name: "", batteryKwh: 4, consumptionKwhPer100Km: 90, chargingPowerKw: 2000 });
  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors), ["name", "batteryKwh", "consumptionKwhPer100Km", "chargingPowerKw"]);
});
