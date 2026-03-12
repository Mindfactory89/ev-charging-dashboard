const test = require("node:test");
const assert = require("node:assert/strict");

const { buildSelectableYears, yearRange } = require("../lib/year");

test("buildSelectableYears merges defaults and data years", () => {
  assert.deepEqual(buildSelectableYears([2025, 2028], 2030), [2025, 2026, 2027, 2028, 2030]);
});

test("yearRange returns UTC year boundaries", () => {
  const range = yearRange(2027);
  assert.equal(range.from.toISOString(), "2027-01-01T00:00:00.000Z");
  assert.equal(range.to.toISOString(), "2028-01-01T00:00:00.000Z");
});
