'use strict';

const { normalizeOptionalText, normalizeTagsInput } = require('./sessionMetadata');

function hhmmToSeconds(hhmm) {
  const source = String(hhmm ?? '').trim();
  const [hh, mm] = source.split(':').map((value) => Number(value));
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || mm < 0 || mm > 59) return null;
  return hh * 3600 + mm * 60;
}

function parseFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoundedInteger(value, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function parseOptionalNonNegativeInteger(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return NaN;
  return parsed;
}

function parseSessionMutation(body) {
  const payload = body || {};

  const required = ['date', 'connector', 'soc_start', 'soc_end', 'energy_kwh', 'price_per_kwh'];
  for (const key of required) {
    if (payload[key] === undefined || payload[key] === null || payload[key] === '') {
      return { error: `Fehlendes Feld: ${key}` };
    }
  }

  const date = new Date(payload.date);
  if (Number.isNaN(date.getTime())) {
    return { error: 'Ungültiges Datum.' };
  }

  const connector = String(payload.connector).replace(/\s+/g, ' ').trim();
  if (!connector) {
    return { error: 'Anschluss darf nicht leer sein.' };
  }

  const provider = normalizeOptionalText(payload.provider);
  const location = normalizeOptionalText(payload.location);
  const vehicle = normalizeOptionalText(payload.vehicle);
  const tags = normalizeTagsInput(payload.tags);

  const soc_start = parseBoundedInteger(payload.soc_start, 0, 100);
  const soc_end = parseBoundedInteger(payload.soc_end, 0, 100);
  if (soc_start == null || soc_end == null) {
    return { error: 'SoC Start/Ende muss zwischen 0 und 100 liegen.' };
  }
  if (soc_end < soc_start) {
    return { error: 'SoC Ende darf nicht kleiner als SoC Start sein.' };
  }

  const energy = parseFiniteNumber(payload.energy_kwh);
  if (energy == null || energy <= 0) {
    return { error: 'Energie (kWh) muss größer als 0 sein.' };
  }

  const price = parseFiniteNumber(payload.price_per_kwh);
  if (price == null || price <= 0) {
    return { error: 'Preis pro kWh muss größer als 0 sein.' };
  }

  let duration_seconds = null;
  if (payload.duration_hhmm != null && payload.duration_hhmm !== '') {
    duration_seconds = hhmmToSeconds(payload.duration_hhmm);
    if (duration_seconds == null || duration_seconds <= 0) {
      return { error: 'Dauer muss als HH:MM angegeben werden.' };
    }
  } else if (payload.duration_seconds != null && payload.duration_seconds !== '') {
    duration_seconds = parseFiniteNumber(payload.duration_seconds);
    if (duration_seconds == null || duration_seconds <= 0) {
      return { error: 'Dauer in Sekunden muss größer als 0 sein.' };
    }
  }

  if (duration_seconds != null) {
    duration_seconds = Math.round(duration_seconds);
  }

  const odo_start_km = parseOptionalNonNegativeInteger(payload.odo_start_km);
  const odo_end_km = parseOptionalNonNegativeInteger(payload.odo_end_km ?? payload.odometer_km);
  if (Number.isNaN(odo_start_km) || Number.isNaN(odo_end_km)) {
    return { error: 'Kilometerstände müssen positive Ganzzahlen sein.' };
  }
  if (odo_start_km != null && odo_end_km != null && odo_end_km < odo_start_km) {
    return { error: 'Kilometer Ende darf nicht kleiner als Kilometer Start sein.' };
  }

  return {
    data: {
      date,
      connector,
      provider,
      location,
      vehicle,
      tags,
      soc_start,
      soc_end,
      energy_kwh: energy,
      price_per_kwh: price,
      total_cost: Number((energy * price).toFixed(2)),
      duration_seconds,
      note: payload.note ? String(payload.note) : null,
      odo_start_km,
      odo_end_km,
    },
  };
}

module.exports = {
  parseSessionMutation,
};
