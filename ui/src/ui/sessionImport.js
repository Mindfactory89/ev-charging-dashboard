import { formatTags, normalizeSessionText, normalizeTagsInput } from "./sessionMetadata.js";

function splitCsvLine(line, separator) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        current += '"';
        index += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }

    if (char === separator && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function detectSeparator(headerLine) {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function parseCsv(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return { headers: [], rows: [] };

  const separator = detectSeparator(lines[0]);
  const headers = splitCsvLine(lines[0], separator);
  const rows = lines.slice(1).map((line) => splitCsvLine(line, separator));

  return { headers, rows };
}

const FIELD_ALIASES = {
  date: ["date", "datum", "session_date"],
  provider: ["provider", "anbieter", "netzbetreiber"],
  location: ["location", "ort", "standort", "station"],
  vehicle: ["vehicle", "fahrzeug", "car"],
  tags: ["tags", "schlagworte", "kategorien"],
  connector: ["connector", "anschluss", "plug"],
  soc_start: ["soc_start", "soc start", "socstart", "start_soc"],
  soc_end: ["soc_end", "soc ende", "soc end", "socend", "end_soc"],
  energy_kwh: ["energy_kwh", "energy", "kwh", "energie", "geladen_kwh"],
  price_per_kwh: ["price_per_kwh", "preis_pro_kwh", "preis", "price"],
  total_cost: ["total_cost", "cost", "kosten", "eur"],
  duration_hhmm: ["duration_hhmm", "dauer", "duration", "zeit"],
  duration_seconds: ["duration_seconds"],
  odometer_km: ["odometer_km", "kilometer", "km", "odo_end_km", "kilometerstand"],
  note: ["note", "notiz", "beschreibung"],
};

function normalizeHeader(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function autoMapHeaders(headers) {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const mapping = {};

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const matchIndex = normalizedHeaders.findIndex((header) => aliases.includes(header));
    if (matchIndex >= 0) mapping[field] = headers[matchIndex];
  }

  return mapping;
}

function readMappedValue(record, mapping, field) {
  const header = mapping?.[field];
  return header ? record[header] : "";
}

function parseNumber(value) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseInteger(value) {
  const numeric = parseNumber(value);
  return Number.isInteger(numeric) ? numeric : numeric == null ? null : Math.round(numeric);
}

function parseDuration(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number(text);

  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60;
}

function buildDedupeKey(payload) {
  return [
    payload.date,
    payload.provider || "",
    payload.location || "",
    payload.connector || "",
    payload.energy_kwh != null ? Number(payload.energy_kwh).toFixed(1) : "",
    payload.total_cost != null ? Number(payload.total_cost).toFixed(2) : "",
  ].join("|");
}

function buildExistingKeys(sessions = []) {
  return new Set(
    sessions.map((session) =>
      buildDedupeKey({
        date: session?.date ? new Date(session.date).toISOString().slice(0, 10) : "",
        provider: session?.provider,
        location: session?.location,
        connector: session?.connector,
        energy_kwh: session?.energy_kwh,
        total_cost: session?.total_cost,
      })
    )
  );
}

function normalizeImportRecord(record, mapping) {
  const date = normalizeSessionText(readMappedValue(record, mapping, "date"));
  const energy = parseNumber(readMappedValue(record, mapping, "energy_kwh"));
  const explicitPrice = parseNumber(readMappedValue(record, mapping, "price_per_kwh"));
  const totalCost = parseNumber(readMappedValue(record, mapping, "total_cost"));
  const pricePerKwh =
    explicitPrice != null && explicitPrice > 0
      ? explicitPrice
      : energy != null && energy > 0 && totalCost != null && totalCost >= 0
        ? totalCost / energy
        : null;

  const payload = {
    date,
    provider: normalizeSessionText(readMappedValue(record, mapping, "provider")),
    location: normalizeSessionText(readMappedValue(record, mapping, "location")),
    vehicle: normalizeSessionText(readMappedValue(record, mapping, "vehicle")),
    tags: formatTags(readMappedValue(record, mapping, "tags")),
    connector: normalizeSessionText(readMappedValue(record, mapping, "connector")) || "CCS - DC",
    soc_start: parseInteger(readMappedValue(record, mapping, "soc_start")),
    soc_end: parseInteger(readMappedValue(record, mapping, "soc_end")),
    energy_kwh: energy,
    price_per_kwh: pricePerKwh != null ? Number(pricePerKwh.toFixed(3)) : null,
    duration_seconds:
      parseDuration(readMappedValue(record, mapping, "duration_seconds")) ??
      parseDuration(readMappedValue(record, mapping, "duration_hhmm")),
    odometer_km: parseInteger(readMappedValue(record, mapping, "odometer_km")),
    note: normalizeSessionText(readMappedValue(record, mapping, "note")),
  };

  const missing = [];
  for (const field of ["date", "energy_kwh", "price_per_kwh", "soc_start", "soc_end"]) {
    if (payload[field] == null || payload[field] === "") missing.push(field);
  }

  return {
    payload,
    missing,
    dedupeKey: buildDedupeKey({
      ...payload,
      total_cost:
        payload.energy_kwh != null && payload.price_per_kwh != null
          ? payload.energy_kwh * payload.price_per_kwh
          : totalCost,
    }),
  };
}

export function buildImportPreview(text, sessions = []) {
  const { headers, rows } = parseCsv(text);
  const mapping = autoMapHeaders(headers);
  const existingKeys = buildExistingKeys(sessions);
  const seenImportKeys = new Set();

  const previewRows = rows.map((cells, index) => {
    const record = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] ?? ""]));
    const normalized = normalizeImportRecord(record, mapping);
    const duplicateExisting = existingKeys.has(normalized.dedupeKey);
    const duplicateImport = seenImportKeys.has(normalized.dedupeKey);
    seenImportKeys.add(normalized.dedupeKey);

    return {
      index: index + 1,
      record,
      payload: normalized.payload,
      missing: normalized.missing,
      duplicateExisting,
      duplicateImport,
      ready: normalized.missing.length === 0 && !duplicateExisting && !duplicateImport,
    };
  });

  return {
    headers,
    mapping,
    rows: previewRows,
    summary: {
      total: previewRows.length,
      ready: previewRows.filter((row) => row.ready).length,
      duplicates: previewRows.filter((row) => row.duplicateExisting || row.duplicateImport).length,
      invalid: previewRows.filter((row) => row.missing.length > 0).length,
    },
  };
}
