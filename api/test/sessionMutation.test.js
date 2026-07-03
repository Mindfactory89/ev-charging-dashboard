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

test("parseSessionMutation prefers HH:MM duration and accepts odometer_km alias", () => {
  const result = parseSessionMutation({
    date: "2026-03-12",
    connector: " CCS   -   DC ",
    soc_start: 15,
    soc_end: 81,
    energy_kwh: "40.0",
    price_per_kwh: "0.49",
    duration_hhmm: "01:45",
    duration_seconds: 900,
    odo_start_km: 12000,
    odometer_km: 12150,
  });

  assert.equal(result.error, undefined);
  assert.equal(result.data.connector, "CCS - DC");
  assert.equal(result.data.duration_seconds, 6300);
  assert.equal(result.data.odo_start_km, 12000);
  assert.equal(result.data.odo_end_km, 12150);
  assert.equal(result.data.total_cost, 19.6);
});

test("parseSessionMutation rejects decreasing odometer ranges", () => {
  const result = parseSessionMutation({
    date: "2026-03-12",
    connector: "CCS - DC",
    soc_start: 20,
    soc_end: 80,
    energy_kwh: 30,
    price_per_kwh: 0.5,
    odo_start_km: 15000,
    odo_end_km: 14900,
  });

  assert.equal(result.error, "Kilometer Ende darf nicht kleiner als Kilometer Start sein.");
});

test("parseSessionMutation rejects invalid HH:MM durations", () => {
  const result = parseSessionMutation({
    date: "2026-03-12",
    connector: "CCS - DC",
    soc_start: 20,
    soc_end: 80,
    energy_kwh: 30,
    price_per_kwh: 0.5,
    duration_hhmm: "01:99",
  });

  assert.equal(result.error, "Dauer muss als HH:MM angegeben werden.");
});
