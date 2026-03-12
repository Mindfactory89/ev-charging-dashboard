const test = require("node:test");
const assert = require("node:assert/strict");

const { buildDashboardPayload } = require("../lib/analytics");

function session(id, overrides = {}) {
  return {
    id,
    date: new Date(overrides.date || "2026-01-10T10:00:00.000Z"),
    connector: overrides.connector || "CCS - DC",
    provider: overrides.provider || "Ionity",
    location: overrides.location || "Brohltal Ost",
    vehicle: overrides.vehicle || "CUPRA Born 79 kWh",
    tags: overrides.tags || "hpc",
    soc_start: overrides.soc_start ?? 10,
    soc_end: overrides.soc_end ?? 70,
    energy_kwh: overrides.energy_kwh ?? 42,
    price_per_kwh: overrides.price_per_kwh ?? 0.59,
    total_cost: overrides.total_cost ?? 24.78,
    duration_seconds: overrides.duration_seconds ?? 1800,
  };
}

test("buildDashboardPayload exposes default years and intelligence filters", () => {
  const sessions = [
    session("1"),
    session("2", { date: "2025-12-05T10:00:00.000Z", provider: "EnBW", location: "Hamburg", tags: "public, ac" }),
  ];

  const payload = buildDashboardPayload({
    sessions: [sessions[0]],
    allSessions: sessions,
    year: 2026,
  });

  assert.deepEqual(payload.available_years, [2025, 2026, 2027, 2028]);
  assert.equal(payload.sessions.meta.total, 1);
  assert.ok(payload.intelligence.filters.providers.includes("Ionity"));
});
