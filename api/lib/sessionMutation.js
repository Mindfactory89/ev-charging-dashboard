'use strict';

const { normalizeOptionalText, normalizeTagsInput } = require('./sessionMetadata');

const REQUIRED_FIELDS = ['date', 'connector', 'soc_start', 'soc_end', 'energy_kwh', 'price_per_kwh'];

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

function validateRequiredFields(payload) {
  for (const key of REQUIRED_FIELDS) {
    if (payload[key] === undefined || payload[key] === null || payload[key] === '') {
      return { error: `Fehlendes Feld: ${key}` };
    }
  }

  return { error: null };
}

function parseDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { error: 'Ungültiges Datum.' };
  }

  return { value: date };
}

function normalizeConnector(value) {
  const connector = String(value).replace(/\s+/g, ' ').trim();
  if (!connector) {
    return { error: 'Anschluss darf nicht leer sein.' };
  }

  return { value: connector };
}

function parseSocRange(payload) {
  const soc_start = parseBoundedInteger(payload.soc_start, 0, 100);
  const soc_end = parseBoundedInteger(payload.soc_end, 0, 100);

  if (soc_start == null || soc_end == null) {
    return { error: 'SoC Start/Ende muss zwischen 0 und 100 liegen.' };
  }

  if (soc_end < soc_start) {
    return { error: 'SoC Ende darf nicht kleiner als SoC Start sein.' };
  }

  return { value: { soc_start, soc_end } };
}

function parsePositiveNumber(value, errorMessage) {
  const parsed = parseFiniteNumber(value);
  if (parsed == null || parsed <= 0) {
    return { error: errorMessage };
  }

  return { value: parsed };
}

function parseDurationSeconds(payload) {
  if (payload.duration_hhmm != null && payload.duration_hhmm !== '') {
    const durationSeconds = hhmmToSeconds(payload.duration_hhmm);
    if (durationSeconds == null || durationSeconds <= 0) {
      return { error: 'Dauer muss als HH:MM angegeben werden.' };
    }

    return { value: Math.round(durationSeconds) };
  }

  if (payload.duration_seconds != null && payload.duration_seconds !== '') {
    const durationSeconds = parseFiniteNumber(payload.duration_seconds);
    if (durationSeconds == null || durationSeconds <= 0) {
      return { error: 'Dauer in Sekunden muss größer als 0 sein.' };
    }

    return { value: Math.round(durationSeconds) };
  }

  return { value: null };
}

function parseOdometerRange(payload) {
  const odo_start_km = parseOptionalNonNegativeInteger(payload.odo_start_km);
  const odo_end_km = parseOptionalNonNegativeInteger(payload.odo_end_km ?? payload.odometer_km);

  if (Number.isNaN(odo_start_km) || Number.isNaN(odo_end_km)) {
    return { error: 'Kilometerstände müssen positive Ganzzahlen sein.' };
  }

  if (odo_start_km != null && odo_end_km != null && odo_end_km < odo_start_km) {
    return { error: 'Kilometer Ende darf nicht kleiner als Kilometer Start sein.' };
  }

  return { value: { odo_start_km, odo_end_km } };
}

function buildSessionMutationData(payload, parsed) {
  return {
    date: parsed.date,
    connector: parsed.connector,
    provider: normalizeOptionalText(payload.provider),
    location: normalizeOptionalText(payload.location),
    vehicle: normalizeOptionalText(payload.vehicle),
    vehicle_profile_id: normalizeOptionalText(payload.vehicle_profile_id),
    tags: normalizeTagsInput(payload.tags),
    soc_start: parsed.soc.soc_start,
    soc_end: parsed.soc.soc_end,
    energy_kwh: parsed.energy,
    price_per_kwh: parsed.price,
    total_cost: Number((parsed.energy * parsed.price).toFixed(2)),
    duration_seconds: parsed.duration_seconds,
    note: payload.note ? String(payload.note) : null,
    odo_start_km: parsed.odometer.odo_start_km,
    odo_end_km: parsed.odometer.odo_end_km,
  };
}

function parseSessionMutation(body) {
  const payload = body || {};

  const requiredFields = validateRequiredFields(payload);
  if (requiredFields.error) {
    return { error: requiredFields.error };
  }

  const date = parseDate(payload.date);
  if (date.error) {
    return { error: date.error };
  }

  const connector = normalizeConnector(payload.connector);
  if (connector.error) {
    return { error: connector.error };
  }

  const soc = parseSocRange(payload);
  if (soc.error) {
    return { error: soc.error };
  }

  const energy = parsePositiveNumber(payload.energy_kwh, 'Energie (kWh) muss größer als 0 sein.');
  if (energy.error) {
    return { error: energy.error };
  }

  const price = parsePositiveNumber(payload.price_per_kwh, 'Preis pro kWh muss größer als 0 sein.');
  if (price.error) {
    return { error: price.error };
  }

  const durationSeconds = parseDurationSeconds(payload);
  if (durationSeconds.error) {
    return { error: durationSeconds.error };
  }

  const odometer = parseOdometerRange(payload);
  if (odometer.error) {
    return { error: odometer.error };
  }

  return {
    data: buildSessionMutationData(payload, {
      date: date.value,
      connector: connector.value,
      soc: soc.value,
      energy: energy.value,
      price: price.value,
      duration_seconds: durationSeconds.value,
      odometer: odometer.value,
    }),
  };
}

module.exports = {
  parseSessionMutation,
};
