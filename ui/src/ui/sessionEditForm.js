import { deriveMobilityForSession, getSessionOdometerKm } from "./sessionIntelligence.js";
import { formatTags } from "./sessionMetadata.js";

export const SESSION_EDIT_FIELD_ORDER = [
  "date",
  "energy_kwh",
  "price_per_kwh",
  "duration_hhmm",
  "soc_start",
  "soc_end",
  "odometer_km",
];

export function durationToHHMM(value) {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function hhmmToSeconds(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) return null;
  return hours * 3600 + minutes * 60;
}

export function parseDecimalInput(value) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  return normalized ? Number(normalized) : Number.NaN;
}

export function parseIntegerInput(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
}

export function effectivePricePerKwh(row) {
  const direct = Number(row?.price_per_kwh);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const energy = Number(row?.energy_kwh);
  const cost = Number(row?.total_cost);
  if (!Number.isFinite(energy) || energy <= 0 || !Number.isFinite(cost) || cost < 0) return null;
  return cost / energy;
}

export function buildSessionEditDraft(row) {
  const pricePerKwh = effectivePricePerKwh(row);
  const odometerKm = getSessionOdometerKm(row);
  return {
    date: row?.date ? new Date(row.date).toISOString().slice(0, 10) : "",
    provider: row?.provider || "",
    location: row?.location || "",
    vehicle: row?.vehicle || "",
    tags: row?.tags || "",
    connector: row?.connector || "Type 2",
    soc_start: String(row?.soc_start ?? 10),
    soc_end: String(row?.soc_end ?? 80),
    energy_kwh: row?.energy_kwh != null ? String(row.energy_kwh) : "",
    price_per_kwh: pricePerKwh != null ? String(Number(pricePerKwh).toFixed(3)) : "",
    duration_hhmm: durationToHHMM(row?.duration_seconds),
    odometer_km: odometerKm != null ? String(odometerKm) : "",
    note: row?.note || "",
  };
}

function normalizedDraft(draft) {
  return {
    date: String(draft?.date || ""),
    provider: String(draft?.provider || "").trim(),
    location: String(draft?.location || "").trim(),
    vehicle: String(draft?.vehicle || "").trim(),
    tags: formatTags(draft?.tags || ""),
    connector: String(draft?.connector || "Type 2"),
    soc_start: Number.parseInt(String(draft?.soc_start || ""), 10),
    soc_end: Number.parseInt(String(draft?.soc_end || ""), 10),
    energy_kwh: Number.isFinite(parseDecimalInput(draft?.energy_kwh))
      ? Number(parseDecimalInput(draft?.energy_kwh).toFixed(3))
      : null,
    price_per_kwh: Number.isFinite(parseDecimalInput(draft?.price_per_kwh))
      ? Number(parseDecimalInput(draft?.price_per_kwh).toFixed(3))
      : null,
    duration_seconds: hhmmToSeconds(draft?.duration_hhmm),
    odometer_km: parseIntegerInput(draft?.odometer_km),
    note: String(draft?.note || "").trim(),
  };
}

export function sessionEditHasChanges(row, draft) {
  if (!row || !draft) return false;
  return JSON.stringify(normalizedDraft(draft)) !== JSON.stringify(normalizedDraft(buildSessionEditDraft(row)));
}

export function buildSessionEditPreview(draft, sessions = [], row = null) {
  const energy = parseDecimalInput(draft?.energy_kwh);
  const price = parseDecimalInput(draft?.price_per_kwh);
  const durationSeconds = hhmmToSeconds(draft?.duration_hhmm);
  const socStart = Number.parseInt(String(draft?.soc_start ?? ""), 10);
  const socEnd = Number.parseInt(String(draft?.soc_end ?? ""), 10);
  const odometerKm = parseIntegerInput(draft?.odometer_km);
  const totalCost = Number.isFinite(energy) && energy > 0 && Number.isFinite(price) && price > 0 ? energy * price : null;
  const avgPowerKw = Number.isFinite(energy) && energy > 0 && durationSeconds > 0
    ? energy / (durationSeconds / 3600)
    : null;
  const odometerValid = odometerKm == null || Number.isInteger(odometerKm);
  const candidate = odometerValid
    ? deriveMobilityForSession(sessions, {
        ...row,
        id: row?.id || "__draft__",
        date: draft?.date || row?.date || new Date().toISOString(),
        energy_kwh: energy,
        total_cost: totalCost,
        duration_seconds: durationSeconds,
        price_per_kwh: price,
        soc_start: socStart,
        soc_end: socEnd,
        odo_end_km: odometerKm,
      })
    : null;

  return {
    energy,
    price,
    durationSeconds,
    socStart,
    socEnd,
    odometerKm,
    totalCost,
    avgPowerKw,
    socDelta: Number.isInteger(socStart) && Number.isInteger(socEnd) ? socEnd - socStart : null,
    previousOdometerKm: candidate?.previousOdometerKm ?? null,
    nextOdometerKm: candidate?.nextOdometerKm ?? null,
    distanceKm: candidate?.distanceKm ?? null,
    costPer100Km: candidate?.costPer100Km ?? null,
  };
}

export function validateSessionEditDraft(draft, sessions = [], row = null) {
  const preview = buildSessionEditPreview(draft, sessions, row);
  const errors = {};
  if (!draft?.date) errors.date = { key: "date" };
  if (!Number.isFinite(preview.energy) || preview.energy <= 0) errors.energy_kwh = { key: "energy" };
  if (!Number.isFinite(preview.price) || preview.price <= 0) errors.price_per_kwh = { key: "price" };
  if (!Number.isFinite(preview.durationSeconds) || preview.durationSeconds <= 0) errors.duration_hhmm = { key: "duration" };
  if (!Number.isInteger(preview.socStart) || preview.socStart < 0 || preview.socStart > 100) {
    errors.soc_start = { key: "socStart" };
  }
  if (!Number.isInteger(preview.socEnd) || preview.socEnd < 0 || preview.socEnd > 100) {
    errors.soc_end = { key: "socEnd" };
  } else if (!errors.soc_start && preview.socEnd < preview.socStart) {
    errors.soc_end = { key: "socOrder" };
  }
  if (Number.isNaN(preview.odometerKm)) {
    errors.odometer_km = { key: "odometer" };
  } else if (preview.odometerKm != null && preview.previousOdometerKm != null && preview.odometerKm < preview.previousOdometerKm) {
    errors.odometer_km = { key: "odometerMin", params: { value: preview.previousOdometerKm } };
  } else if (preview.odometerKm != null && preview.nextOdometerKm != null && preview.odometerKm > preview.nextOdometerKm) {
    errors.odometer_km = { key: "odometerMax", params: { value: preview.nextOdometerKm } };
  }
  return { errors, preview, valid: Object.keys(errors).length === 0 };
}

export function sessionEditPayload(draft, preview) {
  return {
    date: draft.date,
    provider: draft.provider || null,
    location: draft.location || null,
    vehicle: draft.vehicle || null,
    tags: formatTags(draft.tags || ""),
    connector: draft.connector,
    soc_start: preview.socStart,
    soc_end: preview.socEnd,
    energy_kwh: preview.energy,
    price_per_kwh: preview.price,
    duration_seconds: preview.durationSeconds,
    odometer_km: preview.odometerKm,
    note: draft.note || null,
  };
}
