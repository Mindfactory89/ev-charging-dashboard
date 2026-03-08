/**
 * Browser-Client
 * UI:  http://<host>:<ui-port>
 * API: http://<host>:18800
 */

const qs = new URLSearchParams(window.location.search);
const demoByQuery = qs.get("demo") === "1";
const ENV_DEMO_HOST_PREFIX = String(import.meta.env.VITE_DEMO_HOST_PREFIX || "")
  .trim()
  .toLowerCase();
const demoByHost =
  !!ENV_DEMO_HOST_PREFIX && window.location.hostname.toLowerCase().startsWith(ENV_DEMO_HOST_PREFIX);
export const isDemoMode = demoByQuery || demoByHost;

const ENV_API_BASE = (import.meta.env.VITE_API_BASE || "").trim();

export function getApiBase() {
  if (ENV_API_BASE) return ENV_API_BASE.replace(/\/+$/, "");
  return `${window.location.protocol}//${window.location.hostname}:18800`;
}
export const API_BASE = getApiBase();

async function asJson(r) {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `${r.status} ${r.statusText}`);
  return data;
}

const DEMO_MAX_ROWS = 20;
const DEMO_MIN_SEED_ROWS = 10;
const DEMO_MAX_SEED_ROWS = 15;

function rand(min, max) {
  return Math.random() * (max - min) + min;
}
function randi(min, max) {
  return Math.floor(rand(min, max + 1));
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
function isoDate(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseDateParts(value) {
  const raw = String(value ?? "").trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    return {
      year: Number(m[1]),
      month: Number(m[2]),
      day: Number(m[3]),
      iso: `${m[1]}-${m[2]}-${m[3]}`,
      valid: true,
    };
  }

  const dt = raw ? new Date(raw) : null;
  if (!dt || Number.isNaN(dt.getTime())) return null;

  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
    iso: dt.toISOString().slice(0, 10),
    valid: true,
  };
}
function safeUUID() {
  try {
    return crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  } catch {
    return `${Date.now()}-${Math.random()}`;
  }
}
function round(n, d = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  const f = 10 ** d;
  return Math.round(v * f) / f;
}
function median(values) {
  const clean = (values || [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  if (clean.length % 2 === 1) return clean[mid];
  return (clean[mid - 1] + clean[mid]) / 2;
}
function clamp(n, min, max) {
  return Math.min(max, Math.max(min, Number(n) || 0));
}
function monthToSeason(month) {
  if ([12, 1, 2].includes(month)) return "winter";
  if ([3, 4, 5].includes(month)) return "spring";
  if ([6, 7, 8].includes(month)) return "summer";
  return "autumn";
}

const SEASON_META = {
  winter: { key: "winter", label: "Winter", months: [12, 1, 2] },
  spring: { key: "spring", label: "Frühling", months: [3, 4, 5] },
  summer: { key: "summer", label: "Sommer", months: [6, 7, 8] },
  autumn: { key: "autumn", label: "Herbst", months: [9, 10, 11] },
};

const DEMO_SESSION_TEMPLATES = [
  {
    month: 1,
    provider: "Ionity",
    location: "A7 Raststätte Holmmoor West",
    connector: "CCS - DC",
    energyMin: 32,
    energyMax: 46,
    priceMin: 0.65,
    priceMax: 0.69,
    priceAnchors: [0.66, 0.69],
    durationMin: 26,
    durationMax: 34,
    socStartMin: 10,
    socStartMax: 22,
    socEndMin: 78,
    socEndMax: 88,
    note: "Autobahn-Stopp auf längerer Strecke",
  },
  {
    month: 2,
    provider: "Aral Pulse",
    location: "Bochum Innenstadt Parkhaus",
    connector: "CCS AC",
    energyMin: 7,
    energyMax: 13,
    priceMin: 0.54,
    priceMax: 0.59,
    priceAnchors: [0.54, 0.59],
    durationMin: 85,
    durationMax: 135,
    socStartMin: 54,
    socStartMax: 68,
    socEndMin: 76,
    socEndMax: 86,
    note: "Laden während Termin in der Innenstadt",
  },
  {
    month: 3,
    provider: "EnBW",
    location: "Autohof Rhynern",
    connector: "CCS - DC",
    energyMin: 26,
    energyMax: 38,
    priceMin: 0.56,
    priceMax: 0.62,
    priceAnchors: [0.56, 0.59],
    durationMin: 21,
    durationMax: 29,
    socStartMin: 18,
    socStartMax: 32,
    socEndMin: 70,
    socEndMax: 82,
    note: "Zwischenladung auf Wochenendtrip",
  },
  {
    month: 4,
    provider: "Ionity",
    location: "Hilden A3/A46",
    connector: "CCS - DC",
    energyMin: 36,
    energyMax: 50,
    priceMin: 0.65,
    priceMax: 0.69,
    priceAnchors: [0.66, 0.69],
    durationMin: 28,
    durationMax: 37,
    socStartMin: 8,
    socStartMax: 18,
    socEndMin: 82,
    socEndMax: 90,
    note: "Längere Autobahnetappe",
  },
  {
    month: 5,
    provider: "Stadtwerke Aachen",
    location: "Parkhaus Büchel",
    connector: "CCS AC",
    energyMin: 8,
    energyMax: 14,
    priceMin: 0.49,
    priceMax: 0.56,
    priceAnchors: [0.49, 0.55],
    durationMin: 95,
    durationMax: 155,
    socStartMin: 42,
    socStartMax: 58,
    socEndMin: 72,
    socEndMax: 84,
    note: "AC-Laden während Innenstadtbesuch",
  },
  {
    month: 6,
    provider: "Aldi Süd",
    location: "Köln Marsdorf",
    connector: "CCS - DC",
    energyMin: 20,
    energyMax: 32,
    priceMin: 0.49,
    priceMax: 0.59,
    priceAnchors: [0.49, 0.55, 0.59],
    durationMin: 16,
    durationMax: 25,
    socStartMin: 20,
    socStartMax: 34,
    socEndMin: 72,
    socEndMax: 82,
    note: "Günstiger Lade-Stopp beim Einkauf",
  },
  {
    month: 7,
    provider: "Aral Pulse",
    location: "Kassel Ost A7",
    connector: "CCS - DC",
    energyMin: 36,
    energyMax: 50,
    priceMin: 0.69,
    priceMax: 0.79,
    priceAnchors: [0.69, 0.79],
    durationMin: 29,
    durationMax: 38,
    socStartMin: 6,
    socStartMax: 15,
    socEndMin: 84,
    socEndMax: 92,
    note: "Ferienfahrt mit hoher Sommerauslastung",
  },
  {
    month: 8,
    provider: "EWE Go",
    location: "Bremen Waterfront",
    connector: "CCS AC",
    energyMin: 6,
    energyMax: 11,
    priceMin: 0.49,
    priceMax: 0.55,
    priceAnchors: [0.49, 0.55],
    durationMin: 90,
    durationMax: 140,
    socStartMin: 60,
    socStartMax: 74,
    socEndMin: 78,
    socEndMax: 88,
    note: "Nebenbei geladen während Restaurantbesuch",
  },
  {
    month: 9,
    provider: "EnBW",
    location: "Limburg Süd",
    connector: "CCS - DC",
    energyMin: 20,
    energyMax: 31,
    priceMin: 0.56,
    priceMax: 0.62,
    priceAnchors: [0.56, 0.59],
    durationMin: 18,
    durationMax: 26,
    socStartMin: 24,
    socStartMax: 36,
    socEndMin: 68,
    socEndMax: 78,
    note: "Kurzer Business-Trip",
  },
  {
    month: 10,
    provider: "Ionity",
    location: "Brohltal Ost",
    connector: "CCS - DC",
    energyMin: 30,
    energyMax: 44,
    priceMin: 0.65,
    priceMax: 0.69,
    priceAnchors: [0.66, 0.69],
    durationMin: 24,
    durationMax: 33,
    socStartMin: 12,
    socStartMax: 22,
    socEndMin: 78,
    socEndMax: 86,
    note: "Rückreise am Wochenende",
  },
  {
    month: 11,
    provider: "EnBW",
    location: "Duisburg Hauptbahnhof",
    connector: "CCS - DC",
    energyMin: 26,
    energyMax: 39,
    priceMin: 0.56,
    priceMax: 0.63,
    priceAnchors: [0.56, 0.59],
    durationMin: 23,
    durationMax: 32,
    socStartMin: 18,
    socStartMax: 30,
    socEndMin: 72,
    socEndMax: 82,
    note: "Kälterer Tag mit leicht reduzierter Ladeleistung",
  },
  {
    month: 12,
    provider: "Stadtwerke Münster",
    location: "Hotelparkplatz Münster",
    connector: "CCS AC",
    energyMin: 7,
    energyMax: 13,
    priceMin: 0.49,
    priceMax: 0.55,
    priceAnchors: [0.49, 0.55],
    durationMin: 95,
    durationMax: 150,
    socStartMin: 50,
    socStartMax: 64,
    socEndMin: 80,
    socEndMax: 88,
    note: "Übernachtungsladung vor der Heimfahrt",
  },
  {
    month: 2,
    provider: "Tesla Supercharger",
    location: "Lutterberg A7",
    connector: "CCS - DC",
    energyMin: 18,
    energyMax: 29,
    priceMin: 0.52,
    priceMax: 0.59,
    priceAnchors: [0.55, 0.59],
    durationMin: 15,
    durationMax: 22,
    socStartMin: 28,
    socStartMax: 40,
    socEndMin: 66,
    socEndMax: 78,
    note: "Kurzer HPC-Top-up auf Rückfahrt",
  },
  {
    month: 6,
    provider: "Fastned",
    location: "Mönchengladbach Nord",
    connector: "CCS - DC",
    energyMin: 16,
    energyMax: 25,
    priceMin: 0.64,
    priceMax: 0.73,
    priceAnchors: [0.69, 0.73],
    durationMin: 14,
    durationMax: 21,
    socStartMin: 38,
    socStartMax: 50,
    socEndMin: 68,
    socEndMax: 80,
    note: "Kurze Nachladung vor Weiterfahrt",
  },
  {
    month: 9,
    provider: "TankE",
    location: "Köln Rheinauhafen",
    connector: "CCS AC",
    energyMin: 7,
    energyMax: 12,
    priceMin: 0.49,
    priceMax: 0.56,
    priceAnchors: [0.49, 0.55],
    durationMin: 90,
    durationMax: 145,
    socStartMin: 58,
    socStartMax: 70,
    socEndMin: 78,
    socEndMax: 88,
    note: "AC-Laden während Abendtermin",
  },
  {
    month: 11,
    provider: "Allego",
    location: "Dortmund Flughafen",
    connector: "CCS - DC",
    energyMin: 22,
    energyMax: 34,
    priceMin: 0.69,
    priceMax: 0.75,
    priceAnchors: [0.69, 0.73],
    durationMin: 20,
    durationMax: 29,
    socStartMin: 20,
    socStartMax: 34,
    socEndMin: 68,
    socEndMax: 81,
    note: "Ladestopp vor spätem Heimweg",
  },
];

function jitter(value, delta, digits = 1) {
  return round(value + rand(-delta, delta), digits);
}

function pickRandomDay(month) {
  return month === 2 ? randi(1, 27) : randi(1, 28);
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randi(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildDemoSessionFromTemplate(template, year, idx) {
  const baseEnergy = round(rand(template.energyMin, template.energyMax), 1);
  const pricePerKwh =
    Array.isArray(template.priceAnchors) && template.priceAnchors.length && Math.random() < 0.58
      ? Number(template.priceAnchors[randi(0, template.priceAnchors.length - 1)].toFixed(3))
      : round(rand(template.priceMin, template.priceMax), 3);
  const durationMinutes = randi(template.durationMin, template.durationMax);
  const socStart = randi(template.socStartMin, template.socStartMax);
  const socEnd = Math.max(socStart + 8, randi(template.socEndMin, template.socEndMax));
  const seasonalJitter = template.connector === "CCS AC" ? 0.4 : 0.8;
  const energy = round(clamp(jitter(baseEnergy, seasonalJitter, 1), template.energyMin, template.energyMax), 1);

  return {
    id: `demo-seed-${year}-${String(idx + 1).padStart(2, "0")}`,
    date: isoDate(year, template.month, pickRandomDay(template.month)),
    energy_kwh: energy,
    total_cost: Number((energy * pricePerKwh).toFixed(2)),
    duration_seconds: durationMinutes * 60,
    price_per_kwh: pricePerKwh,
    provider: template.provider,
    location: template.location,
    connector: template.connector,
    soc_start: socStart,
    soc_end: Math.min(100, socEnd),
    note: template.note || null,
  };
}

function seedDemoSessions(year = 2026, maxRows = DEMO_MAX_SEED_ROWS) {
  const cappedMax = clamp(maxRows, 0, DEMO_MAX_SEED_ROWS);
  const count =
    cappedMax <= 0 ? 0 : cappedMax < DEMO_MIN_SEED_ROWS ? cappedMax : randi(DEMO_MIN_SEED_ROWS, cappedMax);
  const selectedTemplates = shuffle(DEMO_SESSION_TEMPLATES).slice(0, count);
  const rows = selectedTemplates.map((template, idx) => buildDemoSessionFromTemplate(template, year, idx));
  rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return rows;
}

const DEMO_DEFAULT_YEAR = 2026;
const DEMO_BY_YEAR = Object.create(null);

function getDemoTotalRowCount() {
  return Object.values(DEMO_BY_YEAR).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
}

function getDemoYearRows(year) {
  const y = Number(year) || DEMO_DEFAULT_YEAR;
  if (!Object.prototype.hasOwnProperty.call(DEMO_BY_YEAR, y)) {
    const remainingBudget = Math.max(0, DEMO_MAX_ROWS - getDemoTotalRowCount());
    DEMO_BY_YEAR[y] = y === DEMO_DEFAULT_YEAR ? seedDemoSessions(y, remainingBudget) : [];
  }
  return DEMO_BY_YEAR[y];
}

function filterByYear(rows, year) {
  const y = Number(year) || 2026;
  return (rows || []).filter((s) => {
    const parts = parseDateParts(s?.date);
    return parts?.valid && parts.year === y;
  });
}

function buildDerived(row) {
  const energy = Number(row?.energy_kwh || 0);
  const cost = Number(row?.total_cost || 0);
  const duration = Number(row?.duration_seconds || 0);
  const avgPower = duration > 0 ? energy / (duration / 3600) : 0;
  const pricePerKwh = energy > 0 ? cost / energy : Number(row?.price_per_kwh || 0);
  const minutesPerKwh = energy > 0 && duration > 0 ? (duration / 60) / energy : 0;

  return {
    energy_kwh: energy,
    total_cost: cost,
    duration_seconds: duration,
    avg_power_kw: avgPower,
    price_per_kwh: pricePerKwh,
    minutes_per_kwh: minutesPerKwh,
  };
}

function computeStatsFromSessions(rows, year) {
  const r = filterByYear(rows, year);
  const total_energy_kwh = r.reduce((sum, s) => sum + (Number(s.energy_kwh) || 0), 0);
  const total_cost = r.reduce((sum, s) => sum + (Number(s.total_cost) || 0), 0);
  const timedSessions = r.filter((session) => Number(session?.duration_seconds) > 0);
  const total_dur = timedSessions.reduce((sum, session) => sum + (Number(session.duration_seconds) || 0), 0);
  const total_timed_energy_kwh = timedSessions.reduce((sum, session) => sum + (Number(session.energy_kwh) || 0), 0);
  const n = r.length || 0;
  const avg_kwh_per_session = n ? total_energy_kwh / n : 0;
  const avg_duration_seconds = timedSessions.length ? total_dur / timedSessions.length : 0;
  const avg_price_per_charge = n ? total_cost / n : 0;
  const avg_power_kw = total_dur > 0 ? total_timed_energy_kwh / (total_dur / 3600) : 0;
  const avg_price_per_kwh = total_energy_kwh > 0 ? total_cost / total_energy_kwh : 0;
  const prices = r
    .map((session) => buildDerived(session).price_per_kwh)
    .filter((value) => Number.isFinite(value) && value > 0);
  const powers = r
    .map((session) => buildDerived(session).avg_power_kw)
    .filter((value) => Number.isFinite(value) && value > 0);
  const energies = r.map((session) => Number(session.energy_kwh)).filter((value) => Number.isFinite(value) && value > 0);
  const costs = r.map((session) => Number(session.total_cost)).filter((value) => Number.isFinite(value) && value >= 0);
  const durations = r
    .map((session) => Number(session.duration_seconds))
    .filter((value) => Number.isFinite(value) && value > 0);

  const most_expensive = r.reduce(
    (best, s) => ((Number(s.total_cost) || 0) > (Number(best?.total_cost) || -1) ? s : best),
    null
  );
  const longest = r.reduce(
    (best, s) => ((Number(s.duration_seconds) || 0) > (Number(best?.duration_seconds) || -1) ? s : best),
    null
  );

  return {
    ok: true,
    year: Number(year) || 2026,
    count: n,
    total_cost: round(total_cost, 2),
    total_energy_kwh: round(total_energy_kwh, 3),
    avg_kwh_per_session: round(avg_kwh_per_session, 2),
    avg_duration_seconds: Math.round(avg_duration_seconds),
    avg_price_per_charge: round(avg_price_per_charge, 2),
    avg_price_per_kwh: round(avg_price_per_kwh, 3),
    avg_power_kw: round(avg_power_kw, 1),
    medians: {
      energy_kwh: median(energies) != null ? round(median(energies), 1) : null,
      cost_per_session: median(costs) != null ? round(median(costs), 2) : null,
      duration_seconds: median(durations) != null ? Math.round(median(durations)) : null,
      price_per_kwh: median(prices) != null ? round(median(prices), 3) : null,
      power_kw: median(powers) != null ? round(median(powers), 1) : null,
    },
    most_expensive: most_expensive ? { date: most_expensive.date, total_cost: most_expensive.total_cost } : null,
    longest: longest ? { date: longest.date, duration_seconds: longest.duration_seconds } : null,
  };
}

function computeMonthlyFromSessions(rows, year) {
  const r = filterByYear(rows, year);
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: 0, energy_kwh: 0, cost: 0 }));

  for (const s of r) {
    const parts = parseDateParts(s.date);
    if (!parts?.valid) continue;
    const idx = parts.month - 1;
    const e = Number(s.energy_kwh) || 0;
    const c = Number(s.total_cost) || 0;
    months[idx].count += 1;
    months[idx].energy_kwh += e;
    months[idx].cost += c;
  }

  const base = months.map((m) => {
    const energy = round(m.energy_kwh, 3);
    const cost = round(m.cost, 2);
    return {
      month: m.month,
      count: m.count,
      energy_kwh: energy,
      cost,
      avg_price_per_charge: m.count ? round(cost / m.count, 2) : 0,
      price_per_kwh: energy > 0 ? round(cost / energy, 3) : 0,
    };
  });

  function mkTrend(cur, prev) {
    const c = Number(cur);
    const p = Number(prev);
    if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null;
    return { delta: round(c - p, 3), pct: round((c - p) / p, 4) };
  }

  const monthsWithTrend = base.map((m, idx) => {
    const prev = idx > 0 ? base[idx - 1] : null;
    return {
      ...m,
      trend: {
        energy: prev ? mkTrend(m.energy_kwh, prev.energy_kwh) : null,
        cost: prev ? mkTrend(m.cost, prev.cost) : null,
        price_per_kwh: prev ? mkTrend(m.price_per_kwh, prev.price_per_kwh) : null,
      },
    };
  });

  const top_energy_month = monthsWithTrend.reduce(
    (best, m) => (m.energy_kwh > (best?.energy_kwh ?? -1) ? m : best),
    null
  );
  const top_cost_month = monthsWithTrend.reduce((best, m) => (m.cost > (best?.cost ?? -1) ? m : best), null);

  return {
    ok: true,
    year: Number(year) || 2026,
    months: monthsWithTrend,
    top_energy_month: top_energy_month ? { month: top_energy_month.month, energy_kwh: top_energy_month.energy_kwh } : null,
    top_cost_month: top_cost_month ? { month: top_cost_month.month, cost: top_cost_month.cost } : null,
  };
}

function buildEfficiencyFramework(rows, year) {
  const r = filterByYear(rows, year);
  const enriched = r.map((row) => ({ ...row, _derived: buildDerived(row) }));

  const priceValues = enriched.map((s) => s._derived.price_per_kwh).filter((n) => Number.isFinite(n) && n > 0);
  const powerValues = enriched.map((s) => s._derived.avg_power_kw).filter((n) => Number.isFinite(n) && n > 0);
  const mpkValues = enriched.map((s) => s._derived.minutes_per_kwh).filter((n) => Number.isFinite(n) && n > 0);

  const priceMin = priceValues.length ? Math.min(...priceValues) : 0;
  const priceMax = priceValues.length ? Math.max(...priceValues) : 0;
  const powerMin = powerValues.length ? Math.min(...powerValues) : 0;
  const powerMax = powerValues.length ? Math.max(...powerValues) : 0;
  const mpkMin = mpkValues.length ? Math.min(...mpkValues) : 0;
  const mpkMax = mpkValues.length ? Math.max(...mpkValues) : 0;

  function normLowGood(value, min, max) {
    if (!Number.isFinite(value)) return 50;
    if (max <= min) return 50;
    return clamp(((max - value) / (max - min)) * 100, 0, 100);
  }
  function normHighGood(value, min, max) {
    if (!Number.isFinite(value)) return 50;
    if (max <= min) return 50;
    return clamp(((value - min) / (max - min)) * 100, 0, 100);
  }

  function scoreRow(row) {
    const d = row._derived;
    const priceScore = normLowGood(d.price_per_kwh, priceMin, priceMax);
    const powerScore = d.avg_power_kw > 0 ? normHighGood(d.avg_power_kw, powerMin, powerMax) : 35;
    const speedScore = d.minutes_per_kwh > 0 ? normLowGood(d.minutes_per_kwh, mpkMin, mpkMax) : 35;
    const score = priceScore * 0.55 + powerScore * 0.25 + speedScore * 0.2;

    return {
      session_id: row.id,
      date: row.date,
      connector: row.connector,
      energy_kwh: round(d.energy_kwh, 1),
      total_cost: round(d.total_cost, 2),
      duration_seconds: d.duration_seconds || null,
      avg_power_kw: d.avg_power_kw > 0 ? round(d.avg_power_kw, 1) : null,
      price_per_kwh: d.price_per_kwh > 0 ? round(d.price_per_kwh, 3) : null,
      score: round(score, 1),
      breakdown: {
        price_score: round(priceScore, 1),
        power_score: round(powerScore, 1),
        speed_score: round(speedScore, 1),
      },
    };
  }

  return {
    rows: enriched,
    scoreRow,
    baseline: {
      price_min: round(priceMin, 3),
      price_max: round(priceMax, 3),
      power_min_kw: round(powerMin, 1),
      power_max_kw: round(powerMax, 1),
      minutes_per_kwh_min: round(mpkMin, 2),
      minutes_per_kwh_max: round(mpkMax, 2),
    },
  };
}

function computeSeasonAnalytics(rows, year) {
  const fw = buildEfficiencyFramework(rows, year);
  const buckets = { winter: [], spring: [], summer: [], autumn: [] };

  for (const row of fw.rows) {
    const parts = parseDateParts(row.date);
    if (!parts?.valid) continue;
    buckets[monthToSeason(parts.month)].push(row);
  }

  const seasons = Object.values(SEASON_META).map((meta) => {
    const list = buckets[meta.key] || [];
    const totalEnergy = list.reduce((a, s) => a + Number(s.energy_kwh || 0), 0);
    const totalCost = list.reduce((a, s) => a + Number(s.total_cost || 0), 0);
    const timedSessions = list.filter((session) => Number(session?.duration_seconds) > 0);
    const durations = timedSessions.map((s) => Number(s.duration_seconds || 0)).filter((n) => Number.isFinite(n) && n > 0);
    const scored = list.map((s) => fw.scoreRow(s));
    const totalDuration = durations.reduce((a, n) => a + n, 0);
    const totalTimedEnergy = timedSessions.reduce((sum, session) => sum + Number(session.energy_kwh || 0), 0);

    return {
      key: meta.key,
      label: meta.label,
      months: meta.months,
      count: list.length,
      energy_kwh: round(totalEnergy, 3),
      cost: round(totalCost, 2),
      avg_duration_seconds: durations.length ? Math.round(totalDuration / durations.length) : 0,
      avg_kwh_per_session: list.length ? round(totalEnergy / list.length, 2) : 0,
      avg_cost_per_session: list.length ? round(totalCost / list.length, 2) : 0,
      avg_price_per_kwh: totalEnergy > 0 ? round(totalCost / totalEnergy, 3) : null,
      avg_power_kw: totalDuration > 0 ? round(totalTimedEnergy / (totalDuration / 3600), 1) : null,
      efficiency_score: scored.length ? round(scored.reduce((a, s) => a + Number(s.score || 0), 0) / scored.length, 1) : null,
      best_session: scored.reduce((best, s) => (!best || s.score > best.score ? s : best), null),
      worst_session: scored.reduce((best, s) => (!best || s.score < best.score ? s : best), null),
    };
  });

  const active = seasons.filter((s) => s.count > 0);
  const best_efficiency_season = active.reduce((best, s) => (!best || (s.efficiency_score || -1) > (best.efficiency_score || -1) ? s : best), null);
  const cheapest_season = active.reduce((best, s) => {
    const cur = Number(s.avg_price_per_kwh ?? Infinity);
    const old = Number(best?.avg_price_per_kwh ?? Infinity);
    return cur < old ? s : best;
  }, null);

  return {
    ok: true,
    year: Number(year) || 2026,
    seasons,
    highlights: { best_efficiency_season, cheapest_season },
    baseline: fw.baseline,
  };
}

function computeEfficiencyFromSessions(rows, year) {
  const fw = buildEfficiencyFramework(rows, year);
  const scored = fw.rows.map((r) => fw.scoreRow(r));
  const validPrice = scored.filter((s) => s.price_per_kwh != null);
  const validPower = scored.filter((s) => s.avg_power_kw != null);
  const overall = scored.length ? round(scored.reduce((a, s) => a + Number(s.score || 0), 0) / scored.length, 1) : null;

  return {
    ok: true,
    year: Number(year) || 2026,
    overall_score: overall,
    score_label: overall == null ? "Keine Daten" : overall >= 80 ? "Sehr effizient" : overall >= 65 ? "Effizient" : overall >= 50 ? "Solide" : "Optimierungspotenzial",
    session_count: scored.length,
    averages: {
      price_per_kwh: validPrice.length ? round(validPrice.reduce((a, s) => a + Number(s.price_per_kwh || 0), 0) / validPrice.length, 3) : null,
      power_kw: validPower.length ? round(validPower.reduce((a, s) => a + Number(s.avg_power_kw || 0), 0) / validPower.length, 1) : null,
    },
    best_session: scored.reduce((best, s) => (!best || s.score > best.score ? s : best), null),
    worst_session: scored.reduce((best, s) => (!best || s.score < best.score ? s : best), null),
    cheapest_session: scored.reduce((best, s) => {
      const cur = Number(s.price_per_kwh ?? Infinity);
      const old = Number(best?.price_per_kwh ?? Infinity);
      return cur < old ? s : best;
    }, null),
    fastest_session: scored.reduce((best, s) => {
      const cur = Number(s.avg_power_kw ?? -1);
      const old = Number(best?.avg_power_kw ?? -1);
      return cur > old ? s : best;
    }, null),
    baseline: fw.baseline,
    weights: {
      price_score: 0.55,
      power_score: 0.25,
      speed_score: 0.2,
    },
    sessions: scored,
  };
}

const SOC_BUCKET_SIZE = 10;

function getSocBucketMeta(start) {
  const bucketStart = clamp(Math.floor(Number(start) / SOC_BUCKET_SIZE) * SOC_BUCKET_SIZE, 0, 100 - SOC_BUCKET_SIZE);
  const bucketEnd = Math.min(100, bucketStart + SOC_BUCKET_SIZE);
  return {
    key: `${bucketStart}-${bucketEnd}`,
    label: `${bucketStart}-${bucketEnd}%`,
    start: bucketStart,
    end: bucketEnd,
  };
}

function getSocWindowMeta(socStart, socEnd) {
  const start = Number(socStart);
  const end = Number(socEnd);

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || start > 100 || end < 0 || end > 100 || end <= start) return null;

  const bucketStart = clamp(Math.floor(start / SOC_BUCKET_SIZE) * SOC_BUCKET_SIZE, 0, 100 - SOC_BUCKET_SIZE);
  let bucketEnd = clamp(Math.ceil(end / SOC_BUCKET_SIZE) * SOC_BUCKET_SIZE, SOC_BUCKET_SIZE, 100);

  if (bucketEnd <= bucketStart) {
    bucketEnd = Math.min(100, bucketStart + SOC_BUCKET_SIZE);
  }

  return {
    key: `${bucketStart}-${bucketEnd}`,
    label: `${bucketStart}-${bucketEnd}%`,
    start: bucketStart,
    end: bucketEnd,
  };
}

function getSocBandSlices(socStart, socEnd) {
  const start = Number(socStart);
  const end = Number(socEnd);

  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];

  const clampedStart = clamp(start, 0, 100);
  const clampedEnd = clamp(end, 0, 100);
  const totalDelta = clampedEnd - clampedStart;
  if (totalDelta <= 0) return [];

  const firstBandStart = clamp(Math.floor(clampedStart / SOC_BUCKET_SIZE) * SOC_BUCKET_SIZE, 0, 100 - SOC_BUCKET_SIZE);
  const slices = [];

  for (let bandStart = firstBandStart; bandStart < clampedEnd; bandStart += SOC_BUCKET_SIZE) {
    const meta = getSocBucketMeta(bandStart);
    const overlapStart = Math.max(clampedStart, meta.start);
    const overlapEnd = Math.min(clampedEnd, meta.end);
    const overlap = overlapEnd - overlapStart;
    if (overlap <= 0) continue;

    slices.push({
      ...meta,
      overlap_pct: round(overlap, 1),
      weight: overlap / totalDelta,
    });
  }

  return slices;
}

function createSocAggregate(meta) {
  return {
    ...meta,
    count: 0,
    total_weight: 0,
    total_score: 0,
    score_weight: 0,
    total_price_per_kwh: 0,
    price_weight: 0,
    total_power_kw: 0,
    power_weight: 0,
    total_duration_seconds: 0,
    duration_weight: 0,
    total_energy_kwh: 0,
    energy_weight: 0,
    total_soc_delta: 0,
    soc_delta_weight: 0,
    best_session: null,
    worst_session: null,
  };
}

function accumulateSocAggregate(target, scored, row, options = {}) {
  const { weight = 1, countWeight = 1 } = options;
  const socDelta = Math.max(0, Number(row?.soc_end || 0) - Number(row?.soc_start || 0));
  const scoreValue = Number(scored.score);
  const priceValue = Number(scored.price_per_kwh);
  const powerValue = Number(scored.avg_power_kw);
  const durationValue = Number(scored.duration_seconds);
  const energyValue = Number(scored.energy_kwh);

  target.count += countWeight;
  target.total_weight += weight;

  if (Number.isFinite(scoreValue)) {
    target.total_score += scoreValue * weight;
    target.score_weight += weight;
  }
  if (Number.isFinite(priceValue) && priceValue > 0) {
    target.total_price_per_kwh += priceValue * weight;
    target.price_weight += weight;
  }
  if (Number.isFinite(powerValue) && powerValue > 0) {
    target.total_power_kw += powerValue * weight;
    target.power_weight += weight;
  }
  if (Number.isFinite(durationValue) && durationValue > 0) {
    target.total_duration_seconds += durationValue * weight;
    target.duration_weight += weight;
  }
  if (Number.isFinite(energyValue) && energyValue > 0) {
    target.total_energy_kwh += energyValue * weight;
    target.energy_weight += weight;
  }
  if (Number.isFinite(socDelta) && socDelta > 0) {
    target.total_soc_delta += socDelta * countWeight;
    target.soc_delta_weight += countWeight;
  }

  const sessionSnapshot = { ...scored, soc_start: Number(row.soc_start), soc_end: Number(row.soc_end) };
  target.best_session =
    !target.best_session || Number(scored.score || 0) > Number(target.best_session.score || -1) ? sessionSnapshot : target.best_session;
  target.worst_session =
    !target.worst_session || Number(scored.score || 0) < Number(target.worst_session.score || Infinity) ? sessionSnapshot : target.worst_session;
}

function finalizeSocAggregates(collection, analyzedSessionCount) {
  return Array.from(collection.values())
    .map((entry) => ({
      key: entry.key,
      label: entry.label,
      start: entry.start,
      end: entry.end,
      count: Math.round(entry.count),
      coverage_pct: analyzedSessionCount > 0 ? round((entry.count / analyzedSessionCount) * 100, 1) : 0,
      share_pct: analyzedSessionCount > 0 ? round((entry.count / analyzedSessionCount) * 100, 1) : 0,
      avg_score: entry.score_weight ? round(entry.total_score / entry.score_weight, 1) : null,
      avg_price_per_kwh: entry.price_weight ? round(entry.total_price_per_kwh / entry.price_weight, 3) : null,
      avg_power_kw: entry.power_weight ? round(entry.total_power_kw / entry.power_weight, 1) : null,
      avg_duration_seconds: entry.duration_weight ? Math.round(entry.total_duration_seconds / entry.duration_weight) : 0,
      avg_energy_kwh: entry.energy_weight ? round(entry.total_energy_kwh / entry.energy_weight, 1) : null,
      avg_soc_delta: entry.soc_delta_weight ? round(entry.total_soc_delta / entry.soc_delta_weight, 1) : null,
      best_session: entry.best_session,
      worst_session: entry.worst_session,
    }))
    .sort((left, right) => {
      if (Number(left.start || 0) !== Number(right.start || 0)) {
        return Number(left.start || 0) - Number(right.start || 0);
      }
      return Number(left.end || 0) - Number(right.end || 0);
    });
}

export function computeSocWindowAnalysis(rows, year = 2026) {
  const fw = buildEfficiencyFramework(rows, year);
  const byWindow = new Map();
  const byBand = new Map();
  let analyzedSessionCount = 0;

  for (const row of fw.rows) {
    const windowMeta = getSocWindowMeta(row?.soc_start, row?.soc_end);
    if (!windowMeta) continue;
    analyzedSessionCount += 1;

    const scored = fw.scoreRow(row);
    const windowBucket = byWindow.get(windowMeta.key) || createSocAggregate(windowMeta);
    accumulateSocAggregate(windowBucket, scored, row, { weight: 1, countWeight: 1 });
    byWindow.set(windowMeta.key, windowBucket);

    const bandSlices = getSocBandSlices(row?.soc_start, row?.soc_end);
    for (const bandMeta of bandSlices) {
      const bandBucket = byBand.get(bandMeta.key) || createSocAggregate(bandMeta);
      accumulateSocAggregate(bandBucket, scored, row, { weight: bandMeta.weight, countWeight: 1 });
      byBand.set(bandMeta.key, bandBucket);
    }
  }

  const analyzed_session_count = analyzedSessionCount;
  const windows = finalizeSocAggregates(byWindow, analyzed_session_count);
  const bands = finalizeSocAggregates(byBand, analyzed_session_count);
  const highlightPool = bands.length ? bands : windows;

  const highlights = {
    best_efficiency_window: highlightPool.reduce((best, window) => {
      if (!best) return window;
      return Number(window.avg_score || -1) > Number(best.avg_score || -1) ? window : best;
    }, null),
    cheapest_window: highlightPool.reduce((best, window) => {
      if (!best) return window;
      return Number(window.avg_price_per_kwh ?? Infinity) < Number(best.avg_price_per_kwh ?? Infinity) ? window : best;
    }, null),
    fastest_window: highlightPool.reduce((best, window) => {
      if (!best) return window;
      return Number(window.avg_power_kw || -1) > Number(best.avg_power_kw || -1) ? window : best;
    }, null),
    widest_window: highlightPool.reduce((best, window) => {
      if (!best) return window;
      return Number(window.avg_soc_delta || -1) > Number(best.avg_soc_delta || -1) ? window : best;
    }, null),
  };

  return {
    ok: true,
    year: Number(year) || 2026,
    analyzed_session_count,
    windows,
    bands,
    highlights,
  };
}

function quantileSorted(sortedValues, q) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) return null;
  const pos = (sortedValues.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const lower = sortedValues[base];
  const upper = sortedValues[Math.min(base + 1, sortedValues.length - 1)];
  return lower + (upper - lower) * rest;
}

function buildOutlierBaseline(values, direction, fallbackMultiplier, digits = 2) {
  const clean = values
    .filter((n) => n != null && n !== "")
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  if (!clean.length) {
    return {
      sample_count: 0,
      median: null,
      q1: null,
      q3: null,
      iqr: null,
      threshold: null,
      method: "none",
      direction,
    };
  }

  const median = quantileSorted(clean, 0.5);
  const q1 = quantileSorted(clean, 0.25);
  const q3 = quantileSorted(clean, 0.75);
  const iqr = q1 != null && q3 != null ? q3 - q1 : 0;
  const canUseIqr = clean.length >= 5 && Number.isFinite(iqr) && iqr > 0;

  let threshold = null;
  let method = "median";

  if (direction === "high") {
    threshold = canUseIqr ? q3 + iqr * 1.5 : median > 0 ? median * fallbackMultiplier : null;
    method = canUseIqr ? "iqr" : "median";
  } else {
    threshold = canUseIqr ? q1 - iqr * 1.5 : median > 0 ? median * fallbackMultiplier : null;
    method = canUseIqr ? "iqr" : "median";
  }

  return {
    sample_count: clean.length,
    median: median != null ? round(median, digits) : null,
    q1: q1 != null ? round(q1, digits) : null,
    q3: q3 != null ? round(q3, digits) : null,
    iqr: iqr != null ? round(iqr, digits) : null,
    threshold: threshold != null ? round(threshold, digits) : null,
    method,
    direction,
  };
}

export function computeOutlierAnalytics(rows, year = 2026) {
  const fw = buildEfficiencyFramework(rows, year);
  const scored = fw.rows.map((row) => {
    const scoredRow = fw.scoreRow(row);
    return {
      ...scoredRow,
      minutes_per_kwh: row._derived.minutes_per_kwh > 0 ? round(row._derived.minutes_per_kwh, 2) : null,
      soc_delta:
        Number.isFinite(row?.soc_start) && Number.isFinite(row?.soc_end) && Number(row.soc_end) > Number(row.soc_start)
          ? round(Number(row.soc_end) - Number(row.soc_start), 1)
          : null,
    };
  });

  const rules = [
    {
      key: "price_per_kwh",
      label: "Hoher Preis",
      direction: "high",
      digits: 3,
      fallbackMultiplier: 1.18,
      weight: 1.8,
      read: (session) => session.price_per_kwh,
    },
    {
      key: "avg_power_kw",
      label: "Schwache Ladeleistung",
      direction: "low",
      digits: 1,
      fallbackMultiplier: 0.78,
      weight: 1.4,
      read: (session) => session.avg_power_kw,
    },
    {
      key: "duration_seconds",
      label: "Lange Dauer",
      direction: "high",
      digits: 0,
      fallbackMultiplier: 1.3,
      weight: 1.1,
      read: (session) => session.duration_seconds,
    },
    {
      key: "score",
      label: "Schwacher Score",
      direction: "low",
      digits: 1,
      fallbackMultiplier: 0.82,
      weight: 1.9,
      read: (session) => session.score,
    },
  ];

  const baselines = {};
  const bySession = new Map();

  for (const rule of rules) {
    const baseline = buildOutlierBaseline(
      scored.map((session) => rule.read(session)),
      rule.direction,
      rule.fallbackMultiplier,
      rule.digits
    );

    baselines[rule.key] = baseline;
    if (baseline.threshold == null) continue;

    for (const session of scored) {
      const rawValue = rule.read(session);
      if (rawValue == null || rawValue === "") continue;
      const value = Number(rawValue);
      if (!Number.isFinite(value)) continue;

      const isOutlier =
        rule.direction === "high"
          ? value > Number(baseline.threshold)
          : value < Number(baseline.threshold);

      if (!isOutlier) continue;

      const median = Number(baseline.median);
      const deviationPct =
        Number.isFinite(median) && median !== 0
          ? round((Math.abs(value - median) / Math.abs(median)) * 100, 1)
          : null;

      const reason = {
        key: rule.key,
        label: rule.label,
        direction: rule.direction,
        value: round(value, rule.digits),
        threshold: baseline.threshold,
        median: baseline.median,
        deviation_pct: deviationPct,
        severity:
          deviationPct != null && deviationPct >= 35
            ? "high"
            : deviationPct != null && deviationPct >= 18
              ? "medium"
              : "low",
      };

      const current =
        bySession.get(session.session_id) ||
        {
          ...session,
          reasons: [],
          flag_count: 0,
          severity_score: 0,
        };

      current.reasons.push(reason);
      current.flag_count += 1;
      current.severity_score +=
        rule.weight + (deviationPct != null ? Math.min(4, deviationPct / 20) : 0);

      bySession.set(session.session_id, current);
    }
  }

  const flagged_sessions = Array.from(bySession.values())
    .map((session) => ({
      ...session,
      severity_score: round(session.severity_score, 1),
      reasons: [...session.reasons].sort((a, b) => {
        const dev = Number(b.deviation_pct || 0) - Number(a.deviation_pct || 0);
        if (dev !== 0) return dev;
        return String(a.label).localeCompare(String(b.label), "de");
      }),
    }))
    .sort((a, b) => {
      if (b.flag_count !== a.flag_count) return b.flag_count - a.flag_count;
      if (b.severity_score !== a.severity_score) return b.severity_score - a.severity_score;
      return String(b.date).localeCompare(String(a.date), "de");
    });

  const priceOutliers = flagged_sessions.filter((session) =>
    session.reasons.some((reason) => reason.key === "price_per_kwh")
  );
  const powerOutliers = flagged_sessions.filter((session) =>
    session.reasons.some((reason) => reason.key === "avg_power_kw")
  );
  const durationOutliers = flagged_sessions.filter((session) =>
    session.reasons.some((reason) => reason.key === "duration_seconds")
  );
  const scoreOutliers = flagged_sessions.filter((session) =>
    session.reasons.some((reason) => reason.key === "score")
  );

  const priciest_outlier = priceOutliers.reduce((best, session) => {
    const cur = Number(session.price_per_kwh ?? -1);
    const old = Number(best?.price_per_kwh ?? -1);
    return cur > old ? session : best;
  }, null);

  const lowest_power_outlier = powerOutliers.reduce((best, session) => {
    const cur = Number(session.avg_power_kw ?? Infinity);
    const old = Number(best?.avg_power_kw ?? Infinity);
    return cur < old ? session : best;
  }, null);

  const longest_outlier = durationOutliers.reduce((best, session) => {
    const cur = Number(session.duration_seconds ?? -1);
    const old = Number(best?.duration_seconds ?? -1);
    return cur > old ? session : best;
  }, null);

  const weakest_score_outlier = scoreOutliers.reduce((best, session) => {
    const cur = Number(session.score ?? Infinity);
    const old = Number(best?.score ?? Infinity);
    return cur < old ? session : best;
  }, null);

  return {
    ok: true,
    year: Number(year) || 2026,
    session_count: scored.length,
    outlier_count: flagged_sessions.length,
    flagged_sessions,
    baselines,
    highlights: {
      worst_session: flagged_sessions[0] || null,
      priciest_outlier,
      lowest_power_outlier,
      longest_outlier,
      weakest_score_outlier,
    },
  };
}

function normalizePayloadToSession(payload) {
  const rawDate = payload?.date ?? payload?.datum ?? payload?.session_date;
  const parts = parseDateParts(rawDate);
  const year = parts?.year ?? 2026;

  const date =
    parts?.valid
      ? parts.iso
      : isoDate(year, randi(1, 12), randi(1, 28));

  const energy = Number(payload?.energy_kwh ?? payload?.energyKWh ?? payload?.kwh ?? payload?.energy) || 0;
  const explicitPrice = Number(payload?.price_per_kwh ?? payload?.pricePerKwh);
  const fallbackCost = Number(payload?.total_cost ?? payload?.costEur ?? payload?.cost ?? payload?.eur);
  const pricePerKwh =
    Number.isFinite(explicitPrice) && explicitPrice > 0
      ? explicitPrice
      : energy > 0 && Number.isFinite(fallbackCost) && fallbackCost > 0
        ? fallbackCost / energy
        : 0;
  const cost =
    Number.isFinite(fallbackCost) && fallbackCost >= 0
      ? fallbackCost
      : energy > 0 && pricePerKwh > 0
        ? energy * pricePerKwh
        : 0;

  let durSec = Number(payload?.duration_seconds ?? payload?.durationSeconds ?? payload?.duration) || 0;
  if (payload?.duration_minutes != null || payload?.durationMinutes != null) {
    const mins = Number(payload?.duration_minutes ?? payload?.durationMinutes) || 0;
    durSec = mins * 60;
  }
  if (!Number.isFinite(durSec) || durSec <= 0) durSec = randi(20, 80) * 60;

  return {
    id: payload?.id || `demo-user-${safeUUID()}`,
    date,
    energy_kwh: Number(Math.max(0, energy).toFixed(1)),
    total_cost: Number(Math.max(0, cost).toFixed(2)),
    duration_seconds: Math.max(0, Math.round(durSec)),
    price_per_kwh: Number(Math.max(0, pricePerKwh).toFixed(3)),
    provider: payload?.provider || payload?.anbieter || "DemoNet",
    location: payload?.location || payload?.ort || "Demo Charger",
    connector: payload?.connector || payload?.anschluss || "CCS - DC",
    soc_start: payload?.soc_start ?? payload?.socStart ?? 10,
    soc_end: payload?.soc_end ?? payload?.socEnd ?? 80,
    note: payload?.note ? String(payload.note) : null,
  };
}

export async function getStats(year = 2026) {
  if (isDemoMode) return computeStatsFromSessions(getDemoYearRows(year), year);
  const r = await fetch(`${API_BASE}/api/stats?year=${encodeURIComponent(year)}`);
  return asJson(r);
}

export async function getSessions(year = 2026) {
  if (isDemoMode) return { ok: true, rows: filterByYear(getDemoYearRows(year), year) };
  const r = await fetch(`${API_BASE}/api/sessions?year=${encodeURIComponent(year)}`);
  return asJson(r);
}

export async function getMonthly(year = 2026) {
  if (isDemoMode) return computeMonthlyFromSessions(getDemoYearRows(year), year);
  const r = await fetch(`${API_BASE}/api/analytics/monthly?year=${encodeURIComponent(year)}`);
  return asJson(r);
}

export async function getSeasons(year = 2026) {
  if (isDemoMode) return computeSeasonAnalytics(getDemoYearRows(year), year);
  const r = await fetch(`${API_BASE}/api/analytics/seasons?year=${encodeURIComponent(year)}`);
  return asJson(r);
}

export async function getEfficiency(year = 2026) {
  if (isDemoMode) return computeEfficiencyFromSessions(getDemoYearRows(year), year);
  const r = await fetch(`${API_BASE}/api/analytics/efficiency?year=${encodeURIComponent(year)}`);
  return asJson(r);
}

export async function getOutliers(year = 2026) {
  if (isDemoMode) return computeOutlierAnalytics(getDemoYearRows(year), year);
  const r = await fetch(`${API_BASE}/api/analytics/outliers?year=${encodeURIComponent(year)}`);
  return asJson(r);
}

export async function createSession(payload) {
  if (isDemoMode) {
    const year = parseDateParts(payload?.date)?.year ?? 2026;
    const totalRows = getDemoTotalRowCount();
    const rows = getDemoYearRows(year);
    if (totalRows >= DEMO_MAX_ROWS) {
      throw new Error(`Demo-Limit erreicht (${DEMO_MAX_ROWS} Einträge insgesamt). Reload = neue Demo-Daten.`);
    }

    const row = normalizePayloadToSession(payload || {});
    DEMO_BY_YEAR[year] = [...rows, row];
    return { ok: true, demo: true, row };
  }

  const r = await fetch(`${API_BASE}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return asJson(r);
}

export async function updateSession(id, payload) {
  if (!id) throw new Error("Missing id");

  if (isDemoMode) {
    let existing = null;
    let currentYear = null;

    for (const y of Object.keys(DEMO_BY_YEAR)) {
      const row = (DEMO_BY_YEAR[y] || []).find((session) => String(session.id) === String(id));
      if (row) {
        existing = row;
        currentYear = Number(y);
        break;
      }
    }

    if (!existing || currentYear == null) {
      throw new Error("Session not found");
    }

    const updated = normalizePayloadToSession({ ...existing, ...(payload || {}), id: existing.id });
    const targetYear = parseDateParts(updated.date)?.year ?? currentYear;

    DEMO_BY_YEAR[currentYear] = (DEMO_BY_YEAR[currentYear] || []).filter((session) => String(session.id) !== String(id));
    DEMO_BY_YEAR[targetYear] = [...getDemoYearRows(targetYear).filter((session) => String(session.id) !== String(id)), updated]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return { ok: true, demo: true, updated };
  }

  const r = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  return asJson(r);
}

export async function restoreSession(payload) {
  return createSession(payload);
}

export function getMonthlyCsvUrl(year = 2026) {
  if (isDemoMode) return null;
  return `${API_BASE}/api/export/monthly.csv?year=${encodeURIComponent(year)}`;
}

export function getSessionsCsvUrl(year = 2026) {
  if (isDemoMode) return null;
  return `${API_BASE}/api/export/sessions.csv?year=${encodeURIComponent(year)}`;
}

export function getSeasonsCsvUrl(year = 2026) {
  if (isDemoMode) return null;
  return `${API_BASE}/api/export/seasons.csv?year=${encodeURIComponent(year)}`;
}

export const ladeAuswertung = (year) => getStats(year);

export async function ladeLadevorgaenge(year) {
  const data = await getSessions(year);
  return data.rows || [];
}

export const ladeMonatsauswertung = (year) => getMonthly(year);
export const ladeSaisonauswertung = (year) => getSeasons(year);
export const ladeEfficiencyScore = (year) => getEfficiency(year);
export const ladeAusreisserAnalyse = (year) => getOutliers(year);
export const erstelleLadevorgang = (payload) => createSession(payload);

export async function deleteSession(id) {
  if (!id) throw new Error("Missing id");

  if (isDemoMode) {
    for (const y of Object.keys(DEMO_BY_YEAR)) {
      const rows = DEMO_BY_YEAR[y] || [];
      const deleted = rows.find((session) => String(session.id) === String(id));
      if (!deleted) continue;
      DEMO_BY_YEAR[y] = rows.filter((session) => String(session.id) !== String(id));
      return { ok: true, demo: true, deleted };
    }
    throw new Error("Session not found");
  }

  const r = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Delete failed (${r.status}): ${t || r.statusText}`);
  }

  return r.json().catch(() => ({ ok: true }));
}
