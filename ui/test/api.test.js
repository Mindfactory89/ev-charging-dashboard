import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

function createDemoWindow() {
  return {
    location: {
      search: "?demo=1",
      hostname: "localhost",
      host: "localhost:5173",
      protocol: "http:",
      assign() {},
      reload() {},
    },
    open() {
      return null;
    },
    confirm() {
      return true;
    },
    alert() {},
  };
}

async function loadDemoApi() {
  globalThis.window = createDemoWindow();
  const moduleUrl = pathToFileURL(path.resolve("src/ui/api.js"));
  return import(`${moduleUrl.href}?test=${Date.now()}-${Math.random()}`);
}

async function seedAnalyticsYear(api, year = 2032) {
  const sessions = [
    {
      date: `${year}-01-10`,
      energy_kwh: 20,
      total_cost: 10,
      duration_seconds: 1800,
      provider: "Ionity",
      location: "Brohltal Ost",
      connector: "CCS - DC",
      soc_start: 10,
      soc_end: 60,
    },
    {
      date: `${year}-01-15`,
      energy_kwh: 30,
      total_cost: 18,
      duration_seconds: 5400,
      provider: "EnBW",
      location: "Hamburg",
      connector: "CCS AC",
      soc_start: 22,
      soc_end: 80,
    },
    {
      date: `${year}-07-04`,
      energy_kwh: 12,
      total_cost: 3.6,
      duration_seconds: 1440,
      provider: "Wallbox",
      location: "Zuhause",
      connector: "Wallbox AC",
      soc_start: 40,
      soc_end: 70,
    },
  ];

  for (const session of sessions) {
    await api.createSession(session);
  }
}

async function seedOutlierYear(api, year = 2033) {
  const sessions = [
    {
      date: `${year}-01-05`,
      energy_kwh: 20,
      total_cost: 9,
      duration_seconds: 1800,
      provider: "Ionity",
      location: "A",
      connector: "CCS - DC",
      soc_start: 10,
      soc_end: 50,
    },
    {
      date: `${year}-01-08`,
      energy_kwh: 18,
      total_cost: 8.1,
      duration_seconds: 1620,
      provider: "EnBW",
      location: "B",
      connector: "CCS - DC",
      soc_start: 20,
      soc_end: 55,
    },
    {
      date: `${year}-02-11`,
      energy_kwh: 24,
      total_cost: 10.8,
      duration_seconds: 2400,
      provider: "Aral",
      location: "C",
      connector: "CCS - DC",
      soc_start: 30,
      soc_end: 70,
    },
    {
      date: `${year}-03-09`,
      energy_kwh: 16,
      total_cost: 7.2,
      duration_seconds: 1440,
      provider: "Fastned",
      location: "D",
      connector: "CCS - DC",
      soc_start: 40,
      soc_end: 65,
    },
    {
      date: `${year}-04-02`,
      energy_kwh: 15,
      total_cost: 18,
      duration_seconds: 10800,
      provider: "Demo Fail",
      location: "E",
      connector: "CCS AC",
      soc_start: 12,
      soc_end: 62,
    },
  ];

  for (const session of sessions) {
    await api.createSession(session);
  }
}

test.afterEach(() => {
  delete globalThis.window;
});

test("createSession normalizes alias fields and invalidates the demo dashboard cache", async () => {
  const api = await loadDemoApi();
  api.invalidateDashboardBundleCache();

  const initialBundle = await api.getDashboardBundle(2027);
  const created = await api.createSession({
    datum: "2027-03-15",
    energy: 22,
    cost: 11,
    duration_minutes: 45,
    anbieter: "Ionity",
    ort: "Brohltal Ost",
    fahrzeug: "Born",
    schlagworte: ["reise", "hpc"],
    anschluss: "CCS - DC",
    socStart: 18,
    socEnd: 82,
    note: "Alias import",
  });

  assert.equal(api.isDemoMode, true);
  assert.equal(created.demo, true);
  assert.equal(created.row.date, "2027-03-15");
  assert.equal(created.row.provider, "Ionity");
  assert.equal(created.row.location, "Brohltal Ost");
  assert.equal(created.row.vehicle, "Born");
  assert.equal(created.row.tags, "reise, hpc");
  assert.equal(created.row.duration_seconds, 2700);
  assert.equal(created.row.price_per_kwh, 0.5);
  assert.equal(created.row.total_cost, 11);
  assert.equal(Number.isInteger(created.row.odo_start_km), true);
  assert.equal(Number.isInteger(created.row.odo_end_km), true);
  assert.equal(created.row.odo_end_km > created.row.odo_start_km, true);

  const sessions = await api.getSessions(2027);
  const nextBundle = await api.getDashboardBundle(2027);

  assert.equal(sessions.rows.some((row) => row.id === created.row.id), true);
  assert.equal(nextBundle.sessions.meta.total, initialBundle.sessions.meta.total + 1);
});

test("updateSession moves demo sessions across years without changing the id", async () => {
  const api = await loadDemoApi();
  api.invalidateDashboardBundleCache();

  const created = await api.createSession({
    date: "2026-04-01",
    energy_kwh: 19.6,
    total_cost: 8.82,
    duration_seconds: 1800,
    provider: "EnBW",
    location: "Hamburg",
    connector: "CCS - DC",
    soc_start: 24,
    soc_end: 78,
  });

  const updated = await api.updateSession(created.row.id, {
    session_date: "2028-01-02",
    provider: "Ionity",
    location: "Brohltal Ost",
  });

  const year2026 = await api.getSessions(2026);
  const year2028 = await api.getSessions(2028);

  assert.equal(updated.demo, true);
  assert.equal(updated.updated.id, created.row.id);
  assert.equal(updated.updated.date, "2028-01-02");
  assert.equal(updated.updated.provider, "Ionity");
  assert.equal(updated.updated.location, "Brohltal Ost");
  assert.equal(year2026.rows.some((row) => row.id === created.row.id), false);
  assert.equal(year2028.rows.some((row) => row.id === created.row.id), true);
});

test("deleteSession removes demo rows and refreshes dashboard totals", async () => {
  const api = await loadDemoApi();
  api.invalidateDashboardBundleCache();

  const baselineBundle = await api.getDashboardBundle(2026);
  const created = await api.createSession({
    date: "2026-05-20",
    energy_kwh: 16.2,
    total_cost: 5.51,
    duration_seconds: 1500,
    provider: "Aral pulse",
    location: "Berlin",
    connector: "CCS - DC",
    soc_start: 32,
    soc_end: 70,
  });

  const afterCreateBundle = await api.getDashboardBundle(2026);
  const deleted = await api.deleteSession(created.row.id);
  const sessions = await api.getSessions(2026);
  const afterDeleteBundle = await api.getDashboardBundle(2026);

  assert.equal(afterCreateBundle.sessions.meta.total, baselineBundle.sessions.meta.total + 1);
  assert.equal(deleted.demo, true);
  assert.equal(deleted.deleted.id, created.row.id);
  assert.equal(sessions.rows.some((row) => row.id === created.row.id), false);
  assert.equal(afterDeleteBundle.sessions.meta.total, baselineBundle.sessions.meta.total);
});

test("getStats summarizes totals, averages and medians for a custom demo year", async () => {
  const api = await loadDemoApi();
  await seedAnalyticsYear(api);

  const stats = await api.getStats(2032);

  assert.equal(stats.count, 3);
  assert.equal(stats.total_energy_kwh, 62);
  assert.equal(stats.total_cost, 31.6);
  assert.equal(stats.avg_kwh_per_session, 20.67);
  assert.equal(stats.avg_duration_seconds, 2880);
  assert.equal(stats.avg_price_per_charge, 10.53);
  assert.equal(stats.avg_price_per_kwh, 0.51);
  assert.equal(stats.avg_power_kw, 25.8);
  assert.equal(stats.medians.energy_kwh, 20);
  assert.equal(stats.medians.cost_per_session, 10);
  assert.equal(stats.medians.duration_seconds, 1800);
  assert.equal(stats.medians.price_per_kwh, 0.5);
  assert.equal(stats.medians.power_kw, 30);
  assert.equal(stats.most_expensive.date, "2032-01-15");
  assert.equal(stats.longest.duration_seconds, 5400);
});

test("getMonthly builds top months and trends for a custom demo year", async () => {
  const api = await loadDemoApi();
  await seedAnalyticsYear(api);

  const monthly = await api.getMonthly(2032);
  const january = monthly.months[0];
  const february = monthly.months[1];
  const july = monthly.months[6];

  assert.equal(monthly.top_energy_month.month, 1);
  assert.equal(monthly.top_energy_month.energy_kwh, 50);
  assert.equal(monthly.top_cost_month.month, 1);
  assert.equal(monthly.top_cost_month.cost, 28);
  assert.equal(january.count, 2);
  assert.equal(january.price_per_kwh, 0.56);
  assert.equal(january.trend.energy, null);
  assert.equal(february.energy_kwh, 0);
  assert.equal(february.trend.energy.delta, -50);
  assert.equal(february.trend.energy.pct, -1);
  assert.equal(july.count, 1);
  assert.equal(july.cost, 3.6);
  assert.equal(july.price_per_kwh, 0.3);
});

test("getSeasons and getEfficiency stay consistent for a custom demo year", async () => {
  const api = await loadDemoApi();
  await seedAnalyticsYear(api);

  const seasons = await api.getSeasons(2032);
  const efficiency = await api.getEfficiency(2032);
  const winter = seasons.seasons.find((season) => season.key === "winter");
  const summer = seasons.seasons.find((season) => season.key === "summer");

  assert.equal(winter.count, 2);
  assert.equal(winter.energy_kwh, 50);
  assert.equal(winter.avg_price_per_kwh, 0.56);
  assert.equal(winter.efficiency_score, 31.7);
  assert.equal(winter.best_session.date, "2032-01-10");
  assert.equal(winter.worst_session.date, "2032-01-15");
  assert.equal(summer.count, 1);
  assert.equal(summer.avg_price_per_kwh, 0.3);
  assert.equal(summer.efficiency_score, 80.8);
  assert.equal(seasons.highlights.best_efficiency_season.key, "summer");
  assert.equal(seasons.highlights.cheapest_season.key, "summer");
  assert.equal(seasons.baseline.price_min, 0.3);
  assert.equal(seasons.baseline.price_max, 0.6);
  assert.equal(efficiency.overall_score, 48);
  assert.equal(efficiency.score_label, "Optimierungspotenzial");
  assert.equal(efficiency.averages.price_per_kwh, 0.467);
  assert.equal(efficiency.averages.power_kw, 30);
  assert.equal(efficiency.best_session.date, "2032-07-04");
  assert.equal(efficiency.cheapest_session.date, "2032-07-04");
  assert.equal(efficiency.fastest_session.date, "2032-01-10");
});

test("getOutliers isolates a single multi-reason outlier in a custom demo year", async () => {
  const api = await loadDemoApi();
  await seedOutlierYear(api);

  const outliers = await api.getOutliers(2033);

  assert.equal(outliers.session_count, 5);
  assert.equal(outliers.outlier_count, 1);
  assert.equal(outliers.baselines.price_per_kwh.threshold, 0.531);
  assert.equal(outliers.baselines.avg_power_kw.method, "iqr");
  assert.equal(outliers.baselines.duration_seconds.threshold, 3570);
  assert.equal(outliers.baselines.score.threshold, 92);
  assert.equal(outliers.flagged_sessions[0].date, "2033-04-02");
  assert.equal(outliers.flagged_sessions[0].flag_count, 4);
  assert.equal(outliers.flagged_sessions[0].severity_score, 22.2);
  assert.deepEqual(
    outliers.flagged_sessions[0].reasons.map((reason) => reason.key),
    ["duration_seconds", "price_per_kwh", "score", "avg_power_kw"]
  );
  assert.equal(outliers.highlights.worst_session.date, "2033-04-02");
  assert.equal(outliers.highlights.priciest_outlier.price_per_kwh, 1.2);
  assert.equal(outliers.highlights.lowest_power_outlier.avg_power_kw, 5);
  assert.equal(outliers.highlights.longest_outlier.duration_seconds, 10800);
  assert.equal(outliers.highlights.weakest_score_outlier.score, 0);
});

test("getDashboardBundle exposes stable soc window highlights for a custom demo year", async () => {
  const api = await loadDemoApi();
  await seedOutlierYear(api);

  const bundle = await api.getDashboardBundle(2033);
  const soc = bundle.soc_window_analysis;

  assert.equal(soc.analyzed_session_count, 5);
  assert.equal(soc.windows.length, 5);
  assert.equal(soc.bands.length, 6);
  assert.equal(soc.highlights.best_efficiency_window.key, "60-70");
  assert.equal(soc.highlights.cheapest_window.key, "60-70");
  assert.equal(soc.highlights.fastest_window.key, "60-70");
  assert.equal(soc.highlights.widest_window.key, "10-20");
  assert.equal(soc.highlights.best_efficiency_window.avg_score, 90.2);
  assert.equal(soc.highlights.widest_window.avg_soc_delta, 45);
  assert.equal(soc.bands.find((band) => band.key === "40-50")?.count, 5);
  assert.equal(soc.bands.find((band) => band.key === "40-50")?.avg_score, 85);
});

test("getDashboardBundle isolates sessions by stable vehicle profile id", async () => {
  const api = await loadDemoApi();
  api.invalidateDashboardBundleCache();
  await api.createSession({
    date: "2039-02-01",
    energy_kwh: 20,
    price_per_kwh: 0.4,
    duration_seconds: 1800,
    connector: "CCS - DC",
    soc_start: 20,
    soc_end: 70,
    vehicle: "City EV",
    vehicle_profile_id: "city-ev",
  });
  await api.createSession({
    date: "2039-02-02",
    energy_kwh: 30,
    price_per_kwh: 0.5,
    duration_seconds: 2400,
    connector: "CCS - DC",
    soc_start: 10,
    soc_end: 80,
    vehicle: "Family EV",
    vehicle_profile_id: "family-ev",
  });

  const scoped = await api.getDashboardBundle(2039, { id: "city-ev", name: "City EV" });
  assert.equal(scoped.sessions.meta.total, 1);
  assert.equal(scoped.sessions.rows[0].vehicle_profile_id, "city-ev");
  assert.equal(scoped.stats.total_energy_kwh, 20);
});
