import test from "node:test";
import assert from "node:assert/strict";

import {
  deleteHistoryFilterProfile,
  readSavedHistoryFilters,
  SAVED_HISTORY_FILTERS_STORAGE_KEY,
  saveHistoryFilterProfile,
} from "../src/ui/savedHistoryFilters.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

test("saved history filters persist the complete view", () => {
  const storage = memoryStorage();
  const result = saveHistoryFilterProfile({
    id: "long-trips",
    name: "Reisen",
    filters: { provider: "Ionity", tag: "reise", query: "Hamburg", sort: "cost_desc" },
  }, [], storage);

  const restored = readSavedHistoryFilters(storage)[0];
  assert.equal(result.profile.name, "Reisen");
  assert.equal(restored.filters.provider, "Ionity");
  assert.equal(restored.filters.query, "Hamburg");
  assert.equal(restored.filters.sort, "cost_desc");
  assert.ok(storage.getItem(SAVED_HISTORY_FILTERS_STORAGE_KEY));
});

test("deleting a saved history filter leaves other views intact", () => {
  const storage = memoryStorage();
  const first = saveHistoryFilterProfile({ id: "one", name: "One" }, [], storage);
  const second = saveHistoryFilterProfile({ id: "two", name: "Two" }, first.profiles, storage);
  const remaining = deleteHistoryFilterProfile("one", second.profiles, storage);
  assert.deepEqual(remaining.map((profile) => profile.id), ["two"]);
});
