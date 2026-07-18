import test from "node:test";
import assert from "node:assert/strict";

import { buildSessionHistoryView, normalizeHistoryFilters, sessionMatchesQuery, sortSessions } from "../src/ui/sessionHistoryView.js";

const sessions = [
  { id: 1, date: "2026-01-04T10:00:00Z", provider: "EnBW", location: "Köln", vehicle: "Born", connector: "CCS", tags: "reise, hpc", energy_kwh: 30, total_cost: 15, duration_seconds: 1800 },
  { id: 2, date: "2026-02-10T10:00:00Z", provider: "Ionity", location: "Hamburg", vehicle: "Tavascan", connector: "CCS", note: "Rückfahrt", tags: "öffentlich", energy_kwh: 50, total_cost: 20, duration_seconds: 2400 },
  { id: 3, date: "2026-02-12T10:00:00Z", provider: "Aral", location: "Berlin", vehicle: "Born", connector: "Type 2", tags: "stadt", energy_kwh: 12, total_cost: 9, duration_seconds: 7200 },
];

test("history search is case-insensitive, accent-tolerant, and supports multiple terms", () => {
  assert.equal(sessionMatchesQuery(sessions[0], "KOLN hpc"), true);
  assert.equal(sessionMatchesQuery(sessions[1], "ionity rückfahrt"), true);
  assert.equal(sessionMatchesQuery(sessions[1], "10.02.2026 hamburg"), true);
  assert.equal(sessionMatchesQuery(sessions[2], "ionity"), false);
});

test("history view combines metadata filters, search, and sorting", () => {
  const result = buildSessionHistoryView(sessions, { month: 2, vehicle: "Born", query: "type", sort: "energy_desc" });
  assert.deepEqual(result.map((session) => session.id), [3]);
});

test("history sorting handles dates and derived price per kWh", () => {
  assert.deepEqual(sortSessions(sessions, "date_desc").map((session) => session.id), [3, 2, 1]);
  assert.deepEqual(sortSessions(sessions, "date_asc").map((session) => session.id), [1, 2, 3]);
  assert.deepEqual(sortSessions(sessions, "price_asc").map((session) => session.id), [2, 1, 3]);
});

test("unknown filters normalize to a safe default", () => {
  assert.deepEqual(normalizeHistoryFilters({ month: 19, sort: "unknown", query: "  Ionity  " }), {
    month: null,
    provider: "",
    location: "",
    vehicle: "",
    tag: "",
    query: "Ionity",
    sort: "date_desc",
  });
});
