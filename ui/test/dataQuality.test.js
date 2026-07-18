import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDataQualityReport,
  clearReviewedDataQualityIssues,
  readDataQualityPreferences,
  reviewDataQualityIssues,
  restoreDataQualityIssue,
} from "../src/ui/dataQuality.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

const complete = {
  id: "one", date: "2026-01-01", provider: "Home", location: "Garage", vehicle: "EV",
  duration_seconds: 3600, energy_kwh: 20, total_cost: 6, soc_start: 20, soc_end: 60,
};

test("data quality report detects context, metrics, outliers, and duplicates", () => {
  const duplicate = { ...complete, id: "two" };
  const incomplete = { ...complete, id: "three", provider: "", duration_seconds: 0, total_cost: null };
  const report = buildDataQualityReport({
    sessions: [complete, duplicate, incomplete],
    sessionOutliersById: { three: { flag_count: 2 } },
  });

  assert.equal(report.metrics.duplicateGroups, 1);
  assert.equal(report.metrics.context, 1);
  assert.equal(report.metrics.metrics, 1);
  assert.equal(report.metrics.outliers, 1);
  assert.deepEqual(report.issues.map((issue) => issue.kind).sort(), ["context", "duplicate", "metrics", "outlier"]);
  assert.equal(report.score, 33);
});

test("reviewed data-quality issues stay year-scoped and reversible", () => {
  const storage = memoryStorage();
  reviewDataQualityIssues(2026, ["context-one", "outlier-one"], storage);
  reviewDataQualityIssues(2027, "duplicate-two", storage);
  assert.deepEqual(readDataQualityPreferences(2026, storage).reviewed, ["context-one", "outlier-one"]);
  restoreDataQualityIssue(2026, "context-one", storage);
  assert.deepEqual(readDataQualityPreferences(2026, storage).reviewed, ["outlier-one"]);
  clearReviewedDataQualityIssues(2026, storage);
  assert.deepEqual(readDataQualityPreferences(2026, storage).reviewed, []);
});
