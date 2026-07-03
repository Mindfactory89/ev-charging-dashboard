const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildDashboardPayload,
  buildEfficiencyAnalyticsPayload,
  buildIntelligenceAnalyticsPayload,
  buildMonthlyCsvRows,
  buildMonthlyAnalyticsPayload,
  buildSeasonAnalyticsPayload,
  buildSeasonsCsvRows,
  buildSocWindowAnalyticsPayload,
  buildStatsPayload,
  calcOutlierAnalytics,
  buildSessionDerived,
} = require("../lib/analytics");

function session(id, overrides = {}) {
  const pick = (key, fallback) => (Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : fallback);

  return {
    id,
    date: new Date(overrides.date || "2026-01-10T10:00:00.000Z"),
    connector: overrides.connector || "CCS - DC",
    provider: pick("provider", "Ionity"),
    location: pick("location", "Brohltal Ost"),
    vehicle: pick("vehicle", "CUPRA Born 79 kWh"),
    tags: pick("tags", "hpc"),
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

test("buildSessionDerived calculates effective per-session metrics", () => {
  const derived = buildSessionDerived(
    session("derived", {
      soc_start: 18,
      soc_end: 79,
      energy_kwh: 45,
      total_cost: 22.5,
      duration_seconds: 1800,
    })
  );

  assert.equal(derived.energy_kwh, 45);
  assert.equal(derived.total_cost, 22.5);
  assert.equal(derived.avg_power_kw, 90);
  assert.equal(derived.price_per_kwh_effective, 0.5);
  assert.equal(derived.soc_delta, 61);
  assert.equal(derived.minutes_per_kwh, 2 / 3);
});

test("buildEfficiencyAnalyticsPayload derives stable highlights, averages, and labels", () => {
  const payload = buildEfficiencyAnalyticsPayload(
    [
      session("best", {
        energy_kwh: 40,
        total_cost: 20,
        price_per_kwh: 0.5,
        duration_seconds: 1800,
      }),
      session("worst", {
        energy_kwh: 40,
        total_cost: 28,
        price_per_kwh: 0.7,
        duration_seconds: 3600,
      }),
      session("middle", {
        energy_kwh: 20,
        total_cost: 12,
        price_per_kwh: 0.6,
        duration_seconds: 2400,
      }),
    ],
    2026
  );

  assert.equal(payload.overall_score, 46.8);
  assert.equal(payload.score_label, "Optimierungspotenzial");
  assert.equal(payload.averages.price_per_kwh, 0.6);
  assert.equal(payload.averages.power_kw, 50);
  assert.equal(payload.best_session.session_id, "best");
  assert.equal(payload.worst_session.session_id, "worst");
  assert.equal(payload.cheapest_session.session_id, "best");
  assert.equal(payload.fastest_session.session_id, "best");
  assert.deepEqual(payload.weights, {
    price_score: 0.55,
    power_score: 0.25,
    speed_score: 0.2,
  });
  assert.deepEqual(payload.baseline, {
    price_min: 0.5,
    price_max: 0.7,
    power_min_kw: 30,
    power_max_kw: 80,
    minutes_per_kwh_min: 0.75,
    minutes_per_kwh_max: 2,
  });
});

test("buildIntelligenceAnalyticsPayload groups fallbacks, filters, and highlights consistently", () => {
  const payload = buildIntelligenceAnalyticsPayload(
    [
      session("ionity", {
        provider: "Ionity",
        location: "Brohltal Ost",
        vehicle: "CUPRA Born 79 kWh",
        tags: "hpc, reise",
        energy_kwh: 40,
        total_cost: 24,
        duration_seconds: 1800,
      }),
      session("enbw", {
        provider: "EnBW",
        location: "Hamburg",
        vehicle: "CUPRA Born 79 kWh",
        tags: "ac",
        energy_kwh: 20,
        total_cost: 9,
        duration_seconds: 3600,
      }),
      session("fallback", {
        provider: null,
        location: null,
        vehicle: null,
        tags: "",
        energy_kwh: 10,
        total_cost: 4,
        duration_seconds: 1800,
      }),
    ],
    2026
  );

  assert.ok(payload.filters.providers.includes("Ionity"));
  assert.ok(payload.filters.providers.includes("EnBW"));
  assert.ok(payload.filters.providers.includes("Nicht zugeordnet"));
  assert.ok(payload.filters.vehicles.includes("Standardfahrzeug"));
  assert.deepEqual(payload.filters.tags, ["hpc", "reise", "ac"]);
  assert.equal(payload.highlights.cheapest_provider.label, "Nicht zugeordnet");
  assert.equal(payload.highlights.fastest_provider.label, "Ionity");
  assert.equal(payload.highlights.strongest_location.label, "Brohltal Ost");
  assert.equal(payload.highlights.dominant_vehicle.label, "CUPRA Born 79 kWh");
});

test("calcOutlierAnalytics flags a clearly weak session across multiple rules", () => {
  const payload = calcOutlierAnalytics(
    [
      session("base-1", { energy_kwh: 40, total_cost: 20, price_per_kwh: 0.5, duration_seconds: 1800 }),
      session("base-2", { energy_kwh: 40, total_cost: 20, price_per_kwh: 0.5, duration_seconds: 1800 }),
      session("base-3", { energy_kwh: 40, total_cost: 20, price_per_kwh: 0.5, duration_seconds: 1800 }),
      session("base-4", { energy_kwh: 40, total_cost: 20, price_per_kwh: 0.5, duration_seconds: 1800 }),
      session("outlier", { energy_kwh: 40, total_cost: 36, price_per_kwh: 0.9, duration_seconds: 7200 }),
    ],
    2026
  );

  assert.equal(payload.session_count, 5);
  assert.equal(payload.outlier_count, 1);
  assert.equal(payload.flagged_sessions[0].session_id, "outlier");
  assert.deepEqual(
    payload.flagged_sessions[0].reasons.map((reason) => reason.key).sort(),
    ["avg_power_kw", "duration_seconds", "price_per_kwh", "score"]
  );
  assert.equal(payload.highlights.worst_session.session_id, "outlier");
  assert.equal(payload.highlights.priciest_outlier.session_id, "outlier");
  assert.equal(payload.highlights.lowest_power_outlier.session_id, "outlier");
  assert.equal(payload.highlights.longest_outlier.session_id, "outlier");
  assert.equal(payload.highlights.weakest_score_outlier.session_id, "outlier");
});

test("buildStatsPayload reuses aggregate metrics and exposes stable medians and highlights", () => {
  const payload = buildStatsPayload(
    [
      session("s1", { energy_kwh: 10, total_cost: 5, duration_seconds: 1200 }),
      session("s2", { energy_kwh: 20, total_cost: 12, duration_seconds: 1800 }),
      session("s3", { energy_kwh: 30, total_cost: 21, duration_seconds: 3600 }),
    ],
    2026
  );

  assert.equal(payload.count, 3);
  assert.equal(payload.total_energy_kwh, 60);
  assert.equal(payload.total_cost, 38);
  assert.equal(payload.avg_kwh_per_session, 20);
  assert.equal(payload.avg_duration_seconds, 2200);
  assert.equal(payload.avg_price_per_kwh, 0.633);
  assert.equal(payload.avg_price_per_charge, 12.67);
  assert.equal(payload.avg_power_kw, 32.7);
  assert.equal(payload.avg_cost_per_min, 0.35);
  assert.deepEqual(payload.medians, {
    energy_kwh: 20,
    cost_per_session: 12,
    duration_seconds: 1800,
    price_per_kwh: 0.6,
    power_kw: 30,
  });
  assert.equal(payload.best_session_kwh.id, "s3");
  assert.equal(payload.most_expensive.id, "s3");
  assert.equal(payload.longest.id, "s3");
});

test("buildMonthlyAnalyticsPayload calculates trends and top-month highlights", () => {
  const payload = buildMonthlyAnalyticsPayload(
    [
      session("jan-1", { date: "2026-01-10T10:00:00.000Z", energy_kwh: 10, total_cost: 5 }),
      session("jan-2", { date: "2026-01-20T10:00:00.000Z", energy_kwh: 20, total_cost: 10 }),
      session("feb-1", { date: "2026-02-05T10:00:00.000Z", energy_kwh: 20, total_cost: 14 }),
    ],
    2026
  );

  assert.equal(payload.months.length, 12);
  assert.equal(payload.top_energy_month.month, 1);
  assert.equal(payload.top_cost_month.month, 1);
  assert.equal(payload.avg_sessions_per_month, 1.5);

  const january = payload.months[0];
  const february = payload.months[1];

  assert.equal(january.energy_kwh, 30);
  assert.equal(january.cost, 15);
  assert.equal(january.price_per_kwh, 0.5);
  assert.equal(january.trend.energy, null);

  assert.equal(february.energy_kwh, 20);
  assert.equal(february.cost, 14);
  assert.equal(february.price_per_kwh, 0.7);
  assert.deepEqual(february.trend, {
    energy: { delta: -10, pct: -0.3333 },
    cost: { delta: -1, pct: -0.0667 },
    price_per_kwh: { delta: 0.2, pct: 0.4 },
  });
});

test("buildSeasonAnalyticsPayload calculates season highlights and per-season best/worst sessions", () => {
  const payload = buildSeasonAnalyticsPayload(
    [
      session("winter-1", { date: "2026-01-10T10:00:00.000Z", energy_kwh: 40, total_cost: 20, duration_seconds: 1800 }),
      session("spring-1", { date: "2026-04-10T10:00:00.000Z", energy_kwh: 40, total_cost: 28, duration_seconds: 3600 }),
      session("summer-1", { date: "2026-07-10T10:00:00.000Z", energy_kwh: 20, total_cost: 9, duration_seconds: 1800 }),
    ],
    2026
  );

  const winter = payload.seasons.find((season) => season.key === "winter");
  const spring = payload.seasons.find((season) => season.key === "spring");
  const summer = payload.seasons.find((season) => season.key === "summer");

  assert.equal(winter.best_session.session_id, "winter-1");
  assert.equal(winter.worst_session.session_id, "winter-1");
  assert.equal(payload.highlights.best_efficiency_season.key, "winter");
  assert.equal(payload.highlights.cheapest_season.key, "summer");
  assert.equal(spring.efficiency_score, 0);
  assert.equal(summer.efficiency_score, 55);
});

test("monthly and seasonal CSV rows reuse aggregated values", () => {
  const sessions = [
    session("jan-1", { date: "2026-01-10T10:00:00.000Z", energy_kwh: 10, total_cost: 5, duration_seconds: 1200 }),
    session("jan-2", { date: "2026-01-20T10:00:00.000Z", energy_kwh: 20, total_cost: 10, duration_seconds: 1800 }),
    session("apr-1", { date: "2026-04-05T10:00:00.000Z", energy_kwh: 20, total_cost: 14, duration_seconds: 3600 }),
  ];

  const monthlyRows = buildMonthlyCsvRows(sessions);
  const seasonalRows = buildSeasonsCsvRows(sessions);

  assert.equal(monthlyRows[0].energy_kwh, 30);
  assert.equal(monthlyRows[0].cost, 15);
  assert.equal(monthlyRows[0].price_per_kwh, 0.5);
  assert.equal(monthlyRows[3].energy_kwh, 20);

  const winter = seasonalRows.find((row) => row.season === "Winter");
  const spring = seasonalRows.find((row) => row.season === "Frühling");

  assert.equal(winter.count, 2);
  assert.equal(winter.energy_kwh, 30);
  assert.equal(winter.avg_price_per_kwh, 0.5);
  assert.equal(spring.count, 1);
  assert.equal(spring.avg_power_kw, 20);
});

test("buildSocWindowAnalyticsPayload aggregates windows and bands while ignoring invalid ranges", () => {
  const payload = buildSocWindowAnalyticsPayload(
    [
      session("win-a", {
        soc_start: 10,
        soc_end: 30,
        energy_kwh: 40,
        total_cost: 20,
        duration_seconds: 1800,
      }),
      session("win-b", {
        soc_start: 20,
        soc_end: 40,
        energy_kwh: 20,
        total_cost: 14,
        duration_seconds: 3600,
      }),
      session("invalid", {
        soc_start: 90,
        soc_end: 80,
        energy_kwh: 10,
        total_cost: 3,
        duration_seconds: 1200,
      }),
    ],
    2026
  );

  assert.equal(payload.analyzed_session_count, 2);
  assert.deepEqual(payload.windows.map((row) => row.key), ["10-30", "20-40"]);

  const mixedBand = payload.bands.find((row) => row.key === "20-30");
  assert.equal(mixedBand.count, 2);
  assert.equal(mixedBand.coverage_pct, 100);
  assert.equal(mixedBand.avg_price_per_kwh, 0.6);
  assert.equal(mixedBand.avg_soc_delta, 20);

  assert.equal(payload.highlights.best_efficiency_window.key, "10-20");
  assert.equal(payload.highlights.cheapest_window.key, "10-20");
  assert.equal(payload.highlights.fastest_window.key, "10-20");
  assert.equal(payload.highlights.widest_window.key, "10-20");
});
