import test from "node:test";
import assert from "node:assert/strict";

import {
  clearAddSessionDraft,
  hasMeaningfulAddSessionDraft,
  readAddSessionDraft,
  writeAddSessionDraft,
} from "../src/ui/addSessionDraft.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

test("add-session drafts persist meaningful values and ignore an untouched form", () => {
  const storage = memoryStorage();
  assert.equal(hasMeaningfulAddSessionDraft({ date: "2026-01-01", connector: "CCS" }), false);
  assert.equal(writeAddSessionDraft({ date: "2026-01-01", connector: "CCS" }, storage), null);
  writeAddSessionDraft({ date: "2026-01-01", provider: "Home", note: "Later" }, storage);
  assert.equal(readAddSessionDraft(storage).values.provider, "Home");
  clearAddSessionDraft(storage);
  assert.equal(readAddSessionDraft(storage), null);
});
