import test from "node:test";
import assert from "node:assert/strict";

import { buildImportPreview } from "../src/ui/sessionImport.js";

test("buildImportPreview detects ionity-style profile and applies defaults", () => {
  const preview = buildImportPreview(
    "start_date,station,charged_amount_kwh,total_price\n2026-03-12,Brohltal Ost,48.1,28.37",
    []
  );

  assert.equal(preview.profile.activeId, "ionity");
  assert.equal(preview.rows[0].payload.provider, "Ionity");
  assert.equal(preview.rows[0].payload.connector, "CCS - DC");
  assert.equal(preview.rows[0].ready, true);
});

test("buildImportPreview flags duplicate rows", () => {
  const preview = buildImportPreview(
    "date,provider,location,energy_kwh,total_cost,soc_start,soc_end\n2026-03-12,EnBW,Hamburg,22,11,20,80\n2026-03-12,EnBW,Hamburg,22,11,20,80",
    []
  );

  assert.equal(preview.summary.duplicates, 1);
  assert.equal(preview.rows[1].duplicateImport, true);
});

test("buildImportPreview parses fully quoted semicolon exports with BOM", () => {
  const preview = buildImportPreview(
    '\uFEFF"date;provider;location;vehicle;tags;connector;soc_start;soc_end;energy_kwh;price_per_kwh;total_cost;duration_seconds;odo_start_km;odo_end_km;note;calc_price_per_kwh"\n' +
      '"2026-03-11;Aldi;Essen;Born;Aldi;CCS - DC;28;84;46.518;0.47;21.86;1560;;7556;Laden bei Aldi + Einkauf;0.47"',
    []
  );

  assert.equal(preview.summary.total, 1);
  assert.equal(preview.summary.ready, 1);
  assert.equal(preview.rows[0].payload.date, "2026-03-11");
  assert.equal(preview.rows[0].payload.provider, "Aldi");
  assert.equal(preview.rows[0].payload.location, "Essen");
  assert.equal(preview.rows[0].payload.connector, "CCS - DC");
  assert.equal(preview.rows[0].payload.energy_kwh, 46.518);
  assert.equal(preview.rows[0].payload.odometer_km, 7556);
});
