const test = require("node:test");
const assert = require("node:assert/strict");

const { parseSessionMutation } = require("../lib/sessionMutation");

test("parseSessionMutation normalizes optional metadata", () => {
  const result = parseSessionMutation({
    date: "2026-03-12",
    connector: "CCS - DC",
    soc_start: 12,
    soc_end: 78,
    energy_kwh: 44.5,
    price_per_kwh: 0.59,
    provider: "  Ionity  ",
    location: " Brohltal Ost ",
    vehicle: " CUPRA Born 79 kWh ",
    tags: ["#HPC", "reise", "reise"],
  });

  assert.equal(result.error, undefined);
  assert.equal(result.data.provider, "Ionity");
  assert.equal(result.data.location, "Brohltal Ost");
  assert.equal(result.data.vehicle, "CUPRA Born 79 kWh");
  assert.equal(result.data.tags, "HPC, reise");
  assert.equal(result.data.total_cost, 26.25);
});
