import test from "node:test";
import assert from "node:assert/strict";

import {
  deleteImportMappingProfile,
  IMPORT_MAPPING_PROFILE_STORAGE_KEY,
  readImportMappingProfiles,
  saveImportMappingProfile,
} from "../src/ui/importMappingProfiles.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, value); },
  };
}

test("saved import mapping profiles persist mapping and fallbacks", () => {
  const storage = memoryStorage();
  const result = saveImportMappingProfile({
    id: "my-provider",
    name: "Mein Anbieter",
    baseProfileId: "generic",
    mapping: { date: "Started", energy_kwh: "Energy" },
    fallbacks: { soc_start: 15, soc_end: 85, vehicle: "CUPRA Born" },
  }, [], storage);

  assert.equal(result.profile.name, "Mein Anbieter");
  assert.equal(readImportMappingProfiles(storage)[0].mapping.energy_kwh, "Energy");
  assert.equal(readImportMappingProfiles(storage)[0].fallbacks.soc_end, 85);
  assert.ok(storage.getItem(IMPORT_MAPPING_PROFILE_STORAGE_KEY));
});

test("deleting a saved import mapping profile preserves other profiles", () => {
  const storage = memoryStorage();
  const first = saveImportMappingProfile({ id: "one", name: "One" }, [], storage);
  const second = saveImportMappingProfile({ id: "two", name: "Two" }, first.profiles, storage);
  const remaining = deleteImportMappingProfile("one", second.profiles, storage);

  assert.deepEqual(remaining.map((profile) => profile.id), ["two"]);
});
