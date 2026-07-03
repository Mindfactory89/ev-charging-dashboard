/**
 * Browser-Client
 * UI:  http://<host>:<ui-port>
 * API: http://<host>:18800
 */

import { CONNECTOR_OPTIONS, DEFAULT_VEHICLE, YEARS } from "../app/constants.js";
import { normalizeSessionText, normalizeTagsInput, parseTags } from "./sessionMetadata.js";
import {
  dashboardCacheKey,
  deleteDashboardCacheEntry,
  getDashboardCacheEntry,
  invalidateDashboardBundleCache as invalidateDashboardBundleCacheByMode,
  setDashboardCachePromise,
  setDashboardCacheValue,
} from "./apiCache.js";
import {
  createSessionRemote,
  deleteSessionRemote,
  getDashboardBundleRemote,
  getEfficiencyRemote,
  getMonthlyCsvUrlRemote,
  getMonthlyRemote,
  getOutliersRemote,
  getSeasonsCsvUrlRemote,
  getSeasonsRemote,
  getSessionsCsvUrlRemote,
  getSessionsRemote,
  getStatsRemote,
  updateSessionRemote,
} from "./apiRemote.js";
import { getApiBaseError, isDemoMode } from "./apiRuntime.js";

export { getApiBaseError, isDemoMode };

const DEMO_SEEDED_YEARS = [...YEARS];
const DEMO_MIN_SEED_ROWS_PER_YEAR = 30;
const DEMO_MAX_SEED_ROWS_PER_YEAR = 50;
const DEMO_MAX_USER_ROWS = 8;
const DEMO_MAX_ROWS = DEMO_SEEDED_YEARS.length * DEMO_MAX_SEED_ROWS_PER_YEAR + DEMO_MAX_USER_ROWS;
const DEMO_REFERENCE_BATTERY_KWH = 79;

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
function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}
function hasFiniteNumber(value) {
  if (value == null || value === "") return false;
  return Number.isFinite(Number(value));
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
    priceMin: 0.59,
    priceMax: 0.67,
    priceAnchors: [0.59, 0.63, 0.66],
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
    priceMin: 0.49,
    priceMax: 0.56,
    priceAnchors: [0.49, 0.52, 0.55],
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
    priceMin: 0.55,
    priceMax: 0.61,
    priceAnchors: [0.56, 0.59, 0.61],
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
    priceMin: 0.59,
    priceMax: 0.67,
    priceAnchors: [0.59, 0.63, 0.66],
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
    priceMin: 0.46,
    priceMax: 0.54,
    priceAnchors: [0.47, 0.51, 0.54],
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
    priceMin: 0.47,
    priceMax: 0.54,
    priceAnchors: [0.47, 0.49, 0.52],
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
    priceMin: 0.61,
    priceMax: 0.68,
    priceAnchors: [0.62, 0.65, 0.67],
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
    priceMin: 0.47,
    priceMax: 0.54,
    priceAnchors: [0.48, 0.52, 0.54],
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
    priceMin: 0.55,
    priceMax: 0.61,
    priceAnchors: [0.56, 0.59, 0.61],
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
    priceMin: 0.59,
    priceMax: 0.67,
    priceAnchors: [0.59, 0.63, 0.66],
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
    priceMin: 0.55,
    priceMax: 0.62,
    priceAnchors: [0.56, 0.59, 0.61],
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
    priceMin: 0.46,
    priceMax: 0.54,
    priceAnchors: [0.47, 0.51, 0.54],
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
    priceMin: 0.51,
    priceMax: 0.58,
    priceAnchors: [0.52, 0.55, 0.58],
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
    priceMin: 0.59,
    priceMax: 0.69,
    priceAnchors: [0.60, 0.64, 0.67],
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
    priceMin: 0.47,
    priceMax: 0.55,
    priceAnchors: [0.48, 0.52, 0.55],
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
    priceMin: 0.60,
    priceMax: 0.68,
    priceAnchors: [0.61, 0.64, 0.67],
    durationMin: 20,
    durationMax: 29,
    socStartMin: 20,
    socStartMax: 34,
    socEndMin: 68,
    socEndMax: 81,
    note: "Ladestopp vor spätem Heimweg",
  },
  {
    month: 1,
    provider: "Wallbox Zuhause",
    location: "Garage Zuhause",
    connector: "Wallbox AC",
    energyMin: 18,
    energyMax: 28,
    priceMin: 0.29,
    priceMax: 0.35,
    priceAnchors: [0.299, 0.319, 0.339],
    durationMin: 150,
    durationMax: 250,
    socStartMin: 22,
    socStartMax: 46,
    socEndMin: 74,
    socEndMax: 88,
    note: "Abendladung zuhause vor dem nächsten Arbeitstag",
  },
  {
    month: 4,
    provider: "Wallbox Zuhause",
    location: "Carport Zuhause",
    connector: "Wallbox AC",
    energyMin: 14,
    energyMax: 24,
    priceMin: 0.29,
    priceMax: 0.35,
    priceAnchors: [0.299, 0.319, 0.339],
    durationMin: 120,
    durationMax: 210,
    socStartMin: 36,
    socStartMax: 58,
    socEndMin: 72,
    socEndMax: 86,
    note: "Zwischenladung zuhause nach Pendelstrecke",
  },
  {
    month: 6,
    provider: "Wallbox Zuhause",
    location: "Garage Zuhause",
    connector: "Wallbox AC",
    energyMin: 20,
    energyMax: 34,
    priceMin: 0.29,
    priceMax: 0.36,
    priceAnchors: [0.299, 0.319, 0.349],
    durationMin: 170,
    durationMax: 300,
    socStartMin: 18,
    socStartMax: 40,
    socEndMin: 78,
    socEndMax: 92,
    note: "Nachladung zuhause vor Wochenendfahrt",
  },
  {
    month: 8,
    provider: "Wallbox Zuhause",
    location: "Garage Zuhause",
    connector: "Wallbox AC",
    energyMin: 15,
    energyMax: 26,
    priceMin: 0.29,
    priceMax: 0.35,
    priceAnchors: [0.299, 0.319, 0.339],
    durationMin: 130,
    durationMax: 230,
    socStartMin: 34,
    socStartMax: 60,
    socEndMin: 74,
    socEndMax: 88,
    note: "Ruhige Heimladung nach Alltagsfahrt",
  },
  {
    month: 10,
    provider: "Wallbox Zuhause",
    location: "Carport Zuhause",
    connector: "Wallbox AC",
    energyMin: 17,
    energyMax: 30,
    priceMin: 0.29,
    priceMax: 0.35,
    priceAnchors: [0.299, 0.319, 0.339],
    durationMin: 150,
    durationMax: 280,
    socStartMin: 28,
    socStartMax: 52,
    socEndMin: 76,
    socEndMax: 90,
    note: "Home-Charging vor längerer Strecke am Folgetag",
  },
  {
    month: 12,
    provider: "Wallbox Zuhause",
    location: "Garage Zuhause",
    connector: "Wallbox AC",
    energyMin: 22,
    energyMax: 36,
    priceMin: 0.30,
    priceMax: 0.36,
    priceAnchors: [0.309, 0.329, 0.349],
    durationMin: 180,
    durationMax: 330,
    socStartMin: 16,
    socStartMax: 38,
    socEndMin: 80,
    socEndMax: 94,
    note: "Übernachtladung zuhause bei winterlicher Nutzung",
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

function templateKind(template) {
  if (
    String(template?.provider || "").toLowerCase().includes("wallbox") ||
    String(template?.connector || "").toLowerCase().includes("wallbox")
  ) {
    return "wallbox";
  }
  return template?.connector === "CCS AC" ? "ac" : "dc";
}

// Demo anchors:
// - Verivox, published 2026-02-02: public charging averages in 2025 were 0.52 EUR/kWh (AC) and 0.60 EUR/kWh (DC).
// - Verivox/BMWK compact-EV baseline: 15.9 kWh/100 km.
// - ADAC Ecotest examples from 2025 put real-world compact EVs with charging losses roughly in the 16.5-19.5 kWh/100 km range.
function seasonalConsumptionPer100Km(month, kind = "dc") {
  const seasonKey =
    month === 12 || month <= 2 ? "winter"
    : month >= 6 && month <= 8 ? "summer"
    : "shoulder";

  const consumptionBySeason = {
    winter: { wallbox: 18.8, ac: 19.4, dc: 20.2 },
    shoulder: { wallbox: 17.2, ac: 17.8, dc: 18.6 },
    summer: { wallbox: 15.8, ac: 16.4, dc: 17.2 },
  };

  return round(consumptionBySeason[seasonKey]?.[kind] ?? consumptionBySeason.shoulder.dc, 1);
}

function seasonalPriceDelta(month, kind = "dc") {
  if (kind === "wallbox") {
    if (month === 12 || month <= 2) return 0.02;
    if (month >= 6 && month <= 8) return -0.005;
    return 0.008;
  }

  if (kind === "ac") {
    if (month === 12 || month <= 2) return 0.025;
    if (month >= 6 && month <= 8) return 0.012;
    return 0.018;
  }

  if (month === 12 || month <= 2) return 0.045;
  if (month >= 6 && month <= 8) return 0.028;
  return 0.035;
}

function providerPriceBias(provider, kind = "dc") {
  const normalized = String(provider || "").toLowerCase();

  if (normalized.includes("ionity")) return 0.035;
  if (normalized.includes("fastned")) return 0.028;
  if (normalized.includes("allego")) return 0.03;
  if (normalized.includes("aral")) return 0.02;
  if (normalized.includes("tesla")) return 0.005;
  if (normalized.includes("enbw")) return 0.012;
  if (normalized.includes("tanke")) return kind === "ac" ? -0.004 : 0.008;
  if (normalized.includes("aldi")) return -0.03;
  if (normalized.includes("wallbox")) return -0.012;
  if (normalized.includes("stadtwerke")) return kind === "ac" ? -0.015 : -0.006;
  if (normalized.includes("ewe")) return kind === "ac" ? -0.01 : 0.004;

  return 0;
}

function priceBoundsForKind(kind = "dc") {
  if (kind === "wallbox") return { min: 0.26, max: 0.41 };
  if (kind === "ac") return { min: 0.41, max: 0.64 };
  return { min: 0.45, max: 0.79 };
}

function buildDemoPricePerKwh(template) {
  const kind = templateKind(template);
  const bounds = priceBoundsForKind(kind);
  const basePrice =
    Array.isArray(template.priceAnchors) && template.priceAnchors.length && Math.random() < 0.46
      ? Number(template.priceAnchors[randi(0, template.priceAnchors.length - 1)].toFixed(3))
      : round(rand(template.priceMin, template.priceMax), 3);

  const sessionVariance =
    kind === "wallbox"
      ? rand(-0.018, 0.02)
      : kind === "ac"
        ? rand(-0.03, 0.055)
        : rand(-0.045, 0.085);

  const effectiveMin =
    kind === "wallbox"
      ? Math.max(bounds.min, template.priceMin - 0.025)
      : kind === "ac"
        ? Math.max(bounds.min, template.priceMin - 0.035)
        : Math.max(bounds.min, template.priceMin - 0.05);

  const effectiveMax =
    kind === "wallbox"
      ? Math.min(bounds.max, template.priceMax + 0.03)
      : kind === "ac"
        ? Math.min(bounds.max, template.priceMax + 0.06)
        : Math.min(bounds.max, template.priceMax + 0.09);

  const finalPrice =
    basePrice +
    seasonalPriceDelta(template.month, kind) +
    providerPriceBias(template.provider, kind) +
    sessionVariance;

  return round(clamp(finalPrice, effectiveMin, effectiveMax), 3);
}

function chargingLossFactor(month, kind = "dc") {
  const winter = month === 12 || month <= 2;
  const summer = month >= 6 && month <= 8;

  if (kind === "wallbox") return winter ? 1.12 : summer ? 1.08 : 1.1;
  if (kind === "ac") return winter ? 1.1 : summer ? 1.06 : 1.08;
  return winter ? 1.06 : summer ? 1.03 : 1.04;
}

function targetAveragePowerKw(template, energyKwh, socStart, socEnd) {
  const kind = templateKind(template);
  const provider = String(template?.provider || "").toLowerCase();
  const socDelta = Math.max(0, Number(socEnd) - Number(socStart));
  const highSocPenalty = Number(socEnd) >= 85 ? 0.84 : Number(socEnd) >= 80 ? 0.9 : 1;
  const deepWindowBoost = socDelta >= 55 ? 1.06 : socDelta >= 40 ? 1.02 : 0.98;

  let power =
    kind === "wallbox"
      ? rand(7.0, 10.9)
      : kind === "ac"
        ? rand(7.4, 12.4)
        : rand(48, 88);

  if (kind === "dc") {
    if (provider.includes("ionity")) power += 8;
    if (provider.includes("fastned")) power += 7;
    if (provider.includes("tesla")) power += 9;
    if (provider.includes("aral")) power += 4;
    if (provider.includes("enbw")) power += 3;
    if (provider.includes("allego")) power -= 6;
    if (provider.includes("aldi")) power -= 12;
    if (Number(energyKwh) >= 58) power *= 0.92;
  } else if (kind === "ac") {
    if (provider.includes("stadtwerke")) power -= 0.4;
    if (provider.includes("ewe")) power += 0.3;
  }

  power *= highSocPenalty;
  power *= deepWindowBoost;

  if (kind === "wallbox") return round(clamp(power, 6.6, 11.2), 1);
  if (kind === "ac") return round(clamp(power, 7.0, 13.2), 1);
  return round(clamp(power, 34, 110), 1);
}

function buildDemoEnergyKwh(template, socStart, socEnd) {
  const kind = templateKind(template);
  const socDelta = Math.max(8, Number(socEnd) - Number(socStart));
  const batteryWindowKwh = (DEMO_REFERENCE_BATTERY_KWH * socDelta) / 100;
  const losses = chargingLossFactor(template.month, kind);
  const jitterFactor =
    kind === "wallbox"
      ? rand(0.98, 1.05)
      : kind === "ac"
        ? rand(0.97, 1.04)
        : rand(0.98, 1.06);

  const floor =
    kind === "wallbox"
      ? Math.max(14, template.energyMin * 1.08)
      : kind === "ac"
        ? Math.max(10, template.energyMin * 1.05)
        : Math.max(16, template.energyMin * 1.02);
  const ceiling =
    kind === "wallbox"
      ? 64
      : kind === "ac"
        ? 38
        : 72;

  const energy = batteryWindowKwh * losses * jitterFactor;
  return round(clamp(energy, floor, ceiling), 1);
}

function estimateDistanceKm(energyKwh, month, kind = "dc") {
  const energy = Number(energyKwh);
  const consumption = seasonalConsumptionPer100Km(month, kind);
  if (!Number.isFinite(energy) || energy <= 0 || !Number.isFinite(consumption) || consumption <= 0) return null;
  return Math.max(12, Math.round((energy / consumption) * 100));
}

function applySequentialOdometer(rows, year) {
  let cursorKm = randi(11800 + Math.max(0, year - 2026) * 14500, 16400 + Math.max(0, year - 2026) * 14500);

  return rows.map((row) => {
    const kind = templateKind(row);
    const month = parseDateParts(row?.date)?.month ?? 1;
    const distanceKm = estimateDistanceKm(row?.energy_kwh, month, kind);
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) return row;

    const odoStart = cursorKm + randi(6, 42);
    const odoEnd = odoStart + distanceKm;
    cursorKm = odoEnd;
    return {
      ...row,
      odo_start_km: odoStart,
      odo_end_km: odoEnd,
    };
  });
}

function ensureDemoOdometer(row, year, existingRows = []) {
  if (hasFiniteNumber(row?.odo_start_km) && hasFiniteNumber(row?.odo_end_km)) return row;

  const latestCursor = existingRows.reduce((maxValue, existing) => {
    const candidate = Math.max(Number(existing?.odo_end_km || 0), Number(existing?.odo_start_km || 0));
    return Number.isFinite(candidate) && candidate > maxValue ? candidate : maxValue;
  }, randi(11800 + Math.max(0, year - 2026) * 14500, 16400 + Math.max(0, year - 2026) * 14500));
  const month = parseDateParts(row?.date)?.month ?? 1;
  const distanceKm = estimateDistanceKm(row?.energy_kwh, month, templateKind(row));
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return row;

  const odoStart = latestCursor + randi(6, 32);
  return {
    ...row,
    odo_start_km: odoStart,
    odo_end_km: odoStart + distanceKm,
  };
}

function buildDemoSessionFromTemplate(template, year, idx) {
  const socStart = randi(template.socStartMin, template.socStartMax);
  const socEnd = Math.max(socStart + 8, randi(template.socEndMin, template.socEndMax));
  const energy = buildDemoEnergyKwh(template, socStart, socEnd);
  const pricePerKwh = buildDemoPricePerKwh(template);
  const avgPowerKw = targetAveragePowerKw(template, energy, socStart, socEnd);
  const durationMinutes = Math.max(10, Math.round((energy / avgPowerKw) * 60));

  return {
    id: `demo-seed-${year}-${String(idx + 1).padStart(2, "0")}`,
    date: null,
    energy_kwh: energy,
    total_cost: Number((energy * pricePerKwh).toFixed(2)),
    duration_seconds: durationMinutes * 60,
    price_per_kwh: pricePerKwh,
    provider: template.provider,
    location: template.location,
    vehicle: DEFAULT_VEHICLE,
    tags:
      templateKind(template) === "wallbox"
        ? "zuhause, alltag"
        : templateKind(template) === "ac"
          ? "stadt, zwischenstopp"
          : "reise, schnellladen",
    connector: template.connector,
    soc_start: socStart,
    soc_end: Math.min(100, socEnd),
    note: template.note || null,
  };
}

function pickUniqueDemoDate(year, month, usedDates) {
  if (!usedDates) {
    return isoDate(year, month, pickRandomDay(month));
  }

  for (let attempt = 0; attempt < 56; attempt += 1) {
    const candidate = isoDate(year, month, pickRandomDay(month));
    if (!usedDates.has(candidate)) {
      usedDates.add(candidate);
      return candidate;
    }
  }

  for (let day = 1; day <= 28; day += 1) {
    const candidate = isoDate(year, month, day);
    if (!usedDates.has(candidate)) {
      usedDates.add(candidate);
      return candidate;
    }
  }

  return isoDate(year, month, pickRandomDay(month));
}

function pickTemplatesRepeated(pool, amount) {
  if (!Array.isArray(pool) || pool.length === 0 || amount <= 0) return [];

  const picks = [];
  let bag = shuffle(pool);
  let cursor = 0;

  while (picks.length < amount) {
    if (cursor >= bag.length) {
      bag = shuffle(pool);
      cursor = 0;
    }
    picks.push(bag[cursor]);
    cursor += 1;
  }

  return picks;
}

function seedDemoSessions(year = 2026, targetCount = 0) {
  const count = clamp(targetCount, 0, DEMO_MAX_SEED_ROWS_PER_YEAR);
  if (count <= 0) return [];

  const wallboxTemplates = DEMO_SESSION_TEMPLATES.filter((template) => templateKind(template) === "wallbox");
  const acTemplates = DEMO_SESSION_TEMPLATES.filter((template) => templateKind(template) === "ac");
  const dcTemplates = DEMO_SESSION_TEMPLATES.filter((template) => templateKind(template) === "dc");

  const desiredWallbox = Math.max(10, Math.min(count - 10, Math.round(count * 0.38) + randi(-2, 2)));
  const desiredAc = Math.max(6, Math.min(count - desiredWallbox - 4, Math.round(count * 0.22) + randi(-1, 2)));
  const desiredDc = Math.max(0, count - desiredWallbox - desiredAc);

  const selectedTemplates = shuffle([
    ...pickTemplatesRepeated(wallboxTemplates, desiredWallbox),
    ...pickTemplatesRepeated(acTemplates, desiredAc),
    ...pickTemplatesRepeated(dcTemplates, desiredDc),
  ]).slice(0, count);

  const usedDates = new Set();
  const rows = selectedTemplates.map((template, idx) => ({
    ...buildDemoSessionFromTemplate(template, year, idx),
    date: pickUniqueDemoDate(year, template.month, usedDates),
  }));
  rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return applySequentialOdometer(rows, year);
}

const DEMO_DEFAULT_YEAR = 2026;
const DEMO_BY_YEAR = Object.create(null);
let DEMO_SEED_INITIALIZED = false;

function getDemoTotalRowCount() {
  ensureDemoSeeded();
  return Object.values(DEMO_BY_YEAR).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
}

function ensureDemoSeeded() {
  if (DEMO_SEED_INITIALIZED) return;

  DEMO_SEEDED_YEARS.forEach((year) => {
    const targetCount = randi(DEMO_MIN_SEED_ROWS_PER_YEAR, DEMO_MAX_SEED_ROWS_PER_YEAR);
    DEMO_BY_YEAR[year] = seedDemoSessions(year, targetCount);
  });

  DEMO_SEED_INITIALIZED = true;
}

function getDemoYearRows(year) {
  ensureDemoSeeded();
  const y = Number(year) || DEMO_DEFAULT_YEAR;
  if (!Object.prototype.hasOwnProperty.call(DEMO_BY_YEAR, y)) {
    DEMO_BY_YEAR[y] = [];
  }
  return DEMO_BY_YEAR[y];
}

function getAllDemoRows() {
  ensureDemoSeeded();
  return Object.values(DEMO_BY_YEAR).flatMap((rows) => rows || []);
}

function compareSessionDateAsc(left, right) {
  return new Date(left?.date || 0).getTime() - new Date(right?.date || 0).getTime();
}

function sortSessionsAsc(rows) {
  return [...(rows || [])].sort(compareSessionDateAsc);
}

function setDemoYearRows(year, rows) {
  const y = Number(year) || DEMO_DEFAULT_YEAR;
  DEMO_BY_YEAR[y] = sortSessionsAsc(rows);
  return DEMO_BY_YEAR[y];
}

function isSameSessionId(session, id) {
  return String(session?.id) === String(id);
}

function withoutSessionId(rows, id) {
  return (rows || []).filter((session) => !isSameSessionId(session, id));
}

function findDemoSessionRecord(id) {
  ensureDemoSeeded();
  for (const yearKey of Object.keys(DEMO_BY_YEAR)) {
    const rows = DEMO_BY_YEAR[yearKey] || [];
    const session = rows.find((entry) => isSameSessionId(entry, id));
    if (session) {
      return {
        year: Number(yearKey),
        rows,
        session,
      };
    }
  }
  return null;
}

function filterByYear(rows, year) {
  const y = Number(year) || 2026;
  return (rows || []).filter((s) => {
    const parts = parseDateParts(s?.date);
    return parts?.valid && parts.year === y;
  });
}

function sortSessionsDesc(rows) {
  return sortSessionsAsc(rows).reverse();
}

function buildAvailableYears(rows, fallbackYear = null) {
  const years = Array.from(
    new Set(
      (rows || [])
        .map((row) => parseDateParts(row?.date)?.year)
        .filter((value) => Number.isInteger(value))
    )
  );
  const merged = new Set([...(YEARS || []), ...years]);

  if (fallbackYear != null && Number.isInteger(Number(fallbackYear))) {
    merged.add(Number(fallbackYear));
  }

  return Array.from(merged).sort((left, right) => left - right);
}

function labelOrFallback(value, fallback = "Nicht zugeordnet") {
  return normalizeSessionText(value) || fallback;
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

function normalizeAnalyticsYear(year) {
  return Number(year) || DEMO_DEFAULT_YEAR;
}

function sumMetric(rows, reader) {
  return (rows || []).reduce((sum, row) => sum + (Number(reader(row)) || 0), 0);
}

function collectMetricValues(rows, reader, predicate = (value) => Number.isFinite(value)) {
  return (rows || [])
    .map((row) => Number(reader(row)))
    .filter((value) => Number.isFinite(value) && predicate(value));
}

function getTimedRows(rows) {
  return (rows || []).filter((row) => Number(row?.duration_seconds) > 0);
}

function buildSessionAggregate(rows) {
  const list = rows || [];
  const timedRows = getTimedRows(list);
  const totalEnergy = sumMetric(list, (row) => row?.energy_kwh);
  const totalCost = sumMetric(list, (row) => row?.total_cost);
  const totalDuration = sumMetric(timedRows, (row) => row?.duration_seconds);
  const totalTimedEnergy = sumMetric(timedRows, (row) => row?.energy_kwh);

  return {
    rows: list,
    count: list.length,
    timedRows,
    totalEnergy,
    totalCost,
    totalDuration,
    totalTimedEnergy,
  };
}

function averageRounded(total, count, digits = 2, options = {}) {
  const { emptyValue = 0 } = options;
  if (!(count > 0)) return emptyValue;
  return round(total / count, digits);
}

function averageDurationSeconds(totalDuration, count) {
  return count > 0 ? Math.round(totalDuration / count) : 0;
}

function deriveAveragePricePerKwh(totalCost, totalEnergy, options = {}) {
  const { emptyValue = null } = options;
  if (!(totalEnergy > 0)) return emptyValue;
  return round(totalCost / totalEnergy, 3);
}

function deriveAveragePowerKw(totalTimedEnergy, totalDuration, options = {}) {
  const { emptyValue = null } = options;
  if (!(totalDuration > 0)) return emptyValue;
  return round(totalTimedEnergy / (totalDuration / 3600), 1);
}

function pickMetric(rows, reader, options = {}) {
  const { direction = "desc" } = options;
  const fallback = direction === "asc" ? Infinity : -Infinity;

  return (rows || []).reduce((best, row) => {
    const currentValue = Number(reader(row));
    const bestValue = best ? Number(reader(best)) : fallback;
    const currentScore = Number.isFinite(currentValue) ? currentValue : fallback;
    const bestScore = Number.isFinite(bestValue) ? bestValue : fallback;

    if (direction === "asc") {
      return currentScore < bestScore ? row : best;
    }

    return currentScore > bestScore ? row : best;
  }, null);
}

function pickHighestBy(rows, reader) {
  return pickMetric(rows, reader, { direction: "desc" });
}

function pickLowestBy(rows, reader) {
  return pickMetric(rows, reader, { direction: "asc" });
}

function buildStaticSessionMeta(total) {
  return {
    total,
    offset: 0,
    limit: null,
    has_more: false,
    truncated: false,
  };
}

function buildTrend(current, previous, digits = 3) {
  const currentValue = Number(current);
  const previousValue = Number(previous);
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue) || previousValue === 0) return null;

  return {
    delta: round(currentValue - previousValue, digits),
    pct: round((currentValue - previousValue) / previousValue, 4),
  };
}

function createMonthlyBuckets() {
  return Array.from({ length: 12 }, (_, index) => ({ month: index + 1, count: 0, energy_kwh: 0, cost: 0 }));
}

function buildMonthlySummary(bucket) {
  const energy = round(bucket.energy_kwh, 3);
  const cost = round(bucket.cost, 2);

  return {
    month: bucket.month,
    count: bucket.count,
    energy_kwh: energy,
    cost,
    avg_price_per_charge: bucket.count ? round(cost / bucket.count, 2) : 0,
    price_per_kwh: energy > 0 ? round(cost / energy, 3) : 0,
  };
}

function buildSeasonSummary(meta, rows, scoreRow) {
  const aggregate = buildSessionAggregate(rows);
  const scored = rows.map((row) => scoreRow(row));

  return {
    key: meta.key,
    label: meta.label,
    months: meta.months,
    count: aggregate.count,
    energy_kwh: round(aggregate.totalEnergy, 3),
    cost: round(aggregate.totalCost, 2),
    avg_duration_seconds: averageDurationSeconds(aggregate.totalDuration, aggregate.timedRows.length),
    avg_kwh_per_session: averageRounded(aggregate.totalEnergy, aggregate.count, 2),
    avg_cost_per_session: averageRounded(aggregate.totalCost, aggregate.count, 2),
    avg_price_per_kwh: deriveAveragePricePerKwh(aggregate.totalCost, aggregate.totalEnergy, { emptyValue: null }),
    avg_power_kw: deriveAveragePowerKw(aggregate.totalTimedEnergy, aggregate.totalDuration, { emptyValue: null }),
    efficiency_score: averageRounded(sumMetric(scored, (session) => session?.score), scored.length, 1, { emptyValue: null }),
    best_session: pickHighestBy(scored, (session) => session?.score),
    worst_session: pickLowestBy(scored, (session) => session?.score),
  };
}

function computeStatsFromSessions(rows, year) {
  const yearRows = filterByYear(rows, year);
  const aggregate = buildSessionAggregate(yearRows);
  const derivedRows = yearRows.map((session) => ({ session, derived: buildDerived(session) }));
  const prices = collectMetricValues(derivedRows, ({ derived }) => derived.price_per_kwh, (value) => value > 0);
  const powers = collectMetricValues(derivedRows, ({ derived }) => derived.avg_power_kw, (value) => value > 0);
  const energies = collectMetricValues(yearRows, (session) => session?.energy_kwh, (value) => value > 0);
  const costs = collectMetricValues(yearRows, (session) => session?.total_cost, (value) => value >= 0);
  const durations = collectMetricValues(yearRows, (session) => session?.duration_seconds, (value) => value > 0);
  const mostExpensive = pickHighestBy(yearRows, (session) => session?.total_cost);
  const longest = pickHighestBy(yearRows, (session) => session?.duration_seconds);

  return {
    ok: true,
    year: normalizeAnalyticsYear(year),
    count: aggregate.count,
    total_cost: round(aggregate.totalCost, 2),
    total_energy_kwh: round(aggregate.totalEnergy, 3),
    avg_kwh_per_session: averageRounded(aggregate.totalEnergy, aggregate.count, 2),
    avg_duration_seconds: averageDurationSeconds(aggregate.totalDuration, aggregate.timedRows.length),
    avg_price_per_charge: averageRounded(aggregate.totalCost, aggregate.count, 2),
    avg_price_per_kwh: deriveAveragePricePerKwh(aggregate.totalCost, aggregate.totalEnergy, { emptyValue: 0 }),
    avg_power_kw: deriveAveragePowerKw(aggregate.totalTimedEnergy, aggregate.totalDuration, { emptyValue: 0 }),
    medians: {
      energy_kwh: median(energies) != null ? round(median(energies), 1) : null,
      cost_per_session: median(costs) != null ? round(median(costs), 2) : null,
      duration_seconds: median(durations) != null ? Math.round(median(durations)) : null,
      price_per_kwh: median(prices) != null ? round(median(prices), 3) : null,
      power_kw: median(powers) != null ? round(median(powers), 1) : null,
    },
    most_expensive: mostExpensive ? { date: mostExpensive.date, total_cost: mostExpensive.total_cost } : null,
    longest: longest ? { date: longest.date, duration_seconds: longest.duration_seconds } : null,
  };
}

function summarizeRows(rows, label) {
  const aggregate = buildSessionAggregate(rows);
  const tags = Array.from(new Set(rows.flatMap((row) => parseTags(row.tags)))).sort((left, right) => left.localeCompare(right, "de"));

  return {
    key: label.toLowerCase(),
    label,
    count: aggregate.count,
    energy_kwh: round(aggregate.totalEnergy, 3),
    cost: round(aggregate.totalCost, 2),
    avg_duration_seconds: averageDurationSeconds(aggregate.totalDuration, aggregate.timedRows.length),
    avg_kwh_per_session: averageRounded(aggregate.totalEnergy, aggregate.count, 2),
    avg_cost_per_session: averageRounded(aggregate.totalCost, aggregate.count, 2),
    avg_price_per_kwh: deriveAveragePricePerKwh(aggregate.totalCost, aggregate.totalEnergy, { emptyValue: null }),
    avg_power_kw: deriveAveragePowerKw(aggregate.totalTimedEnergy, aggregate.totalDuration, { emptyValue: null }),
    first_session_date: aggregate.count ? rows[0].date : null,
    last_session_date: aggregate.count ? rows[rows.length - 1].date : null,
    tags,
  };
}

function groupSessions(rows, keyResolver, labelResolver = keyResolver) {
  const grouped = new Map();

  for (const row of rows) {
    const key = keyResolver(row);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  return Array.from(grouped.entries())
    .map(([key, groupedRows]) => summarizeRows(groupedRows, labelResolver({ key, rows: groupedRows })))
    .sort((left, right) => {
      if (right.cost !== left.cost) return right.cost - left.cost;
      if (right.energy_kwh !== left.energy_kwh) return right.energy_kwh - left.energy_kwh;
      return String(left.label).localeCompare(String(right.label), "de");
    });
}

function computeIntelligenceFromSessions(rows, year) {
  const filtered = filterByYear(rows, year).sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
  const providers = groupSessions(filtered, (row) => labelOrFallback(row.provider), ({ key }) => key);
  const locations = groupSessions(filtered, (row) => labelOrFallback(row.location), ({ key }) => key);
  const vehicles = groupSessions(filtered, (row) => labelOrFallback(row.vehicle, "Standardfahrzeug"), ({ key }) => key);
  const tagPool = Array.from(new Set(filtered.flatMap((row) => parseTags(row.tags))));
  const tags = tagPool
    .map((tag) =>
      summarizeRows(
        filtered.filter((row) => parseTags(row.tags).some((entry) => entry.toLowerCase() === tag.toLowerCase())),
        tag
      )
    )
    .sort((left, right) => {
      if (right.cost !== left.cost) return right.cost - left.cost;
      return String(left.label).localeCompare(String(right.label), "de");
    });

  return {
    ok: true,
    year: Number(year) || 2026,
    providers,
    locations,
    vehicles,
    tags,
    highlights: {
      cheapest_provider: providers.reduce((best, row) => (!best || Number(row.avg_price_per_kwh ?? Infinity) < Number(best.avg_price_per_kwh ?? Infinity) ? row : best), null),
      fastest_provider: providers.reduce((best, row) => (!best || Number(row.avg_power_kw || -1) > Number(best.avg_power_kw || -1) ? row : best), null),
      strongest_location: locations[0] || null,
      dominant_vehicle: vehicles[0] || null,
    },
    filters: {
      providers: providers.map((row) => row.label),
      locations: locations.map((row) => row.label),
      vehicles: vehicles.map((row) => row.label),
      tags: tags.map((row) => row.label),
    },
  };
}

function buildDashboardBundleFromSessions(rows, year) {
  const normalizedYear = normalizeAnalyticsYear(year);
  const yearRows = filterByYear(rows, normalizedYear);
  return {
    ok: true,
    year: normalizedYear,
    available_years: buildAvailableYears(rows, normalizedYear),
    stats: computeStatsFromSessions(yearRows, normalizedYear),
    monthly: computeMonthlyFromSessions(yearRows, normalizedYear),
    seasons: computeSeasonAnalytics(yearRows, normalizedYear),
    efficiency: computeEfficiencyFromSessions(yearRows, normalizedYear),
    outliers: computeOutlierAnalytics(yearRows, normalizedYear),
    soc_window_analysis: computeSocWindowAnalysis(yearRows, normalizedYear),
    intelligence: computeIntelligenceFromSessions(yearRows, normalizedYear),
    sessions: {
      rows: sortSessionsDesc(yearRows),
      meta: buildStaticSessionMeta(yearRows.length),
    },
  };
}

function computeMonthlyFromSessions(rows, year) {
  const yearRows = filterByYear(rows, year);
  const months = createMonthlyBuckets();

  for (const s of yearRows) {
    const parts = parseDateParts(s.date);
    if (!parts?.valid) continue;
    const idx = parts.month - 1;
    const e = Number(s.energy_kwh) || 0;
    const c = Number(s.total_cost) || 0;
    months[idx].count += 1;
    months[idx].energy_kwh += e;
    months[idx].cost += c;
  }

  const base = months.map(buildMonthlySummary);

  const monthsWithTrend = base.map((m, idx) => {
    const prev = idx > 0 ? base[idx - 1] : null;
    return {
      ...m,
      trend: {
        energy: prev ? buildTrend(m.energy_kwh, prev.energy_kwh) : null,
        cost: prev ? buildTrend(m.cost, prev.cost) : null,
        price_per_kwh: prev ? buildTrend(m.price_per_kwh, prev.price_per_kwh) : null,
      },
    };
  });

  const topEnergyMonth = pickHighestBy(monthsWithTrend, (month) => month?.energy_kwh);
  const topCostMonth = pickHighestBy(monthsWithTrend, (month) => month?.cost);

  return {
    ok: true,
    year: normalizeAnalyticsYear(year),
    months: monthsWithTrend,
    top_energy_month: topEnergyMonth ? { month: topEnergyMonth.month, energy_kwh: topEnergyMonth.energy_kwh } : null,
    top_cost_month: topCostMonth ? { month: topCostMonth.month, cost: topCostMonth.cost } : null,
  };
}

const EFFICIENCY_WEIGHTS = {
  price_score: 0.55,
  power_score: 0.25,
  speed_score: 0.2,
};
const EFFICIENCY_NEUTRAL_SCORE = 50;
const EFFICIENCY_MISSING_COMPONENT_SCORE = 35;
const OUTLIER_RULES = [
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

function normalizeDirectionalScore(value, min, max, direction = "high", fallback = EFFICIENCY_NEUTRAL_SCORE) {
  if (!Number.isFinite(value) || max <= min) return fallback;

  if (direction === "low") {
    return clamp(((max - value) / (max - min)) * 100, 0, 100);
  }

  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

function buildEfficiencyBaseline(enrichedRows) {
  const priceValues = collectMetricValues(enrichedRows, (row) => row?._derived?.price_per_kwh, (value) => value > 0);
  const powerValues = collectMetricValues(enrichedRows, (row) => row?._derived?.avg_power_kw, (value) => value > 0);
  const mpkValues = collectMetricValues(enrichedRows, (row) => row?._derived?.minutes_per_kwh, (value) => value > 0);

  const priceRange = {
    min: priceValues.length ? Math.min(...priceValues) : 0,
    max: priceValues.length ? Math.max(...priceValues) : 0,
  };
  const powerRange = {
    min: powerValues.length ? Math.min(...powerValues) : 0,
    max: powerValues.length ? Math.max(...powerValues) : 0,
  };
  const minutesRange = {
    min: mpkValues.length ? Math.min(...mpkValues) : 0,
    max: mpkValues.length ? Math.max(...mpkValues) : 0,
  };

  return {
    priceRange,
    powerRange,
    minutesRange,
    baseline: {
      price_min: round(priceRange.min, 3),
      price_max: round(priceRange.max, 3),
      power_min_kw: round(powerRange.min, 1),
      power_max_kw: round(powerRange.max, 1),
      minutes_per_kwh_min: round(minutesRange.min, 2),
      minutes_per_kwh_max: round(minutesRange.max, 2),
    },
  };
}

function scoreEfficiencyRow(row, ranges) {
  const derived = row._derived;
  const priceScore = normalizeDirectionalScore(
    derived.price_per_kwh,
    ranges.priceRange.min,
    ranges.priceRange.max,
    "low"
  );
  const powerScore =
    derived.avg_power_kw > 0
      ? normalizeDirectionalScore(derived.avg_power_kw, ranges.powerRange.min, ranges.powerRange.max, "high")
      : EFFICIENCY_MISSING_COMPONENT_SCORE;
  const speedScore =
    derived.minutes_per_kwh > 0
      ? normalizeDirectionalScore(derived.minutes_per_kwh, ranges.minutesRange.min, ranges.minutesRange.max, "low")
      : EFFICIENCY_MISSING_COMPONENT_SCORE;
  const score =
    priceScore * EFFICIENCY_WEIGHTS.price_score +
    powerScore * EFFICIENCY_WEIGHTS.power_score +
    speedScore * EFFICIENCY_WEIGHTS.speed_score;

  return {
    session_id: row.id,
    date: row.date,
    connector: row.connector,
    energy_kwh: round(derived.energy_kwh, 1),
    total_cost: round(derived.total_cost, 2),
    duration_seconds: derived.duration_seconds || null,
    avg_power_kw: derived.avg_power_kw > 0 ? round(derived.avg_power_kw, 1) : null,
    price_per_kwh: derived.price_per_kwh > 0 ? round(derived.price_per_kwh, 3) : null,
    score: round(score, 1),
    breakdown: {
      price_score: round(priceScore, 1),
      power_score: round(powerScore, 1),
      speed_score: round(speedScore, 1),
    },
  };
}

function getPositiveSocDelta(row) {
  const start = Number(row?.soc_start);
  const end = Number(row?.soc_end);
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? round(end - start, 1) : null;
}

function buildScoredSessionDetails(row, scored) {
  const socStart = Number(row?.soc_start);
  const socEnd = Number(row?.soc_end);

  return {
    ...scored,
    minutes_per_kwh: row._derived.minutes_per_kwh > 0 ? round(row._derived.minutes_per_kwh, 2) : null,
    soc_delta: getPositiveSocDelta(row),
    soc_start: Number.isFinite(socStart) ? socStart : null,
    soc_end: Number.isFinite(socEnd) ? socEnd : null,
  };
}

function buildEfficiencyAnalysisContext(rows, year) {
  const framework = buildEfficiencyFramework(rows, year);
  const entries = framework.rows.map((row) => {
    const scored = framework.scoreRow(row);
    return {
      row,
      scored,
      details: buildScoredSessionDetails(row, scored),
    };
  });

  return {
    ...framework,
    entries,
    scoredRows: entries.map((entry) => entry.scored),
    detailedRows: entries.map((entry) => entry.details),
  };
}

function getEfficiencyScoreLabel(score) {
  if (score == null) return "Keine Daten";
  if (score >= 80) return "Sehr effizient";
  if (score >= 65) return "Effizient";
  if (score >= 50) return "Solide";
  return "Optimierungspotenzial";
}

function averageMetric(rows, reader, digits = 2, options = {}) {
  const { emptyValue = null, predicate = () => true } = options;
  const values = collectMetricValues(rows, reader, predicate);
  if (!values.length) return emptyValue;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length, digits);
}

function selectDirectionalHighlight(rows, reader, direction = "desc") {
  return direction === "asc" ? pickLowestBy(rows, reader) : pickHighestBy(rows, reader);
}

function filterSessionsByReason(flaggedSessions, reasonKey) {
  return (flaggedSessions || []).filter((session) =>
    (session.reasons || []).some((reason) => reason.key === reasonKey)
  );
}

function buildDirectionalHighlights(rows, definitions) {
  return Object.fromEntries(
    definitions.map(({ key, source, reader, direction = "desc" }) => [
      key,
      selectDirectionalHighlight(source ? source(rows) : rows, reader, direction),
    ])
  );
}

function buildEfficiencyFramework(rows, year) {
  const enriched = filterByYear(rows, year).map((row) => ({ ...row, _derived: buildDerived(row) }));
  const ranges = buildEfficiencyBaseline(enriched);

  return {
    rows: enriched,
    scoreRow: (row) => scoreEfficiencyRow(row, ranges),
    baseline: ranges.baseline,
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

  const seasons = Object.values(SEASON_META).map((meta) => buildSeasonSummary(meta, buckets[meta.key] || [], fw.scoreRow));

  const active = seasons.filter((s) => s.count > 0);
  const best_efficiency_season = pickHighestBy(active, (season) => season?.efficiency_score);
  const cheapest_season = pickLowestBy(active, (season) => season?.avg_price_per_kwh);

  return {
    ok: true,
    year: normalizeAnalyticsYear(year),
    seasons,
    highlights: { best_efficiency_season, cheapest_season },
    baseline: fw.baseline,
  };
}

function computeEfficiencyFromSessions(rows, year) {
  const context = buildEfficiencyAnalysisContext(rows, year);
  const scored = context.scoredRows;
  const overall = averageMetric(scored, (session) => session?.score, 1, { emptyValue: null });

  return {
    ok: true,
    year: normalizeAnalyticsYear(year),
    overall_score: overall,
    score_label: getEfficiencyScoreLabel(overall),
    session_count: scored.length,
    averages: {
      price_per_kwh: averageMetric(scored, (session) => session?.price_per_kwh, 3, {
        emptyValue: null,
        predicate: (value) => value > 0,
      }),
      power_kw: averageMetric(scored, (session) => session?.avg_power_kw, 1, {
        emptyValue: null,
        predicate: (value) => value > 0,
      }),
    },
    best_session: pickHighestBy(scored, (session) => session?.score),
    worst_session: pickLowestBy(scored, (session) => session?.score),
    cheapest_session: pickLowestBy(scored, (session) => session?.price_per_kwh),
    fastest_session: pickHighestBy(scored, (session) => session?.avg_power_kw),
    baseline: context.baseline,
    weights: EFFICIENCY_WEIGHTS,
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
  const socDelta = getPositiveSocDelta(row);
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
  if (socDelta != null && socDelta > 0) {
    target.total_soc_delta += socDelta * countWeight;
    target.soc_delta_weight += countWeight;
  }

  target.best_session =
    !target.best_session || Number(scored.score || 0) > Number(target.best_session.score || -1) ? scored : target.best_session;
  target.worst_session =
    !target.worst_session || Number(scored.score || 0) < Number(target.worst_session.score || Infinity) ? scored : target.worst_session;
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
  const context = buildEfficiencyAnalysisContext(rows, year);
  const byWindow = new Map();
  const byBand = new Map();
  let analyzedSessionCount = 0;

  for (const entry of context.entries) {
    const { row, details } = entry;
    const windowMeta = getSocWindowMeta(row?.soc_start, row?.soc_end);
    if (!windowMeta) continue;
    analyzedSessionCount += 1;

    const windowBucket = byWindow.get(windowMeta.key) || createSocAggregate(windowMeta);
    accumulateSocAggregate(windowBucket, details, row, { weight: 1, countWeight: 1 });
    byWindow.set(windowMeta.key, windowBucket);

    const bandSlices = getSocBandSlices(row?.soc_start, row?.soc_end);
    for (const bandMeta of bandSlices) {
      const bandBucket = byBand.get(bandMeta.key) || createSocAggregate(bandMeta);
      accumulateSocAggregate(bandBucket, details, row, { weight: bandMeta.weight, countWeight: 1 });
      byBand.set(bandMeta.key, bandBucket);
    }
  }

  const analyzed_session_count = analyzedSessionCount;
  const windows = finalizeSocAggregates(byWindow, analyzed_session_count);
  const bands = finalizeSocAggregates(byBand, analyzed_session_count);
  const highlightPool = bands.length ? bands : windows;

  return {
    ok: true,
    year: normalizeAnalyticsYear(year),
    analyzed_session_count,
    windows,
    bands,
    highlights: buildDirectionalHighlights(highlightPool, [
      { key: "best_efficiency_window", reader: (window) => window?.avg_score, direction: "desc" },
      { key: "cheapest_window", reader: (window) => window?.avg_price_per_kwh, direction: "asc" },
      { key: "fastest_window", reader: (window) => window?.avg_power_kw, direction: "desc" },
      { key: "widest_window", reader: (window) => window?.avg_soc_delta, direction: "desc" },
    ]),
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

function isDirectionalOutlier(value, threshold, direction) {
  return direction === "high" ? value > Number(threshold) : value < Number(threshold);
}

function buildOutlierReason(rule, value, baseline) {
  const median = Number(baseline.median);
  const deviationPct =
    Number.isFinite(median) && median !== 0
      ? round((Math.abs(value - median) / Math.abs(median)) * 100, 1)
      : null;

  return {
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
}

function buildOutlierHighlights(flaggedSessions) {
  return {
    worst_session: flaggedSessions[0] || null,
    ...buildDirectionalHighlights(flaggedSessions, [
      {
        key: "priciest_outlier",
        source: (sessions) => filterSessionsByReason(sessions, "price_per_kwh"),
        reader: (session) => session?.price_per_kwh,
        direction: "desc",
      },
      {
        key: "lowest_power_outlier",
        source: (sessions) => filterSessionsByReason(sessions, "avg_power_kw"),
        reader: (session) => session?.avg_power_kw,
        direction: "asc",
      },
      {
        key: "longest_outlier",
        source: (sessions) => filterSessionsByReason(sessions, "duration_seconds"),
        reader: (session) => session?.duration_seconds,
        direction: "desc",
      },
      {
        key: "weakest_score_outlier",
        source: (sessions) => filterSessionsByReason(sessions, "score"),
        reader: (session) => session?.score,
        direction: "asc",
      },
    ]),
  };
}

export function computeOutlierAnalytics(rows, year = 2026) {
  const context = buildEfficiencyAnalysisContext(rows, year);
  const scored = context.detailedRows;

  const baselines = {};
  const bySession = new Map();

  for (const rule of OUTLIER_RULES) {
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
      if (!isDirectionalOutlier(value, baseline.threshold, rule.direction)) continue;

      const reason = buildOutlierReason(rule, value, baseline);

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
        rule.weight + (reason.deviation_pct != null ? Math.min(4, reason.deviation_pct / 20) : 0);

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

  return {
    ok: true,
    year: normalizeAnalyticsYear(year),
    session_count: scored.length,
    outlier_count: flagged_sessions.length,
    flagged_sessions,
    baselines,
    highlights: buildOutlierHighlights(flagged_sessions),
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

  const odoStartRaw = payload?.odo_start_km ?? payload?.odoStartKm ?? payload?.km_start;
  const odoEndRaw = payload?.odo_end_km ?? payload?.odoEndKm ?? payload?.km_end ?? payload?.odometer_km ?? payload?.odometerKm;
  const odoStart = hasFiniteNumber(odoStartRaw) ? Math.max(0, Math.round(Number(odoStartRaw))) : null;
  const odoEnd = hasFiniteNumber(odoEndRaw) ? Math.max(0, Math.round(Number(odoEndRaw))) : null;
  const vehicle = normalizeSessionText(payload?.vehicle ?? payload?.fahrzeug) || DEFAULT_VEHICLE;
  const tags = normalizeTagsInput(payload?.tags ?? payload?.schlagworte);

  return {
    id: payload?.id || `demo-user-${safeUUID()}`,
    date,
    energy_kwh: Number(Math.max(0, energy).toFixed(1)),
    total_cost: Number(Math.max(0, cost).toFixed(2)),
    duration_seconds: Math.max(0, Math.round(durSec)),
    price_per_kwh: Number(Math.max(0, pricePerKwh).toFixed(3)),
    provider: normalizeSessionText(payload?.provider || payload?.anbieter) || "DemoNet",
    location: normalizeSessionText(payload?.location || payload?.ort) || "Demo Charger",
    vehicle,
    tags: tags.join(", "),
    connector: payload?.connector || payload?.anschluss || CONNECTOR_OPTIONS[0] || "CCS - DC",
    soc_start: payload?.soc_start ?? payload?.socStart ?? 10,
    soc_end: payload?.soc_end ?? payload?.socEnd ?? 80,
    note: payload?.note ? String(payload.note) : null,
    odo_start_km: odoStart,
    odo_end_km: odoEnd != null && odoStart != null && odoEnd < odoStart ? odoStart : odoEnd,
  };
}

function buildSessionNormalizationInput(existing, payload) {
  const current = existing || {};
  const next = payload || {};

  return {
    ...current,
    ...next,
    id: current.id ?? next.id,
    date: firstDefined(next?.date, next?.datum, next?.session_date, current?.date, current?.datum, current?.session_date),
    energy_kwh: firstDefined(
      next?.energy_kwh,
      next?.energyKWh,
      next?.kwh,
      next?.energy,
      current?.energy_kwh,
      current?.energyKWh,
      current?.kwh,
      current?.energy
    ),
    price_per_kwh: firstDefined(next?.price_per_kwh, next?.pricePerKwh, current?.price_per_kwh, current?.pricePerKwh),
    total_cost: firstDefined(
      next?.total_cost,
      next?.costEur,
      next?.cost,
      next?.eur,
      current?.total_cost,
      current?.costEur,
      current?.cost,
      current?.eur
    ),
    duration_seconds: firstDefined(
      next?.duration_seconds,
      next?.durationSeconds,
      next?.duration,
      current?.duration_seconds,
      current?.durationSeconds,
      current?.duration
    ),
    duration_minutes: firstDefined(next?.duration_minutes, next?.durationMinutes, current?.duration_minutes, current?.durationMinutes),
    provider: firstDefined(next?.provider, next?.anbieter, current?.provider, current?.anbieter),
    location: firstDefined(next?.location, next?.ort, current?.location, current?.ort),
    vehicle: firstDefined(next?.vehicle, next?.fahrzeug, current?.vehicle, current?.fahrzeug),
    tags: firstDefined(next?.tags, next?.schlagworte, current?.tags, current?.schlagworte),
    connector: firstDefined(next?.connector, next?.anschluss, current?.connector, current?.anschluss),
    soc_start: firstDefined(next?.soc_start, next?.socStart, current?.soc_start, current?.socStart),
    soc_end: firstDefined(next?.soc_end, next?.socEnd, current?.soc_end, current?.socEnd),
    odo_start_km: firstDefined(next?.odo_start_km, next?.odoStartKm, next?.km_start, current?.odo_start_km, current?.odoStartKm, current?.km_start),
    odo_end_km: firstDefined(
      next?.odo_end_km,
      next?.odoEndKm,
      next?.km_end,
      next?.odometer_km,
      next?.odometerKm,
      current?.odo_end_km,
      current?.odoEndKm,
      current?.km_end,
      current?.odometer_km,
      current?.odometerKm
    ),
    note: next?.note ?? current?.note,
  };
}

function getDemoSessionsResult(year) {
  return {
    ok: true,
    rows: sortSessionsDesc(filterByYear(getDemoYearRows(year), year)),
  };
}

function getDemoDashboardBundleValue(cacheKey, year) {
  return setDashboardCacheValue(cacheKey, buildDashboardBundleFromSessions(getAllDemoRows(), year));
}

function resolveDemoOrRemote(year, demoResolver, remoteResolver) {
  if (isDemoMode) return demoResolver(year);
  return remoteResolver(year);
}

async function runSessionMutation(executor) {
  const result = await executor();
  invalidateDashboardBundleCache();
  return result;
}

function createDemoSession(payload) {
  const candidate = normalizePayloadToSession(payload || {});
  const year = parseDateParts(candidate.date)?.year ?? DEMO_DEFAULT_YEAR;
  if (getDemoTotalRowCount() >= DEMO_MAX_ROWS) {
    throw new Error(`Demo-Limit erreicht (${DEMO_MAX_ROWS} Einträge insgesamt). Reload = neue Demo-Daten.`);
  }

  const rows = getDemoYearRows(year);
  const row = ensureDemoOdometer(candidate, year, rows);
  setDemoYearRows(year, [...rows, row]);
  return { ok: true, demo: true, row };
}

function updateDemoSession(id, payload) {
  const existing = findDemoSessionRecord(id);
  if (!existing) {
    throw new Error("Session not found");
  }

  const candidate = normalizePayloadToSession(buildSessionNormalizationInput(existing.session, payload));
  const targetYear = parseDateParts(candidate.date)?.year ?? existing.year;
  const targetRows = withoutSessionId(getDemoYearRows(targetYear), id);
  const updated = ensureDemoOdometer(candidate, targetYear, targetRows);

  setDemoYearRows(existing.year, withoutSessionId(existing.rows, id));
  setDemoYearRows(targetYear, [...withoutSessionId(getDemoYearRows(targetYear), id), updated]);
  return { ok: true, demo: true, updated };
}

function deleteDemoSession(id) {
  const existing = findDemoSessionRecord(id);
  if (!existing) {
    throw new Error("Session not found");
  }

  setDemoYearRows(existing.year, withoutSessionId(existing.rows, id));
  return { ok: true, demo: true, deleted: existing.session };
}

function getCsvUrl(year, remoteResolver) {
  if (isDemoMode) return null;
  return remoteResolver(year);
}

export async function getStats(year = 2026) {
  return resolveDemoOrRemote(year, (selectedYear) => computeStatsFromSessions(getDemoYearRows(selectedYear), selectedYear), getStatsRemote);
}

export async function getDashboardBundle(year = 2026) {
  const cacheMode = isDemoMode ? "demo" : "real";
  const cacheKey = dashboardCacheKey(year, cacheMode);
  const cachedEntry = getDashboardCacheEntry(cacheKey);
  if (cachedEntry?.value) return cachedEntry.value;
  if (cachedEntry?.promise) return cachedEntry.promise;

  if (isDemoMode) {
    return getDemoDashboardBundleValue(cacheKey, year);
  }

  const request = getDashboardBundleRemote(year)
    .then((bundle) => setDashboardCacheValue(cacheKey, bundle))
    .catch((error) => {
      deleteDashboardCacheEntry(cacheKey);
      throw error;
    });

  setDashboardCachePromise(cacheKey, request);
  return request;
}

export async function getSessions(year = 2026) {
  return resolveDemoOrRemote(year, getDemoSessionsResult, getSessionsRemote);
}

export async function getMonthly(year = 2026) {
  return resolveDemoOrRemote(year, (selectedYear) => computeMonthlyFromSessions(getDemoYearRows(selectedYear), selectedYear), getMonthlyRemote);
}

export async function getSeasons(year = 2026) {
  return resolveDemoOrRemote(year, (selectedYear) => computeSeasonAnalytics(getDemoYearRows(selectedYear), selectedYear), getSeasonsRemote);
}

export async function getEfficiency(year = 2026) {
  return resolveDemoOrRemote(
    year,
    (selectedYear) => computeEfficiencyFromSessions(getDemoYearRows(selectedYear), selectedYear),
    getEfficiencyRemote
  );
}

export async function getOutliers(year = 2026) {
  return resolveDemoOrRemote(year, (selectedYear) => computeOutlierAnalytics(getDemoYearRows(selectedYear), selectedYear), getOutliersRemote);
}

export async function createSession(payload) {
  return runSessionMutation(() => (isDemoMode ? createDemoSession(payload) : createSessionRemote(payload)));
}

export async function updateSession(id, payload) {
  if (!id) throw new Error("Missing id");

  return runSessionMutation(() => (isDemoMode ? updateDemoSession(id, payload) : updateSessionRemote(id, payload)));
}

export async function restoreSession(payload) {
  return createSession(payload);
}

export function getMonthlyCsvUrl(year = 2026) {
  return getCsvUrl(year, getMonthlyCsvUrlRemote);
}

export function getSessionsCsvUrl(year = 2026) {
  return getCsvUrl(year, getSessionsCsvUrlRemote);
}

export function getSeasonsCsvUrl(year = 2026) {
  return getCsvUrl(year, getSeasonsCsvUrlRemote);
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

  return runSessionMutation(() => (isDemoMode ? deleteDemoSession(id) : deleteSessionRemote(id)));
}

export function invalidateDashboardBundleCache(year = null) {
  invalidateDashboardBundleCacheByMode(isDemoMode ? "demo" : "real", year);
}
