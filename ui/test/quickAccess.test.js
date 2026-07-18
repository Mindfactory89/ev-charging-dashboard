import test from "node:test";
import assert from "node:assert/strict";
import { buildQuickAccessResults, isQuickAccessTypingTarget } from "../src/ui/quickAccess.js";

const actions = [
  { id: "overview", label: "Übersicht öffnen", description: "Kosten und Energie", keywords: ["Cockpit"] },
  { id: "add", label: "Ladevorgang hinzufügen", description: "Neue Session", keywords: ["erfassen"] },
];

const sessions = [
  { id: 1, date: "2026-01-02", provider: "EnBW", location: "Köln", vehicle: "CUPRA Born" },
  { id: 2, date: "2026-03-04", provider: "IONITY", location: "Aachen", tags: "Reise" },
];

test("quick access matches actions and session metadata accent-tolerantly", () => {
  const actionResult = buildQuickAccessResults({ actions, sessions, query: "cockpit" });
  assert.deepEqual(actionResult.actions.map((item) => item.id), ["overview"]);
  assert.equal(actionResult.sessions.length, 0);

  const sessionResult = buildQuickAccessResults({ actions, sessions, query: "koln born" });
  assert.deepEqual(sessionResult.sessions.map((item) => item.id), [1]);
  assert.equal(sessionResult.actions.length, 0);
});

test("quick access shows recent sessions first and protects typing shortcuts", () => {
  const result = buildQuickAccessResults({ actions, sessions });
  assert.deepEqual(result.sessions.map((item) => item.id), [2, 1]);
  assert.equal(isQuickAccessTypingTarget({ tagName: "INPUT" }), true);
  assert.equal(isQuickAccessTypingTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isQuickAccessTypingTarget({ tagName: "BUTTON" }), false);
});
