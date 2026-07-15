export const ADD_SESSION_FIELD_ORDER = [
  "date",
  "connector",
  "socStart",
  "socEnd",
  "energyKwh",
  "pricePerKwh",
  "durationHHMM",
  "odometerKm",
];

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function createInitialAddSessionValues(now = new Date()) {
  return {
    date: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`,
    connector: "",
    socStart: 14,
    socEnd: 80,
    energyKwh: "",
    pricePerKwh: "0.59",
    durationHHMM: "00:30",
    odometerKm: "",
    provider: "",
    location: "",
    vehicle: "",
    tags: "",
    note: "",
  };
}

export function parseLocalizedNumber(value) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function durationToSeconds(value) {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) return null;
  return hours * 3600 + minutes * 60;
}

function issue(key, values = undefined) {
  return values ? { key, values } : { key };
}

export function validateAddSessionValues(values, bounds = {}) {
  const errors = {};
  const energy = parseLocalizedNumber(values.energyKwh);
  const price = parseLocalizedNumber(values.pricePerKwh);
  const duration = durationToSeconds(values.durationHHMM);
  const odometer = values.odometerKm === "" ? null : Number(values.odometerKm);
  const socStart = Number(values.socStart);
  const socEnd = Number(values.socEnd);

  if (!values.date) errors.date = issue("date");
  if (!values.connector) errors.connector = issue("connector");
  if (!Number.isFinite(socStart) || socStart < 0 || socStart > 100) errors.socStart = issue("socStart");
  if (!Number.isFinite(socEnd) || socEnd < 0 || socEnd > 100) errors.socEnd = issue("socEnd");
  if (!errors.socStart && !errors.socEnd && socEnd < socStart) errors.socEnd = issue("socOrder");
  if (!Number.isFinite(energy) || energy <= 0) errors.energyKwh = issue("energy");
  if (!Number.isFinite(price) || price <= 0) errors.pricePerKwh = issue("price");
  if (duration == null || duration <= 0) errors.durationHHMM = issue("duration");

  if (odometer != null && (!Number.isInteger(odometer) || odometer < 0)) {
    errors.odometerKm = issue("odometer");
  } else if (odometer != null && bounds.previousOdometerKm != null && odometer < bounds.previousOdometerKm) {
    errors.odometerKm = issue("odometerMin", { value: bounds.previousOdometerKm });
  } else if (odometer != null && bounds.nextOdometerKm != null && odometer > bounds.nextOdometerKm) {
    errors.odometerKm = issue("odometerMax", { value: bounds.nextOdometerKm });
  }

  return errors;
}
